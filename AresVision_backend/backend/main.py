"""
AresVision 后端入口
- 启动时预加载数据和模型（lifespan）
- 注册所有 API 路由
- 配置 CORS（允许前端跨域）
"""

import logging
import os
import time
import sys
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

# Windows 下异步子进程必须使用 ProactorEventLoop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, FileResponse

from config import API_PREFIX, USER_UPLOADS_DIR, PENDING_REVIEW_DIR
from database.init_db import init_database
from database.engine import async_session_maker
from services.data_service import DataService
from services.analysis_service import AnalysisService
from services.predict_data_service import PredictDataService
from services.predict_service import PredictOrchestratorService
from services.ai_service import AIService
from services.copilot_service import CopilotService
from services.upload_service import UploadService
from services.user_data_service import UserDataService
from services.personal_data_source_service import PersonalDataSourceService
from services.data_governance_service import DataGovernanceService
from core.analysis_transforms import AnalysisTransforms
from core.predict_transforms import PredictTransforms
from core.predict_inference import PredictInference
from routers import analysis, predict, ai, copilot
from routers import auth
from routers import upload as upload_router_module
from routers import governance as governance_router_module
from routers import notification as notification_router_module
from routers import user_data as user_data_router_module
from routers import feedback as feedback_router_module
from routers import training as training_router_module

# ─── 日志配置 ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("aresvision")


def _resolve_frontend_dist_dir() -> Path | None:
    """
    Resolve frontend dist directory for single-process deployment.
    Priority:
    1) ARESVISION_FRONTEND_DIST env
    2) <backend>/frontend_dist           (portable package layout)
    3) <repo>/frontend/dist              (local dev/release build)
    """
    candidates: list[Path] = []
    env_dir = os.getenv("ARESVISION_FRONTEND_DIST", "").strip()
    if env_dir:
        candidates.append(Path(env_dir))

    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent.parent
    candidates.append(backend_dir / "frontend_dist")
    candidates.append(repo_root / "frontend" / "dist")

    for candidate in candidates:
        try:
            resolved = candidate.expanduser().resolve()
        except OSError:
            continue
        if (resolved / "index.html").is_file():
            logger.info(f"检测到前端静态资源目录: {resolved}")
            return resolved
    logger.info("未检测到前端静态资源目录，后端以 API-only 模式运行")
    return None


FRONTEND_DIST_DIR = _resolve_frontend_dist_dir()


