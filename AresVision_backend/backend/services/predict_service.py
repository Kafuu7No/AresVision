"""
预测服务层
- 加载 PredRNNv2 模型权重
- 执行推理（支持动态通道 mask）
- 计算评估指标
- 结果缓存
"""

import logging
import hashlib
import json
import numpy as np
import torch
from pathlib import Path

from cachetools import LRUCache
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from skimage.metrics import structural_similarity as ssim

from config import MODEL_CONFIG, MODEL_DIR, MCD_VARIABLES, N_LAT, N_LON
from core.predrnn_v2 import PredRNNv2
from services.data_service import DataService

logger = logging.getLogger("aresvision.predict")


class PredictService:
    """
    预测服务：加载模型 → 接收输入 → 推理 → 评估 → 返回结果
    """

    def __init__(self, data_service: DataService):
        self.data_service = data_service
        self.model: PredRNNv2 | None = None
        self.device = self._select_device()
        self._result_cache = LRUCache(maxsize=32)

        self._load_model()

    def _select_device(self) -> torch.device:
        """选择推理设备：优先 GPU"""
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"使用 GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device("cpu")
            logger.info("使用 CPU 推理")
        return device

    def _load_model(self):
        """加载 PredRNNv2 模型权重"""
        cfg = MODEL_CONFIG
        num_layers = len(cfg["num_hidden"])

        self.model = PredRNNv2(
            num_layers=num_layers,
            num_hidden=cfg["num_hidden"],
            configs=cfg,
        ).to(self.device)

        # 查找权重文件
        weight_files = list(MODEL_DIR.glob("*.pt")) + list(MODEL_DIR.glob("*.pth"))

        if weight_files:
            weight_path = weight_files[0]
            try:
                state_dict = torch.load(weight_path, map_location=self.device,
                                         weights_only=True)
                self.model.load_state_dict(state_dict, strict=False)
                logger.info(f"模型权重已加载: {weight_path.name}")
            except Exception as e:
                logger.warning(f"加载权重失败: {e}，将使用随机初始化模型")
        else:
            logger.warning(
                f"未找到模型权重文件 ({MODEL_DIR})，将使用随机初始化模型。"
                "预测结果仅供演示。"
            )

        self.model.eval()

    # ═══════════════════════════════════════════
    #  核心预测
    # ═══════════════════════════════════════════

    def predict(
        self,
        mars_year: int,
        ls_start: float,
        selected_variables: list[str],
        horizon: int = 3,
    ) -> dict:
        """
        执行预测并返回完整结果。

        Returns:
            {
                "ground_truth": [(H,W), ...],    # horizon 步真值
                "prediction": [(H,W), ...],      # horizon 步预测
                "residual": [(H,W), ...],        # 差值
                "ls_values": [float, ...],       # 对应 Ls
                "metrics": {...},                # 评估指标
            }
        """
        # 检查缓存
        cache_key = self._make_cache_key(
            mars_year, ls_start, selected_variables, horizon
        )
        if cache_key in self._result_cache:
            logger.info("命中预测缓存")
            return self._result_cache[cache_key]

        cfg = MODEL_CONFIG
        window = cfg["input_window"]

        # 1. 获取模型输入
        input_arr, channel_mask, input_ls = self.data_service.get_model_input(
            mars_year, ls_start, window, selected_variables,
        )

        # 2. 获取真值
        try:
            truth_arr, truth_ls = self.data_service.get_ground_truth(
                mars_year, ls_start, window, horizon,
            )
        except ValueError as e:
            logger.warning(f"无法获取真值: {e}")
            truth_arr = None
            truth_ls = np.array([ls_start + i * 5.0 for i in range(horizon)])

        # 3. 模型推理
        pred_arr = self._run_inference(input_arr, channel_mask, horizon)

        # 4. 计算差值和指标
        actual_horizon = pred_arr.shape[0]

        if truth_arr is not None:
            actual_horizon = min(actual_horizon, truth_arr.shape[0])
            pred_arr = pred_arr[:actual_horizon]
            truth_arr = truth_arr[:actual_horizon]
            residual_arr = pred_arr - truth_arr
            metrics = self._compute_metrics(truth_arr, pred_arr)
        else:
            residual_arr = np.zeros_like(pred_arr)
            metrics = self._empty_metrics(actual_horizon)

        # 5. 组装结果
        om = self.data_service._get_openmars(mars_year)
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

        # 缓存
        self._result_cache[cache_key] = result
        return result

    def _run_inference(
        self,
        input_arr: np.ndarray,
        channel_mask: np.ndarray,
        horizon: int,
    ) -> np.ndarray:
        """
        执行 PyTorch 推理。

        Args:
            input_arr: (window, total_ch, H, W)
            channel_mask: (total_ch,)
            horizon: 预测步数

        Returns:
            pred: (horizon, H, W)
        """
        with torch.no_grad():
            # (1, window, C, H, W)
            x = torch.from_numpy(input_arr).unsqueeze(0).float().to(self.device)
            mask = torch.from_numpy(channel_mask).float().to(self.device)

            # 临时修改 pred_horizon
            orig_horizon = self.model.configs.get("pred_horizon", 3)
            self.model.configs["pred_horizon"] = horizon

            try:
                output = self.model(x, channel_mask=mask)
                # output: (1, horizon, 1, H, W) → (horizon, H, W)
                pred = output[0, :, 0].cpu().numpy()
            finally:
                self.model.configs["pred_horizon"] = orig_horizon

        return pred

    # ═══════════════════════════════════════════
    #  评估指标
    # ═══════════════════════════════════════════

    def _compute_metrics(
        self,
        truth: np.ndarray,
        pred: np.ndarray,
    ) -> dict:
        """
        计算逐步和总体评估指标。

        Args:
            truth: (horizon, H, W)
            pred:  (horizon, H, W)

        Returns:
            {"overall": {...}, "per_step": [{...}, ...]}
        """
        horizon = truth.shape[0]
        per_step = []

        for step in range(horizon):
            t = truth[step].flatten()
            p = pred[step].flatten()

            # 去除 NaN
            valid = ~(np.isnan(t) | np.isnan(p))
            t_valid, p_valid = t[valid], p[valid]

            if len(t_valid) < 10:
                per_step.append(self._zero_metrics(step + 1))
                continue

            rmse = float(np.sqrt(mean_squared_error(t_valid, p_valid)))
            mae = float(mean_absolute_error(t_valid, p_valid))
            r2 = float(r2_score(t_valid, p_valid))

            # SSIM 需要 2D 输入
            t_2d = truth[step]
            p_2d = pred[step]
            t_2d = np.nan_to_num(t_2d, nan=0.0)
            p_2d = np.nan_to_num(p_2d, nan=0.0)

            data_range = max(t_2d.max() - t_2d.min(), 1e-10)
            ssim_val = float(ssim(t_2d, p_2d, data_range=data_range))

            per_step.append({
                "step": step + 1,
                "rmse": round(rmse, 6),
                "mae": round(mae, 6),
                "ssim": round(ssim_val, 4),
                "r2": round(r2, 4),
            })

        # 总体指标（各步平均）
        overall = {
            "step": 0,
            "rmse": round(np.mean([s["rmse"] for s in per_step]), 6),
            "mae": round(np.mean([s["mae"] for s in per_step]), 6),
            "ssim": round(np.mean([s["ssim"] for s in per_step]), 4),
            "r2": round(np.mean([s["r2"] for s in per_step]), 4),
        }

        return {"overall": overall, "per_step": per_step}

    @staticmethod
    def _zero_metrics(step: int) -> dict:
        return {"step": step, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0}

    @staticmethod
    def _empty_metrics(horizon: int) -> dict:
        per_step = [
            {"step": i + 1, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0}
            for i in range(horizon)
        ]
        return {
            "overall": {"step": 0, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0},
            "per_step": per_step,
        }

    # ═══════════════════════════════════════════
    #  消融实验（预计算）
    # ═══════════════════════════════════════════

    def get_ablation_results(
        self,
        mars_year: int = 27,
        ls_start: float = 90.0,
    ) -> list[dict]:
        """
        运行消融实验：测试不同变量组合的预测效果。
        """
        combos = [
            ("Full (All 7ch)", MCD_VARIABLES.copy()),
            ("No Dust", [v for v in MCD_VARIABLES if v != "Dust_Optical_Depth"]),
            ("No Wind", [v for v in MCD_VARIABLES if "Wind" not in v]),
            ("Temp + Solar Only", ["Temperature", "Solar_Flux_DN"]),
            ("O₃ Only (Baseline)", []),
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

    # ═══════════════════════════════════════════
    #  辅助
    # ═══════════════════════════════════════════

    def _fields_to_dicts(
        self,
        fields: np.ndarray,
        lat_arr: np.ndarray,
        lon_arr: np.ndarray,
    ) -> list[dict]:
        """
        将 (horizon, H, W) 的数组转为前端需要的格式列表。
        """
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
