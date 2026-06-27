import sys
from pathlib import Path

import numpy as np
import xarray as xr

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
    assert "nomad" not in payload["available_sources"]
    assert "MCD-OpenMARS" in payload["diff_candidates"] or payload["openmars"] is None


class FakeBaseDataService:
    def __init__(self, openmars_by_year=None):
        self.openmars_by_year = openmars_by_year or {}

    def get_openmars_data(self, mars_year: int) -> dict:
        if mars_year not in self.openmars_by_year:
            raise ValueError(f"MY{mars_year} OpenMARS missing")
        return self.openmars_by_year[mars_year]

    def get_mcd_data(self, mars_year: int) -> dict:
        raise ValueError(f"MY{mars_year} runtime MCD missing")


def write_overview_nc(path: Path, year: int, ls_values=None):
    ls_arr = np.asarray(ls_values or [10.0, 12.0], dtype=np.float32)
    lat = np.array([2.5, -2.5], dtype=np.float32)
    lon = np.array([-180.0, -175.0], dtype=np.float32)
    shape = (len(ls_arr), len(lat), len(lon))
    base = np.arange(np.prod(shape), dtype=np.float32).reshape(shape) + year
    ds = xr.Dataset(
        data_vars={
            "Ls": (("time",), ls_arr),
            "o3col": (("time", "lat", "lon"), base),
            "Pressure": (("time", "lat", "lon"), base + 1),
            "Temperature": (("time", "lat", "lon"), base + 2),
            "U_Wind": (("time", "lat", "lon"), base + 3),
            "V_Wind": (("time", "lat", "lon"), base + 4),
            "Dust_Optical_Depth": (("time", "lat", "lon"), base + 5),
            "Solar_Flux_DN": (("time", "lat", "lon"), base + 6),
        },
        coords={"time": np.arange(len(ls_arr)), "lat": lat, "lon": lon},
    )
    ds.to_netcdf(path)
    ds.close()


def write_nomad_nc(path: Path, year: int):
    lat = np.array([2.5, -2.5], dtype=np.float32)
    lon = np.array([-180.0, -175.0], dtype=np.float32)
    ls_arr = np.array([10.0], dtype=np.float32)
    field = np.array([[[5.0, np.nan], [np.nan, 7.0]]], dtype=np.float32)
    count = np.array([[[1, 0], [0, 2]]], dtype=np.int32)
    ds = xr.Dataset(
        data_vars={
            "Ls": (("time",), ls_arr),
            "o3col": (("time", "lat", "lon"), field),
            "count": (("time", "lat", "lon"), count),
            "uncertainty": (("time", "lat", "lon"), np.ones_like(field)),
        },
        coords={"time": np.arange(len(ls_arr)), "lat": lat, "lon": lon},
        attrs={"mars_year": year},
    )
    ds.to_netcdf(path)
    ds.close()


def test_overview_service_discovers_years_from_overview_files(tmp_path):
    overview_dir = tmp_path / "mcd_overview"
    nomad_dir = tmp_path / "nomad"
    overview_dir.mkdir()
    write_overview_nc(overview_dir / "MCD_MY34_overview.nc", 34)

    service = McdOverviewDataService(FakeBaseDataService(), overview_dir=overview_dir, nomad_dir=nomad_dir)

    assert service.get_available_years() == [34]
    assert service.get_openmars_data(34)["o3col"].shape == (2, 2, 2)


def test_overlay_payload_includes_nomad_when_sparse_points_match(tmp_path):
    overview_dir = tmp_path / "mcd_overview"
    nomad_dir = tmp_path / "nomad"
    overview_dir.mkdir()
    nomad_dir.mkdir()
    write_overview_nc(overview_dir / "MCD_MY34_overview.nc", 34, ls_values=[10.0])
    write_nomad_nc(nomad_dir / "NOMAD_ozone_MY34_gridded.nc", 34)

    service = McdOverviewDataService(FakeBaseDataService(), overview_dir=overview_dir, nomad_dir=nomad_dir)
    payload = service.get_ozone_overlay_payload(34, 10.0)

    assert payload["capabilities"]["nomad"] is True
    assert "nomad" in payload["available_sources"]
    assert "MCD-NOMAD" in payload["diff_candidates"]
    assert payload["nomad"]["source"] == "nomad"
    assert len(payload["nomad"]["points"]) == 2


def test_overlay_payload_does_not_include_nomad_when_no_sparse_points_match(tmp_path):
    overview_dir = tmp_path / "mcd_overview"
    nomad_dir = tmp_path / "nomad"
    overview_dir.mkdir()
    nomad_dir.mkdir()
    write_overview_nc(overview_dir / "MCD_MY34_overview.nc", 34, ls_values=[100.0])
    write_nomad_nc(nomad_dir / "NOMAD_ozone_MY34_gridded.nc", 34)

    service = McdOverviewDataService(FakeBaseDataService(), overview_dir=overview_dir, nomad_dir=nomad_dir)
    payload = service.get_ozone_overlay_payload(34, 100.0)

    assert payload["capabilities"]["nomad"] is True
    assert "nomad" not in payload["available_sources"]
    assert "MCD-NOMAD" not in payload["diff_candidates"]
    assert payload["nomad"] is None
