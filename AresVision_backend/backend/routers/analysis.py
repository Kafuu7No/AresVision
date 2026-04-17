"""
Data overview / exploration routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth.dependencies import get_optional_user
from config import DEFAULT_MARS_YEAR, MCD_VARIABLES
from database.models import User
from schemas.explore import (
    CorrelationResponse,
    GlobeDataResponse,
    HeatmapResponse,
    SeasonalBandsResponse,
)
from services.analysis_service import AnalysisService
from services.personal_data_source_service import SingleYearDataView

router = APIRouter(prefix="/explore", tags=["数据探索"])

_ALLOWED_SOURCES = ("default", "personal")


def _with_source_meta(payload: dict, source_meta: dict) -> dict:
    out = dict(payload)
    out["source_meta"] = source_meta
    return out


def _normalize_source(data_source: str) -> str:
    s = (data_source or "default").strip().lower()
    if s not in _ALLOWED_SOURCES:
        raise HTTPException(status_code=400, detail="data_source must be 'default' or 'personal'")
    return s


async def _resolve_analysis_context(
    request: Request,
    my: int,
    data_source: str,
    current_user: User | None,
) -> tuple[AnalysisService, dict, int]:
    requested = _normalize_source(data_source)

    if requested == "default":
        return (
            request.app.state.analysis_service,
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
        service = request.app.state.analysis_service
    else:
        data_view = SingleYearDataView(
            mars_year=resolution.mars_year,
            openmars_data=resolution.openmars_data,
            aligned_mcd_data=resolution.aligned_mcd_data,
            mcd_raw_data=resolution.mcd_raw_data,
        )
        service = AnalysisService(data_view)

    return service, resolution.source_meta(), resolution.mars_year


@router.get("/globe", response_model=GlobeDataResponse)
async def get_globe_data(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    ls: float = Query(10.0, ge=0, le=360, description="太阳黄经 Ls"),
    variable: str = Query("o3col", description="显示变量", enum=["o3col"] + MCD_VARIABLES),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_globe_data(resolved_year, ls, variable=variable)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"数据处理错误: {exc}")


@router.get("/seasonal-heatmap", response_model=HeatmapResponse)
async def get_seasonal_heatmap(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_seasonal_heatmap(resolved_year, variable="o3col")
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/seasonal-bands", response_model=SeasonalBandsResponse)
async def get_seasonal_bands(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_seasonal_bands(resolved_year)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/env-heatmap", response_model=HeatmapResponse)
async def get_env_variable_heatmap(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    variable: str = Query(..., description="变量名", enum=MCD_VARIABLES),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_env_variable_heatmap(resolved_year, variable)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/correlation", response_model=CorrelationResponse)
async def get_correlation_matrix(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_correlation_matrix(resolved_year)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/info")
async def get_data_info(
    request: Request,
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        resolver = request.app.state.personal_data_source_service
        requested = _normalize_source(data_source)
        return await resolver.get_data_info(requested, current_user.id if current_user else None)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"获取数据源信息失败: {exc}")


@router.get("/coupling")
async def get_coupling(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    var1: str = Query("o3col", description="变量1"),
    var2: str = Query("Dust_Optical_Depth", description="变量2"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_coupling_data(resolved_year, var1, var2)
        return _with_source_meta(result, source_meta)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/zonal-anomaly")
async def get_zonal_anomaly(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    variable: str = Query("o3col", description="变量名"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_zonal_anomalies(resolved_year, variable)
        return _with_source_meta(result, source_meta)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/solar-photochemical")
async def get_solar_photochemical(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    lat_band: str = Query("Equatorial (30S-30N)", description="纬度带名称"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_solar_photochemical(resolved_year, lat_band)
        return _with_source_meta(result, source_meta)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/polar-dynamics")
async def get_polar_dynamics(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_polar_dynamics(resolved_year)
        return _with_source_meta(result, source_meta)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/research-suite")
async def get_research_suite(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_research_suite(resolved_year)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/phase-space")
async def get_phase_space(
    request: Request,
    my: int = Query(DEFAULT_MARS_YEAR, description="火星年"),
    driver: str = Query("Dust_Optical_Depth", description="驱动变量", enum=MCD_VARIABLES),
    data_source: str = Query("default", description="default | personal"),
    current_user: User | None = Depends(get_optional_user),
):
    try:
        service, source_meta, resolved_year = await _resolve_analysis_context(
            request, my, data_source, current_user
        )
        result = service.get_phase_space(resolved_year, driver)
        return _with_source_meta(result, source_meta)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
