"""
上传校验服务
-----------
封装 .nc 文件的保存、校验、元信息提取和数据库记录逻辑。
校验函数是同步的（xarray I/O），通过 run_in_executor 在线程池中调用。
"""

import asyncio
import logging
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import xarray as xr
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from config import (
    ALLOWED_NC_EXTENSIONS,
    MAX_UPLOAD_SIZE_MB,
    MCD_VARIABLES,
    N_LAT,
    N_LON,
    PENDING_REVIEW_DIR,
    USER_UPLOADS_DIR,
)
from database.models import UploadRecord

logger = logging.getLogger("aresvision.upload")

# MCD 类型检测时额外包含 Pressure（存在于 MCD 文件中，但不在 MCD_VARIABLES 常量里）
_MCD_DETECT_VARS: set[str] = set(MCD_VARIABLES) | {"Pressure"}

# 维度名模糊匹配（统一转小写后比较）
_LAT_ALIASES = {"lat", "latitude"}
_LON_ALIASES = {"lon", "longitude"}

# Ls 是数据变量而非维度（两种格式均如此，经调查确认）
_LS_VAR_ALIASES = {"ls", "l_s", "solar_longitude"}


# ─── 数据类 ───────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    is_valid:   bool            = False
    data_type:  Optional[str]   = None   # 'openmars' | 'mcd' | None
    mars_year:  Optional[int]   = None
    ls_start:   Optional[float] = None
    ls_end:     Optional[float] = None
    lat_points: int             = 0
    lon_points: int             = 0
    ls_points:  int             = 0
    variables:  list            = field(default_factory=list)
    warnings:   list            = field(default_factory=list)
    error:      Optional[str]   = None


# ─── 服务类 ───────────────────────────────────────────────────────────────────

