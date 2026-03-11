"""
模型推理服务 (Inference Layer)
专注于 PyTorch 资源管理与前向传播计算。
"""
import logging
import torch

from config import MODEL_CONFIG, MODEL_DIR
from core.predict_model import PredRNNv2

logger = logging.getLogger("aresvision.predict.inference")


class PredictInference:
    def __init__(self):
        self.device = self._select_device()
        self.model = self._load_model()

    def _select_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"使用 GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device("cpu")
            logger.info("使用 CPU 推理")
        return device

    def _load_model(self) -> PredRNNv2:
        cfg = MODEL_CONFIG
        model = PredRNNv2(
            input_dim=cfg["total_channels"],
            hidden_dims=cfg["num_hidden"],
            height=cfg["img_height"],
            width=cfg["img_width"],
            horizon=cfg["pred_horizon"],
        ).to(self.device)

        weight_files = list(MODEL_DIR.glob("*.pt")) + list(MODEL_DIR.glob("*.pth"))

        if weight_files:
            weight_path = weight_files[0]
            try:
                state_dict = torch.load(weight_path, map_location=self.device, weights_only=True)
                model.load_state_dict(state_dict, strict=True)
                logger.info(f"模型权重已加载: {weight_path.name}")
            except Exception as e:
                logger.warning(f"加载权重失败 (strict=True): {e}")
                try:
                    state_dict = torch.load(weight_path, map_location=self.device, weights_only=True)
                    model.load_state_dict(state_dict, strict=False)
                    logger.warning("已用 strict=False 加载（部分权重匹配），预测结果可能不准确")
                except Exception as e2:
                    logger.warning(f"权重加载完全失败: {e2}，使用随机初始化模型")
        else:
            logger.warning(
                f"未找到模型权重文件 ({MODEL_DIR})，将使用随机初始化模型。预测结果仅供演示。"
            )

        model.eval()
        return model

    def infer(self, scaled_input: torch.Tensor, horizon: int) -> torch.Tensor:
        """
        执行推理。
        Args:
            scaled_input: (1, window, 7, H, W)
            horizon: 输出步长

        Returns:
            (horizon, H, W)
        """
        with torch.no_grad():
            output = self.model(scaled_input)
            pred_scaled = output[0, :, 0].cpu().numpy()

        pred_scaled = pred_scaled[:horizon]
        return pred_scaled
