"""
数据探索页 — 请求/响应 Schema
"""
from pydantic import BaseModel


class GlobePoint(BaseModel):
    lat: float
    lng: float
    val: float


class GlobeDataResponse(BaseModel):
    points: list[GlobePoint]
    minVal: float
    maxVal: float
    ls: float
    mars_year: int


class HeatmapResponse(BaseModel):
    x: list[float]
    y: list[float]
    z: list[list[float]]
    min: float
    max: float
    variable: str = "o3col"


class LatitudeBand(BaseModel):
    name: str
    values: list[float]


class SeasonalBandsResponse(BaseModel):
    ls: list[float]
    bands: list[LatitudeBand]


class CorrelationResponse(BaseModel):
    matrix: list[list[float]]
    variable_names: list[str]
