# AresVision 智绘赤星

<div align="center">
  <img src="./assets/images/logo.png" width="200" alt="AresVision Logo" />
  <p align="center">
    <strong>Mars Ozone Column Prediction & Visualization System</strong><br />
    基于深度学习的火星臭氧柱浓度预测与多维交互可视化平台
  </p>

  [![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://www.python.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
</div>

---

## 🌟 项目简介

**AresVision (智绘赤星)** 是一个融合前沿深度学习技术与 3D 可视化交互的火星气象研究系统。系统以 PredRNNv2 时空卷积神经网络为核心，通过集成 OpenMARS 再分析数据与 MCD 6.1 气候模拟数据，实现了对火星大气臭氧的时空演化高精度预测，并提供了沉浸式的科研级可视化工作流。

## 🚀 核心功能

### 1. 🪐 沉浸式 3D 火星可视化
- **实时球体渲染**：基于 React Globe GL 与 Three.js 驱动，支持光照模拟、自转动画与多图层覆盖。
- **全屏 HUD 模式**：提供类似于头戴显示器（HUD）的沉浸式数据监控视图，实时展示火星全球背景。

### 2. 🔮 时空序列预测系统
- **PredRNNv2 框架**：采用 3 步滑窗输入，预测未来 3 个步长的大气臭氧时空演变。
- **三联画对比 (Triptych Display)**：支持核心分析、地面真值与预测结果的平行对比，直观评估模型效能。
- **Shapley 贡献归因 (SHAP)**：内置特征重要性分析，量化温度、风速等 7 个主要气候变量对预测结果的实际贡献。

### 3. 🧠 自定义模型训练平台 (New)
- **云端训练实验室**：支持用户自定义超参数（Epochs, Learning Rate, Hidden Dims, STLSTM Layers）在线开启训练任务。
- **实时监控流**：提供动态 Loss 演化曲线图及详细的训练进度日志，支持任务的实时终止与持久化管理。
- **消融实验支持**：支持选择不同的输入通道组合进行模型性能验证。

### 4. 📊 多维数据科学探照
- **多维分析看板**：包括点云视图、Ls-纬度热力图、纬度带季节曲线及环境变量相关性矩阵。
- **动态性能矩阵**：自动生成验证集/测试集在不同太阳黄经（Ls）下的 $R^2$、RMSE 等性能指标。

### 5. 🤝 用户贡献与社区系统
- **众包数据接入**：支持 NC 格式气象数据的上传，内置自动化数据对齐与格式校验逻辑。
- **通知与反馈**：集成的实时通知中枢，用于展示训练任务状态、数据审核进度及系统反馈建议。

### 6. 🤖 AI 智能气象解读
- **深度解析助手**：结合大语言模型，通过自然语言对话深入解析复杂的火星气候机制与预测视图。

## 🛠️ 技术栈

| 领域 | 核心技术 | 说明 |
| :--- | :--- | :--- |
| **前端** | React 19 / Vite / Three.js / MUI / Plotly | 高交互、响应式科研界面 |
| **后端** | FastAPI / Uvicorn / SQLAlchemy / Pydantic | 高性能异步 API 中枢 |
| **AI/ML** | PyTorch / PredRNNv2 / SHAP / Scikit-learn | 时空预测与归因分析 |
| **数据** | xarray / netCDF4 / NumPy / SciPy | 专业气象数据处理 |
| **数据库** | SQLite / PostgreSQL (支持扩展) | 用户、任务、贡献数据持久化 |

## 📂 项目结构

```text
AresVision/
├── AresVision_backend/      # 后端逻辑
│   └── backend/
│       ├── core/            # PredRNNv2 模型架构与数据变换 (Transforms)
│       ├── routers/         # API 路由 (Analysis, Predict, AI, Auth, Training, etc.)
│       ├── services/        # 核心业务逻辑 (Predict Orchestrator, AI Service)
│       ├── database/        # 数据库模型与迁移
│       ├── data/            # 本地气象数据集存放 (OpenMARS/MCD)
│       └── models/          # 训练好的模型权重 (.pt)
├── frontend/                # 前端工程
│   ├── src/
│   │   ├── components/      # 复用 UI 组件 (Chart, HUD, Table)
│   │   ├── pages/           # 功能页面 (Predict, Training, Explore, Overview)
│   │   ├── i18n/            # 国际化支持 (中/英)
│   │   └── contexts/        # 全局状态管理 (Auth, Settings, Training)
└── assets/                  # 静态资源 (Logo, Docs Images)
```

## 🏁 快速启动

### 1. 环境准备
- **Node.js**: v18.0+
- **Python**: v3.10+
- **GPU (可选)**: 建议使用支持 CUDA 的显卡以提升训练速度。

### 2. 后端部署
```bash
cd AresVision_backend/backend
# 安装依赖
pip install -r requirements.txt
# 配置环境变量 (AI API, etc.)
cp .env.example .env  # 需自行根据需求填充
# 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 前端部署
```bash
cd frontend
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```
访问 `http://localhost:5173` 即可开启探索。

## 📜 环境变量说明

在 `backend/.env` 中可配置以下关键项：
- `AI_API_KEY`: 连接 AI 助手所需的 API Key。
- `DATABASE_URL`: 数据库连接字符串（默认使用 SQLite）。
- `JWT_SECRET`: 用户认证加密密钥。

---

## 📅 路线图
- [ ] 开发集成实时卫星遥感数据流接口。
- [ ] 增加 VR 模式以实现更真实的火星表面漫游。
- [ ] 优化 PredRNNv3 模型以支持更长周期的预测。

## 🤝 参与贡献
欢迎通过 Pull Requests 或 Issues 为项目贡献代码或建议。在提交 PR 前，请确保已阅读并遵守项目的开发规范。

## 📄 开源协议
本项目采用 [MIT License](LICENSE) 协议。

---
<p align="center">
  由 <strong>AresVision 开发团队</strong> 倾力打造 | 探索赤星，智绘未来
</p>
