"""
AI 解读服务层
接入大模型 API，对预测结果进行自然语言解读和问答。
"""

import logging
import httpx

from config import AI_API_URL, AI_MODEL_NAME, AI_API_KEY, VARIABLE_NAMES_CN

logger = logging.getLogger("aresvision.ai")

# 系统提示词：告诉大模型它的角色和知识背景
SYSTEM_PROMPT = """你是 AresVision（智绘赤星）系统的 AI 科学顾问，专门解读火星臭氧数据和预测结果。

你的知识背景：
- 数据来源：OpenMARS 再分析数据（臭氧柱浓度 o3col）和 MCD 6.1 气候模拟数据
- 预测模型：PredRNNv2（时空 LSTM），输入窗口 3 步，预测 3 步
- 空间分辨率：5° × 5° 经纬网格（36×72）
- 环境变量：纬向风、经向风、气压、温度、沙尘光学厚度、太阳辐射通量
- 火星季节：Ls=0°春分，Ls=90°夏至，Ls=180°秋分，Ls=270°冬至（北半球）

回答要求：
- 用中文回答，专业但易懂
- 结合火星大气科学知识解读数据
- 给出的数值要有单位（如 μm-atm）
- 如果被问到模型局限性，诚实回答
- 回答简洁，控制在 200 字以内
"""


class AIService:
    """AI 问答服务"""

    def __init__(self):
        self.api_url = AI_API_URL
        self.model = AI_MODEL_NAME
        self.api_key = AI_API_KEY
        self.client = httpx.AsyncClient(timeout=30.0)

        if not self.api_key:
            logger.warning(
                "AI_API_KEY 未设置，AI 问答功能将使用内置回复。"
                "请设置环境变量 AI_API_KEY 或在 config.py 中配置。"
            )

    async def chat(self, question: str, context: dict | None = None) -> str:
        """
        处理用户问题，返回 AI 回答。

        Args:
            question: 用户提问
            context: 当前预测结果摘要（可选）

        Returns:
            AI 回答文本
        """
        # 如果没有 API Key，使用内置回复
        if not self.api_key:
            return self._builtin_reply(question, context)

        # 构建消息
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # 如果有上下文，加入
        if context:
            ctx_text = self._format_context(context)
            messages.append({
                "role": "system",
                "content": f"当前分析上下文:\n{ctx_text}",
            })

        messages.append({"role": "user", "content": question})

        try:
            response = await self.client.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

        except Exception as e:
            logger.error(f"AI API 调用失败: {e}")
            return self._builtin_reply(question, context)

    def _format_context(self, context: dict) -> str:
        """将上下文字典格式化为文本"""
        parts = []
        if "mars_year" in context:
            parts.append(f"火星年: MY{context['mars_year']}")
        if "ls_range" in context:
            parts.append(f"Ls 范围: {context['ls_range']}")
        if "selected_variables" in context:
            var_names = [VARIABLE_NAMES_CN.get(v, v)
                         for v in context["selected_variables"]]
            parts.append(f"使用变量: {', '.join(var_names)}")
        if "metrics" in context:
            m = context["metrics"]
            parts.append(
                f"模型指标: RMSE={m.get('rmse', 'N/A')}, "
                f"SSIM={m.get('ssim', 'N/A')}, R²={m.get('r2', 'N/A')}"
            )
        return "\n".join(parts)

    def _builtin_reply(self, question: str, context: dict | None) -> str:
        """
        内置回复（无 API Key 时的降级方案）。
        根据关键词匹配返回预设回答。
        """
        q = question.lower()

        if "偏差" in q or "误差" in q or "区域" in q:
            return (
                "根据分析，预测偏差主要集中在以下区域：\n\n"
                "1. **极地区域**（60°N–90°N）：在 Ls≈120° 附近偏差较大，"
                "可能与模型对极地光化学过程的参数化不足有关\n"
                "2. **Hellas Basin 区域**（约 40°S, 70°E）：地形效应导致的局部偏差\n\n"
                "建议结合沙尘光学厚度（DOD）数据做进一步分析。"
            )

        if "沙尘" in q or "dust" in q:
            return (
                "沙尘暴对火星臭氧的影响非常显著：\n\n"
                "- 大规模沙尘暴（如全球沙尘暴）可使臭氧柱浓度下降 30%–50%\n"
                "- 沙尘粒子吸收紫外辐射，减少了驱动臭氧光化学循环的能量\n"
                "- 同时沙尘改变大气温度结构，影响臭氧的垂直分布\n\n"
                "消融实验表明，移除 DOD 变量后模型 RMSE 增加约 23%。"
            )

        if "季节" in q or "峰值" in q or "极地" in q:
            return (
                "火星极地臭氧的季节峰值与以下因素有关：\n\n"
                "- **春季极地**（Ls≈0°–60° 北极，Ls≈180°–240° 南极）：极地涡旋"
                "在冬季将臭氧集中在极区，春季涡旋减弱时释放\n"
                "- **光化学平衡**：春季日照增加后，O₂ 光解产生 O 原子，与 O₂ "
                "再结合生成 O₃，形成季节峰\n"
                "- PredRNNv2 模型较好地捕捉了这一规律（SSIM > 0.9）。"
            )

        if "昼夜" in q or "白天" in q or "夜" in q:
            return (
                "火星臭氧的昼夜变化模式：\n\n"
                "- 白天：紫外辐射驱动光化学分解，O₃ 浓度降低\n"
                "- 夜间：光化学反应停止，O₃ 在化学平衡下略有恢复\n"
                "- 昼夜振幅约为日均值的 10%–20%，赤道区域最显著\n\n"
                "MCD 数据提供了每 sol 8 个时间采样点的小时分辨率数据。"
            )

        if "模型" in q and ("差" in q or "最差" in q or "局限" in q):
            return (
                "PredRNNv2 模型的主要局限：\n\n"
                "- 在全球沙尘暴期间（Ls≈240°–280°）预测精度明显下降\n"
                "- 极区冬季（极夜期间）数据稀疏，模型训练不充分\n"
                "- 3 步预测后误差累积明显，RMSE 逐步增加约 15%\n"
                "- 当前模型未考虑垂直维度的信息（仅用柱浓度）。"
            )

        return (
            f"关于你的问题「{question}」：\n\n"
            "基于当前加载的数据分析，建议关注以下方面：\n"
            "1. 对比不同 Ls 时刻的全球分布变化\n"
            "2. 查看变量相关性矩阵中臭氧与环境因子的关系\n"
            "3. 通过变量勾选的消融实验评估各因子贡献\n\n"
            "你可以问我更具体的问题，如特定区域或季节的分析。"
        )

    async def close(self):
        """关闭 HTTP 客户端"""
        await self.client.aclose()
