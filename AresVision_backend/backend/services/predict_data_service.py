"""
专用于预测链路的数据预处理服务
完全解构自 demo3-UVPDST.py，实现独立的数据加载、清洗、对齐与张量构造。
"""
import os
import glob
import re
import logging
import numpy as np
import netCDF4 as nc
from scipy.interpolate import interp1d
import torch # Added torch import
from config import OPENMARS_DIR, MCD_DIR, MCD_VARIABLES, TRAINING_MASTER_ORDER, N_LAT, N_LON

logger = logging.getLogger("aresvision.predict.data")

class PredictDataService:
    def __init__(self, data_service=None, use_processed_tensor: bool = True):
        # 保留 data_service 参数仅为了兼容性，逻辑上已实现解耦
        self.data_service = data_service
        self._max_flux = 1.0  # 动态计算辐射归一化参数
        
        # 尝试加载预处理好的张量
        self.processed_data = None
        # Construct path relative to the current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.tensor_path = os.path.join(current_dir, "..", "data", "processed_tensors.pt")
        
        if use_processed_tensor:
            if os.path.exists(self.tensor_path):
                try:
                    # weights_only=False is the default for torch.load, but explicitly stated in instruction
                    self.processed_data = torch.load(self.tensor_path, weights_only=False)
                    logger.info(f"成功加载预处理张量: {self.tensor_path}")
                except Exception as e:
                    logger.error(f"加载预处理张量失败: {e}")
            else:
                logger.info(f"未找到预处理张量文件: {self.tensor_path}，将回退到原始 NetCDF 读取。")
        else:
            logger.info("已禁用预处理张量读取，按请求数据源直接走原始 NetCDF 数据流。")
        # Cache heavy per-year preparation in raw NetCDF path.
        self._prepared_year_cache: dict[int, tuple[np.ndarray, np.ndarray, dict[str, np.ndarray]]] = {}

    def prewarm_for_year(self, mars_year: int) -> None:
        """
        Warm raw-data preparation cache for a specific Mars year.
        This is primarily used by personal data-source prewarm flow after login.
        """
        if self.processed_data is not None:
            return
        self._prepare_aligned_year_data(mars_year)

    def get_model_input(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        selected_variables: list[str],
        use_predict_data: bool = True,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        优先从预处理张量中提取数据，否则回退到原始 NetCDF 读取逻辑
        """
        if self.processed_data is not None:
            # 1. 查找最接近的 Ls 索引 (考虑年份)
            ls_array = self.processed_data['om_ls_raw']
            idx = self._get_nearest_ls_index(ls_array, ls_start, mars_year)
            
            if idx < len(self.processed_data['X_torch']):
                # 因为 X_torch 已经是预先切好的滑窗样本 [Batch, Time, Channels, H, W]
                # 所以直接提取索引 idx 处的整个窗口即可，不需要再做 [idx : idx + window] 切片
                x_sample = self.processed_data['X_torch'][idx].cpu().numpy() # (window, C, H, W)
                
                # ─── 维度适配逻辑 ───
                # 如果张量是旧版的 7 通道 (含 P)，但配置已改为 6 通道
                if x_sample.shape[1] == 7 and len(MCD_VARIABLES) == 5:
                    # 剔除索引为 3 的通道 (即原 Pressure 通道)
                    # 顺序: [0:O3, 1:U, 2:V, 3:P, 4:D, 5:S, 6:T]
                    indices = [0, 1, 2, 4, 5, 6]
                    x_sample = x_sample[:, indices]
                
                target_ls = ls_array[idx : idx + window]
                
                # 构造 mask (严格对齐 TRAINING_MASTER_ORDER 顺序)
                total_ch = 1 + len(TRAINING_MASTER_ORDER)
                channel_mask = np.zeros(total_ch, dtype=np.float32)
                channel_mask[0] = 1.0 # O3
                for ch_idx, var_name in enumerate(TRAINING_MASTER_ORDER, start=1):
                    if var_name in selected_variables:
                        channel_mask[ch_idx] = 1.0
                
                return x_sample, channel_mask, target_ls
            else:
                logger.warning(f"索引 {idx} 超出预处理张量范围，回退至 NetCDF 读取。")

        # --- 以下为回退逻辑 (NetCDF 读取) ---
        return self._fallback_get_model_input(mars_year, ls_start, window, selected_variables)

    def get_ground_truth(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        horizon: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        优先从预处理张量中提取真值
        """
        if self.processed_data is not None:
            ls_array = self.processed_data['om_ls_raw']
            idx = self._get_nearest_ls_index(ls_array, ls_start, mars_year)
            pred_start = idx + window
            
            # y_torch 维度是 [Batch, Horizon, 1, H, W]
            if idx < len(self.processed_data['y_torch']):
                y_sample = self.processed_data['y_torch'][idx, :, 0].cpu().numpy() # (horizon, H, W)
                
                # IMPORTANT: 这里必须将真值反标准化回物理单位，否则指标计算 (MSE/R2) 会因量纲不一而报错 (R2 ~ -50)
                y_mean = self.processed_data.get('y_mean', 0.0)
                y_std = self.processed_data.get('y_std', 1.0)
                y_sample = y_sample * y_std + y_mean
                
                target_ls = ls_array[pred_start : pred_start + horizon]
                return y_sample, target_ls
            else:
                logger.warning(f"预测起始索引 {pred_start} 超出预处理真值张量范围，回退至 NetCDF 读取。")

        # 回退逻辑
        return self._fallback_get_ground_truth(mars_year, ls_start, window, horizon)

    # --- 内部逻辑函数 ---

    def _fallback_get_model_input(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        selected_variables: list[str],
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        原始的端到端构造模型输入张量逻辑 (作为回退)
        """
        # 1) Prepare (clean + align) once per Mars year and reuse.
        o3_clean, om_ls_raw, aligned_mcd = self._prepare_aligned_year_data(mars_year)

        # 5. 构造滑窗张量索引
        start_idx = self._get_nearest_ls_index(om_ls_raw, ls_start, mars_year)
        # 确保窗口不越界
        if start_idx + window > len(om_ls_raw):
            start_idx = max(0, len(om_ls_raw) - window)
        
        indices = list(range(start_idx, start_idx + window))
        target_ls = om_ls_raw[indices]

        # 6. 填充 7 通道张量 [O3, U, V, P, D, S, T]
        # 注意：此处通道顺序必须与 UVPDST 模型严格一致
        total_ch = 1 + len(MCD_VARIABLES)
        input_arr = np.zeros((window, total_ch, N_LAT, N_LON), dtype=np.float32)
        channel_mask = np.zeros(total_ch, dtype=np.float32)

        # Ch 0: O3
        input_arr[:, 0] = o3_clean[indices]
        channel_mask[0] = 1.0

        # Ch 1-6: MCD Variables (严格对齐 TRAINING_MASTER_ORDER)
        for ch_idx, var_name in enumerate(TRAINING_MASTER_ORDER, start=1):
            if var_name in selected_variables and var_name in aligned_mcd:
                input_arr[:, ch_idx] = aligned_mcd[var_name][indices]
                channel_mask[ch_idx] = 1.0

        return input_arr, channel_mask, target_ls

    def _prepare_aligned_year_data(
        self,
        mars_year: int,
    ) -> tuple[np.ndarray, np.ndarray, dict[str, np.ndarray]]:
        cached = self._prepared_year_cache.get(mars_year)
        if cached is not None:
            return cached

        # 1. 独立读取原始数据
        o3_raw, om_ls_raw = self._load_raw_openmars(mars_year)
        mcd_raw_dict, mcd_ls_raw = self._load_raw_mcd(mars_year)

        # 2. 清洗数据 (demo3 L185)
        o3_clean = self._clean_invalid(o3_raw, "OpenMars O3")
        for k in mcd_raw_dict:
            mcd_raw_dict[k] = self._clean_invalid(mcd_raw_dict[k], k)

        # 3. 物理预处理 (demo3 L204)
        # 沙尘 Log1p (同步 demo3-D.py: 训练脚本中注释掉了此行，因此部署端也需移除以保持尺度一致)
        dust = mcd_raw_dict['Dust_Optical_Depth']
        dust[dust < 0] = 0.0
        # mcd_raw_dict['Dust_Optical_Depth'] = np.log1p(dust)  # 停用以对齐训练脚本
        # 辐射归一化
        flux = mcd_raw_dict['Solar_Flux_DN']
        self._max_flux = np.max(np.abs(flux)) + 1e-6
        mcd_raw_dict['Solar_Flux_DN'] = flux / self._max_flux

        # 4. 时间对齐 (demo3 L214)
        om_ls_cont = self._unwrap_ls(om_ls_raw)
        mcd_ls_cont = self._unwrap_ls(mcd_ls_raw)

        aligned_mcd: dict[str, np.ndarray] = {}
        for k in mcd_raw_dict:
            interpolator = interp1d(
                mcd_ls_cont, mcd_raw_dict[k],
                axis=0, kind='linear',
                bounds_error=False, fill_value="extrapolate"
            )
            aligned_mcd[k] = interpolator(om_ls_cont)

        packed = (o3_clean, om_ls_raw, aligned_mcd)
        self._prepared_year_cache[mars_year] = packed
        return packed

    def _fallback_get_ground_truth(
        self,
        mars_year: int,
        ls_start: float,
        window: int,
        horizon: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        获取真值场 (基于原始 OpenMars 数据) (作为回退)
        """
        o3_raw, om_ls_raw = self._load_raw_openmars(mars_year)
        start_idx = self._get_nearest_ls_index(om_ls_raw, ls_start, mars_year)
        pred_start = start_idx + window
        
        end_idx = min(pred_start + horizon, len(om_ls_raw))
        if pred_start >= end_idx:
            raise ValueError(f"Ls={ls_start} 之后没有足够的真值数据")

        indices = list(range(pred_start, end_idx))
        return o3_raw[indices], om_ls_raw[indices]

    # --- 内部逻辑函数 ---

    def _load_raw_openmars(self, mars_year: int):
        if self.data_service is not None and hasattr(self.data_service, "get_openmars_data"):
            om = self.data_service.get_openmars_data(mars_year)
            o3 = np.asarray(om["o3col"], dtype=np.float32)
            if o3.ndim == 4:  # (time, level, lat, lon)
                o3 = np.nanmean(o3, axis=1)
            ls = np.asarray(om["ls"], dtype=np.float32).reshape(-1)
            if o3.shape[0] != len(ls):
                n = min(o3.shape[0], len(ls))
                o3 = o3[:n]
                ls = ls[:n]
            return o3, ls

        pattern = str(OPENMARS_DIR / f"*my{mars_year}*.nc")
        files = sorted(glob.glob(pattern), key=self._natural_sort_key)
        if not files: raise FileNotFoundError(f"Missing OpenMars data for MY{mars_year}")

        o3_list, ls_list = [], []
        for f in files:
            with nc.Dataset(f) as ds:
                data = ds.variables['o3col'][:]
                if data.ndim == 4: # (time, level, lat, lon)
                    data = np.nanmean(data, axis=1)
                o3_list.append(data)
                ls_key = 'Ls' if 'Ls' in ds.variables else 'ls'
                ls_list.append(ds.variables[ls_key][:])
        
        return np.concatenate(o3_list, axis=0), np.concatenate(ls_list, axis=0)

    def _load_raw_mcd(self, mars_year: int):
        if self.data_service is not None and hasattr(self.data_service, "get_mcd_data"):
            mc = self.data_service.get_mcd_data(mars_year)
            ls = np.asarray(mc.get("ls"), dtype=np.float32).reshape(-1)
            if ls.size == 0:
                raise ValueError(f"Missing MCD ls for MY{mars_year}")

            out = {}
            for v in MCD_VARIABLES:
                arr = mc.get(v)
                if arr is None:
                    continue
                arr = np.asarray(arr, dtype=np.float32)
                if arr.ndim == 4:  # (sol, hour, lat, lon)
                    arr = np.nanmean(arr, axis=1)
                if arr.ndim != 3:
                    continue
                if arr.shape[0] != len(ls):
                    n = min(arr.shape[0], len(ls))
                    arr = arr[:n]
                    ls = ls[:n]
                out[v] = arr

            # Keep channel count predictable even when one variable is absent.
            for v in MCD_VARIABLES:
                if v not in out:
                    out[v] = np.zeros((len(ls), N_LAT, N_LON), dtype=np.float32)
            return out, ls

        pattern = str(MCD_DIR / f"*my{mars_year}*.nc")
        files = sorted(glob.glob(pattern))
        if not files: raise FileNotFoundError(f"Missing MCD data for MY{mars_year}")

        mcd_data = {v: [] for v in MCD_VARIABLES}
        ls_list = []
        
        for f in files:
            with nc.Dataset(f) as ds:
                # 记录维度用于 Ls 展开
                sample_var = ds.variables[MCD_VARIABLES[0]]
                S_dim, H_dim = sample_var.shape[0], sample_var.shape[1]
                
                for v in MCD_VARIABLES:
                    if v in ds.variables:
                        data = ds.variables[v][:]
                        # 合并 Sol 和 Hour 维度 (demo3 L111)
                        mcd_data[v].append(data.reshape(S_dim * H_dim, N_LAT, N_LON))
                
                ls_key = 'Ls' if 'Ls' in ds.variables else 'ls'
                ls_raw = ds.variables[ls_key][:]
                
                # 展开 Ls (demo3 L145)
                if ls_raw.ndim == 1 and len(ls_raw) == S_dim:
                    ls_exp = np.zeros(S_dim * H_dim)
                    for i in range(S_dim):
                        ls_s = ls_raw[i]
                        ls_e = ls_raw[i+1] if i < S_dim - 1 else ls_s + 0.5
                        if ls_e < ls_s: ls_e += 360.0
                        ls_exp[i*H_dim : (i+1)*H_dim] = np.linspace(ls_s, ls_e, H_dim, endpoint=False)
                    ls_list.append(ls_exp % 360.0)
                else:
                    ls_list.append(ls_raw.flatten())

        return {k: np.concatenate(mcd_data[k], axis=0) for k in mcd_data}, np.concatenate(ls_list, axis=0)

    def _clean_invalid(self, x, name):
        # 同步 demo3 L185
        x = np.array(x, dtype=np.float32)
        bad = ~np.isfinite(x) | (np.abs(x) > 1e10)
        if np.any(bad):
            logger.warning(f"Data Cleaning [{name}]: {np.sum(bad)} invalid values")
            x[bad] = np.nan
        return np.nan_to_num(x, nan=0.0)

    def _unwrap_ls(self, ls_array):
        # 同步 demo3 L221
        ls_unwrapped = np.copy(ls_array).astype(np.float64)
        offset = 0.0
        for i in range(1, len(ls_unwrapped)):
            if ls_array[i] < ls_array[i-1] - 180:
                offset += 360.0
            ls_unwrapped[i] += offset
        return ls_unwrapped

    @staticmethod
    def _natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

    @staticmethod
    def _get_nearest_ls_index(ls_array, target_ls, mars_year):
        """
        根据年份和 Ls 寻找索引。
        ls_array 是 [MY27_LS..., MY28_LS...] 的拼接。
        """
        # 1. 寻找年份分界线 (Ls 从大变小的地方)
        diffs = np.diff(ls_array)
        # 寻找 Ls 突然减小超过 180 度的点，即为跨年点
        split_indices = np.where(diffs < -180)[0]
        
        if len(split_indices) > 0:
            split_idx = split_indices[0] + 1
            if mars_year == 27:
                search_range = ls_array[:split_idx]
                offset = 0
            else:
                search_range = ls_array[split_idx:]
                offset = split_idx
        else:
            # 如果没有发现跨年，则全量搜索 (可能是数据不足)
            search_range = ls_array
            offset = 0
            
        return int(np.argmin(np.abs(search_range - target_ls))) + offset
