import sys
from pathlib import Path

import numpy as np
import pytest
import xarray as xr
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import OVERVIEW_MCD_VARIABLES  # noqa: E402
from routers.analysis import router  # noqa: E402
from services.analysis_service import AnalysisService  # noqa: E402
from services.data_service import DataService  # noqa: E402
from services.mcd_overview_data_service import McdOverviewDataService  # noqa: E402


def build_client() -> TestClient:
    app = FastAPI()
    data_service = DataService()
    overview_service = McdOverviewDataService(data_service)
    app.state.mcd_overview_service = overview_service
    app.state.mcd_overview_analysis_service = AnalysisService(overview_service, mcd_variables=OVERVIEW_MCD_VARIABLES)
    app.include_router(router, prefix="/api")
    return TestClient(app)


class FakeBaseDataService:
    def get_openmars_data(self, mars_year: int) -> dict:
        raise ValueError(f"MY{mars_year} OpenMARS missing")

    def get_mcd_data(self, mars_year: int) -> dict:
        raise ValueError(f"MY{mars_year} runtime MCD missing")


def build_client_with_overview_dir(overview_dir: Path, nomad_dir: Path) -> TestClient:
    app = FastAPI()
    overview_service = McdOverviewDataService(FakeBaseDataService(), overview_dir=overview_dir, nomad_dir=nomad_dir)
    app.state.mcd_overview_service = overview_service
    app.state.mcd_overview_analysis_service = AnalysisService(overview_service, mcd_variables=OVERVIEW_MCD_VARIABLES)
    app.include_router(router, prefix="/api")
    return TestClient(app)


def write_overview_with_all_nan_dust(path: Path):
    lat = np.array([2.5, -2.5], dtype=np.float32)
    lon = np.array([-180.0, -175.0], dtype=np.float32)
    ls = np.array([10.0], dtype=np.float32)
    field = np.ones((1, 2, 2), dtype=np.float32)
    ds = xr.Dataset(
        data_vars={
            "Ls": (("time",), ls),
            "o3col": (("time", "lat", "lon"), field),
            "Pressure": (("time", "lat", "lon"), field),
            "Temperature": (("time", "lat", "lon"), field),
            "U_Wind": (("time", "lat", "lon"), field),
            "V_Wind": (("time", "lat", "lon"), field),
            "Dust_Optical_Depth": (("time", "lat", "lon"), np.full_like(field, np.nan)),
            "Solar_Flux_DN": (("time", "lat", "lon"), field),
        },
        coords={"time": np.arange(1), "lat": lat, "lon": lon},
    )
    ds.to_netcdf(path)
    ds.close()


def write_validation_overview(path: Path):
    lat = np.array([2.5, -2.5], dtype=np.float32)
    lon = np.array([-180.0, -175.0], dtype=np.float32)
    ls = np.array([10.0], dtype=np.float32)
    ozone = np.array([[[10.0, 20.0], [30.0, 40.0]]], dtype=np.float32)
    env = np.ones_like(ozone)
    ds = xr.Dataset(
        data_vars={
            "Ls": (("time",), ls),
            "o3col": (("time", "lat", "lon"), ozone),
            "Pressure": (("time", "lat", "lon"), env),
            "Temperature": (("time", "lat", "lon"), env),
            "U_Wind": (("time", "lat", "lon"), env),
            "V_Wind": (("time", "lat", "lon"), env),
            "Dust_Optical_Depth": (("time", "lat", "lon"), env),
            "Solar_Flux_DN": (("time", "lat", "lon"), env),
        },
        coords={"time": np.arange(1), "lat": lat, "lon": lon},
    )
    ds.to_netcdf(path)
    ds.close()


def write_validation_nomad(path: Path):
    lat = np.array([2.5, -2.5], dtype=np.float32)
    lon = np.array([-180.0, -175.0], dtype=np.float32)
    ls = np.array([10.0], dtype=np.float32)
    ozone = np.array([[[8.0, 22.0], [28.0, np.nan]]], dtype=np.float32)
    count = np.array([[[3, 2], [4, 0]]], dtype=np.int32)
    ds = xr.Dataset(
        data_vars={
            "Ls": (("time",), ls),
            "o3col": (("time", "lat", "lon"), ozone),
            "count": (("time", "lat", "lon"), count),
        },
        coords={"time": np.arange(1), "lat": lat, "lon": lon},
    )
    ds.to_netcdf(path)
    ds.close()


