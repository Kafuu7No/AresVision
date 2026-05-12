"""
Data governance service:
- Asset overview aggregation
- Dataset quality scoring
- Lineage and provenance details
"""

from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path
from typing import Optional

import numpy as np
import xarray as xr
from cachetools import LRUCache
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from config import APPROVED_DIR, MCD_VARIABLES, N_LAT, N_LON
from database.engine import async_session_maker
from database.models import UploadRecord, User

logger = logging.getLogger("aresvision.data_governance")

_OPENMARS = "openmars"
_MCD = "mcd"
_STATUS_ORDER = ["valid", "invalid", "pending_review", "approved", "rejected"]

_LAT_ALIASES = ("lat", "latitude")
_LON_ALIASES = ("lon", "longitude")
_LS_ALIASES = ("ls", "l_s", "solar_longitude")


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _safe_float(v) -> Optional[float]:
    try:
        if v is None:
            return None
        f = float(v)
        if np.isnan(f):
            return None
        return f
    except Exception:
        return None


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    return "D"


class DataGovernanceService:
    def __init__(self) -> None:
        self._meta_cache: LRUCache = LRUCache(maxsize=256)
        self._quality_cache: LRUCache = LRUCache(maxsize=256)

    async def get_overview(self, scope: str, current_user: User) -> dict:
        if scope not in ("mine", "all"):
            raise ValueError("scope must be 'mine' or 'all'")
        if scope == "all" and current_user.role != "admin":
            raise PermissionError("admin permission required for scope=all")

        records = await self._fetch_records(scope=scope, user_id=current_user.id)

        status_counter: Counter[str] = Counter()
        source_counter: Counter[str] = Counter()
        year_counter: Counter[str] = Counter()
        quality_scores: list[float] = []
        assets: list[dict] = []

        for record in records:
            status_counter[record.status] += 1
            source_counter[(record.data_type or "unknown").lower()] += 1
            if record.mars_year is not None:
                year_counter[f"MY{record.mars_year}"] += 1

            file_meta = self._resolve_record_file(record)
            path = file_meta["path"]
            meta = self._get_dataset_meta(record, path) if path else self._empty_meta(record)

            quality_score = None
            if path:
                quality = self._get_quality_metrics(record, path, meta)
                quality_score = quality["scores"]["overall"]
                quality_scores.append(quality_score)

            assets.append(
                {
                    "upload_id": record.id,
                    "filename": record.filename,
                    "data_type": record.data_type or meta.get("data_type") or "unknown",
                    "mars_year": record.mars_year,
                    "variables": meta.get("variables", []),
                    "ls_range": meta.get("ls_range"),
                    "ls_coverage": meta.get("ls_coverage"),
                    "grid": {
                        "lat_points": meta.get("lat_points", 0),
                        "lon_points": meta.get("lon_points", 0),
                    },
                    "status": record.status,
                    "quality_score": quality_score,
                    "uploader": {
                        "id": record.uploader.id if record.uploader else None,
                        "username": record.uploader.username if record.uploader else None,
                        "email": record.uploader.email if record.uploader else None,
                    },
                    "reviewer": {
                        "id": record.reviewer.id if record.reviewer else None,
                        "username": record.reviewer.username if record.reviewer else None,
                        "email": record.reviewer.email if record.reviewer else None,
                    }
                    if record.reviewer
                    else None,
                    "created_at": _iso(record.created_at),
                    "reviewed_at": _iso(record.reviewed_at),
                    "storage_zone": file_meta["storage_zone"],
                    "effective": file_meta["effective"],
                }
            )

        status_distribution = {k: status_counter.get(k, 0) for k in _STATUS_ORDER}
        for k, v in status_counter.items():
            if k not in status_distribution:
                status_distribution[k] = v

        avg_quality = float(np.mean(quality_scores)) if quality_scores else None
        effective_count = sum(1 for a in assets if a["effective"])

        return {
            "scope": scope,
            "summary": {
                "total_datasets": len(assets),
                "effective_datasets": effective_count,
                "status_distribution": status_distribution,
                "data_source_distribution": dict(source_counter),
                "mars_year_distribution": dict(year_counter),
                "average_quality_score": round(avg_quality, 2) if avg_quality is not None else None,
            },
            "assets": assets,
        }

    async def get_quality(self, upload_id: int, current_user: User) -> dict:
        record = await self._get_record(upload_id)
        self._assert_access(record, current_user)

        file_meta = self._resolve_record_file(record)
        if file_meta["path"] is None:
            raise FileNotFoundError("dataset file not found")

        meta = self._get_dataset_meta(record, file_meta["path"])
        quality = self._get_quality_metrics(record, file_meta["path"], meta)

        return {
            "upload_id": record.id,
            "filename": record.filename,
            "status": record.status,
            "data_type": record.data_type or meta.get("data_type") or "unknown",
            "metrics": quality["metrics"],
            "scores": quality["scores"],
            "issues": quality["issues"],
            "computed_from": {
                "storage_zone": file_meta["storage_zone"],
                "effective": file_meta["effective"],
            },
        }

    async def get_lineage(self, upload_id: int, current_user: User) -> dict:
        record = await self._get_record(upload_id)
        self._assert_access(record, current_user)
        file_meta = self._resolve_record_file(record)

        events = [
            {
                "type": "uploaded",
                "actor": record.uploader.username if record.uploader else None,
                "at": _iso(record.created_at),
                "detail": "file uploaded and validated",
            }
        ]

        if record.status in ("pending_review", "approved", "rejected") and record.is_public:
            events.append(
                {
                    "type": "submitted_for_review",
                    "actor": record.uploader.username if record.uploader else None,
                    "at": None,
                    "detail": "submitted to public review workflow",
                }
            )

        if record.reviewed_at:
            events.append(
                {
                    "type": record.status if record.status in ("approved", "rejected") else "reviewed",
                    "actor": record.reviewer.username if record.reviewer else None,
                    "at": _iso(record.reviewed_at),
                    "detail": record.validation_message or "",
                }
            )

        return {
            "upload_id": record.id,
            "filename": record.filename,
            "status": record.status,
            "data_type": record.data_type,
            "mars_year": record.mars_year,
            "description": record.description,
            "file_hash": record.file_hash,
            "uploader": {
                "id": record.uploader.id if record.uploader else None,
                "username": record.uploader.username if record.uploader else None,
                "email": record.uploader.email if record.uploader else None,
            },
            "reviewer": {
                "id": record.reviewer.id if record.reviewer else None,
                "username": record.reviewer.username if record.reviewer else None,
                "email": record.reviewer.email if record.reviewer else None,
            }
            if record.reviewer
            else None,
            "timestamps": {
                "uploaded_at": _iso(record.created_at),
                "reviewed_at": _iso(record.reviewed_at),
            },
            "current_effective_data_source": {
                "storage_zone": file_meta["storage_zone"],
                "effective": file_meta["effective"],
                "path_exists": bool(file_meta["path"]),
            },
            "events": events,
        }

    async def _fetch_records(self, scope: str, user_id: int) -> list[UploadRecord]:
        async with async_session_maker() as db:
            stmt = (
                select(UploadRecord)
                .options(selectinload(UploadRecord.uploader), selectinload(UploadRecord.reviewer))
                .order_by(UploadRecord.created_at.desc(), UploadRecord.id.desc())
            )
            if scope == "mine":
                stmt = stmt.where(UploadRecord.user_id == user_id)
            return (await db.execute(stmt)).scalars().all()

    async def _get_record(self, upload_id: int) -> UploadRecord:
        async with async_session_maker() as db:
            stmt = (
                select(UploadRecord)
                .options(selectinload(UploadRecord.uploader), selectinload(UploadRecord.reviewer))
                .where(UploadRecord.id == upload_id)
            )
            record = (await db.execute(stmt)).scalars().first()
            if record is None:
                raise ValueError("upload record not found")
            return record

    @staticmethod
    def _assert_access(record: UploadRecord, current_user: User) -> None:
        if current_user.role == "admin":
            return
        if record.user_id == current_user.id:
            return
        raise PermissionError("insufficient permission")

    @staticmethod
    def _resolve_record_file(record: UploadRecord) -> dict:
        approved_path = APPROVED_DIR / str(record.id) / "original.nc"
        if record.status == "approved" and approved_path.exists():
            return {"path": approved_path, "storage_zone": "approved", "effective": True}

        p = Path(record.file_path) if record.file_path else None
        if p and p.exists():
            return {
                "path": p,
                "storage_zone": "user_uploads",
                "effective": record.status == "approved",
            }

        return {"path": None, "storage_zone": "missing", "effective": False}

    def _cache_key(self, record: UploadRecord, file_path: Path, suffix: str) -> tuple:
        try:
            mtime_ns = file_path.stat().st_mtime_ns
        except OSError:
            mtime_ns = 0
        return (record.id, str(file_path), mtime_ns, record.file_hash or "", suffix)

    @staticmethod
    def _pick_name(candidates: list[str], aliases: tuple[str, ...]) -> Optional[str]:
        lowered = {name.lower(): name for name in candidates}
        for alias in aliases:
            if alias in lowered:
                return lowered[alias]
        return None

    @staticmethod
    def _size_of(ds: xr.Dataset, name: Optional[str]) -> int:
        if not name:
            return 0
        if name in ds.sizes:
            return int(ds.sizes[name])
        if name in ds:
            return int(np.asarray(ds[name].values).shape[0]) if np.asarray(ds[name].values).size > 0 else 0
        return 0

    def _extract_ls_values(self, ds: xr.Dataset, ls_name: Optional[str]) -> np.ndarray:
        if not ls_name:
            return np.array([], dtype=float)
        try:
            vals = np.asarray(ds[ls_name].values, dtype=float).reshape(-1)
        except Exception:
            return np.array([], dtype=float)
        vals = vals[np.isfinite(vals)]
        if vals.size == 0:
            return vals
        return np.unique(np.sort(vals))

    @staticmethod
    def _detect_data_type(variables: list[str]) -> str:
        if "o3col" in variables:
            return _OPENMARS
        if any(v in variables for v in MCD_VARIABLES):
            return _MCD
        return "unknown"

    def _empty_meta(self, record: UploadRecord) -> dict:
        ls_range = None
        if record.ls_start is not None and record.ls_end is not None:
            ls_range = [float(record.ls_start), float(record.ls_end)]
        return {
            "data_type": record.data_type or "unknown",
            "variables": [],
            "ls_range": ls_range,
            "ls_coverage": None,
            "lat_points": 0,
            "lon_points": 0,
            "ls_points": 0,
        }

    def _get_dataset_meta(self, record: UploadRecord, file_path: Path) -> dict:
        key = self._cache_key(record, file_path, "meta")
        cached = self._meta_cache.get(key)
        if cached is not None:
            return cached

        with xr.open_dataset(file_path, decode_times=False) as ds:
            variables = sorted(list(ds.data_vars))
            names = list(ds.dims) + list(ds.coords) + list(ds.data_vars)

            lat_name = self._pick_name(names, _LAT_ALIASES)
            lon_name = self._pick_name(names, _LON_ALIASES)
            ls_name = self._pick_name(names, _LS_ALIASES)

            lat_points = self._size_of(ds, lat_name)
            lon_points = self._size_of(ds, lon_name)
            ls_values = self._extract_ls_values(ds, ls_name)

            ls_range = None
            ls_coverage = None
            if ls_values.size:
                ls_min = float(ls_values[0])
                ls_max = float(ls_values[-1])
                ls_range = [ls_min, ls_max]
                ls_coverage = round(max(0.0, min(1.0, (ls_max - ls_min) / 360.0)), 4)

            meta = {
                "data_type": record.data_type or self._detect_data_type(variables),
                "variables": variables,
                "lat_points": lat_points,
                "lon_points": lon_points,
                "ls_points": int(ls_values.size),
                "ls_range": ls_range,
                "ls_coverage": ls_coverage,
                "lat_name": lat_name,
                "lon_name": lon_name,
                "ls_name": ls_name,
            }

        self._meta_cache[key] = meta
        return meta

    @staticmethod
    def _required_vars(data_type: str) -> list[str]:
        if data_type == _OPENMARS:
            return ["o3col"]
        if data_type == _MCD:
            return list(MCD_VARIABLES)
        return []

    def _pick_primary_var(self, ds: xr.Dataset, data_type: str, required_vars: list[str]) -> Optional[str]:
        if data_type == _OPENMARS and "o3col" in ds.data_vars:
            return "o3col"
        for var in required_vars:
            if var in ds.data_vars:
                return var
        if ds.data_vars:
            return list(ds.data_vars)[0]
        return None

    @staticmethod
    def _grid_score(lat_points: int, lon_points: int) -> tuple[float, dict]:
        if lat_points <= 0 or lon_points <= 0:
            return 0.0, {"compatible": False, "mode": "missing"}
        if lat_points == N_LAT and lon_points == N_LON:
            return 100.0, {"compatible": True, "mode": "native", "factor": 1}
        if lat_points % N_LAT == 0 and lon_points % N_LON == 0:
            factor = max(lat_points // N_LAT, lon_points // N_LON)
            score = max(70.0, 95.0 - 8.0 * (factor - 1))
            return float(score), {"compatible": True, "mode": "downsample", "factor": factor}
        return 0.0, {"compatible": False, "mode": "incompatible"}

    @staticmethod
    def _time_continuity_score(ls_values: np.ndarray) -> tuple[float, dict]:
        if ls_values.size < 2:
            return 0.0, {"max_gap": None, "coverage_ratio": 0.0, "points": int(ls_values.size)}

        span = float(ls_values[-1] - ls_values[0])
        coverage_ratio = max(0.0, min(1.0, span / 350.0))
        diffs = np.diff(ls_values)
        max_gap = float(np.max(diffs)) if diffs.size else 360.0
        gap_ratio = max(0.0, 1.0 - max_gap / 45.0)
        density_ratio = min(1.0, float(ls_values.size) / 72.0)

        score = 100.0 * (0.5 * coverage_ratio + 0.35 * gap_ratio + 0.15 * density_ratio)
        return float(max(0.0, min(100.0, score))), {
            "max_gap": max_gap,
            "coverage_ratio": round(max(0.0, min(1.0, span / 360.0)), 4),
            "points": int(ls_values.size),
        }

    def _get_quality_metrics(self, record: UploadRecord, file_path: Path, meta: dict) -> dict:
        key = self._cache_key(record, file_path, "quality")
        cached = self._quality_cache.get(key)
        if cached is not None:
            return cached

        issues: list[str] = []

        with xr.open_dataset(file_path, decode_times=False) as ds:
            data_type = meta.get("data_type") or record.data_type or "unknown"
            required_vars = self._required_vars(data_type)
            present_required = [v for v in required_vars if v in ds.data_vars]
            missing_required = [v for v in required_vars if v not in ds.data_vars]
            variable_completeness = (
                len(present_required) / len(required_vars) if required_vars else 1.0
            )

            primary_var = self._pick_primary_var(ds, data_type, required_vars)
            missing_rate = 1.0
            valid_ratio = 0.0
            if primary_var:
                arr = np.asarray(ds[primary_var].values, dtype=float)
                if arr.ndim == 4:
                    arr = np.nanmean(arr, axis=1)
                flat = arr.reshape(-1)
                total = max(flat.size, 1)
                valid_count = int(np.isfinite(flat).sum())
                valid_ratio = valid_count / total
                missing_rate = 1.0 - valid_ratio
            else:
                issues.append("No primary variable found for quality scoring")

            ls_values = self._extract_ls_values(ds, meta.get("ls_name"))
            time_score, time_detail = self._time_continuity_score(ls_values)

        grid_score, grid_detail = self._grid_score(meta.get("lat_points", 0), meta.get("lon_points", 0))
        missing_score = max(0.0, min(100.0, (1.0 - missing_rate) * 100.0))
        valid_score = max(0.0, min(100.0, valid_ratio * 100.0))
        variable_score = max(0.0, min(100.0, variable_completeness * 100.0))

        overall = (
            0.20 * missing_score
            + 0.25 * valid_score
            + 0.20 * variable_score
            + 0.20 * time_score
            + 0.15 * grid_score
        )
        overall = float(round(overall, 2))

        if missing_rate > 0.2:
            issues.append(f"Missing rate is high ({missing_rate:.1%})")
        if variable_completeness < 1.0:
            issues.append(f"Required variables missing: {', '.join(missing_required)}")
        if time_score < 60:
            issues.append("Time continuity is weak for full-season analysis")
        if grid_score < 70:
            issues.append("Grid is incompatible with native 36x72 resolution")

        result = {
            "metrics": {
                "missing_rate": round(missing_rate, 6),
                "valid_value_ratio": round(valid_ratio, 6),
                "variable_completeness": round(variable_completeness, 6),
                "time_continuity": {
                    "score": round(time_score, 2),
                    **time_detail,
                },
                "grid_compatibility": {
                    "score": round(grid_score, 2),
                    **grid_detail,
                    "lat_points": meta.get("lat_points", 0),
                    "lon_points": meta.get("lon_points", 0),
                    "expected": [N_LAT, N_LON],
                },
                "variables": {
                    "required": required_vars,
                    "present": present_required,
                    "missing": missing_required,
                },
            },
            "scores": {
                "missing_rate_score": round(missing_score, 2),
                "valid_ratio_score": round(valid_score, 2),
                "variable_score": round(variable_score, 2),
                "time_score": round(time_score, 2),
                "grid_score": round(grid_score, 2),
                "overall": overall,
                "grade": _grade(overall),
            },
            "issues": issues,
        }

        self._quality_cache[key] = result
        return result
