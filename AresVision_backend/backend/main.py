"""
AresVision 后端入口
- 启动时预加载数据和模型（lifespan）
- 注册所有 API 路由
- 配置 CORS（允许前端跨域）
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from config import API_PREFIX
from services.data_service import DataService
from services.predict_service import PredictService
from services.ai_service import AIService
from routers import explore, predict, ai

# ─── 日志配置 ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("aresvision")


# ─── 生命周期：启动时预加载，关闭时清理 ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan 事件：
    - 启动时：读取 nc 数据到内存 + 加载 PyTorch 模型
    - 关闭时：释放资源
    """
    logger.info("=" * 60)
    logger.info("  AresVision 后端启动中...")
    logger.info("=" * 60)

    t0 = time.time()

    # 1. 加载数据
    logger.info("[1/3] 加载 OpenMARS & MCD 数据...")
    data_service = DataService()
    app.state.data_service = data_service

    # 2. 加载预测模型
    logger.info("[2/3] 加载 PredRNNv2 模型...")
    predict_service = PredictService(data_service)
    app.state.predict_service = predict_service

    # 3. 初始化 AI 服务
    logger.info("[3/3] 初始化 AI 解读服务...")
    ai_service = AIService()
    app.state.ai_service = ai_service

    elapsed = time.time() - t0
    logger.info("=" * 60)
    logger.info(f"  启动完成! 耗时 {elapsed:.1f}s")
    logger.info(f"  数据: {data_service.get_available_years()}")
    logger.info(f"  设备: {predict_service.device}")
    logger.info(f"  API 文档: http://localhost:8000/docs")
    logger.info("=" * 60)

    yield  # ← 应用运行中

    # 关闭时清理
    logger.info("正在关闭服务...")
    await ai_service.close()


# ─── 创建 FastAPI 应用 ───

app = FastAPI(
    title="AresVision API",
    description="智绘赤星 — 火星臭氧预测与可视化系统后端",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,  # 更快的 JSON 序列化
)

# ─── CORS 中间件（允许前端 localhost:5173 访问） ───

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite 开发服务器
        "http://localhost:3000",    # 备用端口
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 注册路由 ───

app.include_router(explore.router, prefix=API_PREFIX)
app.include_router(predict.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)


# ─── 健康检查 ───

@app.get("/")
async def root():
    return {
        "name": "AresVision API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