# ─── 生命周期：启动时预加载，关闭时清理 ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan 事件：
    - 启动时：读取 nc 数据到内存 + 加载 PyTorch 模型
    - 关闭时：释放资源
    """
    logger.info("=" * 60)
    logger.info("  AresVision 后端启动中 (已重构架构)...")
    logger.info("=" * 60)

    t0 = time.time()

    # 0. 数据库初始化（建表 + 默认管理员账号）
    logger.info("[0/5] 初始化数据库...")
    await init_database()
    app.state.db_session = async_session_maker

    # 确保上传目录存在
    USER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    # 1. 基础服务：数据加载
    logger.info("[1/5] 初始化基础数据加载服务...")
    data_service = DataService()
    app.state.data_service = data_service

    # 上传服务（依赖 data_service）
    upload_service = UploadService(data_service)
    app.state.upload_service = upload_service

    # 用户数据服务（按需读取用户上传的 .nc 文件）
    user_data_service = UserDataService()
    app.state.user_data_service = user_data_service

    # 数据源解析服务（默认/个人数据源切换 + 自动降级）
    personal_source_service = PersonalDataSourceService(data_service)
    app.state.personal_data_source_service = personal_source_service

    # 数据治理服务（资产总览 / 质量评分 / 血缘信息）
    data_governance_service = DataGovernanceService()
    app.state.data_governance_service = data_governance_service

    # 2. 领域服务：可视化与 ML 数据准备
    logger.info("[2/5] 初始化分析与 ML 准备服务...")
    analysis_service = AnalysisService(data_service)
    app.state.analysis_service = analysis_service

    predict_data_prep = PredictDataService(data_service)
    app.state.predict_data_prep = predict_data_prep

    # 3. 核心计算模型：预处理、推理模型
    logger.info("[3/5] 初始化预测模型计算流...")
    # 分析专用分量
    analysis_transforms = AnalysisTransforms(data_service)
    app.state.analysis_transforms = analysis_transforms
    
    # 预测专用分量 (严格遵循 demo3)
    predict_transforms = PredictTransforms(data_service)
    app.state.predict_transforms = predict_transforms

    predict_inference = PredictInference()
    app.state.predict_inference = predict_inference

    predict_orchestrator = PredictOrchestratorService(
        data_service=data_service,
        ml_data_prep=predict_data_prep,
        transforms=predict_transforms,
        inference=predict_inference,
    )
    app.state.predict_service = predict_orchestrator

    # 4. 初始化 AI 服务
    logger.info("[4/5] 初始化 AI 解读与 Copilot 服务...")
    ai_service = AIService()
    app.state.ai_service = ai_service
    copilot_service = CopilotService()
    app.state.copilot_service = copilot_service

    # 5. 后台预生成性能分析缓存 (不阻塞启动)
    # 默认关闭，避免在开发态(尤其 --reload)触发长时间计算与频繁文件写入导致接口卡顿。
    warmup_on_startup = os.getenv("ARESVISION_WARMUP_ON_STARTUP", "0").strip() == "1"
    if warmup_on_startup:
        logger.info("[5/5] 启动后台性能缓存预生成检查...")
        asyncio.create_task(predict_orchestrator.ensure_performance_caches())
    else:
        logger.info("[5/5] 跳过启动期性能缓存预生成 (ARESVISION_WARMUP_ON_STARTUP!=1)")

    elapsed = time.time() - t0
    logger.info("=" * 60)
    logger.info(f"  启动完成! 耗时 {elapsed:.1f}s")
    logger.info(f"  数据: {data_service.get_available_years()}")
    logger.info(f"  设备: {predict_inference.device}")
    logger.info(f"  API 文档: http://localhost:8000/docs")
    logger.info("=" * 60)

    yield  # ← 应用运行中

    # 关闭时清理
    logger.info("正在关闭服务...")
    await ai_service.close()
    await copilot_service.close()


# ─── 创建 FastAPI 应用 ───

app = FastAPI(
    title="AresVision API",
    description="智绘赤星 — 火星臭氧预测与可视化系统后端",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

# ─── CORS 中间件（允许前端 localhost:5173 访问） ───

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite 开发服务器
        "http://localhost:3000",    # 备用端口
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://ares-vision.xyz",   # 允许你的穿透域名
        "https://ares-vision.xyz",  # 如果开启了 HTTPS 也要加上
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 注册路由 ───

app.include_router(analysis.router,                  prefix=API_PREFIX)
app.include_router(predict.router,                   prefix=API_PREFIX)
app.include_router(ai.router,                        prefix=API_PREFIX)
app.include_router(copilot.router,                   prefix=API_PREFIX)
app.include_router(auth.router,                      prefix=API_PREFIX)
app.include_router(upload_router_module.router,        prefix=API_PREFIX)
app.include_router(governance_router_module.router,    prefix=API_PREFIX)
app.include_router(notification_router_module.router,  prefix=API_PREFIX)
app.include_router(user_data_router_module.router,     prefix=API_PREFIX)
app.include_router(feedback_router_module.router,      prefix=API_PREFIX)
app.include_router(training_router_module.router,        prefix=API_PREFIX)


# ─── 健康检查 ───

@app.get("/")
async def root():
    if FRONTEND_DIST_DIR is not None:
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
    return {
        "name": "AresVision API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if FRONTEND_DIST_DIR is not None:
    _RESERVED_PATHS = {"api", "docs", "redoc", "openapi.json", "health"}

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        normalized = (full_path or "").lstrip("/")
        if normalized in _RESERVED_PATHS or normalized.startswith("api/"):
            return ORJSONResponse({"detail": "Not Found"}, status_code=404)

        if not normalized:
            return FileResponse(FRONTEND_DIST_DIR / "index.html")

        candidate = (FRONTEND_DIST_DIR / normalized).resolve()
        try:
            candidate.relative_to(FRONTEND_DIST_DIR)
        except ValueError:
            return ORJSONResponse({"detail": "Not Found"}, status_code=404)

        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
