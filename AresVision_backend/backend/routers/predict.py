"""
棰勬祴鍒嗘瀽椤?鈥?API 璺敱
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Query, Body

from auth.dependencies import get_optional_user
from database.models import User

from schemas.predict import (
    PredictRequest, PredictResponse,
    EvalMetricsResponse, AblationResponse, DiurnalResponse,
    PerformanceResponse, PerformanceCompareRequest, PerformanceCompareResponse,
    ErrorDistributionResponse, GlobalShapResponse, PermutationImportanceResponse,
)
from config import DEFAULT_MARS_YEAR, LATITUDE_BANDS
from services.analysis_service import AnalysisService
from services.personal_data_source_service import SingleYearDataView

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predict", tags=["棰勬祴鍒嗘瀽"])


def _get_predict_service(request: Request):
    return request.app.state.predict_service


def _get_analysis_service(request: Request):
    return request.app.state.analysis_service


async def _resolve_diurnal_context(
    request: Request,
    my: int,
    data_source: str,
    current_user: User | None,
) -> tuple[AnalysisService, dict, int]:
    requested = (data_source or "default").strip().lower()
    if requested not in ("default", "personal"):
        raise HTTPException(status_code=400, detail="data_source must be 'default' or 'personal'")

    if requested == "default":
        return (
            _get_analysis_service(request),
            {
                "requested_source": "default",
                "effective_source": "default",
                "fallback": False,
                "message": None,
                "mars_year": my,
            },
            my,
        )

    resolver = request.app.state.personal_data_source_service
    resolution = await resolver.resolve_for_year("personal", my, current_user.id if current_user else None)
    if resolution.effective_source == "default":
        return _get_analysis_service(request), resolution.source_meta(), resolution.mars_year

    data_view = SingleYearDataView(
        mars_year=resolution.mars_year,
        openmars_data=resolution.openmars_data,
        aligned_mcd_data=resolution.aligned_mcd_data,
        mcd_raw_data=resolution.mcd_raw_data,
    )
    return AnalysisService(data_view), resolution.source_meta(), resolution.mars_year


# 鈹€鈹€鈹€ 鏍稿績棰勬祴鎺ュ彛 鈹€鈹€鈹€

@router.post("/run", response_model=PredictResponse)
async def run_prediction(
    request: Request,
    body: PredictRequest = Body(...),
):
    """
    鎵ц棰勬祴銆?
    鍓嶇浼犲叆鍕鹃€夌殑鍙橀噺鍒楄〃 + 棰勬祴姝ラ暱 + 璧峰 Ls銆?
    杩斿洖鐪熷€煎満銆侀娴嬪満銆佸樊鍊煎満銆?
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
        raise HTTPException(status_code=500, detail=f"棰勬祴閿欒: {e}")


# 鈹€鈹€鈹€ 璇勪及鎸囨爣 鈹€鈹€鈹€

@router.post("/metrics", response_model=EvalMetricsResponse)
async def get_eval_metrics(
    request: Request,
    body: PredictRequest = Body(...),
):
    """鑾峰彇棰勬祴璇勪及鎸囨爣锛圧MSE, MAE, SSIM, R虏锛?"""
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


# 鈹€鈹€鈹€ 娑堣瀺瀹為獙 鈹€鈹€鈹€

@router.get("/ablation", response_model=AblationResponse)
async def get_ablation_results(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR),
    ls: float = Query(90.0, ge=0, le=360),
):
    """
    鑾峰彇娑堣瀺瀹為獙缁撴灉锛氫笉鍚屽彉閲忕粍鍚堢殑棰勬祴鏁堟灉瀵规瘮銆?
    娉ㄦ剰锛氭鎺ュ彛浼氳繍琛屽娆￠娴嬶紝棣栨璋冪敤鍙兘杈冩參銆?
    """
    try:
        ps = _get_predict_service(request)
        items = ps.get_ablation_results(mars_year=my, ls_start=ls)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"娑堣瀺瀹為獙閿欒: {e}")


# 鈹€鈹€鈹€ 鎬ц兘鏇茬嚎 (娴嬭瘯闆? 鈹€鈹€鈹€

@router.post("/performance", response_model=PerformanceResponse)
async def get_performance_results(
    request: Request,
    body: PredictRequest = Body(...),
):
    """
    鑾峰彇妯″瀷鍦ㄦ祴璇曢泦涓婄殑 R2 鎬ц兘鏇茬嚎銆?
    妯酱涓?Ls锛岀旱杞翠负绌洪棿 R2 鍧囧€笺€?
    """
    try:
        ps = _get_predict_service(request)
        result = ps.get_performance_curve(selected_variables=body.selected_variables)
        return result
    except Exception as e:
        logger.error(f"鎬ц兘鏇茬嚎鎺ュ彛閿欒: {e}")
        raise HTTPException(status_code=500, detail=f"鎬ц兘鏇茬嚎璁＄畻澶辫触: {e}")


