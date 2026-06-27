import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.data_service import DataService  # noqa: E402
from services.mcd_overview_data_service import McdOverviewDataService  # noqa: E402


def test_overview_service_exposes_mcd_ozone_on_mcd_time_axis():
    base = DataService()
    service = McdOverviewDataService(base)

    overview = service.get_openmars_data(27)
    aligned = service.get_aligned_mcd_data(27)

    assert overview["o3col"].shape[0] == 669
    assert overview["o3col"].shape[1:] == (36, 72)
    assert aligned["Temperature"].shape == overview["o3col"].shape
    assert aligned["Dust_Optical_Depth"].shape == overview["o3col"].shape


def test_overlay_payload_reports_only_available_sources():
    base = DataService()
    service = McdOverviewDataService(base)

    payload = service.get_ozone_overlay_payload(27, 20.0)

    assert "mcd" in payload["available_sources"]
    assert payload["capabilities"]["nomad"] is False
    assert "MCD-OpenMARS" in payload["diff_candidates"] or payload["openmars"] is None
