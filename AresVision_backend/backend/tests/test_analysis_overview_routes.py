import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routers.analysis import router  # noqa: E402
from services.analysis_service import AnalysisService  # noqa: E402
from services.data_service import DataService  # noqa: E402
from services.mcd_overview_data_service import McdOverviewDataService  # noqa: E402


def build_client() -> TestClient:
    app = FastAPI()
    data_service = DataService()
    overview_service = McdOverviewDataService(data_service)
    app.state.mcd_overview_service = overview_service
    app.state.mcd_overview_analysis_service = AnalysisService(overview_service)
    app.include_router(router, prefix="/api")
    return TestClient(app)


def test_overview_info_uses_default_service():
    client = build_client()

    response = client.get("/api/explore/overview/info?data_source=default")

    assert response.status_code == 200
    payload = response.json()
    assert payload["available_years"] == [27, 28]
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
    assert payload["capabilities"]["nomad"] is False
    assert "mcd" in payload["available_sources"]
