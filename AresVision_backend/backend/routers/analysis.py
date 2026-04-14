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


def _get_analysis_service(request: Request):
    return request.app.state.analysis_service


# ─── 3D 地球点云 ───

@router.get("/globe", response_model=GlobeDataResponse)
async def get_globe_data(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    ls: float = Query(10.0, ge=0, le=360, description="太阳黄经 Ls"),
    variable: str = Query("o3col", description="显示变量", enum=["o3col"] + MCD_VARIABLES),
):
    """获取指定 Ls 时刻的全球变量 3D 点云数据"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_globe_data(my, ls, variable=variable)
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
        vs = _get_analysis_service(request)
        return vs.get_seasonal_heatmap(my, variable="o3col")
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
        vs = _get_analysis_service(request)
        return vs.get_seasonal_bands(my)
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
        vs = _get_analysis_service(request)
        return vs.get_env_variable_heatmap(my, variable)
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
        vs = _get_analysis_service(request)
        return vs.get_correlation_matrix(my)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── 元信息 ───

@router.get("/info")
async def get_data_info(request: Request):
    """获取已加载的数据元信息"""
    service = request.app.state.data_service
    years = service.get_available_years()
    info = {}
    for y in years:
        ls_min, ls_max = service.get_ls_range(y)
        info[f"MY{y}"] = {"ls_range": [ls_min, ls_max]}
    return {"available_years": years, "details": info}

# ─── 新增科学气象分析接口 ───

@router.get("/coupling")
async def get_coupling(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    var1: str = Query("o3col", description="变量1"),
    var2: str = Query("Dust_Optical_Depth", description="变量2"),
):
    """沙尘-臭氧耦合数据 (以及任意两个变量的全球平均随Ls变化)"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_coupling_data(my, var1, var2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/zonal-anomaly")
async def get_zonal_anomaly(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    variable: str = Query("o3col", description="变量名"),
):
    """行星波与纬向距平 (时间平均后的经纬度距平)"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_zonal_anomalies(my, variable)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/solar-photochemical")
async def get_solar_photochemical(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    lat_band: str = Query("Equatorial (30S-30N)", description="纬度带名称"),
):
    """太阳辐射-光化学敏感性分析"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_solar_photochemical(my, lat_band)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/polar-dynamics")
async def get_polar_dynamics(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
):
    """极地动力学与涡旋追踪 (南北极对比)"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_polar_dynamics(my)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/research-suite")
async def get_research_suite(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
):
    """综合研究数据包：热力图/柱图/折线图所需聚合指标"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_research_suite(my)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/phase-space")
async def get_phase_space(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    driver: str = Query("Dust_Optical_Depth", description="驱动变量", enum=MCD_VARIABLES),
):
    """臭氧-驱动变量相空间散点数据"""
    try:
        vs = _get_analysis_service(request)
        return vs.get_phase_space(my, driver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
