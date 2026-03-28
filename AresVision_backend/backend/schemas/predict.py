"""
预测分析页 — 请求/响应 Schema
"""
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    selected_variables: list[str] = Field(
        default=["Temperature", "Dust_Optical_Depth", "Solar_Flux_DN",
                 "U_Wind", "V_Wind"],
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
    model_info: dict = Field(default_factory=dict)


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
class PerformancePoint(BaseModel):
    ls: float
    my: int
    r2: float
    rmse: float
    mae: float
    ssim: float


class PerformanceResponse(BaseModel):
    items: list[PerformancePoint]
    global_r2: float = 0.0
    global_rmse: float = 0.0
    global_mae: float = 0.0
    global_ssim: float = 0.0


class PerformanceCompareRequest(BaseModel):
    # 每个项包含一个变量组合
    configs: list[list[str]]


class PerformanceCompareResponse(BaseModel):
    # key 为模型后缀或变量标识，val 为对应的性能数据
    results: dict[str, PerformanceResponse]


class ScatterData(BaseModel):
    trues: list[float]
    preds: list[float]
    density: list[float]


class HistogramData(BaseModel):
    bin_edges: list[float]
    counts: list[int]


class ErrorDistributionResponse(BaseModel):
    scatter: ScatterData
    hist_trues: HistogramData
    hist_preds: HistogramData
    hist_errors: HistogramData
    mae: float
    rmse: float


class GlobalShapBarItem(BaseModel):
    name: str
    value: float


class GlobalShapSummaryItem(BaseModel):
    name: str
    shap_values: list[float]
    feature_values: list[float]


class GlobalShapResponse(BaseModel):
    bar_data: list[GlobalShapBarItem]
    summary_data: list[GlobalShapSummaryItem]


class PermutationImportanceItem(BaseModel):
    name: str
    importance: float


class PermutationImportanceResponse(BaseModel):
    items: list[PermutationImportanceItem]
    baseline_metric: str
    baseline_value: float
