from __future__ import annotations

import os
import json
import torch
import numpy as np
import glob
import re
import netCDF4 as nc
from pathlib import Path

from database.models import ModelTrainingTask
from database.engine import async_session_maker
from services.training_channels import extract_architecture_params, get_task_channel_suffix
from training_backbones.model_zoo import (
    build_forecaster,
    normalize_model_architecture,
    normalize_use_sphere,
)


class InferenceService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.base_dir = Path(__file__).parent.parent
        self.openmars_dir = self.base_dir / "data" / "openmars"
        self.mcd_dir = self.base_dir / "data" / "MCD"

    async def get_test_results(self, task_id: int, data_dirs: dict[str, str] | None = None):
        """获取训练任务的测试结果（散点图数据）"""
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            if not task or not task.output_model_path or not os.path.exists(task.output_model_path):
                raise ValueError("Model file not found")

            # 1. 解析任务参数
            hypers = json.loads(task.hyperparameters)
            window = hypers.get("window", 3)
            horizon = hypers.get("horizon", 3)
            hidden_dims = hypers.get("stlstm_hidden_dims", [64, 64, 64])
            model_architecture = normalize_model_architecture(hypers.get("model_architecture", "predrnnv2"))
            use_sphere = normalize_use_sphere(hypers)
            architecture_params = extract_architecture_params(hypers)
            
            # 2. 识别使用的变量
            active_vars = get_task_channel_suffix(task)
            # UDST -> ['U_Wind', 'Dust_Optical_Depth', 'Solar_Flux_DN', 'Temperature']
            mcd_vars_map = {
                'U': ('U_Wind', 'u'), 
                'V': ('V_Wind', 'v'), 
                'D': ('Dust_Optical_Depth', 'dustq'), 
                'S': ('Solar_Flux_DN', 'fluxsurf_dn_sw'), 
                'T': ('Temperature', 'temp')
            }
            used_mcd_vars = [mcd_vars_map[c] for c in active_vars if c in mcd_vars_map]
            base_input_dim = 1 + len(used_mcd_vars)

            # 3. 加载并预处理数据 (简化版，复用脚本逻辑)
            X_torch, y_torch, ls_torch, y_mean, y_std = self._prepare_data(
                used_mcd_vars,
                window,
                horizon,
                data_dirs=data_dirs,
            )
            
            # 4. 加载模型
            model = build_forecaster(
                architecture=model_architecture,
                input_channels=base_input_dim,
                selected_channels=list(active_vars),
                hidden_dims=hidden_dims,
                height=36,
                width=72,
                window=window,
                horizon=horizon,
                use_sphere=use_sphere,
                architecture_params=architecture_params,
            ).to(self.device)
            state_dict = torch.load(task.output_model_path, map_location=self.device, weights_only=True)
            model.load_state_dict(state_dict)
            model.eval()

            # 5. 执行推理 (仅针对测试集)
            split = int(0.8 * len(X_torch))
            X_test = X_torch[split:]
            y_test_true = y_torch[split:]
            
            with torch.no_grad():
                # 为了性能，限制测试点数
                sample_size = min(len(X_test), 50) 
                indices = np.linspace(0, len(X_test)-1, sample_size, dtype=int)
                
                test_xb = X_test[indices].to(self.device)
                test_yb = y_test_true[indices]
                test_lsb = ls_torch[split:][indices].to(self.device)
                
                preds = model(test_xb, test_lsb).cpu().numpy()
                trues = test_yb.numpy()

            # 6. 反标准化还原物理值
            y_pred_raw = preds * (y_std + 1e-6) + y_mean
            y_true_raw = trues * (y_std + 1e-6) + y_mean
            
            # 展平数据并进行子采样，防止前端渲染海量点位时卡顿（建议上限 50k 点）
            y_true_flat = y_true_raw.flatten()
            y_pred_flat = y_pred_raw.flatten()
            
            if len(y_true_flat) > 50000:
                step = len(y_true_flat) // 50000
                y_true_flat = y_true_flat[::step]
                y_pred_flat = y_pred_flat[::step]
            
            return {
                "y_true": y_true_flat.tolist(),
                "y_pred": y_pred_flat.tolist(),
                "metrics": json.loads(task.metrics) if task.metrics else {}
            }

    def _prepare_data(self, used_mcd_vars, window, horizon, data_dirs: dict[str, str] | None = None):
        """复用训练脚本中的数据加载逻辑"""
        from scipy.interpolate import interp1d
        from sklearn.preprocessing import StandardScaler

        # --- Loading OpenMars ---
        openmars_dir = Path((data_dirs or {}).get("ARESVISION_OPENMARS_DIR") or self.openmars_dir)
        mcd_dir = Path((data_dirs or {}).get("ARESVISION_MCD_DIR") or self.mcd_dir)
        o3_list, om_ls_list = [], []
        def natural_sort_key(s): return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', str(s))]
        file_list = sorted(glob.glob(str(openmars_dir / "*.nc")), key=natural_sort_key)
        for f in file_list:
            ds = nc.Dataset(f)
            o3_list.append(ds.variables['o3col'][:])
            om_ls_list.append(ds.variables['Ls'][:] if 'Ls' in ds.variables else ds.variables['ls'][:])
            ds.close()
        y_raw = np.concatenate(o3_list, axis=0)
        om_ls_raw = np.concatenate(om_ls_list, axis=0)

        # --- Loading MCD ---
        if used_mcd_vars:
            short_names = [v[1] for v in used_mcd_vars]
            vars_dict = {}
            mcd_data = {sn: [] for sn in short_names}
            mcd_ls = []
            for f_nc in sorted(mcd_dir.glob("*.nc"), key=natural_sort_key):
                if not f_nc.exists(): continue
                ds = nc.Dataset(f_nc, 'r')
                for var_name, sn in used_mcd_vars:
                    d = ds.variables[var_name][:]
                    mcd_data[sn].append(d.reshape(d.shape[0]*d.shape[1], d.shape[2], d.shape[3]))
                ls_t = ds.variables['Ls'][:] if 'Ls' in ds.variables else ds.variables['ls'][:]
                s_d, h_d = ds.variables[used_mcd_vars[0][0]].shape[:2]
                ls_e = np.zeros(s_d * h_d)
                for i in range(s_d):
                    ls_e[i*h_d:(i+1)*h_d] = np.linspace(ls_t[i], ls_t[i+1] if i < s_d-1 else ls_t[i]+0.5, h_d, endpoint=False)
                mcd_ls.append(ls_e % 360.0)
                ds.close()
            
            def unwrap(ls_in):
                out = np.copy(ls_in); off = 0
                for j in range(1, len(out)):
                    if ls_in[j] < ls_in[j-1]-180: off += 360
                    out[j] += off
                return out
            
            mcd_ls_c = unwrap(np.concatenate(mcd_ls))
            om_ls_c = unwrap(om_ls_raw)
            for sn in short_names:
                combined = np.concatenate(mcd_data[sn], axis=0)
                vars_dict[sn] = interp1d(mcd_ls_c, combined, axis=0, bounds_error=False, fill_value="extrapolate")(om_ls_c)
        else:
            short_names = []
            vars_dict = {}

        # --- Assembly ---
        feat_list = [y_raw] + [vars_dict[sn] for sn in short_names]
        X_raw = np.stack(feat_list, axis=-1)
        T = X_raw.shape[0]
        
        split_idx = int(0.8 * (T - window - horizon + 1)) + window
        X_scaled = np.zeros_like(X_raw)
        for c in range(X_raw.shape[-1]):
            scaler = StandardScaler()
            scaler.fit(X_raw[:split_idx, ..., c].reshape(split_idx, -1))
            X_scaled[..., c] = scaler.transform(X_raw[..., c].reshape(T, -1)).reshape(T, 36, 72)
        
        y_train_part = y_raw[:split_idx]
        y_mean, y_std = y_train_part.mean(), y_train_part.std()
        y_scaled = (y_raw - y_mean) / (y_std + 1e-6)

        X_seq, y_seq, ls_seq = [], [], []
        for i in range(T - window - horizon + 1):
            X_seq.append(X_scaled[i: i + window])
            y_seq.append(y_scaled[i + window: i + window + horizon])
            ls_seq.append(om_ls_raw[i: i + window])
        
        X_torch = torch.tensor(np.array(X_seq)).permute(0, 1, 4, 2, 3).float()
        y_torch = torch.tensor(np.array(y_seq)).unsqueeze(2).float()
        ls_torch = torch.tensor(np.array(ls_seq)).float()
        
        return X_torch, y_torch, ls_torch, y_mean, y_std
