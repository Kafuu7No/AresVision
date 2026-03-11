"""
预测服务编排层
负责协调 MLDataPrepService, DataTransforms, ModelInferenceService, 获取结果并组装响应
"""
import logging
import hashlib
import json
import numpy as np
import torch

from cachetools import LRUCache

from config import MODEL_CONFIG
from services.data_service import DataService
from services.predict_data_service import PredictDataService
from core.predict_transforms import PredictTransforms
from core.metrics import compute_metrics, empty_metrics
from core.predict_inference import PredictInference

logger = logging.getLogger("aresvision.predict")


class PredictOrchestratorService:
    def __init__(
        self,
        data_service: DataService,
        ml_data_prep: PredictDataService,
        transforms: PredictTransforms,
        inference: PredictInference,
    ):
        self.data_service = data_service
        self.ml_data_prep = ml_data_prep
        self.transforms = transforms
        self.inference = inference

        self._result_cache = LRUCache(maxsize=32)

    def predict(
        self,
        mars_year: int,
        ls_start: float,
        selected_variables: list[str],
        horizon: int = 3,
    ) -> dict:
        cache_key = self._make_cache_key(mars_year, ls_start, selected_variables, horizon)
        if cache_key in self._result_cache:
            logger.info("命中预测缓存")
            return self._result_cache[cache_key]

        cfg = MODEL_CONFIG
        window = cfg["input_window"]

        # 1. 获取输入数据 (使用预测专用对齐数据)
        input_arr, channel_mask, input_ls = self.ml_data_prep.get_model_input(
            mars_year, ls_start, window, selected_variables,
            use_predict_data=True
        )

        # 2. 获取真值
        try:
            truth_arr, truth_ls = self.ml_data_prep.get_ground_truth(
                mars_year, ls_start, window, horizon,
            )
        except ValueError as e:
            logger.warning(f"无法获取真值: {e}")
            truth_arr = None
            truth_ls = np.array([ls_start + i * 5.0 for i in range(horizon)])

        # 3. 编排并执行推理流程
        pred_arr = self._run_inference_pipeline(input_arr, channel_mask, horizon)

        # 4. 计算指标与组装
        actual_horizon = pred_arr.shape[0]

        if truth_arr is not None:
            actual_horizon = min(actual_horizon, truth_arr.shape[0])
            pred_arr = pred_arr[:actual_horizon]
            truth_arr = truth_arr[:actual_horizon]
            residual_arr = pred_arr - truth_arr
            metrics = compute_metrics(truth_arr, pred_arr)
        else:
            residual_arr = np.zeros_like(pred_arr)
            metrics = empty_metrics(actual_horizon)

        om = self.data_service.get_openmars_data(mars_year)
        lat_arr = om["lat"]
        lon_arr = om["lon"]

        result = {
            "ground_truth": self._fields_to_dicts(
                truth_arr if truth_arr is not None else pred_arr,
                lat_arr, lon_arr
            ),
            "prediction": self._fields_to_dicts(pred_arr, lat_arr, lon_arr),
            "residual": self._fields_to_dicts(residual_arr, lat_arr, lon_arr),
            "ls_values": [float(v) for v in truth_ls[:actual_horizon]],
            "selected_variables": selected_variables,
            "horizon": actual_horizon,
            "metrics": metrics,
        }

        self._result_cache[cache_key] = result
        return result

    def _run_inference_pipeline(
        self,
        input_arr: np.ndarray,
        channel_mask: np.ndarray,
        horizon: int,
    ) -> np.ndarray:
        # a. 通道掩码
        masked_input = input_arr.copy()
        for c in range(len(channel_mask)):
            if channel_mask[c] == 0:
                masked_input[:, c, :, :] = 0.0

        # b. 预处理与标准化
        scaled_input = self.transforms.preprocess_input(masked_input)

        # c. 模型推理
        device = self.inference.device
        x = torch.from_numpy(scaled_input).unsqueeze(0).float().to(device)
        pred_scaled = self.inference.infer(x, horizon)

        # d. 反标准化
        pred_physical = self.transforms.postprocess_output(pred_scaled)
        return pred_physical

    def get_ablation_results(
        self,
        mars_year: int = 27,
        ls_start: float = 90.0,
    ) -> list[dict]:
        from config import MCD_VARIABLES
        combos = [
            ("Full (All 7ch)", MCD_VARIABLES.copy()),
            ("No Dust", [v for v in MCD_VARIABLES if v != "Dust_Optical_Depth"]),
            ("No Wind", [v for v in MCD_VARIABLES if "Wind" not in v]),
            ("Temp + Solar Only", ["Temperature", "Solar_Flux_DN"]),
            ("O3 Only (Baseline)", []),
        ]

        results = []
        for label, variables in combos:
            try:
                result = self.predict(mars_year, ls_start, variables, horizon=3)
                m = result["metrics"]["overall"]
                results.append({
                    "variable_combo": label,
                    "variables": variables,
                    "rmse": m["rmse"],
                    "mae": m["mae"],
                    "ssim": m["ssim"],
                    "r2": m["r2"],
                })
            except Exception as e:
                logger.warning(f"消融实验 '{label}' 失败: {e}")
                results.append({
                    "variable_combo": label,
                    "variables": variables,
                    "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0,
                })

        return results

    def _fields_to_dicts(
        self,
        fields: np.ndarray,
        lat_arr: np.ndarray,
        lon_arr: np.ndarray,
    ) -> list[dict]:
        result = []
        for step in range(fields.shape[0]):
            field = fields[step]
            points = []
            for i, lat in enumerate(lat_arr):
                for j, lon in enumerate(lon_arr):
                    val = float(field[i, j])
                    if not np.isnan(val):
                        points.append({
                            "lat": float(lat),
                            "lng": float(lon) if lon <= 180 else float(lon - 360),
                            "val": val,
                        })

            valid = field[~np.isnan(field)]
            result.append({
                "points": points,
                "lat": [float(v) for v in lat_arr],
                "lon": [float(v) for v in lon_arr],
                "field": [[float(v) for v in row] for row in np.nan_to_num(field)],
                "minVal": float(np.nanmin(valid)) if len(valid) > 0 else 0.0,
                "maxVal": float(np.nanmax(valid)) if len(valid) > 0 else 1.0,
            })

        return result

    @staticmethod
    def _make_cache_key(
        mars_year: int,
        ls_start: float,
        selected_variables: list[str],
        horizon: int,
    ) -> str:
        key_data = {
            "my": mars_year,
            "ls": round(ls_start, 2),
            "vars": sorted(selected_variables),
            "h": horizon,
        }
        return hashlib.md5(json.dumps(key_data).encode()).hexdigest()
