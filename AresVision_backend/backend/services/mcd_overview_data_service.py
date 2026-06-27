"""
MCD-only data adapter for the data overview page.

This class deliberately mimics the subset of DataService consumed by
AnalysisService. Its "openmars" view is the MCD overview ozone field, which
lets existing analysis code treat o3col as the main target without changing
legacy /explore behavior elsewhere.
"""

from __future__ import annotations

import glob
import logging
from pathlib import Path

import numpy as np
import xarray as xr

from config import MCD_OVERVIEW_DIR, OVERVIEW_OZONE_MATCH_TOLERANCE_LS, SUPPORTED_MARS_YEARS
from services.data_service import DataService

logger = logging.getLogger("aresvision.mcd_overview")

OVERVIEW_ENV_FIELDS = [
    "Temperature",
    "U_Wind",
    "V_Wind",
    "Dust_Optical_Depth",
    "Solar_Flux_DN",
]


class McdOverviewDataService:
    def __init__(self, base_data_service: DataService):
        self.base = base_data_service
        self.overview: dict[int, dict] = {}
        self._load_all()

    def _load_all(self) -> None:
        for mars_year in SUPPORTED_MARS_YEARS:
            self._load_year(mars_year)
        logger.info("MCD overview data loaded for years: %s", sorted(self.overview.keys()))

    def _load_year(self, mars_year: int) -> None:
        pattern = str(MCD_OVERVIEW_DIR / f"*MY{mars_year}*overview*.nc")
        files = sorted(glob.glob(pattern))
        if not files:
            logger.warning("MCD overview file not found for MY%s: %s", mars_year, pattern)
            return

        file_path = Path(files[0])
        with xr.open_dataset(file_path, decode_times=False) as ds:
            required = ["o3col", "Ls", "lat", "lon", *OVERVIEW_ENV_FIELDS]
            missing = [name for name in required if name not in ds]
            if missing:
                raise ValueError(f"{file_path} missing required fields: {missing}")

            data = {
                "o3col": np.asarray(ds["o3col"].values, dtype=np.float32),
                "ls": np.asarray(ds["Ls"].values, dtype=np.float32),
                "lat": np.asarray(ds["lat"].values, dtype=np.float32),
                "lon": np.asarray(ds["lon"].values, dtype=np.float32),
                "source_file": str(file_path),
            }
            for field_name in OVERVIEW_ENV_FIELDS:
                data[field_name] = np.asarray(ds[field_name].values, dtype=np.float32)

        self.overview[mars_year] = data

    def _require_year(self, mars_year: int) -> dict:
        if mars_year not in self.overview:
            raise ValueError(f"MY{mars_year} MCD overview data is not loaded")
        return self.overview[mars_year]

    def get_openmars_data(self, mars_year: int) -> dict:
        year = self._require_year(mars_year)
        return {
            "o3col": year["o3col"],
            "ls": year["ls"],
            "lat": year["lat"],
            "lon": year["lon"],
        }

    def get_aligned_mcd_data(self, mars_year: int) -> dict:
        year = self._require_year(mars_year)
        aligned = {
            "ls": year["ls"],
            "lat": year["lat"],
            "lon": year["lon"],
        }
        for field_name in OVERVIEW_ENV_FIELDS:
            aligned[field_name] = year[field_name]
        return aligned

    def get_mcd_data(self, mars_year: int) -> dict:
        return self.base.get_mcd_data(mars_year)

    def get_available_years(self) -> list[int]:
        return sorted(self.overview.keys())

    def get_ls_range(self, mars_year: int) -> tuple[float, float]:
        year = self._require_year(mars_year)
        return float(year["ls"][0]), float(year["ls"][-1])

    @staticmethod
    def get_nearest_ls_index(ls_array: np.ndarray, target_ls: float) -> int:
        return int(np.argmin(np.abs(np.asarray(ls_array, dtype=float) - float(target_ls))))

    def _points_from_field(self, field: np.ndarray, lat_arr: np.ndarray, lon_arr: np.ndarray) -> list[dict]:
        points = []
        for i, lat in enumerate(lat_arr):
            for j, lon in enumerate(lon_arr):
                val = float(field[i, j])
                if np.isfinite(val):
                    lon_value = float(lon) if float(lon) <= 180 else float(lon) - 360
                    points.append({"lat": float(lat), "lng": lon_value, "val": val})
        return points

    def _build_layer_from_source(self, source_data: dict, ls: float, source: str) -> dict:
        idx = self.get_nearest_ls_index(source_data["ls"], ls)
        field = np.asarray(source_data["o3col"][idx], dtype=np.float32)
        valid = field[np.isfinite(field)]
        return {
            "source": source,
            "points": self._points_from_field(field, source_data["lat"], source_data["lon"]),
            "minVal": float(np.nanmin(valid)) if valid.size else 0.0,
            "maxVal": float(np.nanmax(valid)) if valid.size else 1.0,
            "ls": float(source_data["ls"][idx]),
        }

    def _match_openmars_layer(self, mars_year: int, anchor_ls: float) -> dict | None:
        try:
            openmars = self.base.get_openmars_data(mars_year)
        except ValueError:
            return None

        idx = self.get_nearest_ls_index(openmars["ls"], anchor_ls)
        matched_ls = float(openmars["ls"][idx])
        if abs(matched_ls - float(anchor_ls)) > OVERVIEW_OZONE_MATCH_TOLERANCE_LS:
            return None

        return self._build_layer_from_source(openmars, matched_ls, "openmars")

    def get_ozone_overlay_payload(self, mars_year: int, ls: float) -> dict:
        mcd = self._build_layer_from_source(self.get_openmars_data(mars_year), ls, "mcd")
        openmars = self._match_openmars_layer(mars_year, mcd["ls"])
        nomad = None

        available_sources = [
            source
            for source, layer in (("mcd", mcd), ("openmars", openmars), ("nomad", nomad))
            if layer is not None
        ]
        diff_candidates = []
        if openmars is not None:
            diff_candidates.append("MCD-OpenMARS")
        if nomad is not None:
            diff_candidates.append("MCD-NOMAD")

        return {
            "mars_year": int(mars_year),
            "requested_ls": float(ls),
            "anchor_ls": float(mcd["ls"]),
            "mcd": mcd,
            "openmars": openmars,
            "nomad": nomad,
            "available_sources": available_sources,
            "diff_candidates": diff_candidates,
            "capabilities": {"openmars": True, "nomad": False},
        }
