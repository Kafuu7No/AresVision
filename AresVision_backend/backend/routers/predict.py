"""
预测分析页 — API 路由
"""

from fastapi import APIRouter, HTTPException, Request, Query, Body

from schemas.predict import (
    PredictRequest, PredictResponse,
    EvalMetricsResponse, AblationResponse, DiurnalResponse,
)
from config import DEFAULT_MARS_YEAR, LATITUDE_BANDS

router = APIRouter(prefix="/predict", tags=["预测分析"])


def _get_predict_service(request: Request):
    return request.app.state.predict_service


def _get_data_service(request: Request):
    return request.app.state.data_service


# ─── 核心预测接口 ───

@router.post("/run", response_model=PredictResponse)
async def run_prediction(
    request: Request,
    body: PredictRequest = Body(...),
):
    """
    执行预测。
    前端传入勾选的变量列表 + 预测步长 + 起始 Ls。
    返回真值场、预测场、差值场。
    """
    try:
        ps = _get_predict_service(request)
        result = ps.predict(
            mars_year=body.mars_year,
            ls_start=body.ls_start,
            selected_variables=body.selected_variables,
            horizon=body.horizon,
        )
        return {
            "ground_truth": result["ground_truth"],
            "prediction": result["prediction"],
            "residual": result["residual"],
            "selected_variables": result["selected_variables"],
            "horizon": result["horizon"],
            "ls_values": result["ls_values"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测错误: {e}")


# ─── 评估指标 ───

@router.post("/metrics", response_model=EvalMetricsResponse)
async def get_eval_metrics(
    request: Request,
    body: PredictRequest = Body(...),
):
    """获取预测评估指标（RMSE, MAE, SSIM, R²）"""
    try:
        ps = _get_predict_service(request)
        result = ps.predict(
            mars_year=body.mars_year,
            ls_start=body.ls_start,
            selected_variables=body.selected_variables,
            horizon=body.horizon,
        )
        return result["metrics"]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── 消融实验 ───

@router.get("/ablation", response_model=AblationResponse)
async def get_ablation_results(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR),
    ls: float = Query(90.0, ge=0, le=360),
):
    """
    获取消融实验结果：不同变量组合的预测效果对比。
    注意：此接口会运行多次预测，首次调用可能较慢。
    """
    try:
        ps = _get_predict_service(request)
        items = ps.get_ablation_results(mars_year=my, ls_start=ls)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"消融实验错误: {e}")


# ─── 昼夜变化 ───

@router.get("/diurnal", response_model=DiurnalResponse)
async def get_diurnal_data(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR),
    ls: float = Query(90.0, ge=0, le=360),
    lat_band: str = Query("Equatorial (30S-30N)", description="纬度带名称"),
):
    """获取指定纬度带的臭氧昼夜变化曲线"""
    try:
        ds = _get_data_service(request)
        return ds.get_diurnal_data(my, ls, lat_band)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── 模型信息 ───

@router.get("/model-info")
async def get_model_info(request: Request):
    """获取模型基本信息"""
    ps = _get_predict_service(request)
    return {
        "model_name": "PredRNNv2",
        "device": str(ps.device),
        "total_channels": 7,
        "input_window": 3,
        "pred_horizon": 3,
        "model_loaded": ps.model is not None,
        "available_bands": [b["name"] for b in LATITUDE_BANDS],
    }
