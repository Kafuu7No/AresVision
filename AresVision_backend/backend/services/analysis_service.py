"""
前端探索大屏的专用可视化数据服务。
聚焦于数据空间降阶、降采样、抽稀聚合成图表格式。
"""
import logging
import numpy as np

from config import MAX_LS_POINTS, LATITUDE_BANDS, MCD_VARIABLES
from services.data_service import DataService

logger = logging.getLogger("aresvision.analysis")


class AnalysisService:
    def __init__(self, data_service: DataService):
        self.data_service = data_service
        self._cache: dict[str, dict] = {}

    def get_globe_data(self, mars_year: int, ls: float) -> dict:
        om = self.data_service.get_openmars_data(mars_year)
        idx = self.data_service.get_nearest_ls_index(om["ls"], ls)
        field = om["o3col"][idx]

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

    def get_seasonal_heatmap(self, mars_year: int, variable: str = "o3col") -> dict:
        cache_key = f"heatmap_{mars_year}_{variable}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        if variable == "o3col":
            om = self.data_service.get_openmars_data(mars_year)
            data_3d = om["o3col"]
            ls_arr = om["ls"]
            lat_arr = om["lat"]
        else:
            am = self.data_service.get_aligned_mcd_data(mars_year)
            data_3d = am.get(variable)
            if data_3d is None:
                raise ValueError(f"变量 {variable} 不可用")
            ls_arr = am["ls"]
            om = self.data_service.get_openmars_data(mars_year)
            lat_arr = om["lat"]

        zonal_mean = np.nanmean(data_3d, axis=2)

        n_time = len(ls_arr)
        step = max(1, n_time // MAX_LS_POINTS)
        ls_ds = ls_arr[::step]
        zm_ds = zonal_mean[::step]

        result = {
            "x": [float(v) for v in ls_ds],
            "y": [float(v) for v in lat_arr],
            "z": self._to_nested_list(zm_ds.T),
            "min": float(np.nanmin(zonal_mean)),
            "max": float(np.nanmax(zonal_mean)),
            "variable": variable,
        }
        self._cache[cache_key] = result
        return result

    def get_seasonal_bands(self, mars_year: int) -> dict:
        cache_key = f"bands_{mars_year}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        om = self.data_service.get_openmars_data(mars_year)
        o3 = om["o3col"]
        ls_arr = om["ls"]
        lat_arr = om["lat"]

        n_time = len(ls_arr)
        step = max(1, n_time // MAX_LS_POINTS)
        ls_ds = ls_arr[::step]
        o3_ds = o3[::step]

        bands = []
        for band_def in LATITUDE_BANDS:
            mask = (lat_arr >= band_def["lat_min"]) & (lat_arr <= band_def["lat_max"])
            band_mean = np.nanmean(o3_ds[:, mask, :], axis=(1, 2))
            bands.append({
                "name": band_def["name"],
                "values": [float(v) for v in band_mean],
            })

        result = {
            "ls": [float(v) for v in ls_ds],
            "bands": bands,
        }
        self._cache[cache_key] = result
        return result

    def get_env_variable_heatmap(self, mars_year: int, variable_name: str) -> dict:
        return self.get_seasonal_heatmap(mars_year, variable=variable_name)

    def get_correlation_matrix(self, mars_year: int) -> dict:
        cache_key = f"corr_{mars_year}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        om = self.data_service.get_openmars_data(mars_year)
        am = self.data_service.get_aligned_mcd_data(mars_year)

        var_names = ["o3col"] + MCD_VARIABLES
        n_vars = len(var_names)

        series_list = []
        o3_mean = np.nanmean(om["o3col"], axis=(1, 2))
        series_list.append(o3_mean)

        for var in MCD_VARIABLES:
            if var in am:
                v_3d = am[var]
                v_mean = np.nanmean(v_3d, axis=(1, 2))
                min_len = min(len(v_mean), len(o3_mean))
                series_list.append(v_mean[:min_len])
            else:
                series_list.append(np.full(len(o3_mean), np.nan))

        min_len = min(len(s) for s in series_list)
        series_list = [s[:min_len] for s in series_list]

        data_matrix = np.stack(series_list, axis=0)

        valid_mask = ~np.any(np.isnan(data_matrix), axis=0)
        data_clean = data_matrix[:, valid_mask]

        if data_clean.shape[1] < 10:
            corr = np.eye(n_vars)
        else:
            corr = np.corrcoef(data_clean)

        result = {
            "matrix": self._to_nested_list(corr),
            "variable_names": var_names,
        }
        self._cache[cache_key] = result
        return result

    def get_diurnal_data(self, mars_year: int, ls: float, lat_band_name: str) -> dict:
        mc = self.data_service.get_mcd_data(mars_year)
        om = self.data_service.get_openmars_data(mars_year)

        band_def = next((b for b in LATITUDE_BANDS if b["name"] == lat_band_name), LATITUDE_BANDS[2])

        lat_arr = om["lat"]
        lat_mask = (lat_arr >= band_def["lat_min"]) & (lat_arr <= band_def["lat_max"])

        hourly_key = "Temperature_hourly"
        if hourly_key in mc and "ls" in mc:
            mcd_ls = mc["ls"]
            sol_idx = self.data_service.get_nearest_ls_index(mcd_ls, ls)
            hourly_data = mc[hourly_key]

            if sol_idx < hourly_data.shape[0]:
                data_at_sol = hourly_data[sol_idx]
                band_mean = np.nanmean(data_at_sol[:, lat_mask, :], axis=(1, 2))
                n_hours = data_at_sol.shape[0]
                hours = np.linspace(0, 24, n_hours, endpoint=False)
                return {
                    "hours": [float(h) for h in hours],
                    "ozone_values": [float(v) for v in band_mean],
                    "lat_band": band_def["name"],
                    "ls": float(ls),
                }

        return self._generate_simulated_diurnal(ls, band_def)

    @staticmethod
    def _to_nested_list(arr: np.ndarray) -> list[list[float]]:
        return [[float(v) for v in row] for row in arr]

    @staticmethod
    def _generate_simulated_diurnal(ls: float, band_def: dict) -> dict:
        hours = np.linspace(0, 24, 8, endpoint=False)
        base = 0.03
        amplitude = 0.008
        phase = 6.0
        values = base + amplitude * np.cos(2 * np.pi * (hours - phase) / 24)
        lat_center = (band_def["lat_min"] + band_def["lat_max"]) / 2
        values *= 1 + abs(lat_center) / 90 * 0.5

        return {
            "hours": [float(h) for h in hours],
            "ozone_values": [float(v) for v in values],
            "lat_band": band_def["name"],
            "ls": float(ls),
        }
