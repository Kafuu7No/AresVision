import sys
from pathlib import Path

import pytest
import xarray as xr

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.build_mcd_overview_dataset import build_overview_dataset  # noqa: E402


def test_build_overview_dataset_creates_backend_runtime_shape(tmp_path):
    repo_root = Path(__file__).resolve().parents[3]
    base_mcd = repo_root / "AresVision_backend" / "backend" / "data" / "mcd" / "MCD_MY27_Lat-90-90_real.nc"
    ozone_ref = repo_root / "Data" / "MCD_Output_global_10m_ls_lst" / "MCD_MY27_global_3h_5deg_10m_ls_lst.nc"
    output_path = tmp_path / "MCD_MY27_overview.nc"

    build_overview_dataset(base_mcd, ozone_ref, output_path)

    ds = xr.open_dataset(output_path)
    try:
        assert "o3col" in ds.data_vars
        assert "Dust_Optical_Depth" in ds.data_vars
        assert ds["o3col"].shape == ds["Temperature"].shape
        assert ds["o3col"].shape == ds["Dust_Optical_Depth"].shape
        assert ds["lat"].shape == (36,)
        assert ds["lon"].shape == (72,)
        assert ds["Ls"].shape == (669,)
        assert float(ds["lat"][0]) == pytest.approx(87.5, abs=1e-3)
        assert float(ds["lat"][-1]) == pytest.approx(-87.5, abs=1e-3)
        assert float(ds["o3col"].isnull().mean()) < 0.05
    finally:
        ds.close()
