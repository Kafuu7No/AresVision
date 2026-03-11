"""
预测专用数据转换器
严格同步 demo3.py 中的数据清洗、物理预处理和标准化逻辑。
"""
import logging
import numpy as np
from sklearn.preprocessing import StandardScaler
from config import MCD_VARIABLES
from services.data_service import DataService

logger = logging.getLogger("aresvision.predict.transforms")


class PredictTransforms:
    def __init__(self, data_service: DataService):
        self.data_service = data_service
        self.scalers = None
        self.y_mean: float = 0.0
        self.y_std: float = 1.0
        self.max_flux: float = 1.0

        self._compute_scalers_strict()

    def clean_invalid(self, x: np.ndarray, name: str) -> np.ndarray:
        """
        同步 demo3.py L166 (clean_invalid):
        检查并处理 ~np.isfinite(x) 以及绝对值超过 1e10 的数据。
        """
        x = x.astype(np.float32)
        bad = ~np.isfinite(x) | (np.abs(x) > 1e10)
        if np.any(bad):
            # logger.debug(f"[Prediction] {name}: cleaned {bad.sum()} invalid values")
            x[bad] = np.nan
        return np.nan_to_num(x, nan=0.0)

    def _compute_scalers_strict(self):
        """
        同步 demo3.py L237-260:
        基于所有可用年份 (MY27 + MY28) 的拼接数据计算标准化参数。
        """
        try:
            o3_list, var_lists = [], {v: [] for v in MCD_VARIABLES}
            years = self.data_service.get_available_years()
            H, W = 0, 0
            
            # Step 1: 加载并清洗所有年份数据
            for my in years:
                om = self.data_service.get_openmars_data(my)
                am = self.data_service.get_aligned_mcd_data(my)
                
                # 清洗 OpenMars O3 (demo3 L176)
                o3_data = self.clean_invalid(om["o3col"], f"MY{my} O3")
                o3_list.append(o3_data)
                H, W = o3_data.shape[1], o3_data.shape[2]
                
                # 清洗 MCD 变量 (demo3 L180)
                for v in MCD_VARIABLES:
                    if v in am:
                        var_lists[v].append(self.clean_invalid(am[v], f"MY{my} {v}"))

            if not o3_list:
                raise ValueError("未找到任何年份的数据用于预测初始化")

            o3_all = np.concatenate(o3_list, axis=0)
            am_all = {v: np.concatenate(var_lists[v], axis=0) for v in MCD_VARIABLES if var_lists[v]}
            
            T_all = o3_all.shape[0]

            # Step 2: 物理预处理 (基于合集) - demo3 L183-191
            # 沙尘 Log1p
            if "Dust_Optical_Depth" in am_all:
                dust = am_all["Dust_Optical_Depth"]
                dust[dust < 0] = 0.0
                am_all["Dust_Optical_Depth"] = np.log1p(dust)
            
            # 辐射归一化 (使用全局 Max)
            if "Solar_Flux_DN" in am_all:
                flux = am_all["Solar_Flux_DN"]
                self.max_flux = float(np.max(np.abs(flux)) + 1e-6)
                am_all["Solar_Flux_DN"] = flux / self.max_flux

            # Step 3: 标准化参数 (demo3 L250-261)
            # 臭氧 (y_scaled)
            self.y_mean = float(np.mean(o3_all))
            self.y_std = float(np.std(o3_all))
            if self.y_std < 1e-10: self.y_std = 1.0

            self.scalers = []
            
            # 这里的特征顺序严格遵循 X_raw 拼接顺序 (demo3 L241-245):
            # [O3, u, v, ps, temp, dust, flux]
            
            # 1. O3 Scaler
            scaler_o3 = StandardScaler()
            scaler_o3.fit(o3_all.reshape(T_all, -1))
            self.scalers.append(scaler_o3)

            # 2. MCD Scalers
            for var_name in MCD_VARIABLES:
                if var_name in am_all:
                    scaler = StandardScaler()
                    scaler.fit(am_all[var_name].reshape(T_all, -1))
                    self.scalers.append(scaler)
                else:
                    # 虚拟补位
                    dummy = StandardScaler()
                    dummy.mean_ = np.zeros(H * W)
                    dummy.scale_ = np.ones(H * W)
                    dummy.var_ = np.ones(H * W)
                    dummy.n_features_in_ = H * W
                    self.scalers.append(dummy)

            logger.info(f"[Prediction] 严格标准化参数完成: y_mean={self.y_mean:.4f}, y_std={self.y_std:.4f}, flux_max={self.max_flux:.4f}")

        except Exception as e:
            logger.error(f"[Prediction] 预测参数初始化失败: {e}")
            raise e

    def apply_physical_preprocess_strict(self, input_arr: np.ndarray) -> np.ndarray:
        """
        同步 demo3.py L183-191:
        输入 shape: (window, C, H, W)
        """
        result = input_arr.copy()
        
        # 1. 极端值清洗 (同步 demo3 L166)
        # 注意：在这里应用清洗可能略晚，但在 Inference 阶段这是最稳的
        for c in range(result.shape[1]):
            result[:, c] = self.clean_invalid(result[:, c], f"Channel {c}")

        # 2. 沙尘 Log1p (demo3 L187-188)
        dust = result[:, 5, :, :]
        dust[dust < 0] = 0.0
        result[:, 5, :, :] = np.log1p(dust)

        # 3. 辐射归一化 (demo3 L190)
        flux = result[:, 6, :, :]
        result[:, 6, :, :] = flux / self.max_flux

        return result

    def preprocess_input(self, input_arr: np.ndarray) -> np.ndarray:
        """
        推理时的全流程预处理
        """
        # 1. 物理变换
        result = self.apply_physical_preprocess_strict(input_arr)

        if self.scalers is None:
            return result

        # 2. 严格标准化 (demo3 L252-258)
        window, C, H, W = result.shape
        for c in range(C):
            if c < len(self.scalers):
                flat = result[:, c, :, :].reshape(window, -1)
                result[:, c, :, :] = self.scalers[c].transform(flat).reshape(window, H, W)

        return result

    def postprocess_output(self, pred_scaled: np.ndarray) -> np.ndarray:
        """
        同步 demo3.py L407: y_pred_phys = preds * y_std + y_mean
        """
        return pred_scaled * self.y_std + self.y_mean