@router.post("/performance-compare", response_model=PerformanceCompareResponse)
async def get_performance_comparison(
    request: Request,
    body: PerformanceCompareRequest = Body(...),
):
    """鍚屾椂鑾峰彇澶氫釜鍙橀噺缁勫悎鐨勬ā鍨嬫€ц兘鏇茬嚎浠ヤ究瀵规瘮鍒嗘瀽"""
    try:
        ps = _get_predict_service(request)
        results = {}
        for vars_list in body.configs:
            # 浣跨敤鍒楄〃鍐呭浣滀负 key
            if not vars_list:
                key = "baseline"
            else:
                from config import VARIABLE_SHORTHANDS
                key = "".join([VARIABLE_SHORTHANDS.get(v, v[0]) for v in sorted(vars_list)])
            
            perf = ps.get_performance_curve(selected_variables=vars_list)
            results[key] = perf
        return {"results": results}
    except Exception as e:
        logger.error(f"澶氭ā鍨嬪姣旀帴鍙ｉ敊璇? {e}")
        raise HTTPException(status_code=500, detail=f"瀵规瘮鏁版嵁鐢熸垚澶辫触: {e}")


@router.get("/shapley")
async def get_shapley_values(
    request: Request,
    metric: str = Query("r2", description="鎬ц兘鎸囨爣 (r2, rmse, mae, ssim)"),
):
    """鑾峰彇鎵€鏈夋皵璞＄壒寰佺殑 Shapley 璐＄尞鍊?"""
    try:
        ps = _get_predict_service(request)
        return ps.get_shapley_values(metric)
    except Exception as e:
        logger.error(f"Shapley璁＄畻澶辫触: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 鈹€鈹€鈹€ 鏄煎鍙樺寲 鈹€鈹€鈹€

@router.get("/diurnal", response_model=DiurnalResponse)
async def get_diurnal_data(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR),
    ls: float = Query(90.0, ge=0, le=360),
    lat_band: str = Query("Equatorial (30S-30N)", description="纬度带名称"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    """获取指定纬度带的臭氧昼夜变化曲线"""
    try:
        vs, source_meta, resolved_year = await _resolve_diurnal_context(
            request, my, data_source, current_user
        )
        result = vs.get_diurnal_data(resolved_year, ls, lat_band)
        result["source_meta"] = source_meta
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 鈹€鈹€鈹€ 妯″瀷淇℃伅 鈹€鈹€鈹€

@router.get("/model-info")
async def get_model_info(request: Request):
    """鑾峰彇妯″瀷鍩烘湰淇℃伅"""
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
    """鑾峰彇鏁翠釜娴嬭瘯闆嗕笂鐨勮宸垎甯冦€佹牳瀵嗗害鏁ｇ偣鍙婃煴鐘跺浘鏁版嵁"""
    try:
        ps = _get_predict_service(request)
        selected_variables = [v.strip() for v in vars.split(",") if v.strip()]
        return ps.get_error_distribution(
            selected_variables=selected_variables
        )
    except Exception as e:
        logger.error(f"璇樊鍒嗗竷璁＄畻澶辫触: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shapley-global", response_model=GlobalShapResponse)
async def get_shapley_global(request: Request):
    """鎵ц骞惰幏鍙栧叏娴嬭瘯闆?SHAP 鍏ㄥ眬褰掑洜鍒嗘瀽缁撴灉"""
    try:
        ps = _get_predict_service(request)
        return ps.get_global_shap()
    except Exception as e:
        logger.error(f"鍏ㄥ眬 SHAP 鍒嗘瀽澶辫触: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/permutation-importance", response_model=PermutationImportanceResponse)
async def get_permutation_importance(
    request: Request,
    vars: str = Query("Temperature,Dust_Optical_Depth,Solar_Flux_DN,U_Wind,V_Wind"),
):
    """鑾峰彇鎺掑垪鐗瑰緛閲嶈鎬?(Permutation Feature Importance) 鍒嗚В缁撴灉"""
    try:
        ps = _get_predict_service(request)
        selected_variables = [v.strip() for v in vars.split(",") if v.strip()]
        return ps.get_permutation_importance(selected_variables=selected_variables)
    except Exception as e:
        logger.error(f"PFI 鍒嗘瀽澶辫触: {e}")
        raise HTTPException(status_code=500, detail=str(e))




