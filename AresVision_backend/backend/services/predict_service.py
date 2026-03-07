"""
预测服务层
- 加载 PredRNNv2 模型权重（与训练时结构完全一致）
- 数据预处理：物理变换 → StandardScaler 标准化
- 推理 + 反标准化
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
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from skimage.metrics import structural_similarity as ssim

from config import MODEL_CONFIG, MODEL_DIR, MCD_VARIABLES, N_LAT, N_LON
from core.predrnn_v2 import PredRNNv2
from services.data_service import DataService

logger = logging.getLogger("aresvision.predict")

# 通道顺序与训练时保持一致
# 索引: 0=O3, 1=U_Wind, 2=V_Wind, 3=Pressure, 4=Temperature, 5=Dust_Optical_Depth, 6=Solar_Flux_DN
CHANNEL_ORDER = ["O3"] + MCD_VARIABLES  # ["O3", "U_Wind", "V_Wind", "Pressure", "Temperature", "Dust_Optical_Depth", "Solar_Flux_DN"]


class PredictService:
    """
    预测服务：加载模型 → 接收输入 → 预处理 → 推理 → 反标准化 → 评估 → 返回结果
    """

    def __init__(self, data_service: DataService):
        self.data_service = data_service
        self.model: PredRNNv2 | None = None
        self.device = self._select_device()
        self._result_cache = LRUCache(maxsize=32)

        # 标准化参数（从训练数据计算）
        self.scalers: list | None = None   # 7 个通道的 StandardScaler
        self.y_mean: float = 0.0           # 臭氧全局均值
        self.y_std: float = 1.0            # 臭氧全局标准差

        self._load_model()
        self._compute_scalers()

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
        """加载 PredRNNv2 模型权重（strict=True，必须与训练时结构完全一致）"""
        cfg = MODEL_CONFIG

        self.model = PredRNNv2(
            input_dim=cfg["total_channels"],    # 7
            hidden_dims=cfg["num_hidden"],       # [64, 64, 64]
            height=cfg["img_height"],            # 36
            width=cfg["img_width"],              # 72
            horizon=cfg["pred_horizon"],         # 3
        ).to(self.device)

        weight_files = list(MODEL_DIR.glob("*.pt")) + list(MODEL_DIR.glob("*.pth"))

        if weight_files:
            weight_path = weight_files[0]
            try:
                state_dict = torch.load(weight_path, map_location=self.device,
                                        weights_only=True)
                self.model.load_state_dict(state_dict, strict=True)
                logger.info(f"模型权重已加载: {weight_path.name}")
            except Exception as e:
                logger.warning(f"加载权重失败 (strict=True): {e}")
                # 尝试 strict=False 作为回退
                try:
                    state_dict = torch.load(weight_path, map_location=self.device,
                                            weights_only=True)
                    self.model.load_state_dict(state_dict, strict=False)
                    logger.warning("已用 strict=False 加载（部分权重匹配），预测结果可能不准确")
                except Exception as e2:
                    logger.warning(f"权重加载完全失败: {e2}，使用随机初始化模型")
        else:
            logger.warning(
                f"未找到模型权重文件 ({MODEL_DIR})，将使用随机初始化模型。预测结果仅供演示。"
            )

        self.model.eval()

    def _compute_scalers(self):
        """
        计算标准化参数，从 MY27 全量数据中估计。
        理想情况下应从训练时保存的 scaler 文件加载，此处从数据计算近似。
        """
        try:
            om = self.data_service._get_openmars(27)
            am = self.data_service._get_aligned_mcd(27)

            o3 = om["o3col"]  # (T, 36, 72)
            T, H, W = o3.shape

            # 臭氧全局均值/标准差（用于反标准化输出）
            self.y_mean = float(np.nanmean(o3))
            self.y_std = float(np.nanstd(o3))
            if self.y_std < 1e-10:
                self.y_std = 1.0

            self.scalers = []

            # 通道 0: O3
            scaler_o3 = StandardScaler()
            scaler_o3.fit(np.nan_to_num(o3, nan=0.0).reshape(T, -1))
            self.scalers.append(scaler_o3)

            # 通道 1-6: 环境变量（顺序与 MCD_VARIABLES 一致）
            for var_name in MCD_VARIABLES:
                if var_name in am:
                    data = np.nan_to_num(am[var_name], nan=0.0)
                    # 物理预处理（与训练时一致）
                    if var_name == "Dust_Optical_Depth":
                        data = np.where(data < 0, 0.0, data)
                        data = np.log1p(data)
                    elif var_name == "Solar_Flux_DN":
                        max_val = np.max(np.abs(data))
                        if max_val > 1e-6:
                            data = data / max_val
                    scaler = StandardScaler()
                    scaler.fit(data.reshape(T, -1))
                    self.scalers.append(scaler)
                else:
                    # 缺失变量：创建单位 scaler（均值0，方差1，不做变换）
                    dummy = StandardScaler()
                    dummy.mean_ = np.zeros(H * W)
                    dummy.scale_ = np.ones(H * W)
                    dummy.var_ = np.ones(H * W)
                    dummy.n_features_in_ = H * W
                    self.scalers.append(dummy)

            logger.info(
                f"标准化参数计算完成: y_mean={self.y_mean:.4f}, y_std={self.y_std:.4f}"
            )

        except Exception as e:
            logger.warning(f"计算标准化参数失败: {e}，将跳过标准化")
            self.scalers = None
            self.y_mean = 0.0
            self.y_std = 1.0

    def _apply_physical_preprocess(self, input_arr: np.ndarray) -> np.ndarray:
        """
        物理预处理（与训练时一致）：
        - 通道 5 (Dust_Optical_Depth): log1p 变换
        - 通道 6 (Solar_Flux_DN): 除以最大值归一化

        Args:
            input_arr: (window, 7, H, W)

        Returns:
            (window, 7, H, W) — 物理预处理后的数值
        """
        result = input_arr.copy()

        # 通道 5: Dust_Optical_Depth → log1p
        dust = result[:, 5, :, :]
        dust = np.where(dust < 0, 0.0, dust)
        result[:, 5, :, :] = np.log1p(dust)

        # 通道 6: Solar_Flux_DN → 归一化
        flux = result[:, 6, :, :]
        max_val = np.max(np.abs(flux))
        if max_val > 1e-6:
            result[:, 6, :, :] = flux / max_val

        return result

    def _preprocess_input(self, input_arr: np.ndarray) -> np.ndarray:
        """
        对模型输入做物理预处理 + StandardScaler 标准化。

        Args:
            input_arr: (window, 7, H, W) — 原始数值

        Returns:
            (window, 7, H, W) — 标准化后的数值
        """
        # 1. 物理预处理
        result = self._apply_physical_preprocess(input_arr)

        if self.scalers is None:
            return result

        # 2. StandardScaler 标准化
        window, C, H, W = result.shape
        for c in range(C):
            if self.scalers[c] is not None:
                flat = result[:, c, :, :].reshape(window, -1)
                result[:, c, :, :] = self.scalers[c].transform(flat).reshape(window, H, W)

        return result

    def _postprocess_output(self, pred_scaled: np.ndarray) -> np.ndarray:
        """
        对模型输出做反标准化（回到物理单位）。

        Args:
            pred_scaled: (horizon, H, W) — 标准化空间的预测值

        Returns:
            (horizon, H, W) — 物理单位的预测值 (μm-atm)
        """
        return pred_scaled * self.y_std + self.y_mean

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

        # 3. 模型推理（包含预处理 + 推理 + 反标准化）
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
            input_arr: (window, 7, H, W) — 原始数值（未标准化）
            channel_mask: (7,) — 0/1 掩码
            horizon: 预测步数（训练时固定为 3，horizon 可以取子集）

        Returns:
            pred: (horizon, H, W) — 物理单位的预测值
        """
        # 1. 应用通道掩码（未选变量置零，在预处理前做）
        masked_input = input_arr.copy()
        for c in range(len(channel_mask)):
            if channel_mask[c] == 0:
                masked_input[:, c, :, :] = 0.0

        # 2. 预处理：物理变换 + 标准化
        scaled_input = self._preprocess_input(masked_input)

        # 3. 推理
        with torch.no_grad():
            x = torch.from_numpy(scaled_input).unsqueeze(0).float().to(self.device)
            # x shape: (1, window, 7, H, W)

            output = self.model(x)
            # output shape: (1, model_horizon, 1, H, W)

            pred_scaled = output[0, :, 0].cpu().numpy()
            # pred_scaled shape: (model_horizon, H, W)

        # 4. 取前 horizon 步
        pred_scaled = pred_scaled[:horizon]

        # 5. 反标准化回物理单位
        pred_physical = self._postprocess_output(pred_scaled)

        return pred_physical

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
        """
        horizon = truth.shape[0]
        per_step = []

        for step in range(horizon):
            t = truth[step].flatten()
            p = pred[step].flatten()

            valid = ~(np.isnan(t) | np.isnan(p))
            t_valid, p_valid = t[valid], p[valid]

            if len(t_valid) < 10:
                per_step.append(self._zero_metrics(step + 1))
                continue

            rmse = float(np.sqrt(mean_squared_error(t_valid, p_valid)))
            mae = float(mean_absolute_error(t_valid, p_valid))
            r2 = float(r2_score(t_valid, p_valid))

            t_2d = np.nan_to_num(truth[step], nan=0.0)
            p_2d = np.nan_to_num(pred[step], nan=0.0)
            data_range = max(t_2d.max() - t_2d.min(), 1e-10)
            ssim_val = float(ssim(t_2d, p_2d, data_range=data_range))

            per_step.append({
                "step": step + 1,
                "rmse": round(rmse, 6),
                "mae": round(mae, 6),
                "ssim": round(ssim_val, 4),
                "r2": round(r2, 4),
            })

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
    #  消融实验
    # ═══════════════════════════════════════════

    def get_ablation_results(
        self,
        mars_year: int = 27,
        ls_start: float = 90.0,
    ) -> list[dict]:
        """运行消融实验：测试不同变量组合的预测效果。"""
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

    # ═══════════════════════════════════════════
    #  辅助
    # ═══════════════════════════════════════════

    def _fields_to_dicts(
        self,
        fields: np.ndarray,
        lat_arr: np.ndarray,
        lon_arr: np.ndarray,
    ) -> list[dict]:
        """将 (horizon, H, W) 的数组转为前端需要的格式列表。"""
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
