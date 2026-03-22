# AresVision 智绘赤星

> Mars Ozone Column Prediction & Visualization System

基于 PredRNNv2 深度学习框架的火星臭氧柱浓度预测与可视化系统。系统融合 OpenMARS 再分析数据与 MCD 6.1 气候模拟数据，实现火星大气臭氧的时空序列预测与多维交互可视化。

## 核心功能

- **3D 火星可视化** — React Globe GL 及 Three.js 驱动的实时渲染火星球体，带光照与自转动画。
- **多维数据探索** — 全球数据点云、Ls-纬度热力图、纬度带季节曲线、环境变量分布及相关性矩阵分析。
- **时空序列预测** — PredRNNv2 深度学习模型，以 **3 步滑窗数据作为输入，预测未来 3 步**的大气臭氧分布。
- **全景预测画幅与界面** — 支持核心分析工作流，提供三联画（Triptych）平行对比与全屏 HUD 沉浸式模式；通过集成融合（Ensemble Fusion）可视化不同模型结果的一致性。
- **性能曲线动态评估** — 提供在测试集上的动态性能折线图，展示在不同太阳黄经（Ls）下的 $R^2$ 评分细微波动。
- **特征贡献归因（SHAP）** — 内置全屏 Shapley 贡献图和流式可视化（Waterfall），客观量化各气候变量（如温度、风速等）对不同预测指标（如 $R^2$、RMSE 等）的实际贡献度。
- **用户体系与众包数据系统** — 配备了基于 JWT 的用户认证机制，支持用户的注册与登录；提供 NC 格式数据的上传、自动化校验与公共贡献投递功能。
- **AI 智能交互探照** — 内嵌大语言模型，通过自然语言对话深入解析预测视图及其背后的气候运作机制。

## 技术栈

| 领域 | 框架与工具集群 |
|------|------|
| **前端体系** | React 19 · Vite 6 · Three.js · React-Globe.gl · Tailwind CSS · Material UI · Plotly.js · MediaPipe (手势交互预留) |
| **后端支撑** | FastAPI · Uvicorn · Pydantic · SQLAlchemy · PyJWT |
| **数据科学** | NumPy · SciPy · xarray · netCDF4 |
| **深度网络** | PyTorch · PredRNNv2 时空循环神经网络 |
| **评测基准** | scikit-learn · scikit-image (SSIM 计算) · SHAP 归因解析 |
| **数据底座** | OpenMARS 再分析数据集 · MCD 6.1 火星气候数据库 |

## 项目结构

```text
AresVision/
├── AresVision_backend/
│   └── backend/
│       ├── main.py                 # FastAPI 应用入口与组件组装
│       ├── config.py               # 项目系统级别核心配置常量
│       ├── database/               # 关系型数据库模型封装仓库
│       ├── auth/                   # JWT 用户验证与依赖分发服务
│       ├── core/
│       │   ├── predrnn_v2.py       # PredRNNv2 模型核心网络架构
│       │   └── data_align.py       # MCD-OpenMARS 地理空间数据流对齐
│       ├── services/               # 隔离的后端微服务逻辑群:
│       │   ├── auth_service.py     # 认证服务
│       │   ├── upload_service.py   # 数据上传及格式清洗检查处理
│       │   ├── predict_service.py  # 核心时空模型推理服务
│       │   ├── analysis_service.py # 探索性数据关联分析封装
│       │   └── ai_service.py       # GPT 等大规模语言模型代理
│       ├── routers/
│       │   ├── auth.py             # 认证 REST API (/api/auth)
│       │   ├── upload.py           # 数据采集及贡献 REST API (/api/upload)
│       │   ├── explore.py          # 数据集探索接口 (/api/explore)
│       │   ├── predict.py          # 模型推理与 SHAP 分析接口 (/api/predict)
│       │   └── ai.py               # 智能客服路由 (/api/ai)
│       ├── data/                   # 本地上游基准气象数据集存放处
│       └── models/                 # PyTorch 模型权重存放处
├── frontend/
│   ├── package.json                # 前端工程依赖与 Vite 指令
│   ├── vite.config.js              # Vite 热重载及 /api 多路代理
│   └── src/
│       ├── components/             # 原子化无状态 UI 组件（如星空背景、发光卡片等）
│       ├── pages/                  # 重装载页面逻辑：
│       │   ├── PredictPage/        # 预测页面聚合组件群：
│       │   │   ├── PredictSidebar.jsx        # 侧边栏配置面板
│       │   │   ├── PredictDisplay.jsx        # 预测核心视区容器 (支持三联画)
│       │   │   ├── PredictFullscreenHUD.jsx  # 沉浸式全屏数据监测头戴显示视图
│       │   │   ├── PredictMetrics.jsx        # 实时评测指标标尺卡片
│       │   │   ├── PredictPerformance.jsx    # 测试集环境 Ls - R² 曲线追踪
│       │   │   └── ShapleyImportanceChart.jsx# 核心特征 SHAP 贡献解绑分析视图
│       │   └── ...                 # 探索页, AI页, Overview页等
│       └── constants/colors.js     # 暗黑系深空设计系统 Token
└── CLAUDE.md                       # AI Code 伴生开发协议
```

## 快速启动

### 基础环境
- Python 3.10+
- Node.js 18+  
- PyTorch 2.x

### 1. 启动后端

```bash
cd AresVision_backend/backend

# 虚拟环境配置并安装包
pip install -r requirements.txt

# 若需独立选择 PyTorch（例如 GPU版）：
# pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# 初始化服务并侦听于 8000
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
启动完成可见 [Swagger API 文档](http://localhost:8000/docs)

### 2. 启动前端

```bash
cd frontend

# 本地依赖初始化
npm install

# 唤起 Vite 研发服务器（端口5173，自动挂载 /api proxy）
npm run dev
```
开启任意现代浏览器存取 `http://localhost:5173`。

### 3. 环境与模型配置补全

1. **AI 预设**（可选）：
```bash
export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_MODEL_NAME="gpt-4o-mini"
export AI_API_KEY="your-api-key"
```

2. **气象基建数据要求** (`backend/data/` 目录)：
| 目录 | 标定内容 | 扫描适配规则 |
|------|------|-------------|
| `openmars/` | 再分析全局臭氧沉降 | `openmars_ozo_my{N}_ls*.nc` |
| `mcd/` | MCD 6.1 环境协同场 | `MCD_MY{N}_Lat-90-90_real.nc` |
| `models/predrnnv2/` | 迭代权重结晶 | `.pt` 或 `.pth` （输入通道必须配齐 7 维） |
输入模型将对 `O₃、Wind(U/V)、Pressure、Temperature、Dust Opacity、Solar Flux` 等 7 通道执行时空图谱扫描。

## 完整 API 体系概览

所有节点以 `/api` 挂载执行：

| 路由切片 | 服务解析向径 |
|----------|------|
| **`/api/auth/`** | 认证中枢：`/register` (新用户接入), `/login` (Token 派发), `/me` (状态刷新) |
| **`/api/upload/`** | 众包数据仓：`/nc` (结构与时段自检入库), `/my-uploads` (个人盘古迹), `/{id}/contribute` (提审贡献) |
| **`/api/explore/`**| 数据探照针：`/globe` (3D点云), `/seasonal-heatmap`, `/env-heatmap`, `/correlation` |
| **`/api/predict/`**| 推理机内核：`/run` (单步前演), `/metrics` (即时打分), `/ablation` (消融), `/performance` (R²曲线), `/shapley` (归因) |
| **`/api/ai/`**     | 自然语言网关 |
| **`/health`**      | 活性保持监测 |
