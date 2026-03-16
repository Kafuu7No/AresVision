"""
模型推理服务 (Inference Layer)
专注于 PyTorch 资源管理与前向传播计算。
"""
import logging
import torch
import numpy as np

from config import MODEL_CONFIG, MODEL_DIR, MCD_VARIABLES
from core.predict_model import PredRNNv2

logger = logging.getLogger("aresvision.predict.inference")


class PredictInference:
    def __init__(self):
        self.device = self._select_device()
        self._model_cache = {}  # {suffix: model}
        # 为保持向后兼容，提供默认的 `model` 属性
        self.model, self._default_input_dim, _ = self.get_model_for_variables(MCD_VARIABLES)

    def _select_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"使用 GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device("cpu")
            logger.info("使用 CPU 推理")
        return device

    def get_model_for_variables(self, selected_variables: list[str]) -> tuple[PredRNNv2, int, dict]:
        """
        根据环境变量组合获取模型。
        使用显式的分支结构实现变量组合与模型权重的一一对应。
        返回: (模型实例, 输入维度, 模型信息字典)
        """
        from config import DEFAULT_MODEL_SUFFIX

        selected_set = set(selected_variables)
        is_fallback = False
        fallback_reason = ""
        
        # ─── 显式分支映射 ───
        if not selected_set:
            suffix = "baseline"
            input_dim = 1
        elif selected_set == {"Temperature"}:
            suffix = "T"
            input_dim = 2
        elif selected_set == {"Dust_Optical_Depth"}:
            suffix = "D"
            input_dim = 2
        elif selected_set == {"Solar_Flux_DN"}:
            suffix = "S"
            input_dim = 2
        elif selected_set == {"U_Wind"}:
            suffix = "U"
            input_dim = 2
        elif selected_set == {"V_Wind"}:
            suffix = "V"
            input_dim = 2
        elif selected_set == {"Dust_Optical_Depth", "Solar_Flux_DN"}:
            suffix = "DS"
            input_dim = 3
        elif selected_set == {"Dust_Optical_Depth", "Temperature"}:
            suffix = "DT"
            input_dim = 3
        elif selected_set == {"Solar_Flux_DN", "Temperature"}:
            suffix = "ST"
            input_dim = 3
        elif selected_set == {"U_Wind", "Dust_Optical_Depth"}:
            suffix = "UD"
            input_dim = 3
        elif selected_set == {"Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"}:
            suffix = "DST"
            input_dim = 4
        elif selected_set == {"U_Wind", "Dust_Optical_Depth", "Solar_Flux_DN"}:
            suffix = "UDS"
            input_dim = 4
        elif selected_set == {"U_Wind", "Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"}:
            suffix = "UDST"
            input_dim = 5
        elif selected_set == {"U_Wind", "V_Wind", "Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"}:
            suffix = "UVDST"
            input_dim = 6
        else:
            # 默认回退逻辑
            is_fallback = True
            fallback_reason = "所选变量组合未定义对应模型分支"
            self._print_fallback_warning(selected_variables, DEFAULT_MODEL_SUFFIX, fallback_reason)
            suffix = DEFAULT_MODEL_SUFFIX
            input_dim = 6

        # 检查是否存在对应权重
        weight_path = self._find_weight_file(suffix)
        if not weight_path and suffix != DEFAULT_MODEL_SUFFIX:
            is_fallback = True
            fallback_reason = f"模型权重文件 *_{suffix}.pth 物理缺失"
            self._print_fallback_warning(selected_variables, DEFAULT_MODEL_SUFFIX, fallback_reason)
            suffix = DEFAULT_MODEL_SUFFIX
            weight_path = self._find_weight_file(suffix)
            input_dim = 6

        input_vars = ["Ozone"] + (selected_variables if not is_fallback else ["U_Wind", "V_Wind", "Dust", "Solar", "Temp"])

        model_info = {
            "suffix": suffix,
            "input_dim": input_dim,
            "input_vars": input_vars,
            "is_fallback": is_fallback,
            "fallback_reason": fallback_reason,
            "weight_file": weight_path.name if weight_path else "None"
        }

        if suffix in self._model_cache:
            return self._model_cache[suffix], input_dim, model_info

        # 创建并加载模型
        model = self._create_and_load(weight_path, input_dim)
        self._model_cache[suffix] = model
        return model, input_dim, model_info

    def _print_fallback_warning(self, requested_vars, fallback_suffix, reason):
        """在后端终端打印醒目的回退警告"""
        logger.warning("!" * 60)
        logger.warning("  [模型加载警告] MODEL FALLBACK DETECTED")
        logger.warning(f"  原因: {reason}")
        logger.warning(f"  请求变量: {requested_vars}")
        logger.warning(f"  操作: 自动回退至默认模型 -> {fallback_suffix}")
        logger.warning("!" * 60)

    def _find_weight_file(self, suffix: str):
        # 使用精确匹配模式，例如 *_T.pth，防止 T 匹配到 DT.pth
        pattern = f"*_{suffix}.pth"
        files = list(MODEL_DIR.glob(pattern))
        if not files:
            files = list(MODEL_DIR.glob(f"*_{suffix}.pt"))
        return files[0] if files else None

    def _create_and_load(self, weight_path, input_dim) -> PredRNNv2:
        cfg = MODEL_CONFIG
        model = PredRNNv2(
            input_dim=input_dim,
            hidden_dims=cfg["num_hidden"],
            height=cfg["img_height"],
            width=cfg["img_width"],
            horizon=cfg["pred_horizon"],
        ).to(self.device)

        if weight_path:
            try:
                state_dict = torch.load(weight_path, map_location=self.device, weights_only=True)
                model.load_state_dict(state_dict, strict=True)
                logger.info(f"动态加载模型权重: {weight_path.name} (input_dim={input_dim})")
            except Exception as e:
                logger.error(f"加载权重失败: {e}")
        else:
            logger.warning(f"未找到权重文件，将使用随机初始化模型 (input_dim={input_dim})")

        model.eval()
        return model

    def infer(self, model: PredRNNv2, scaled_input: torch.Tensor, horizon: int) -> np.ndarray:
        """
        执行推理。
        Args:
            model: 已加载的模型实例
            scaled_input: (1, window, C, H, W)
            horizon: 输出步长

        Returns:
            (horizon, H, W)
        """
        with torch.no_grad():
            output = model(scaled_input)
            # PredRNNv2 输出结构为 (batch, horizon, 1, H, W)
            pred_scaled = output[0, :, 0].cpu().numpy()

        pred_scaled = pred_scaled[:horizon]
        return pred_scaled
