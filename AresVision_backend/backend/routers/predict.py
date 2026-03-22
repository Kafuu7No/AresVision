"""
预测分析页 — API 路由
"""

import logging

from fastapi import APIRouter, HTTPException, Request, Query, Body

from schemas.predict import (
    PredictRequest, PredictResponse,
    EvalMetricsResponse, AblationResponse, DiurnalResponse,
    PerformanceResponse, PerformanceCompareRequest, PerformanceCompareResponse,
    ErrorDistributionResponse,
)
from config import DEFAULT_MARS_YEAR, LATITUDE_BANDS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predict", tags=["预测分析"])


def _get_predict_service(request: Request):
    return request.app.state.predict_service


def _get_analysis_service(request: Request):
    return request.app.state.analysis_service


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
            "model_info": result["model_info"],
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


# ─── 性能曲线 (测试集) ───

@router.post("/performance", response_model=PerformanceResponse)
async def get_performance_results(
    request: Request,
    body: PredictRequest = Body(...),
):
    """
    获取模型在测试集上的 R2 性能曲线。
    横轴为 Ls，纵轴为空间 R2 均值。
    """
    try:
        ps = _get_predict_service(request)
        result = ps.get_performance_curve(selected_variables=body.selected_variables)
        return result
    except Exception as e:
        logger.error(f"性能曲线接口错误: {e}")
        raise HTTPException(status_code=500, detail=f"性能曲线计算失败: {e}")


@router.post("/performance-compare", response_model=PerformanceCompareResponse)
async def get_performance_comparison(
    request: Request,
    body: PerformanceCompareRequest = Body(...),
):
    """同时获取多个变量组合的模型性能曲线以便对比分析"""
    try:
        ps = _get_predict_service(request)
        results = {}
        for vars_list in body.configs:
            # 使用列表内容作为 key
            if not vars_list:
                key = "baseline"
            else:
                from config import VARIABLE_SHORTHANDS
                key = "".join([VARIABLE_SHORTHANDS.get(v, v[0]) for v in sorted(vars_list)])
            
            perf = ps.get_performance_curve(selected_variables=vars_list)
            results[key] = perf
        return {"results": results}
    except Exception as e:
        logger.error(f"多模型对比接口错误: {e}")
        raise HTTPException(status_code=500, detail=f"对比数据生成失败: {e}")


@router.get("/shapley")
async def get_shapley_values(
    request: Request,
    metric: str = Query("r2", description="性能指标 (r2, rmse, mae, ssim)"),
):
    """获取所有气象特征的 Shapley 贡献值"""
    try:
        ps = _get_predict_service(request)
        return ps.get_shapley_values(metric)
    except Exception as e:
        logger.error(f"Shapley计算失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        vs = _get_analysis_service(request)
        return vs.get_diurnal_data(my, ls, lat_band)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── 模型信息 ───

@router.get("/model-info")
async def get_model_info(request: Request):
    """获取模型基本信息"""
    ps = _get_predict_service(request)
    inference = request.app.state.predict_inference
    return {
        "model_name": "PredRNNv2",
        "device": str(inference.device),
        "total_channels": 7,
        "input_window": 3,
        "pred_horizon": 3,
        "model_loaded": inference.model is not None,
        "available_bands": [b["name"] for b in LATITUDE_BANDS],
    }


@router.get("/error-distribution", response_model=ErrorDistributionResponse)
async def get_error_distribution(
    request: Request,
    vars: str = Query("Temperature,Dust_Optical_Depth,Solar_Flux_DN,U_Wind,V_Wind"),
):
    """获取整个测试集上的误差分布、核密度散点及柱状图数据"""
    try:
        ps = _get_predict_service(request)
        selected_variables = [v.strip() for v in vars.split(",") if v.strip()]
        return ps.get_error_distribution(
            selected_variables=selected_variables
        )
    except Exception as e:
        logger.error(f"误差分布计算失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