class UploadService:
    def __init__(self, data_service=None):
        # data_service 预留，后续阶段可用于数据整合
        self.data_service = data_service

    # ── 公共入口 ──────────────────────────────────────────────────────────────

    async def process_upload(
        self,
        file: UploadFile,
        user_id: int,
        db: AsyncSession,
        mars_year: Optional[int] = None,
        description: Optional[str] = None,
    ) -> tuple[UploadRecord, ValidationResult]:
        """完整上传流程：保存 → 校验 → 入库，返回 (record, result)。"""
        upload_id = str(uuid.uuid4())
        upload_dir = USER_UPLOADS_DIR / str(user_id) / upload_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        save_path = upload_dir / "original.nc"

        # 读取上传内容（UploadFile.read() 已是 async）
        content = await file.read()
        file_size = len(content)

        # 写入磁盘（≤200 MB 的一次性写入，可接受在当前线程中执行）
        try:
            save_path.write_bytes(content)
        except OSError as exc:
            logger.error("写入上传文件失败: %s", exc)
            raise

        # 在线程池中运行同步的 xarray 校验，避免阻塞事件循环
        loop = asyncio.get_event_loop()
        result: ValidationResult = await loop.run_in_executor(
            None, self.validate_nc_file, save_path, file_size
        )

        # 用户手动指定的火星年优先于自动提取结果
        if mars_year is not None:
            result.mars_year = mars_year

        # 入库
        warn_msg = "; ".join(result.warnings) if result.warnings else None
        record = UploadRecord(
            user_id=user_id,
            filename=file.filename or "upload.nc",
            file_path=str(save_path),
            file_size=file_size,
            data_type=result.data_type,
            mars_year=result.mars_year,
            ls_start=result.ls_start,
            ls_end=result.ls_end,
            status="valid" if result.is_valid else "invalid",
            validation_message=warn_msg if result.is_valid else result.error,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record, result

    # ── 校验逻辑 ──────────────────────────────────────────────────────────────

    def validate_nc_file(self, file_path: Path, file_size: int) -> ValidationResult:
        """
        校验 .nc 文件。同步函数，应通过 run_in_executor 调用。

        执行顺序：
          Step 1 — 大小 + NetCDF 格式
          Step 2 — 数据类型检测（openmars / mcd）
          Step 3 — 维度名模糊匹配（lat/lon/Ls）
          Step 4 — 网格分辨率（36×72 或整数倍）
          Step 5 — 数据范围（Ls 0-360, lat -90~90, lon -180~360）+ 有效值比例
          Step 6 — 元信息提取（火星年、Ls 范围）
        """
        result = ValidationResult()

        # Step 1a — 大小检查
        max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            result.error = (
                f"文件大小 {file_size / 1024 / 1024:.1f} MB "
                f"超过限制 {MAX_UPLOAD_SIZE_MB} MB"
            )
            return result

        # Step 1b — NetCDF 格式检查
        try:
            ds = xr.open_dataset(file_path, engine="netcdf4")
        except Exception as exc:
            result.error = f"无法解析 NetCDF 文件: {exc}"
            return result

        try:
            return self._validate_dataset(ds, result)
        finally:
            ds.close()

    def _validate_dataset(
        self, ds: xr.Dataset, result: ValidationResult
    ) -> ValidationResult:
        """在已打开的 Dataset 上执行 Step 2-6。"""

        # Step 2 — 数据类型检测
        data_type = self._detect_data_type(ds)
        if data_type is None:
            result.error = (
                "无法识别数据类型：文件需要包含 o3col (OpenMARS) "
                "或环境变量如 U_Wind / Temperature (MCD)"
            )
            return result
        result.data_type = data_type
        result.variables = list(ds.data_vars)

        # Step 3 — 维度名模糊匹配（统一转小写）
        dims_lower = {d.lower(): d for d in ds.dims}

        lat_dim = next((dims_lower[k] for k in dims_lower if k in _LAT_ALIASES), None)
        if lat_dim is None:
            result.error = "缺少纬度维度（lat / latitude）"
            return result

        lon_dim = next((dims_lower[k] for k in dims_lower if k in _LON_ALIASES), None)
        if lon_dim is None:
            result.error = "缺少经度维度（lon / longitude）"
            return result

        # Ls 是数据变量，不是维度名
        all_names_lower = {
            v.lower(): v
            for v in list(ds.data_vars) + list(ds.coords)
        }
        ls_var = next(
            (all_names_lower[k] for k in all_names_lower if k in _LS_VAR_ALIASES),
            None,
        )
        if ls_var is None:
            result.error = "缺少 Ls（太阳黄经）变量，无法确定观测时段"
            return result

        # Step 4 — 网格分辨率
        n_lat = ds.dims[lat_dim]
        n_lon = ds.dims[lon_dim]
        result.lat_points = n_lat
        result.lon_points = n_lon

        if n_lat != N_LAT or n_lon != N_LON:
            if n_lat % N_LAT == 0 and n_lon % N_LON == 0:
                factor = n_lat // N_LAT
                result.warnings.append(
                    f"网格分辨率 {n_lat}×{n_lon} 是标准 {N_LAT}×{N_LON} 的 "
                    f"{factor} 倍，可降采样使用"
                )
            else:
                result.error = (
                    f"网格分辨率不兼容：纬度 {n_lat} 点，经度 {n_lon} 点，"
                    f"需要 {N_LAT}×{N_LON} 或其整数倍"
                )
                return result

        # Step 5 — 数据范围校验

        # 纬度范围
        lat_vals = ds[lat_dim].values.astype(float)
        if lat_vals.min() < -90.5 or lat_vals.max() > 90.5:
            result.error = (
                f"纬度值超出 -90°~90° 范围："
                f"[{lat_vals.min():.1f}, {lat_vals.max():.1f}]"
            )
            return result

        # 经度范围（允许 0~360 或 -180~180 两种约定）
        lon_vals = ds[lon_dim].values.astype(float)
        if lon_vals.min() < -180.5 or lon_vals.max() > 360.5:
            result.error = (
                f"经度值超出有效范围：[{lon_vals.min():.1f}, {lon_vals.max():.1f}]"
            )
            return result

        # Ls 范围
        ls_flat = ds[ls_var].values.flatten().astype(float)
        ls_vals = ls_flat[~np.isnan(ls_flat)]
        if len(ls_vals) == 0:
            result.error = "Ls 变量全为 NaN，无有效时序数据"
            return result
        if ls_vals.min() < -0.5 or ls_vals.max() > 360.5:
            result.error = (
                f"Ls 值超出 0°~360° 范围："
                f"[{ls_vals.min():.1f}, {ls_vals.max():.1f}]"
            )
            return result

        result.ls_points = int(len(ls_vals))
        result.ls_start  = float(round(float(ls_vals.min()), 2))
        result.ls_end    = float(round(float(ls_vals.max()), 2))

        # 有效值比例（基于主变量）
        primary_var = (
            "o3col"
            if data_type == "openmars"
            else next((v for v in _MCD_DETECT_VARS if v in ds.data_vars), None)
        )
        if primary_var:
            raw = ds[primary_var].values.flatten().astype(float)
            valid_ratio = float(np.sum(~np.isnan(raw))) / max(len(raw), 1)
            if valid_ratio < 0.10:
                result.error = (
                    f"有效数据比例过低（{valid_ratio * 100:.1f}%），"
                    "文件可能为空或损坏"
                )
                return result

        # Step 6 — 元信息提取
        result.mars_year = self._extract_mars_year(ds)
        result.is_valid  = True
        return result

    # ── 辅助方法 ──────────────────────────────────────────────────────────────

    def _detect_data_type(self, ds: xr.Dataset) -> Optional[str]:
        """返回 'openmars'、'mcd' 或 None。"""
        if "o3col" in ds.data_vars:
            return "openmars"
        if _MCD_DETECT_VARS & set(ds.data_vars):
            return "mcd"
        return None

    def _extract_mars_year(self, ds: xr.Dataset) -> Optional[int]:
        """从 MY 变量或全局属性中提取火星年，失败返回 None。"""
        # OpenMARS 文件含 MY 数据变量
        if "MY" in ds.data_vars:
            my_flat = ds["MY"].values.flatten()
            valid = my_flat[~np.isnan(my_flat.astype(float))]
            if len(valid) > 0:
                return int(valid[0])
        # 全局属性兜底
        for attr in ("mars_year", "MY", "Mars_Year", "year"):
            if attr in ds.attrs:
                try:
                    return int(ds.attrs[attr])
                except (ValueError, TypeError):
                    pass
        return None
