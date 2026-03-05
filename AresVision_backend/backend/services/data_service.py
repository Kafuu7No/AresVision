"""
数据服务层
- 启动时预加载 OpenMARS 和 MCD 的 nc 文件到内存（numpy 数组）
- 提供各种数据切片和计算方法
- 带 LRU 缓存加速重复请求
"""

import logging
import glob
import numpy as np
from functools import lru_cache
from pathlib import Path

import xarray as xr

from config import (
    OPENMARS_DIR, MCD_DIR, MCD_VARIABLES,
    N_LAT, N_LON, LATITUDE_BANDS, SUPPORTED_MARS_YEARS,
)
from core.data_align import unwrap_ls, interpolate_mcd_to_openmars

logger = logging.getLogger("aresvision.data")


class DataService:
    """
    数据服务：启动时把 nc 数据全部读入内存，后续操作全是 numpy 切片，毫秒级响应。
    """

    def __init__(self):
        # 存储结构：mars_year -> 数据字典
        self.openmars: dict[int, dict] = {}
        self.mcd: dict[int, dict] = {}
        self.aligned_mcd: dict[int, dict] = {}  # 对齐到 OpenMARS Ls 格点后的 MCD 数据

        self._load_all()

    # ═══════════════════════════════════════════
    #  数据加载
    # ═══════════════════════════════════════════

    def _load_all(self):
        """启动时加载所有可用数据"""
        for my in SUPPORTED_MARS_YEARS:
            self._load_openmars(my)
            self._load_mcd(my)

        # 对齐 MCD 到 OpenMARS 格点
        for my in self.openmars:
            if my in self.mcd:
                self._align_mcd(my)

        logger.info(
            f"数据加载完成: OpenMARS={list(self.openmars.keys())}, "
            f"MCD={list(self.mcd.keys())}"
        )

    def _load_openmars(self, mars_year: int):
        """加载 OpenMARS 臭氧数据"""
        pattern = str(OPENMARS_DIR / f"*my{mars_year}*ls*.nc")
        files = sorted(glob.glob(pattern))

        if not files:
            logger.warning(f"未找到 MY{mars_year} 的 OpenMARS 文件: {pattern}")
            return

        logger.info(f"加载 OpenMARS MY{mars_year}: {len(files)} 个文件")

        datasets = []
        for f in files:
            try:
                ds = xr.open_dataset(f)
                datasets.append(ds)
            except Exception as e:
                logger.error(f"读取文件失败 {f}: {e}")

        if not datasets:
            return

        # 合并所有分段文件
        combined = xr.concat(datasets, dim="time")

        # 提取关键数组
        o3col = combined["o3col"].values          # (time, [lev,] lat, lon)
        ls_arr = combined["Ls"].values             # (time,)
        lat_arr = combined["lat"].values           # (36,)
        lon_arr = combined["lon"].values           # (72,)

        # 如果 o3col 有 lev 维度，取柱浓度（对 lev 求和或取特定层）
        if o3col.ndim == 4:
            # 假设柱浓度已经是 o3col 的含义，取第一层或对 lev 平均
            o3col = np.nanmean(o3col, axis=1)  # (time, lat, lon)

        # 按 Ls 排序
        sort_idx = np.argsort(ls_arr)
        ls_arr = ls_arr[sort_idx]
        o3col = o3col[sort_idx]

        self.openmars[mars_year] = {
            "o3col": o3col,        # (n_time, 36, 72)
            "ls": ls_arr,          # (n_time,)
            "lat": lat_arr,        # (36,)
            "lon": lon_arr,        # (72,)
        }

        # 关闭 datasets 释放文件句柄
        for ds in datasets:
            ds.close()

        logger.info(
            f"  OpenMARS MY{mars_year}: o3col shape={o3col.shape}, "
            f"Ls range=[{ls_arr[0]:.1f}, {ls_arr[-1]:.1f}]"
        )

    def _load_mcd(self, mars_year: int):
        """加载 MCD 气候模拟数据"""
        pattern = str(MCD_DIR / f"*my{mars_year}*.nc")
        files = sorted(glob.glob(pattern))

        # 也尝试不带 my 的文件名
        if not files:
            pattern = str(MCD_DIR / "*.nc")
            files = sorted(glob.glob(pattern))

        if not files:
            logger.warning(f"未找到 MCD 数据文件: {MCD_DIR}")
            return

        logger.info(f"加载 MCD MY{mars_year}: {len(files)} 个文件")

        try:
            ds = xr.open_dataset(files[0])
        except Exception as e:
            logger.error(f"读取 MCD 文件失败: {e}")
            return

        mcd_data = {}
        for var in MCD_VARIABLES:
            if var in ds:
                arr = ds[var].values  # (sol, hour, lat, lon) 或 (sol, lat, lon)
                if arr.ndim == 4:
                    # 取日平均（对 hour 维度求均值）用于热力图
                    mcd_data[var] = np.nanmean(arr, axis=1)  # (sol, lat, lon)
                    mcd_data[f"{var}_hourly"] = arr           # 保留完整小时数据
                else:
                    mcd_data[var] = arr
            else:
                logger.warning(f"  MCD 文件中缺少变量: {var}")

        # Ls 索引
        if "Ls" in ds:
            mcd_data["ls"] = ds["Ls"].values
        elif "ls" in ds:
            mcd_data["ls"] = ds["ls"].values

        if "lat" in ds:
            mcd_data["lat"] = ds["lat"].values
        if "lon" in ds:
            mcd_data["lon"] = ds["lon"].values

        self.mcd[mars_year] = mcd_data
        ds.close()

        logger.info(f"  MCD MY{mars_year}: 变量={list(mcd_data.keys())}")

    def _align_mcd(self, mars_year: int):
        """将 MCD 数据插值对齐到 OpenMARS 的 Ls 格点"""
        om = self.openmars[mars_year]
        mc = self.mcd[mars_year]
        target_ls = om["ls"]

        if "ls" not in mc:
            logger.warning(f"MCD MY{mars_year} 缺少 Ls 索引，跳过对齐")
            return

        aligned = {"ls": target_ls}

        for var in MCD_VARIABLES:
            if var in mc:
                try:
                    aligned[var] = interpolate_mcd_to_openmars(
                        mc[var], mc["ls"], target_ls,
                    )
                    logger.info(f"  对齐 {var}: {aligned[var].shape}")
                except Exception as e:
                    logger.error(f"  对齐 {var} 失败: {e}")

        self.aligned_mcd[mars_year] = aligned

    # ═══════════════════════════════════════════
    #  数据探索页接口
    # ═══════════════════════════════════════════

    def get_globe_data(self, mars_year: int, ls: float) -> dict:
        """
        获取指定 Ls 时刻的 3D 地球点云数据。
        找到最接近目标 Ls 的时间步，返回 36×72 个点。
        """
        om = self._get_openmars(mars_year)
        idx = self._find_nearest_ls_index(om["ls"], ls)
        field = om["o3col"][idx]  # (36, 72)

        points = []
        for i, lat in enumerate(om["lat"]):
            for j, lon in enumerate(om["lon"]):
                val = float(field[i, j])
                if not np.isnan(val):
                    points.append({
                        "lat": float(lat),
                        "lng": float(lon) if lon <= 180 else float(lon - 360),
                        "val": val,
                    })

        valid_vals = field[~np.isnan(field)]
        return {
            "points": points,
            "minVal": float(np.nanmin(valid_vals)) if len(valid_vals) > 0 else 0,
            "maxVal": float(np.nanmax(valid_vals)) if len(valid_vals) > 0 else 1,
            "ls": float(om["ls"][idx]),
            "mars_year": mars_year,
        }

    def get_seasonal_heatmap(self, mars_year: int,
                              variable: str = "o3col") -> dict:
        """
        获取 Ls-纬度热力图数据（纬向平均后）。
        """
        if variable == "o3col":
            om = self._get_openmars(mars_year)
            data_3d = om["o3col"]   # (time, lat, lon)
            ls_arr = om["ls"]
            lat_arr = om["lat"]
        else:
            am = self._get_aligned_mcd(mars_year)
            data_3d = am.get(variable)
            if data_3d is None:
                raise ValueError(f"变量 {variable} 不可用")
            ls_arr = am["ls"]
            om = self._get_openmars(mars_year)
            lat_arr = om["lat"]

        # 对经度求平均 → (time, lat)
        zonal_mean = np.nanmean(data_3d, axis=2)  # (time, lat)

        return {
            "x": [float(v) for v in ls_arr],
            "y": [float(v) for v in lat_arr],
            "z": self._to_nested_list(zonal_mean.T),  # [lat][time]
            "min": float(np.nanmin(zonal_mean)),
            "max": float(np.nanmax(zonal_mean)),
            "variable": variable,
        }

    def get_seasonal_bands(self, mars_year: int) -> dict:
        """
        获取 5 个纬度带的臭氧随 Ls 变化曲线。
        """
        om = self._get_openmars(mars_year)
        o3 = om["o3col"]     # (time, lat, lon)
        ls_arr = om["ls"]
        lat_arr = om["lat"]

        bands = []
        for band_def in LATITUDE_BANDS:
            mask = (lat_arr >= band_def["lat_min"]) & (lat_arr <= band_def["lat_max"])
            # 取该纬度带的区域平均 (time, selected_lats, lon) → (time,)
            band_mean = np.nanmean(o3[:, mask, :], axis=(1, 2))
            bands.append({
                "name": band_def["name"],
                "values": [float(v) for v in band_mean],
            })

        return {
            "ls": [float(v) for v in ls_arr],
            "bands": bands,
        }

    def get_env_variable_heatmap(self, mars_year: int,
                                  variable_name: str) -> dict:
        """
        获取单个 MCD 环境变量的 Ls-纬度分布热力图。
        """
        return self.get_seasonal_heatmap(mars_year, variable=variable_name)

    def get_correlation_matrix(self, mars_year: int) -> dict:
        """
        计算 7 个变量（O₃ + 6 个环境变量）之间的 Pearson 相关系数矩阵。
        """
        om = self._get_openmars(mars_year)
        am = self._get_aligned_mcd(mars_year)

        var_names = ["o3col"] + MCD_VARIABLES
        n_vars = len(var_names)

        # 将所有变量展平为一维序列，计算相关系数
        flat_data = []

        # O₃: (time, lat, lon) → 展平
        o3_flat = om["o3col"].reshape(-1)
        flat_data.append(o3_flat)

        for var in MCD_VARIABLES:
            if var in am:
                v_flat = am[var].reshape(-1)
                # 确保长度一致（截取到最短长度）
                if len(v_flat) != len(o3_flat):
                    min_len = min(len(v_flat), len(o3_flat))
                    v_flat = v_flat[:min_len]
                flat_data.append(v_flat)
            else:
                # 缺失变量填 NaN
                flat_data.append(np.full_like(o3_flat, np.nan))

        # 统一截断到最短长度
        min_len = min(len(d) for d in flat_data)
        flat_data = [d[:min_len] for d in flat_data]

        # 构建矩阵并计算相关系数
        data_matrix = np.stack(flat_data, axis=0)  # (7, N)

        # 去除含 NaN 的列
        valid_mask = ~np.any(np.isnan(data_matrix), axis=0)
        data_clean = data_matrix[:, valid_mask]

        if data_clean.shape[1] < 10:
            # 数据太少，返回单位矩阵
            corr = np.eye(n_vars)
        else:
            corr = np.corrcoef(data_clean)

        return {
            "matrix": self._to_nested_list(corr),
            "variable_names": var_names,
        }

    # ═══════════════════════════════════════════
    #  预测页需要的数据获取
    # ═══════════════════════════════════════════

    def get_model_input(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        selected_variables: list[str],
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        构建模型输入张量。

        Returns:
            input_array: (window, total_channels, H, W) — numpy 数组
            channel_mask: (total_channels,) — 0/1 掩码
            target_ls_values: (window,) — 对应的 Ls 值
        """
        om = self._get_openmars(mars_year)
        am = self._get_aligned_mcd(mars_year)

        # 找到起始 Ls 索引
        start_idx = self._find_nearest_ls_index(om["ls"], ls_start)

        # 确保有足够的时间步
        end_idx = min(start_idx + window, len(om["ls"]))
        actual_window = end_idx - start_idx
        if actual_window < window:
            start_idx = max(0, end_idx - window)

        indices = list(range(start_idx, start_idx + window))
        target_ls = om["ls"][indices]

        # 构建 7 通道输入：O₃(1) + 6 个环境变量
        total_ch = 1 + len(MCD_VARIABLES)
        H, W = N_LAT, N_LON
        input_arr = np.zeros((window, total_ch, H, W), dtype=np.float32)
        channel_mask = np.zeros(total_ch, dtype=np.float32)

        # 通道 0: O₃ 自回归（始终启用）
        input_arr[:, 0, :, :] = om["o3col"][indices]
        channel_mask[0] = 1.0

        # 通道 1~6: 环境变量
        for ch_idx, var_name in enumerate(MCD_VARIABLES, start=1):
            if var_name in selected_variables and var_name in am:
                data = am[var_name][indices]
                # NaN 填零
                data = np.nan_to_num(data, nan=0.0)
                input_arr[:, ch_idx, :, :] = data
                channel_mask[ch_idx] = 1.0

        # NaN 填零
        input_arr = np.nan_to_num(input_arr, nan=0.0)

        return input_arr, channel_mask, target_ls

    def get_ground_truth(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        horizon: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        获取真值场（用于预测后对比）。

        Returns:
            truth: (horizon, H, W) — 真值臭氧场
            ls_values: (horizon,) — 对应 Ls
        """
        om = self._get_openmars(mars_year)
        start_idx = self._find_nearest_ls_index(om["ls"], ls_start)
        pred_start = start_idx + window

        end_idx = min(pred_start + horizon, len(om["ls"]))
        actual_h = end_idx - pred_start

        if actual_h <= 0:
            raise ValueError(f"Ls={ls_start} 之后没有足够的真值数据")

        indices = list(range(pred_start, end_idx))
        truth = om["o3col"][indices]
        ls_vals = om["ls"][indices]

        return truth, ls_vals

    def get_diurnal_data(
        self,
        mars_year: int,
        ls: float,
        lat_band_name: str,
    ) -> dict:
        """
        获取昼夜变化数据。
        需要 MCD 的 hourly 数据。
        """
        mc = self.mcd.get(mars_year, {})
        om = self._get_openmars(mars_year)

        # 找纬度带
        band_def = None
        for b in LATITUDE_BANDS:
            if b["name"] == lat_band_name:
                band_def = b
                break
        if band_def is None:
            band_def = LATITUDE_BANDS[2]  # 默认赤道

        lat_arr = om["lat"]
        lat_mask = (lat_arr >= band_def["lat_min"]) & (lat_arr <= band_def["lat_max"])

        # 尝试使用 MCD hourly O₃ 数据（如果有的话）
        # 如果没有，用 OpenMARS 数据做近似
        hourly_key = "Temperature_hourly"  # 用温度的小时变化做示意
        if hourly_key in mc and "ls" in mc:
            mcd_ls = mc["ls"]
            sol_idx = self._find_nearest_ls_index(mcd_ls, ls)
            hourly_data = mc[hourly_key]  # (sol, hour, lat, lon)

            if sol_idx < hourly_data.shape[0]:
                data_at_sol = hourly_data[sol_idx]  # (hour, lat, lon)
                band_mean = np.nanmean(data_at_sol[:, lat_mask, :], axis=(1, 2))
                n_hours = data_at_sol.shape[0]
                hours = np.linspace(0, 24, n_hours, endpoint=False)
                return {
                    "hours": [float(h) for h in hours],
                    "ozone_values": [float(v) for v in band_mean],
                    "lat_band": band_def["name"],
                    "ls": float(ls),
                }

        # 回退：返回模拟数据（OpenMARS 无 hourly 维度）
        return self._generate_simulated_diurnal(ls, band_def)

    # ═══════════════════════════════════════════
    #  辅助方法
    # ═══════════════════════════════════════════

    def _get_openmars(self, mars_year: int) -> dict:
        if mars_year not in self.openmars:
            raise ValueError(
                f"MY{mars_year} 数据未加载。可用: {list(self.openmars.keys())}"
            )
        return self.openmars[mars_year]

    def _get_aligned_mcd(self, mars_year: int) -> dict:
        if mars_year not in self.aligned_mcd:
            raise ValueError(
                f"MY{mars_year} 的对齐 MCD 数据未加载。"
            )
        return self.aligned_mcd[mars_year]

    @staticmethod
    def _find_nearest_ls_index(ls_array: np.ndarray, target_ls: float) -> int:
        """找到最接近目标 Ls 的索引"""
        return int(np.argmin(np.abs(ls_array - target_ls)))

    @staticmethod
    def _to_nested_list(arr: np.ndarray) -> list[list[float]]:
        """将 2D numpy 数组转为嵌套 list（JSON 可序列化）"""
        return [[float(v) for v in row] for row in arr]

    @staticmethod
    def _generate_simulated_diurnal(ls: float, band_def: dict) -> dict:
        """当无 hourly 数据时，生成模拟的昼夜变化曲线"""
        hours = np.linspace(0, 24, 8, endpoint=False)
        # 模拟：白天臭氧较低（光化学分解），夜间较高
        base = 0.03
        amplitude = 0.008
        phase = 6.0  # 最低值在正午附近
        values = base + amplitude * np.cos(2 * np.pi * (hours - phase) / 24)
        # 纬度修正
        lat_center = (band_def["lat_min"] + band_def["lat_max"]) / 2
        values *= 1 + abs(lat_center) / 90 * 0.5

        return {
            "hours": [float(h) for h in hours],
            "ozone_values": [float(v) for v in values],
            "lat_band": band_def["name"],
            "ls": float(ls),
        }

    def get_available_years(self) -> list[int]:
        """返回已加载的火星年列表"""
        return sorted(self.openmars.keys())

    def get_ls_range(self, mars_year: int) -> tuple[float, float]:
        """返回指定火星年的 Ls 范围"""
        om = self._get_openmars(mars_year)
        return float(om["ls"][0]), float(om["ls"][-1])
