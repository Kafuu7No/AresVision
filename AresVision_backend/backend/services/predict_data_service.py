"""
为模型切分离线特征的数据预处理层
专门用于生成模型的 (window, C, H, W) 张量
"""
import numpy as np

from config import MCD_VARIABLES, N_LAT, N_LON
from services.data_service import DataService


class PredictDataService:
    def __init__(self, data_service: DataService):
        self.data_service = data_service

    def get_model_input(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        selected_variables: list[str],
        use_predict_data: bool = False,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        构建模型输入张量
        """
        om = self.data_service.get_openmars_data(mars_year)
        if use_predict_data:
            am = self.data_service.get_aligned_mcd_predict_data(mars_year)
        else:
            am = self.data_service.get_aligned_mcd_data(mars_year)

        start_idx = self.data_service.get_nearest_ls_index(om["ls"], ls_start)

        end_idx = min(start_idx + window, len(om["ls"]))
        actual_window = end_idx - start_idx
        if actual_window < window:
            start_idx = max(0, end_idx - window)

        indices = list(range(start_idx, start_idx + window))
        target_ls = om["ls"][indices]

        total_ch = 1 + len(MCD_VARIABLES)
        H, W = N_LAT, N_LON
        input_arr = np.zeros((window, total_ch, H, W), dtype=np.float32)
        channel_mask = np.zeros(total_ch, dtype=np.float32)

        input_arr[:, 0, :, :] = om["o3col"][indices]
        channel_mask[0] = 1.0

        for ch_idx, var_name in enumerate(MCD_VARIABLES, start=1):
            if var_name in selected_variables and var_name in am:
                data = am[var_name][indices]
                data = np.nan_to_num(data, nan=0.0)
                input_arr[:, ch_idx, :, :] = data
                channel_mask[ch_idx] = 1.0

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
        获取真值场
        """
        om = self.data_service.get_openmars_data(mars_year)
        start_idx = self.data_service.get_nearest_ls_index(om["ls"], ls_start)
        pred_start = start_idx + window

        end_idx = min(pred_start + horizon, len(om["ls"]))
        actual_h = end_idx - pred_start

        if actual_h <= 0:
            raise ValueError(f"Ls={ls_start} 之后没有足够的真值数据")

        indices = list(range(pred_start, end_idx))
        truth = om["o3col"][indices]
        ls_vals = om["ls"][indices]

        return truth, ls_vals
