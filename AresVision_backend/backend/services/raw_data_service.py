import os
import glob
import re
import numpy as np
import netCDF4 as nc
import torch
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from scipy.interpolate import interp1d

def natural_sort_key(s):
    """自然排序，防止 10.nc 排在 2.nc 前面"""
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

def merge_sol_hour(x):
    """合并火星日和小时维度 (S, H, Y, X) -> (S*H, Y, X)"""
    S, H, Y, X = x.shape
    return x.reshape(S * H, Y, X)

def clean_invalid(x, name):
    """清理无效值 (NaN / Inf / 异常大值)"""
    x = np.array(x, dtype=np.float32)
    bad = ~np.isfinite(x) | (np.abs(x) > 1e10)
    if np.any(bad):
        print(f"⚠️ {name}: cleaned {bad.sum()} invalid values")
        x[bad] = np.nan
    return np.nan_to_num(x, nan=0.0)

def unwrap_ls(ls_array):
    """解包跨年的 Ls (0~360 变为单调递增)"""
    ls_unwrapped = np.copy(ls_array)
    year_offset = 0
    for i in range(1, len(ls_unwrapped)):
        if ls_array[i] < ls_array[i - 1] - 180:
            year_offset += 360
        ls_unwrapped[i] += year_offset
    return ls_unwrapped

