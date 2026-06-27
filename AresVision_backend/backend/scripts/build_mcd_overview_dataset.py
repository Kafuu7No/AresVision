"""
Build the MCD-only overview dataset used by the data overview page.

The backend runtime MCD files already define the target time and grid. Reference
MCD files provide O3COL on a slightly different latitude grid, so this script
interpolates ozone onto the runtime MCD coordinates and writes a compact dataset.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import xarray as xr
from scipy.interpolate import interp1d

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import MCD_DIR, MCD_OVERVIEW_DIR, SUPPORTED_MARS_YEARS  # noqa: E402
from core.data_align import unwrap_ls  # noqa: E402

REFERENCE_FIELD_MAP = {
    "o3col": "O3COL",
    "U_Wind": "U",
    "V_Wind": "V",
    "Temperature": "T",
    "Pressure": "PS",
    "Solar_Flux_DN": "FSDS",
    "Ls": "LS",
}

BASE_FIELD_NAMES = [
    "Pressure",
    "Temperature",
    "U_Wind",
    "V_Wind",
    "Dust_Optical_Depth",
    "Solar_Flux_DN",
]


def _daily_mean(values: np.ndarray) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float32)
    if arr.ndim == 4:
        return np.nanmean(arr, axis=1).astype(np.float32)
    if arr.ndim == 3:
        return arr.astype(np.float32)
    raise ValueError(f"Expected 3D or 4D field, got shape {arr.shape}")


def _align_reference_ls(ref_ls: np.ndarray, target_ls: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ref_unwrapped = unwrap_ls(np.asarray(ref_ls, dtype=np.float64))
    target_unwrapped = unwrap_ls(np.asarray(target_ls, dtype=np.float64))

    while target_unwrapped[0] < ref_unwrapped[0] - 180:
        target_unwrapped = target_unwrapped + 360
    while target_unwrapped[0] > ref_unwrapped[-1] + 180:
        target_unwrapped = target_unwrapped - 360

    order = np.argsort(ref_unwrapped)
    return ref_unwrapped[order], target_unwrapped


def interpolate_reference_ozone(ref_o3: np.ndarray, ref_ls: np.ndarray, target_ls: np.ndarray) -> np.ndarray:
    source_ls, target_unwrapped = _align_reference_ls(ref_ls, target_ls)
    source_o3 = np.asarray(ref_o3, dtype=np.float64)[np.argsort(unwrap_ls(np.asarray(ref_ls, dtype=np.float64)))]
    interpolator = interp1d(
        source_ls,
        source_o3,
        axis=0,
        kind="linear",
        bounds_error=False,
        fill_value="extrapolate",
    )
    return np.asarray(interpolator(target_unwrapped), dtype=np.float32)


def regrid_latitude(data: np.ndarray, source_lat: np.ndarray, target_lat: np.ndarray) -> np.ndarray:
    source_lat_arr = np.asarray(source_lat, dtype=np.float64)
    target_lat_arr = np.asarray(target_lat, dtype=np.float64)
    field = np.asarray(data, dtype=np.float64)

    if source_lat_arr[0] > source_lat_arr[-1]:
        source_sorted = source_lat_arr
        field_sorted = field
    else:
        source_sorted = source_lat_arr[::-1]
        field_sorted = field[:, ::-1, :]

    regridded = np.empty((field_sorted.shape[0], target_lat_arr.shape[0], field_sorted.shape[2]), dtype=np.float32)
    for lon_idx in range(field_sorted.shape[2]):
        interpolator = interp1d(
            source_sorted,
            field_sorted[:, :, lon_idx],
            axis=1,
            kind="linear",
            bounds_error=False,
            fill_value="extrapolate",
            assume_sorted=False,
        )
        regridded[:, :, lon_idx] = interpolator(target_lat_arr).astype(np.float32)
    return regridded


def build_overview_dataset(base_mcd_path: Path, ozone_ref_path: Path, output_path: Path) -> Path:
    base_ds = xr.open_dataset(base_mcd_path)
    ref_ds = xr.open_dataset(ozone_ref_path)
    try:
        target_ls = np.asarray(base_ds["Ls"].values, dtype=np.float32)
        target_lat = np.asarray(base_ds["lat"].values, dtype=np.float32)
        target_lon = np.asarray(base_ds["lon"].values, dtype=np.float32)

        ozone_by_ls = interpolate_reference_ozone(
            np.asarray(ref_ds["O3COL"].values, dtype=np.float32),
            np.asarray(ref_ds["LS"].values, dtype=np.float32),
            target_ls,
        )
        ozone_by_grid = regrid_latitude(ozone_by_ls, np.asarray(ref_ds["lat"].values), target_lat)

        data_vars = {
            "o3col": (("time", "lat", "lon"), ozone_by_grid.astype(np.float32)),
            "Ls": (("time",), target_ls.astype(np.float32)),
        }
        for field_name in BASE_FIELD_NAMES:
            if field_name not in base_ds:
                raise ValueError(f"Missing required MCD field: {field_name}")
            data_vars[field_name] = (("time", "lat", "lon"), _daily_mean(base_ds[field_name].values))

        out = xr.Dataset(
            data_vars=data_vars,
            coords={
                "time": np.arange(target_ls.shape[0], dtype=np.int32),
                "lat": target_lat.astype(np.float32),
                "lon": target_lon.astype(np.float32),
            },
            attrs={
                "source": "AresVision derived MCD overview dataset",
                "ozone_source": str(ozone_ref_path),
                "base_mcd_source": str(base_mcd_path),
            },
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        out.to_netcdf(output_path)
        return output_path
    finally:
        base_ds.close()
        ref_ds.close()


def _default_reference_dir() -> Path:
    return REPO_ROOT / "Data" / "MCD_Output_global_10m_ls_lst"


def build_year(year: int, reference_dir: Path, output_dir: Path) -> Path:
    base_mcd = MCD_DIR / f"MCD_MY{year}_Lat-90-90_real.nc"
    ozone_ref = reference_dir / f"MCD_MY{year}_global_3h_5deg_10m_ls_lst.nc"
    output_path = output_dir / f"MCD_MY{year}_overview.nc"

    if not base_mcd.is_file():
        raise FileNotFoundError(f"Missing backend MCD file: {base_mcd}")
    if not ozone_ref.is_file():
        raise FileNotFoundError(f"Missing reference MCD ozone file: {ozone_ref}")

    return build_overview_dataset(base_mcd, ozone_ref, output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build MCD overview NetCDF files.")
    parser.add_argument("--years", nargs="+", type=int, default=SUPPORTED_MARS_YEARS)
    parser.add_argument("--reference-dir", type=Path, default=_default_reference_dir())
    parser.add_argument("--output-dir", type=Path, default=MCD_OVERVIEW_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for year in args.years:
        output_path = build_year(year, args.reference_dir, args.output_dir)
        print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
