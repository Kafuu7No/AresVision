"""
AI 解读服务层
接入大模型 API，对预测结果进行自然语言解读和问答。
"""

from __future__ import annotations

import logging
import re
from typing import Any, Iterable

import httpx

from config import AI_API_KEY, AI_API_URL, AI_MODEL_NAME, VARIABLE_NAMES_CN

logger = logging.getLogger("aresvision.ai")

SYSTEM_PROMPT = """你是 AresVision（智绘赤星）系统的 AI 科学顾问，专门解读火星臭氧数据和预测结果。

请遵守：
1. 使用中文回答，专业但易懂。
2. 结合上下文中的火星年、Ls、变量和指标进行解释。
3. 如果包含数值，请标注单位或说明其含义。
4. 当上下文不足时，明确说明不确定性并给出下一步建议。
5. 默认回答控制在 120-260 字；用户要求详细时再展开。
"""


PLAIN_TEXT_PROMPT = (
    "Reply in plain text only. Do not use Markdown markers such as #, *, `, >, -, or list bullets."
)


class AIService:
    """AI 问答服务。"""

    def __init__(self) -> None:
        self.api_url = AI_API_URL
        self.model = AI_MODEL_NAME
        self.api_key = AI_API_KEY
        self.client = httpx.AsyncClient(timeout=60.0)

        if not self.api_key:
            logger.warning("AI_API_KEY 未配置，将使用内置兜底回复。")

    async def chat(
        self,
        question: str,
        context: dict | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        """处理用户问题，返回 AI 回答。"""
        question = (question or "").strip()
        if not question:
            return "请先输入一个具体问题，例如“本次预测误差最大的区域在哪里？”"

        if not self.api_key:
            return self._normalize_plain_text(self._builtin_reply(question, context))

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": PLAIN_TEXT_PROMPT},
        ]

        if context:
            messages.append(
                {
                    "role": "system",
                    "content": f"当前分析上下文：\n{self._format_context(context)}",
                }
            )

        sanitized_history = self._sanitize_history(history)
        if sanitized_history:
            messages.extend(sanitized_history)

        messages.append({"role": "user", "content": question})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.3,
        }

        try:
            response = await self.client.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            answer = self._extract_answer_text(data)
            if answer:
                return self._normalize_plain_text(answer)

            logger.warning("AI API returned empty content, fallback to builtin reply")
            return self._normalize_plain_text(self._builtin_reply(question, context))
        except Exception as e:
            logger.error("AI API 调用失败: %s", e)
            return self._normalize_plain_text(self._builtin_reply(question, context))

    def _sanitize_history(
        self,
        history: Iterable[dict[str, str]] | None,
    ) -> list[dict[str, str]]:
        if not history:
            return []

        cleaned: list[dict[str, str]] = []
        for item in history:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).strip()
            content = str(item.get("content", "")).strip()
            if role not in {"user", "assistant"}:
                continue
            if not content:
                continue
            cleaned.append({"role": role, "content": content[:2000]})

        return cleaned[-8:]

    def _format_context(self, context: dict[str, Any], max_chars: int = 5200) -> str:
        parts: list[str] = []

        if "mars_year" in context:
            parts.append(f"火星年: MY{context['mars_year']}")
        if "ls_range" in context:
            parts.append(f"Ls 范围: {context['ls_range']}")
        if "selected_variables" in context and isinstance(context["selected_variables"], list):
            var_names = [VARIABLE_NAMES_CN.get(v, v) for v in context["selected_variables"]]
            parts.append(f"使用变量: {', '.join(var_names)}")
        if "metrics" in context and isinstance(context["metrics"], dict):
            m = context["metrics"]
            parts.append(
                "模型指标: "
                f"RMSE={m.get('rmse', 'N/A')}, "
                f"MAE={m.get('mae', 'N/A')}, "
                f"R²={m.get('r2', 'N/A')}, "
                f"SSIM={m.get('ssim', 'N/A')}"
            )
        if "dynamic_metrics" in context and context["dynamic_metrics"]:
            metrics = str(context["dynamic_metrics"])
            if len(metrics) > 2800:
                metrics = metrics[:2800] + "\n...[TRUNCATED]"
            parts.append(f"动态指标快照:\n{metrics}")

        text = "\n".join(parts).strip()
        if len(text) > max_chars:
            return text[:max_chars] + "\n...[TRUNCATED]"
        return text

    def _extract_answer_text(self, data: dict[str, Any]) -> str:
        """兼容常见 OpenAI-compatible 响应结构。"""
        if not isinstance(data, dict):
            return ""

        choices = data.get("choices")
        if isinstance(choices, list):
            for choice in choices:
                if not isinstance(choice, dict):
                    continue
                message = choice.get("message")
                if isinstance(message, dict):
                    text = self._extract_text_from_content(message.get("content"))
                    if text:
                        return text
                text = self._extract_text_from_content(choice.get("text"))
                if text:
                    return text

        output_text = self._extract_text_from_content(data.get("output_text"))
        if output_text:
            return output_text

        return ""

    def _extract_text_from_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, str) and item.strip():
                    chunks.append(item.strip())
                    continue
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        chunks.append(text.strip())
            return "\n".join(chunks).strip()
        return ""

    def _normalize_plain_text(self, text: str) -> str:
        if not isinstance(text, str):
            return ""

        normalized = text.replace("\r\n", "\n")
        normalized = re.sub(r"^\s*```[\w-]*\s*$", "", normalized, flags=re.MULTILINE)
        normalized = re.sub(r"^\s*>\s?", "", normalized, flags=re.MULTILINE)
        normalized = re.sub(r"^\s*#{1,6}\s*", "", normalized, flags=re.MULTILINE)
        normalized = re.sub(r"^\s*(?:[-*+]|\d+\.)\s+", "", normalized, flags=re.MULTILINE)
        normalized = re.sub(r"^\s*[-*_]{3,}\s*$", "", normalized, flags=re.MULTILINE)
        normalized = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r"\1", normalized)
        normalized = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", normalized)
        normalized = re.sub(r"`{1,3}([^`]+)`{1,3}", r"\1", normalized)
        normalized = normalized.replace("**", "").replace("__", "").replace("~~", "")
        normalized = normalized.replace("*", "").replace("`", "")
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    def _builtin_reply(self, question: str, context: dict | None) -> str:
        """无 API Key 或外部调用失败时的兜底回复。"""
        q = question.lower()

        if "偏差" in q or "误差" in q:
            return "从模型评估经验看，极区与强沙尘活动区通常更容易出现偏差。建议优先对比该区域的 RMSE 与 MAE，并结合 Ls 阶段判断是否存在季节性误差放大。"
        if "沙尘" in q or "dust" in q:
            return "沙尘会通过辐射加热与光化学链路共同影响臭氧分布，常见现象是局地臭氧浓度下降且空间梯度增大。建议结合 Dust Optical Depth 与温度场联动查看。"
        if "极地" in q or "季节" in q:
            return "极地臭氧季节峰值通常与极夜后太阳辐射恢复、环流输送重组有关。建议对比 Ls 关键节点（约 0/90/180/270°）的纬向剖面变化。"

        if context and context.get("metrics"):
            metrics = context["metrics"]
            return (
                f"已读取当前预测上下文。模型指标约为 RMSE={metrics.get('rmse', 'N/A')}、"
                f"MAE={metrics.get('mae', 'N/A')}、R²={metrics.get('r2', 'N/A')}。"
                "你可以继续问“误差最大的纬度带在哪里”或“某个变量是否主导当前偏差”。"
            )

        return "目前缺少可用上下文。建议先在“预测分析”页面运行一次预测，再返回 AI 解读页提问，这样我可以给出更针对性的结果解释。"

    async def close(self) -> None:
        """关闭 HTTP 客户端。"""
        await self.client.aclose()
