# AresVision 智绘赤星

> Mars Ozone Column Prediction & Visualization System

基于 PredRNNv2 深度学习框架的火星臭氧柱浓度预测与可视化系统。系统融合 OpenMARS 再分析数据与 MCD 6.1 气候模拟数据，实现火星大气臭氧的时空序列预测与多维交互可视化。

<!-- 项目截图（待补充） -->
<!-- ![首页截图](docs/screenshots/home.png) -->
<!-- ![数据探索](docs/screenshots/explore.png) -->

## 核心功能

- **3D 火星可视化** — Three.js 实时渲染火星球体，带光照与自转动画
- **多维数据探索** — Ls-纬度热力图、纬度带季节曲线、环境变量分布、相关性矩阵
- **时空序列预测** — PredRNNv2 模型支持多变量输入，3 步滑窗预测未来 3 步臭氧分布
- **消融实验** — 动态通道掩码，量化评估各环境变量对预测精度的贡献
- **AI 智能解读** — 大模型驱动的自然语言问答，辅助分析预测结果

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · Vite 6 · Three.js · Tailwind CSS · Recharts |
| **后端** | FastAPI · Uvicorn · Pydantic · ORJSON |
| **数据处理** | NumPy · SciPy · xarray · netCDF4 |
| **深度学习** | PyTorch · PredRNNv2（时空 LSTM） |
| **评估指标** | scikit-learn · scikit-image（SSIM） |
| **数据来源** | OpenMARS 再分析数据集 · MCD 6.1 火星气候数据库 |

## 项目结构

```
AresVision/
├── AresVision_backend/
│   └── backend/
│       ├── main.py                 # FastAPI 入口，lifespan 预加载
│       ├── config.py               # 全局配置常量
│       ├── requirements.txt        # Python 依赖
│       ├── core/
│       │   ├── predrnn_v2.py       # PredRNNv2 模型实现
│       │   └── data_align.py       # MCD-OpenMARS 数据对齐
│       ├── services/
│       │   ├── data_service.py     # 数据加载与查询服务
│       │   ├── predict_service.py  # 模型推理与缓存服务
│       │   └── ai_service.py       # AI 问答服务
│       ├── routers/
│       │   ├── explore.py          # 数据探索 API
│       │   ├── predict.py          # 预测分析 API
│       │   └── ai.py               # AI 问答 API
│       ├── schemas/                # Pydantic 请求/响应模型
│       ├── data/
│       │   ├── openmars/           # OpenMARS .nc 文件（臭氧数据）
│       │   └── mcd/                # MCD .nc 文件（环境变量）
│       └── models/
│           └── predrnnv2/          # 模型权重 .pt 文件
├── frontend/
│   ├── index.html                  # 入口 HTML
│   ├── package.json                # 前端依赖
│   ├── vite.config.js              # Vite 配置（含 API 代理）
│   ├── public/
│   │   └── mars_texture.jpg        # 火星球体纹理贴图
│   └── src/
│       ├── main.jsx                # React 入口
│       ├── App.jsx                 # 根组件（页面路由 + 转场动画）
│       ├── index.css               # 全局样式与关键帧动画
│       ├── constants/colors.js     # 设计系统色彩常量
│       ├── services/api.js         # 后端 API 调用封装
│       ├── components/
│       │   ├── Mars3DPlaceholder.jsx  # Three.js 火星球体
│       │   ├── StarField.jsx          # 星空粒子背景
│       │   ├── Navbar.jsx             # 导航栏
│       │   ├── GlowCard.jsx           # 发光卡片组件
│       │   ├── SectionTitle.jsx       # 章节标题
│       │   └── ChartPlaceholder.jsx   # 图表占位组件
│       └── pages/
│           ├── HomePage.jsx        # 首页（3D 火星 + 功能概览）
│           ├── ExplorePage.jsx     # 数据探索（热力图、曲线、相关性）
│           ├── PredictPage.jsx     # 预测分析（推理、指标、消融）
│           ├── AIPage.jsx          # AI 智能问答
│           └── AboutPage.jsx       # 关于页面
└── CLAUDE.md                       # Claude Code 开发指引
```

## 快速启动

### 环境要求

- Python 3.10+
- Node.js 18+
- PyTorch 2.x（需单独安装，CPU 或 GPU 版本均可）

### 1. 启动后端

```bash
cd AresVision_backend/backend

# 安装 Python 依赖
pip install -r requirements.txt

# 单独安装 PyTorch（CPU 版示例）
pip install torch==2.5.1

# 启动开发服务器（默认端口 8000）
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

启动后可访问 http://localhost:8000/docs 查看 API 文档。

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动 Vite 开发服务器（默认端口 5173）
npm run dev
```

访问 http://localhost:5173 即可使用系统。Vite 开发服务器已配置 `/api` 代理至后端 8000 端口。

### 3. 配置 AI 问答（可选）

设置环境变量以启用大模型驱动的智能问答：

```bash
export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_MODEL_NAME="gpt-4o-mini"
export AI_API_KEY="your-api-key"
```

未配置 `AI_API_KEY` 时，AI 问答将使用内置的关键词匹配回复。

## 数据准备

系统启动时会从以下目录加载数据，请确保文件已就位：

| 目录 | 内容 | 文件命名规则 |
|------|------|-------------|
| `backend/data/openmars/` | OpenMARS 臭氧再分析数据 | `openmars_ozo_my{N}_ls*.nc` |
| `backend/data/mcd/` | MCD 6.1 环境变量数据 | `MCD_MY{N}_Lat-90-90_real.nc` |
| `backend/models/predrnnv2/` | PredRNNv2 模型权重 | `.pt` 或 `.pth` 文件 |

- 当前支持 Mars Year 27 和 28
- 网格分辨率：36 × 72（纬度 5°× 经度 5°）
- 模型输入 7 通道：O₃ + U/V 风速 + 气压 + 温度 + 沙尘光学厚度 + 太阳辐射通量

## API 接口概览

所有接口以 `/api` 为前缀，详细参数见 `/docs` 页面。

| 路由前缀 | 用途 |
|----------|------|
| `/api/explore/` | 数据探索 — 球面点云、Ls-纬度热力图、纬度带曲线、环境变量分布、相关性矩阵 |
| `/api/predict/` | 预测分析 — 模型推理、评估指标、消融实验、日变化分析 |
| `/api/ai/` | AI 问答 — 自然语言解读预测结果 |
| `/health` | 健康检查 |


