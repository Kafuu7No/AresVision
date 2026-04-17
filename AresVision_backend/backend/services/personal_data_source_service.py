"""
Personal data-source resolver for Data Overview.

Resolution strategy for a given user + Mars year:
1) personal_full_year: personal OpenMARS + personal MCD (must be continuous full-year and fully alignable)
2) personal_mcd_plus_system_openmars: system OpenMARS + personal MCD (when personal OpenMARS is incomplete)
3) default: system OpenMARS + system MCD
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import xarray as xr
from cachetools import LRUCache
from sqlalchemy import select

from config import APPROVED_DIR, MCD_VARIABLES
from core.data_align import interpolate_mcd_to_openmars
from database.engine import async_session_maker
from database.models import UploadRecord
from services.data_service import DataService

logger = logging.getLogger("aresvision.personal_source")

_OPENMARS = "openmars"
_MCD = "mcd"
_PERSONAL = "personal"
_DEFAULT = "default"
_ALLOWED_STATUSES = ("valid", "pending_review", "approved")

# "Full year" heuristic on Ls:
# start near 0, end near 360, enough span, and no large holes.
_EDGE_TOL = 8.0
_MIN_SPAN = 350.0
_MAX_GAP = 20.0
_MAX_EDGE_EXTRAPOLATION = 2.0


@dataclass
class SourceResolution:
    requested_source: str
    effective_source: str
    mars_year: int
    openmars_data: dict
    aligned_mcd_data: dict
    mcd_raw_data: dict | None
    fallback: bool = False
    message: Optional[str] = None

    def source_meta(self) -> dict:
        return {
            "requested_source": self.requested_source,
            "effective_source": self.effective_source,
            "fallback": self.fallback,
            "message": self.message,
            "mars_year": self.mars_year,
        }


class SingleYearDataView:
    """Adapter that mimics DataService for one resolved year."""

    def __init__(self, mars_year: int, openmars_data: dict, aligned_mcd_data: dict, mcd_raw_data: dict | None):
        self._mars_year = mars_year
        self._openmars_data = openmars_data
        self._aligned_mcd_data = aligned_mcd_data
        self._mcd_raw_data = mcd_raw_data or {}

    def get_openmars_data(self, mars_year: int) -> dict:
        if mars_year != self._mars_year:
            raise ValueError(f"resolved data only supports MY{self._mars_year}")
        return self._openmars_data

    def get_mcd_data(self, mars_year: int) -> dict:
        if mars_year != self._mars_year:
            raise ValueError(f"resolved data only supports MY{self._mars_year}")
        return self._mcd_raw_data

    def get_aligned_mcd_data(self, mars_year: int) -> dict:
        if mars_year != self._mars_year:
            raise ValueError(f"resolved data only supports MY{self._mars_year}")
        return self._aligned_mcd_data

    @staticmethod
    def get_nearest_ls_index(ls_array: np.ndarray, target_ls: float) -> int:
        return int(np.argmin(np.abs(ls_array - target_ls)))


class PersonalDataSourceService:
    def __init__(self, data_service: DataService):
        self.data_service = data_service
        self._file_cache: LRUCache = LRUCache(maxsize=24)
        self._year_resolution_cache: LRUCache = LRUCache(maxsize=48)
        self._info_cache: LRUCache = LRUCache(maxsize=32)

    # ---------------- public API ----------------

    async def resolve_for_year(
        self,
        requested_source: str,
        mars_year: int,
        user_id: Optional[int],
    ) -> SourceResolution:
        """Resolve one year to an effective source bundle."""
        if requested_source != _PERSONAL:
            return self._default_resolution(_DEFAULT, mars_year)

        if user_id is None:
            return self._default_resolution(
                _PERSONAL,
                mars_year,
                message="未登录，已切换为系统默认数据源",
                fallback=True,
            )

        records = await self._fetch_user_records(user_id)
        signature = self._build_signature(records)
        cache_key = (user_id, mars_year, signature)
        cached = self._year_resolution_cache.get(cache_key)
        if cached is not None:
            return cached

        user_assets = self._build_user_assets(records)
        resolution = self._resolve_from_assets(_PERSONAL, mars_year, user_assets)
        self._year_resolution_cache[cache_key] = resolution
        return resolution

    async def get_data_info(self, requested_source: str, user_id: Optional[int]) -> dict:
        """
        Returns:
        {
          "available_years": [...],
          "details": {"MY27": {"ls_range": [...], "source_mode": "..."}},
          "source_meta": {...}
        }
        """
        system_years = self.data_service.get_available_years()

        if requested_source != _PERSONAL:
            details = {}
            for y in system_years:
                ls_min, ls_max = self.data_service.get_ls_range(y)
                details[f"MY{y}"] = {"ls_range": [ls_min, ls_max], "source_mode": _DEFAULT}
            return {
                "available_years": system_years,
                "details": details,
                "source_meta": {
                    "requested_source": _DEFAULT,
                    "effective_source": _DEFAULT,
                    "fallback": False,
                    "message": None,
                },
            }

        if user_id is None:
            details = {}
            for y in system_years:
                ls_min, ls_max = self.data_service.get_ls_range(y)
                details[f"MY{y}"] = {"ls_range": [ls_min, ls_max], "source_mode": _DEFAULT}
            return {
                "available_years": system_years,
                "details": details,
                "source_meta": {
                    "requested_source": _PERSONAL,
                    "effective_source": _DEFAULT,
                    "fallback": True,
                    "message": "未登录，已切换为系统默认数据源",
                },
            }

        records = await self._fetch_user_records(user_id)
        signature = self._build_signature(records)
        cache_key = (user_id, signature)
        cached = self._info_cache.get(cache_key)
        if cached is not None:
            return cached

        user_assets = self._build_user_assets(records)
        per_year = {}
        personal_years = []
        has_full = False
        has_mixed = False

        for year in system_years:
            res = self._resolve_from_assets(_PERSONAL, year, user_assets)
            mode = res.effective_source
            ls_min = float(res.openmars_data["ls"][0])
            ls_max = float(res.openmars_data["ls"][-1])
            per_year[f"MY{year}"] = {
                "ls_range": [ls_min, ls_max],
                "source_mode": mode,
            }
            if mode in ("personal_full_year", "personal_mcd_plus_system_openmars"):
                personal_years.append(year)
            if mode == "personal_full_year":
                has_full = True
            if mode == "personal_mcd_plus_system_openmars":
                has_mixed = True

        if personal_years:
            meta = {
                "requested_source": _PERSONAL,
                "effective_source": "personal_available",
                "fallback": has_mixed and not has_full,
                "message": (
                    "个人 OpenMARS 不足完整一年，已自动使用系统 OpenMARS + 个人 MCD"
                    if (has_mixed and not has_full)
                    else None
                ),
            }
            info = {
                "available_years": sorted(personal_years),
                "details": {f"MY{y}": per_year[f"MY{y}"] for y in sorted(personal_years)},
                "source_meta": meta,
            }
        else:
            fallback_details = {}
            for y in system_years:
                ls_min, ls_max = self.data_service.get_ls_range(y)
                fallback_details[f"MY{y}"] = {"ls_range": [ls_min, ls_max], "source_mode": _DEFAULT}
            info = {
                "available_years": system_years,
                "details": fallback_details,
                "source_meta": {
                    "requested_source": _PERSONAL,
                    "effective_source": _DEFAULT,
                    "fallback": True,
                    "message": "个人数据源不足，已切换为系统默认数据源",
                },
            }

        self._info_cache[cache_key] = info
        return info

    # ---------------- core resolution ----------------

    def _resolve_from_assets(self, requested_source: str, mars_year: int, user_assets: dict) -> SourceResolution:
        # system fallback if year not supported
        try:
            system_openmars = self.data_service.get_openmars_data(mars_year)
            system_aligned = self.data_service.get_aligned_mcd_data(mars_year)
            system_mcd = self.data_service.get_mcd_data(mars_year)
        except ValueError:
            years = self.data_service.get_available_years()
            if not years:
                raise
            fallback_year = years[0]
            return self._default_resolution(
                requested_source,
                fallback_year,
                message=f"MY{mars_year} 不可用，已切换到 MY{fallback_year} 系统数据源",
                fallback=True,
            )

        # 1) personal openmars (full-year) + personal mcd
        openmars_candidates = user_assets["openmars_by_year"].get(mars_year, [])
        mcd_candidates = user_assets["mcd_by_year"].get(mars_year, [])

        openmars_combined = self._combine_openmars_segments(openmars_candidates)
        mcd_candidate = self._pick_mcd_candidate(mcd_candidates)

        if (
            openmars_combined is not None
            and mcd_candidate is not None
            and self._is_full_year_continuous(openmars_combined["ls"])
            and self._is_full_year_continuous(mcd_candidate["ls"])
        ):
            aligned = self._align_mcd_to_target(mcd_candidate, openmars_combined["ls"])
            if aligned is not None and self._is_alignment_complete(aligned):
                return SourceResolution(
                    requested_source=requested_source,
                    effective_source="personal_full_year",
                    mars_year=mars_year,
                    openmars_data=openmars_combined,
                    aligned_mcd_data=aligned,
                    mcd_raw_data=mcd_candidate,
                    fallback=False,
                    message=None,
                )

        # 2) system openmars + personal mcd
        if mcd_candidate is not None and self._is_full_year_continuous(mcd_candidate["ls"]):
            aligned = self._align_mcd_to_target(mcd_candidate, system_openmars["ls"])
            if aligned is not None and self._is_alignment_complete(aligned):
                return SourceResolution(
                    requested_source=requested_source,
                    effective_source="personal_mcd_plus_system_openmars",
                    mars_year=mars_year,
                    openmars_data=system_openmars,
                    aligned_mcd_data=aligned,
                    mcd_raw_data=mcd_candidate,
                    fallback=True,
                    message="个人 OpenMARS 不足完整一年，已自动使用系统 OpenMARS + 个人 MCD",
                )

        # 3) full fallback
        return SourceResolution(
            requested_source=requested_source,
            effective_source=_DEFAULT,
            mars_year=mars_year,
            openmars_data=system_openmars,
            aligned_mcd_data=system_aligned,
            mcd_raw_data=system_mcd,
            fallback=True,
            message="个人数据源不足，已切换为系统默认数据源",
        )

    def _default_resolution(
        self,
        requested_source: str,
        mars_year: int,
        message: Optional[str] = None,
        fallback: bool = False,
    ) -> SourceResolution:
        openmars = self.data_service.get_openmars_data(mars_year)
        aligned = self.data_service.get_aligned_mcd_data(mars_year)
        mcd = self.data_service.get_mcd_data(mars_year)
        return SourceResolution(
            requested_source=requested_source,
            effective_source=_DEFAULT,
            mars_year=mars_year,
            openmars_data=openmars,
            aligned_mcd_data=aligned,
            mcd_raw_data=mcd,
            fallback=fallback,
            message=message,
        )

    # ---------------- user assets ----------------

    async def _fetch_user_records(self, user_id: int) -> list[UploadRecord]:
        async with async_session_maker() as db:
            stmt = (
                select(UploadRecord)
                .where(UploadRecord.user_id == user_id)
                .where(UploadRecord.status.in_(_ALLOWED_STATUSES))
                .where(UploadRecord.data_type.in_((_OPENMARS, _MCD)))
                .order_by(UploadRecord.created_at.desc(), UploadRecord.id.desc())
            )
            return (await db.execute(stmt)).scalars().all()

    @staticmethod
    def _build_signature(records: list[UploadRecord]) -> tuple:
        return tuple(
            (
                r.id,
                r.status,
                r.data_type,
                r.mars_year,
                r.file_path,
                int(r.created_at.timestamp()) if r.created_at else 0,
            )
            for r in records
        )

    def _build_user_assets(self, records: list[UploadRecord]) -> dict:
        openmars_by_year: dict[int, list[dict]] = {}
        mcd_by_year: dict[int, list[dict]] = {}

        for record in records:
            path = self._resolve_record_path(record)
            if path is None:
                continue

            dataset = self._load_dataset(path, record.data_type or "", record.mars_year)
            if dataset is None:
                continue

            year = dataset.get("mars_year") or record.mars_year
            if year is None:
                continue

            dataset["record_id"] = record.id
            if record.data_type == _OPENMARS:
                openmars_by_year.setdefault(year, []).append(dataset)
            elif record.data_type == _MCD:
                mcd_by_year.setdefault(year, []).append(dataset)

        return {
            "openmars_by_year": openmars_by_year,
            "mcd_by_year": mcd_by_year,
        }

    @staticmethod
    def _resolve_record_path(record: UploadRecord) -> Optional[Path]:
        approved_file = APPROVED_DIR / str(record.id) / "original.nc"
        if approved_file.exists():
            return approved_file

        p = Path(record.file_path)
        if p.exists():
            return p
        return None

    # ---------------- dataset loading ----------------

    def _load_dataset(self, file_path: Path, data_type: str, mars_year_hint: Optional[int]) -> Optional[dict]:
        try:
            mtime = file_path.stat().st_mtime_ns
        except OSError:
            return None

        cache_key = (str(file_path), mtime, data_type, mars_year_hint)
        cached = self._file_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            if data_type == _OPENMARS:
                parsed = self._load_openmars_file(file_path, mars_year_hint)
            elif data_type == _MCD:
                parsed = self._load_mcd_file(file_path, mars_year_hint)
            else:
                parsed = None
        except Exception as exc:
            logger.warning("failed to parse user dataset %s: %s", file_path, exc)
            parsed = None

        if parsed is not None:
            self._file_cache[cache_key] = parsed
        return parsed

    @staticmethod
    def _pick_name(names: list[str], candidates: tuple[str, ...]) -> Optional[str]:
        lower = {n.lower(): n for n in names}
        for c in candidates:
            if c.lower() in lower:
                return lower[c.lower()]
        return None

    @staticmethod
    def _extract_year_from_filename(file_path: Path) -> Optional[int]:
        m = re.search(r"[Mm][Yy]_?(\d{2,3})", file_path.name)
        if m:
            return int(m.group(1))
        return None

    def _load_openmars_file(self, file_path: Path, mars_year_hint: Optional[int]) -> Optional[dict]:
        with xr.open_dataset(file_path, decode_times=False) as ds:
            if "o3col" not in ds.data_vars:
                return None

            coord_names = list(ds.coords) + list(ds.data_vars)
            lat_name = self._pick_name(coord_names, ("lat", "latitude"))
            lon_name = self._pick_name(coord_names, ("lon", "longitude"))
            ls_name = self._pick_name(coord_names, ("ls", "l_s", "solar_longitude"))

            if not lat_name or not lon_name or not ls_name:
                return None

            lat = np.asarray(ds[lat_name].values, dtype=float)
            lon = np.asarray(ds[lon_name].values, dtype=float)
            ls = np.asarray(ds[ls_name].values, dtype=float).reshape(-1)
            o3 = np.asarray(ds["o3col"].values, dtype=float)

            if o3.ndim == 4:
                o3 = np.nanmean(o3, axis=1)
            if o3.ndim != 3:
                return None
            if o3.shape[0] != len(ls):
                return None

            sort_idx = np.argsort(ls)
            ls = ls[sort_idx]
            o3 = o3[sort_idx]

            year = mars_year_hint or self._extract_year_from_filename(file_path)
            return {
                "data_type": _OPENMARS,
                "mars_year": year,
                "lat": lat,
                "lon": lon,
                "ls": ls,
                "o3col": o3,
            }

    def _load_mcd_file(self, file_path: Path, mars_year_hint: Optional[int]) -> Optional[dict]:
        with xr.open_dataset(file_path, decode_times=False) as ds:
            coord_names = list(ds.coords) + list(ds.data_vars)
            lat_name = self._pick_name(coord_names, ("lat", "latitude"))
            lon_name = self._pick_name(coord_names, ("lon", "longitude"))
            ls_name = self._pick_name(coord_names, ("ls", "l_s", "solar_longitude"))
            if not lat_name or not lon_name or not ls_name:
                return None

            lat = np.asarray(ds[lat_name].values, dtype=float)
            lon = np.asarray(ds[lon_name].values, dtype=float)
            ls = np.asarray(ds[ls_name].values, dtype=float).reshape(-1)

            parsed = {
                "data_type": _MCD,
                "mars_year": mars_year_hint or self._extract_year_from_filename(file_path),
                "lat": lat,
                "lon": lon,
                "ls": ls,
            }

            found_any = False
            for var in MCD_VARIABLES:
                if var not in ds.data_vars:
                    continue
                arr = np.asarray(ds[var].values, dtype=float)
                found_any = True
                if arr.ndim == 4:
                    parsed[var] = np.nanmean(arr, axis=1)
                    parsed[f"{var}_hourly"] = arr
                elif arr.ndim == 3:
                    parsed[var] = arr

            if not found_any:
                return None

            sort_idx = np.argsort(parsed["ls"])
            parsed["ls"] = parsed["ls"][sort_idx]
            for var in MCD_VARIABLES:
                if var in parsed:
                    parsed[var] = parsed[var][sort_idx]
                    hourly_key = f"{var}_hourly"
                    if hourly_key in parsed:
                        parsed[hourly_key] = parsed[hourly_key][sort_idx]
            return parsed

    # ---------------- selecting and aligning ----------------

    @staticmethod
    def _has_full_mcd_vars(dataset: dict) -> bool:
        return all(var in dataset and getattr(dataset[var], "ndim", 0) == 3 for var in MCD_VARIABLES)

    def _pick_mcd_candidate(self, candidates: list[dict]) -> Optional[dict]:
        for c in candidates:
            if self._has_full_mcd_vars(c) and self._is_full_year_continuous(c["ls"]):
                return c
        for c in candidates:
            if self._has_full_mcd_vars(c):
                return c
        return None

    @staticmethod
    def _combine_openmars_segments(candidates: list[dict]) -> Optional[dict]:
        if not candidates:
            return None

        base = candidates[0]
        lat_shape = np.asarray(base["lat"]).shape
        lon_shape = np.asarray(base["lon"]).shape
        grid_shape = np.asarray(base["o3col"]).shape[1:]

        ls_parts = []
        o3_parts = []
        for c in candidates:
            if np.asarray(c["lat"]).shape != lat_shape:
                continue
            if np.asarray(c["lon"]).shape != lon_shape:
                continue
            if np.asarray(c["o3col"]).shape[1:] != grid_shape:
                continue
            ls_parts.append(np.asarray(c["ls"], dtype=float))
            o3_parts.append(np.asarray(c["o3col"], dtype=float))

        if not ls_parts:
            return None

        ls_all = np.concatenate(ls_parts, axis=0)
        o3_all = np.concatenate(o3_parts, axis=0)
        sort_idx = np.argsort(ls_all)
        ls_all = ls_all[sort_idx]
        o3_all = o3_all[sort_idx]

        # de-duplicate near-identical Ls to avoid duplicate time slices
        rounded = np.round(ls_all, 3)
        _, unique_idx = np.unique(rounded, return_index=True)
        unique_idx = np.sort(unique_idx)
        ls_all = ls_all[unique_idx]
        o3_all = o3_all[unique_idx]

        return {
            "data_type": _OPENMARS,
            "mars_year": base.get("mars_year"),
            "lat": base["lat"],
            "lon": base["lon"],
            "ls": ls_all,
            "o3col": o3_all,
        }

    @staticmethod
    def _is_full_year_continuous(ls: np.ndarray) -> bool:
        ls_arr = np.asarray(ls, dtype=float).reshape(-1)
        ls_arr = ls_arr[np.isfinite(ls_arr)]
        if ls_arr.size < 20:
            return False

        ls_sorted = np.sort(ls_arr)
        span = float(ls_sorted[-1] - ls_sorted[0])
        max_gap = float(np.max(np.diff(ls_sorted))) if ls_sorted.size > 1 else 360.0
        start_ok = float(ls_sorted[0]) <= _EDGE_TOL
        end_ok = float(ls_sorted[-1]) >= 360.0 - _EDGE_TOL
        return (span >= _MIN_SPAN) and (max_gap <= _MAX_GAP) and start_ok and end_ok

    def _align_mcd_to_target(self, mcd_data: dict, target_ls: np.ndarray) -> Optional[dict]:
        if "ls" not in mcd_data or mcd_data["ls"] is None:
            return None

        src_ls = np.asarray(mcd_data["ls"], dtype=float)
        target_ls = np.asarray(target_ls, dtype=float)
        src_sorted = np.sort(src_ls)
        tgt_sorted = np.sort(target_ls)

        def _interpolate_all(extrapolate: bool) -> Optional[dict]:
            out = {"ls": target_ls}
            try:
                for var in MCD_VARIABLES:
                    if var not in mcd_data:
                        return None
                    out[var] = interpolate_mcd_to_openmars(
                        np.asarray(mcd_data[var], dtype=float),
                        src_ls,
                        target_ls,
                        extrapolate=extrapolate,
                    )
            except Exception as exc:
                logger.warning("failed to align personal mcd (extrapolate=%s): %s", extrapolate, exc)
                return None
            return out

        # First pass: strict in-range interpolation only.
        aligned = _interpolate_all(extrapolate=False)
        if aligned is None:
            return None
        if self._is_alignment_complete(aligned):
            return aligned

        # If only tiny edge ranges are uncovered, retry with bounded extrapolation.
        # This avoids false fallback when source is practically full-year.
        left_gap = max(0.0, float(src_sorted[0] - tgt_sorted[0]))
        right_gap = max(0.0, float(tgt_sorted[-1] - src_sorted[-1]))
        can_extrapolate_edges = (
            self._is_full_year_continuous(src_ls)
            and left_gap <= _MAX_EDGE_EXTRAPOLATION
            and right_gap <= _MAX_EDGE_EXTRAPOLATION
        )
        if can_extrapolate_edges:
            aligned_ex = _interpolate_all(extrapolate=True)
            if aligned_ex is not None:
                return aligned_ex

        return aligned

    @staticmethod
    def _is_alignment_complete(aligned_mcd: dict) -> bool:
        for var in MCD_VARIABLES:
            arr = aligned_mcd.get(var)
            if arr is None or getattr(arr, "ndim", 0) != 3:
                return False
            # full-year overview requires every timestep to retain valid data
            valid_t = np.any(np.isfinite(arr), axis=(1, 2))
            if len(valid_t) == 0 or not np.all(valid_t):
                return False
        return True
