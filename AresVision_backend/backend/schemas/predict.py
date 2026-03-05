"""
预测分析页 — 请求/响应 Schema
"""
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    selected_variables: list[str] = Field(
        default=["Temperature", "Dust_Optical_Depth", "Solar_Flux_DN",
                 "U_Wind", "V_Wind", "Pressure"],
    )
    horizon: int = Field(default=3, ge=1, le=3)
    ls_start: float = Field(default=90.0, ge=0, le=360)
    mars_year: int = Field(default=27)


class PredictFieldData(BaseModel):
    points: list[dict]
    lat: list[float]
    lon: list[float]
    field: list[list[float]]
    minVal: float
    maxVal: float


class PredictResponse(BaseModel):
    ground_truth: list[PredictFieldData]
    prediction: list[PredictFieldData]
    residual: list[PredictFieldData]
    selected_variables: list[str]
    horizon: int
    ls_values: list[float]


class StepMetrics(BaseModel):
    step: int
    rmse: float
    mae: float
    ssim: float
    r2: float


class EvalMetricsResponse(BaseModel):
    overall: StepMetrics
    per_step: list[StepMetrics]


class AblationItem(BaseModel):
    variable_combo: str
    variables: list[str]
    rmse: float
    mae: float
    ssim: float
    r2: float


class AblationResponse(BaseModel):
    items: list[AblationItem]


class DiurnalResponse(BaseModel):
    hours: list[float]
    ozone_values: list[float]
    lat_band: str
    ls: float
