"""
数据探索页 — API 路由
提供 3D 点云、热力图、折线图、环境变量、相关矩阵接口
"""

from fastapi import APIRouter, HTTPException, Request, Query

from schemas.explore import (
    GlobeDataResponse, HeatmapResponse,
    SeasonalBandsResponse, CorrelationResponse,
)
from config import DEFAULT_MARS_YEAR, MCD_VARIABLES

router = APIRouter(prefix="/explore", tags=["数据探索"])


def _get_data_service(request: Request):
    return request.app.state.data_service


# ─── 3D 地球点云 ───

@router.get("/globe", response_model=GlobeDataResponse)
async def get_globe_data(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    ls: float = Query(10.0, ge=0, le=360, description="太阳黄经 Ls"),
):
    """获取指定 Ls 时刻的全球臭氧 3D 点云数据"""
    try:
        ds = _get_data_service(request)
        return ds.get_globe_data(my, ls)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"数据处理错误: {e}")


# ─── Ls-纬度臭氧热力图 ───

@router.get("/seasonal-heatmap", response_model=HeatmapResponse)
async def get_seasonal_heatmap(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
):
    """获取全年 Ls-纬度臭氧热力图（纬向平均）"""
    try:
        ds = _get_data_service(request)
        return ds.get_seasonal_heatmap(my, variable="o3col")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 纬度带折线图 ───

@router.get("/seasonal-bands", response_model=SeasonalBandsResponse)
async def get_seasonal_bands(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
):
    """获取 5 个纬度带的臭氧随 Ls 变化曲线"""
    try:
        ds = _get_data_service(request)
        return ds.get_seasonal_bands(my)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 环境变量热力图 ───

@router.get("/env-heatmap", response_model=HeatmapResponse)
async def get_env_variable_heatmap(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    variable: str = Query(..., description="变量名", enum=MCD_VARIABLES),
):
    """获取单个 MCD 环境变量的 Ls-纬度热力图"""
    try:
        ds = _get_data_service(request)
        return ds.get_env_variable_heatmap(my, variable)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 相关性矩阵 ───

@router.get("/correlation", response_model=CorrelationResponse)
async def get_correlation_matrix(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
):
    """获取 O₃ 与 6 个环境变量的 Pearson 相关系数矩阵"""
    try:
        ds = _get_data_service(request)
        return ds.get_correlation_matrix(my)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 元信息 ───

@router.get("/info")
async def get_data_info(request: Request):
    """获取已加载的数据元信息"""
    ds = _get_data_service(request)
    years = ds.get_available_years()
    info = {}
    for y in years:
        ls_min, ls_max = ds.get_ls_range(y)
        info[f"MY{y}"] = {"ls_range": [ls_min, ls_max]}
    return {"available_years": years, "details": info}
