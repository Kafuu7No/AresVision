"""
Schemas for exploration/overview endpoints.
"""

from pydantic import BaseModel


class SourceMeta(BaseModel):
    requested_source: str
    effective_source: str
    fallback: bool = False
    message: str | None = None
    mars_year: int | None = None


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
    variable: str = "o3col"
    source_meta: SourceMeta | None = None


class HeatmapResponse(BaseModel):
    x: list[float]
    y: list[float]
    z: list[list[float]]
    min: float
    max: float
    variable: str = "o3col"
    source_meta: SourceMeta | None = None


class LatitudeBand(BaseModel):
    name: str
    values: list[float]


class SeasonalBandsResponse(BaseModel):
    ls: list[float]
    bands: list[LatitudeBand]
    source_meta: SourceMeta | None = None


class CorrelationResponse(BaseModel):
    matrix: list[list[float]]
    variable_names: list[str]
    source_meta: SourceMeta | None = None
