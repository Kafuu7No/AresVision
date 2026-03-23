"""
用户数据服务
-----------
按需读取用户上传的 .nc 文件，提供与 AnalysisService 相同格式的可视化数据。
数据不常驻内存，使用 LRU 缓存（最多缓存 8 个数据集）。

支持两种数据源：
  1. 用户私有数据：通过数据库记录的 file_path 字段定位
  2. 审核通过数据：approved/{record_id}/original.nc
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import xarray as xr
from cachetools import LRUCache

from config import (
    APPROVED_DIR,
    LATITUDE_BANDS,
    MAX_LS_POINTS,
    MCD_VARIABLES,
)
from database.engine import async_session_maker
from database.models import UploadRecord

logger = logging.getLogger("aresvision.user_data")


class UserDataService:
    """按需读取用户上传的 .nc 文件并生成可视化数据"""

    def __init__(self):
        # LRU 缓存：key = f"data_{upload_id}", value = 解析后的数据字典
        self._cache: LRUCache = LRUCache(maxsize=8)
        # 审核通过的数据集文件路径索引：{ record_id: Path }
        self._approved_index: dict[int, Path] = {}
        self._scan_approved()

    # ─── 索引管理 ──────────────────────────────────────────────────────────────

    def _scan_approved(self) -> None:
        """扫描 approved/ 目录，建立已通过数据集的路径索引"""
        self._approved_index.clear()
        if not APPROVED_DIR.exists():
            return
        for subdir in APPROVED_DIR.iterdir():
            if subdir.is_dir() and subdir.name.isdigit():
                nc_file = subdir / "original.nc"
                if nc_file.exists():
                    self._approved_index[int(subdir.name)] = nc_file
        logger.info("已扫描 approved 目录: %d 个数据集", len(self._approved_index))

    def reload_approved(self) -> None:
        """热更新：重新扫描 approved 目录（审核通过后调用）"""
        # 清除 approved 数据集的缓存条目
        old_ids = set(self._approved_index.keys())
        self._scan_approved()
        new_ids = set(self._approved_index.keys())
        # 只清除有变化的条目
        for rid in old_ids.symmetric_difference(new_ids):
            key = f"data_{rid}"
            if key in self._cache:
                del self._cache[key]
        logger.info("approved 数据索引已刷新")

    def get_approved_list(self) -> list[int]:
        """返回所有已通过数据集的 record_id 列表"""
        return sorted(self._approved_index.keys())

    # ─── 文件路径解析 ──────────────────────────────────────────────────────────

    async def _get_file_path(self, upload_id: int) -> Optional[str]:
        """
        从 approved 索引或数据库记录中定位 .nc 文件。
        优先检查 approved 目录（已审核通过的在此处），
        然后回退到数据库中记录的原始 file_path。
        """
        # 1. approved 索引
        if upload_id in self._approved_index:
            p = self._approved_index[upload_id]
            if p.exists():
                return str(p)

        # 2. 数据库记录的路径
        async with async_session_maker() as db:
            record = await db.get(UploadRecord, upload_id)
            if not record:
                return None
            if record.file_path and Path(record.file_path).exists():
                return record.file_path
        return None

    # ─── NC 文件解析 ───────────────────────────────────────────────────────────

    def _load_nc_file(self, file_path: str) -> dict:
        """
        读取一个 .nc 文件，返回标准化的数据字典。
        自动检测数据类型（openmars / mcd / unknown）。
        """
        ds = xr.open_dataset(file_path, decode_times=False)

        # 坐标
        lat = (
            ds["lat"].values if "lat" in ds
            else ds["latitude"].values if "latitude" in ds
            else None
        )
        lon = (
            ds["lon"].values if "lon" in ds
            else ds["longitude"].values if "longitude" in ds
            else None
        )

        # Ls / 时间轴
        ls = None
        for ls_name in ("Ls", "ls", "L_s", "solar_longitude"):
            if ls_name in ds:
                ls = ds[ls_name].values
                break
            if ls_name in ds.coords:
                ls = ds.coords[ls_name].values
                break

        # 数据类型检测
        is_openmars = "o3col" in ds
        mcd_vars_found = [v for v in MCD_VARIABLES if v in ds]
        data_type = (
            "openmars" if is_openmars
            else "mcd" if len(mcd_vars_found) >= 2
            else "unknown"
        )

        result: dict = {
            "lat": lat,
            "lon": lon,
            "ls": ls,
            "data_type": data_type,
        }

        # 臭氧数据
        if is_openmars:
            o3 = ds["o3col"].values
            if o3.ndim == 4:
                o3 = np.nanmean(o3, axis=1)  # 平均掉 level 维度
            if ls is not None:
                sort_idx = np.argsort(ls)
                ls = ls[sort_idx]
                o3 = o3[sort_idx]
                result["ls"] = ls
            result["o3col"] = o3

        # MCD 变量
        for var in mcd_vars_found:
            arr = ds[var].values
            if arr.ndim == 4:
                arr = np.nanmean(arr, axis=1)
            result[var] = arr

        ds.close()
        return result

    async def _get_data(self, upload_id: int) -> dict:
        """获取（并缓存）指定 upload_id 的解析数据"""
        cache_key = f"data_{upload_id}"
        if cache_key not in self._cache:
            file_path = await self._get_file_path(upload_id)
            if not file_path:
                raise ValueError(f"找不到上传记录 {upload_id} 的数据文件")
            self._cache[cache_key] = self._load_nc_file(file_path)
        return self._cache[cache_key]

    # ─── 公共接口 ──────────────────────────────────────────────────────────────

    async def get_dataset_summary(self, upload_id: int) -> dict:
        """获取数据集的基本信息摘要"""
        data = await self._get_data(upload_id)
        return {
            "upload_id": upload_id,
            "data_type": data.get("data_type", "unknown"),
            "has_ozone": "o3col" in data,
            "has_mcd_vars": [v for v in MCD_VARIABLES if v in data],
            "lat_points": int(len(data["lat"])) if data.get("lat") is not None else 0,
            "lon_points": int(len(data["lon"])) if data.get("lon") is not None else 0,
            "ls_range": (
                [float(data["ls"][0]), float(data["ls"][-1])]
                if data.get("ls") is not None else None
            ),
            "ls_points": int(len(data["ls"])) if data.get("ls") is not None else 0,
        }

    async def get_globe_data(self, upload_id: int, ls: float) -> dict:
        """获取 3D 点云（与 AnalysisService.get_globe_data 格式一致）"""
        data = await self._get_data(upload_id)

        if "o3col" not in data:
            raise ValueError("该数据集不包含臭氧列浓度数据")

        ls_arr = data["ls"]
        idx = int(np.argmin(np.abs(ls_arr - ls)))
        field = data["o3col"][idx]

        points = []
        for i, lat_v in enumerate(data["lat"]):
            for j, lon_v in enumerate(data["lon"]):
                val = float(field[i, j])
                if not np.isnan(val):
                    points.append({
                        "lat": float(lat_v),
                        "lng": float(lon_v) if lon_v <= 180 else float(lon_v - 360),
                        "val": val,
                    })

        valid_vals = field[~np.isnan(field)]
        return {
            "points": points,
            "minVal": float(np.nanmin(valid_vals)) if len(valid_vals) > 0 else 0.0,
            "maxVal": float(np.nanmax(valid_vals)) if len(valid_vals) > 0 else 1.0,
            "ls": float(ls_arr[idx]),
            "mars_year": None,
        }

    async def get_seasonal_heatmap(self, upload_id: int, variable: str = "o3col") -> dict:
        """获取 Ls-纬度热力图（与 AnalysisService 格式一致）"""
        data = await self._get_data(upload_id)

        if variable not in data:
            raise ValueError(f"该数据集不包含变量 '{variable}'")

        data_3d = data[variable]
        ls_arr = data["ls"]
        lat_arr = data["lat"]

        zonal_mean = np.nanmean(data_3d, axis=2)

        step = max(1, len(ls_arr) // MAX_LS_POINTS)
        ls_ds = ls_arr[::step]
        zm_ds = zonal_mean[::step]

        return {
            "x": [float(v) for v in ls_ds],
            "y": [float(v) for v in lat_arr],
            "z": [
                [float(zm_ds[t, lat_i]) for t in range(len(ls_ds))]
                for lat_i in range(len(lat_arr))
            ],
            "min": float(np.nanmin(zonal_mean)),
            "max": float(np.nanmax(zonal_mean)),
            "variable": variable,
        }

    async def get_seasonal_bands(self, upload_id: int) -> dict:
        """获取纬度带折线图（与 AnalysisService 格式一致）"""
        data = await self._get_data(upload_id)

        if "o3col" not in data:
            raise ValueError("该数据集不包含臭氧数据")

        o3 = data["o3col"]
        ls_arr = data["ls"]
        lat_arr = data["lat"]

        step = max(1, len(ls_arr) // MAX_LS_POINTS)
        ls_ds = ls_arr[::step]
        o3_ds = o3[::step]

        bands = []
        for band_def in LATITUDE_BANDS:
            mask = (lat_arr >= band_def["lat_min"]) & (lat_arr <= band_def["lat_max"])
            if mask.sum() == 0:
                continue
            band_mean = np.nanmean(o3_ds[:, mask, :], axis=(1, 2))
            bands.append({
                "name": band_def["name"],
                "values": [float(v) for v in band_mean],
            })

        return {
            "ls": [float(v) for v in ls_ds],
            "bands": bands,
        }
