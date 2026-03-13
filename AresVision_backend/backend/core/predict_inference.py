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
        # 为保持向后兼容，提供默认的 `model` 属性，供仍然使用
        # `predict_inference.model` 的调用方访问。
        # 这里使用全部配置的 MCD 变量加载一个默认模型。
        self.model, self._default_input_dim = self.get_model_for_variables(MCD_VARIABLES)

    def _select_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"使用 GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device("cpu")
            logger.info("使用 CPU 推理")
        return device

    def get_model_for_variables(self, selected_variables: list[str]) -> tuple[PredRNNv2, int]:
        """
        根据环境变量组合获取模型。
        返回: (模型实例, 输入维度)
        """
        from config import VARIABLE_SHORTHANDS, DEFAULT_MODEL_SUFFIX

        # 生成后缀，例如 UVPDS
        shorthands = []
        for var in MCD_VARIABLES:
            if var in selected_variables:
                shorthands.append(VARIABLE_SHORTHANDS.get(var, ""))
        
        suffix = "".join(shorthands)
        input_dim = 1 + len(shorthands)

        # 检查是否存在对应权重
        weight_path = self._find_weight_file(suffix)
        if not weight_path and suffix != DEFAULT_MODEL_SUFFIX:
            logger.warning(f"未找到组合 '{suffix}' 的模型，尝试回退到默认组合 {DEFAULT_MODEL_SUFFIX}")
            suffix = DEFAULT_MODEL_SUFFIX
            weight_path = self._find_weight_file(suffix)
            input_dim = 7 # 1 (O3) + 6 (MCD)

        if suffix in self._model_cache:
            return self._model_cache[suffix], input_dim

        # 创建并加载模型
        model = self._create_and_load(weight_path, input_dim)
        self._model_cache[suffix] = model
        return model, input_dim

    def _find_weight_file(self, suffix: str):
        pattern = f"*{suffix}.pth"
        files = list(MODEL_DIR.glob(pattern))
        if not files:
            files = list(MODEL_DIR.glob(f"*{suffix}.pt"))
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