def test_overview_info_uses_default_service():
    client = build_client()

    response = client.get("/api/explore/overview/info?data_source=default")

    assert response.status_code == 200
    payload = response.json()
    assert 27 in payload["available_years"]
    assert 28 in payload["available_years"]
    assert payload["available_years"] == sorted(payload["available_years"])
    assert payload["timeline"]["min"] == 0.0
    assert payload["source_meta"]["effective_source"] == "default"


def test_overview_info_falls_back_when_personal_is_requested():
    client = build_client()

    response = client.get("/api/explore/overview/info?data_source=personal")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_meta"]["requested_source"] == "personal"
    assert payload["source_meta"]["effective_source"] == "default"
    assert payload["source_meta"]["fallback"] is True


def test_overview_ozone_sources_never_errors_when_nomad_is_missing():
    client = build_client()

    response = client.get("/api/explore/overview/ozone-sources?my=27&ls=20")

    assert response.status_code == 200
    payload = response.json()
    assert "mcd" in payload["available_sources"]
    assert "nomad" not in payload["available_sources"]


def test_overview_info_reports_nomad_capability_from_service():
    client = build_client()
    service = client.app.state.mcd_overview_service
    service.nomad[27] = {
        "o3col": service.get_openmars_data(27)["o3col"][:1],
        "ls": service.get_openmars_data(27)["ls"][:1],
        "lat": service.get_openmars_data(27)["lat"],
        "lon": service.get_openmars_data(27)["lon"],
        "count": service.get_openmars_data(27)["o3col"][:1].astype("int32"),
    }

    response = client.get("/api/explore/overview/info?data_source=default")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ozone_capabilities"]["nomad"] is True
    assert "MCD-NOMAD" in payload["ozone_capabilities"]["diff_pairs"]


def test_overview_env_heatmap_rejects_dust_variable(tmp_path):
    overview_dir = tmp_path / "mcd_overview"
    nomad_dir = tmp_path / "nomad"
    overview_dir.mkdir()
    write_overview_with_all_nan_dust(overview_dir / "MCD_MY34_overview.nc")
    client = build_client_with_overview_dir(overview_dir, nomad_dir)

    response = client.get("/api/explore/overview/env-heatmap?my=34&variable=Dust_Optical_Depth")

    assert response.status_code == 422


def test_overview_correlation_excludes_dust_variable():
    client = build_client()

    response = client.get("/api/explore/overview/correlation?my=27")

    assert response.status_code == 200
    payload = response.json()
    assert "Dust_Optical_Depth" not in payload["variable_names"]


def test_overview_ozone_sources_returns_nomad_validation_metrics(tmp_path):
    overview_dir = tmp_path / "mcd_overview"
    nomad_dir = tmp_path / "nomad"
    overview_dir.mkdir()
    nomad_dir.mkdir()
    write_validation_overview(overview_dir / "MCD_MY34_overview.nc")
    write_validation_nomad(nomad_dir / "NOMAD_ozone_MY34_gridded.nc")
    client = build_client_with_overview_dir(overview_dir, nomad_dir)

    response = client.get("/api/explore/overview/ozone-sources?my=34&ls=10")

    assert response.status_code == 200
    payload = response.json()
    validation = payload["validation"]["nomad"]
    assert validation["sample_count"] == 3
    assert validation["matched_ls"] == 10.0
    assert validation["bias"] == pytest.approx(2 / 3)
    assert validation["mae"] == pytest.approx(2.0)
    assert validation["rmse"] == pytest.approx(2.0)
    assert validation["points"] == [
        {"lat": 2.5, "lng": -180.0, "val": 2.0, "mcd_value": 10.0, "nomad_value": 8.0, "count": 3},
        {"lat": 2.5, "lng": -175.0, "val": -2.0, "mcd_value": 20.0, "nomad_value": 22.0, "count": 2},
        {"lat": -2.5, "lng": -180.0, "val": 2.0, "mcd_value": 30.0, "nomad_value": 28.0, "count": 4},
    ]
