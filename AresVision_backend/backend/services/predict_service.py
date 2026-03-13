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
        pred_arr = self._run_inference_pipeline(input_arr, channel_mask, ls_start, selected_variables, horizon)

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
        ls_start: float,
        selected_variables: list[str],
        horizon: int,
    ) -> np.ndarray:
        # a. 动态获取模型
        model, input_dim = self.inference.get_model_for_variables(selected_variables)

        # b. 构造满足模型维度要求的输入
        if input_dim < 7:
            indices = [0]
            from config import MCD_VARIABLES
            for i, var in enumerate(MCD_VARIABLES, start=1):
                if channel_mask[i] == 1.0:
                    indices.append(i)
            final_input_arr = input_arr[:, indices[:input_dim]]
        else:
            final_input_arr = input_arr

        # c. 预处理与标准化
        # 如果数据源是预处理好的张量，则跳过标准化步骤
        if getattr(self.ml_data_prep, "processed_data", None) is not None:
            scaled_input = final_input_arr
            # 同步反标准化所需的均值和标准差，确保一致性
            self.transforms.y_mean = self.ml_data_prep.processed_data.get('y_mean', self.transforms.y_mean)
            self.transforms.y_std = self.ml_data_prep.processed_data.get('y_std', self.transforms.y_std)
        else:
            scaled_input = self.transforms.preprocess_input(final_input_arr, selected_variables)

        # d. 模型推理
        device = self.inference.device
        x = torch.from_numpy(scaled_input).unsqueeze(0).float().to(device)
        pred_scaled = self.inference.infer(model, x, horizon)

        # e. 反标准化
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

    def get_performance_curve(self, selected_variables: list[str]) -> list[dict]:
        """
        获取模型在测试集上的性能曲线数据 (R2 分数)
        """
        if self.ml_data_prep.processed_data is None:
            logger.warning("未加载预处理数据，无法生成性能曲线")
            return []
            
        data = self.ml_data_prep.processed_data
        ls_array = data['om_ls_raw']
        total_len = len(ls_array)
        split_idx = int(0.8 * total_len)
        
        # 识别年份分界线
        diffs = np.diff(ls_array)
        split_indices = np.where(diffs < -180)[0]
        my28_start = split_indices[0] + 1 if len(split_indices) > 0 else total_len
        
        results = []
        # 为了保证前端渲染性能，我们对测试集进行抽样 (增加采样密度)
        test_samples_count = total_len - split_idx
        step = max(1, test_samples_count // 150) 
        
        logger.info(f"正在生成性能曲线 (测试集范围: {split_idx} -> {total_len}, 步长: {step})")
        
        for i in range(split_idx, total_len - 3, step):
            ls = float(ls_array[i])
            my = 27 if i < my28_start else 28
            
            try:
                # 调用 predict 获取指标
                res = self.predict(my, ls, selected_variables, horizon=3)
                r2 = res["metrics"]["overall"]["r2"]
                results.append({
                    "ls": round(ls, 2),
                    "my": my,
                    "r2": round(float(r2), 4)
                })
            except Exception as e:
                logger.debug(f"性能曲线采样失败 (MY{my} Ls{ls}): {e}")
                
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