def prepare_raw_data(base_path, output_dir, window=3, horizon=3, batch_size=16):
    """
    严格按照 demo3-UVPDST.py 逻辑处理数据并保存
    """
    # 更新数据源路径以匹配当前项目的 data 文件夹结构
    openmars_dir = os.path.join(base_path, "openmars")
    mcd_dir = os.path.join(base_path, "MCD")
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print("\n[Step 1] Loading OpenMars Data...")
    o3_list = []
    om_ls_list = []
    file_list = sorted(glob.glob(os.path.join(openmars_dir, "*.nc")), key=natural_sort_key)
    
    if not file_list:
        raise FileNotFoundError(f"❌ 未找到 OpenMars 文件: {openmars_dir}")

    for f in file_list:
        ds = nc.Dataset(f)
        o3_list.append(ds.variables['o3col'][:])
        ls_var = 'Ls' if 'Ls' in ds.variables else 'ls'
        om_ls_list.append(ds.variables[ls_var][:])
        ds.close()

    o3col = np.concatenate(o3_list, axis=0)
    om_ls_raw = np.concatenate(om_ls_list, axis=0)
    
    print("\n[Step 2] Loading MCD Data...")
    short_names = ['u', 'v', 'ps', 'temp', 'dustq', 'fluxsurf_dn_sw']
    mcd_data_list = {k: [] for k in short_names}
    mcd_ls_list = []
    target_files = [
        os.path.join(mcd_dir, "MCD_MY27_Lat-90-90_real.nc"),
        os.path.join(mcd_dir, "MCD_MY28_Lat-90-90_real.nc")
    ]

    for f_path in target_files:
        if not os.path.exists(f_path):
            print(f"⚠️ 跳过缺失文件: {f_path}")
            continue

        print(f"正在读取: {os.path.basename(f_path)}")
        ds = nc.Dataset(f_path)
        mcd_data_list['u'].append(merge_sol_hour(ds.variables['U_Wind'][:]))
        mcd_data_list['v'].append(merge_sol_hour(ds.variables['V_Wind'][:]))
        mcd_data_list['ps'].append(merge_sol_hour(ds.variables['Pressure'][:]))
        mcd_data_list['temp'].append(merge_sol_hour(ds.variables['Temperature'][:]))
        mcd_data_list['dustq'].append(merge_sol_hour(ds.variables['Dust_Optical_Depth'][:]))
        mcd_data_list['fluxsurf_dn_sw'].append(merge_sol_hour(ds.variables['Solar_Flux_DN'][:]))

        ls_var = 'Ls' if 'Ls' in ds.variables else 'ls'
        ls_tmp = ds.variables[ls_var][:]
        u_shape = ds.variables['U_Wind'].shape
        S_dim, H_dim = u_shape[0], u_shape[1]

        if ls_tmp.ndim == 1 and len(ls_tmp) == S_dim:
            ls_expanded = np.zeros(S_dim * H_dim)
            for i in range(S_dim):
                ls_start = ls_tmp[i]
                if i < S_dim - 1:
                    ls_end = ls_tmp[i + 1]
                    if ls_end < ls_start: ls_end += 360.0
                else:
                    ls_end = ls_start + (ls_tmp[1] - ls_tmp[0] if S_dim > 1 else 0.5)
                ls_expanded[i * H_dim: (i + 1) * H_dim] = np.linspace(ls_start, ls_end, H_dim, endpoint=False)
            ls_expanded = ls_expanded % 360.0
            mcd_ls_list.append(ls_expanded)
        else:
            mcd_ls_list.append(ls_tmp.flatten())
        ds.close()

    vars_dict = {k: np.concatenate(mcd_data_list[k], axis=0) for k in short_names}
    mcd_ls_raw = np.concatenate(mcd_ls_list, axis=0)

    # 清理数据
    y_raw = clean_invalid(o3col, "OpenMars O3")
    for k in vars_dict:
        vars_dict[k] = clean_invalid(vars_dict[k], k)

    # 物理预处理
    vars_dict['dustq'][vars_dict['dustq'] < 0] = 0.0
    vars_dict['dustq'] = np.log1p(vars_dict['dustq'])
    vars_dict['fluxsurf_dn_sw'] /= (np.max(vars_dict['fluxsurf_dn_sw']) + 1e-6)

    print("\n[Step 3] Time Alignment...")
    om_ls_continuous = unwrap_ls(om_ls_raw)
    mcd_ls_continuous = unwrap_ls(mcd_ls_raw)

    for k in vars_dict:
        interpolator = interp1d(mcd_ls_continuous, vars_dict[k], axis=0, kind='linear', 
                                bounds_error=False, fill_value="extrapolate")
        vars_dict[k] = interpolator(om_ls_continuous)

    # [O3_prev, u, v, ps, temp, dust, flux]
    # 按照训练脚本 demo3-UVPDST.py 的严格顺序排列
    # 这里的顺序决定了标准化器 (scalers) 的对应关系
    features = [y_raw] # 0: O3
    features.append(vars_dict['u'])             # 1: U
    features.append(vars_dict['v'])             # 2: V
    features.append(vars_dict['ps'])            # 3: P
    features.append(vars_dict['temp'])          # 4: T
    features.append(vars_dict['dustq'])         # 5: D
    features.append(vars_dict['fluxsurf_dn_sw']) # 6: S
    
    X_raw = np.stack(features, axis=-1)
    
    T, H, W, C = X_raw.shape
    print(f"数据矩阵形状: {X_raw.shape}")

    # 标准化
    X_scaled = np.zeros_like(X_raw)
    scalers = []
    for c in range(C):
        scaler = StandardScaler()
        X_scaled[..., c] = scaler.fit_transform(X_raw[..., c].reshape(T, -1)).reshape(T, H, W)
        scalers.append(scaler)

    y_mean, y_std = y_raw.mean(), y_raw.std()
    y_scaled = (y_raw - y_mean) / y_std

    # 滑窗序列
    X_seq, y_seq = [], []
    for i in range(T - window - horizon + 1):
        X_seq.append(X_scaled[i: i + window])
        y_seq.append(y_scaled[i + window: i + window + horizon])

    X_torch = torch.tensor(np.array(X_seq)).permute(0, 1, 4, 2, 3).float()
    y_torch = torch.tensor(np.array(y_seq)).unsqueeze(2).float()

    output_path = os.path.join(output_dir, "processed_tensors.pt")
    torch.save({
        'X_torch': X_torch,
        'y_torch': y_torch,
        'y_mean': y_mean,
        'y_std': y_std,
        'om_ls_raw': om_ls_raw,
        'scalers': scalers,  # 保存各通道的标准化器
        'meta': {
            'window': window, 
            'horizon': horizon, 
            'channels': 7,
            'total_time_steps': T
        }
    }, output_path)

    print(f"✅ 处理完成！张量已保存至: {output_path}")
    print(f"X_torch shape: {X_torch.shape}")
    print(f"y_torch shape: {y_torch.shape}")

if __name__ == "__main__":
    # 获取当前脚本所在目录的绝对路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # 计算数据文件夹的相对路径 (从 services 向上跳两级到 backend，再进入 data)
    # 或者根据你的实际结构调整：d:\pycharm\AresVision\AresVision_backend\backend\services -> backend\data
    BASE_PATH = os.path.abspath(os.path.join(current_dir, "..", "data"))
    OUTPUT_PATH = BASE_PATH
    
    print(f"数据目录定位至: {BASE_PATH}")
    prepare_raw_data(BASE_PATH, OUTPUT_PATH)
