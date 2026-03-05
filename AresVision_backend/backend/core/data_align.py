"""
时空对齐工具
- unwrap_ls: 处理 Ls 从 360° 回绕到 0° 的不连续问题
- interpolate_mcd_to_openmars: 将 MCD 数据插值到 OpenMARS 的 Ls 格点
"""

import numpy as np
from scipy.interpolate import interp1d


def unwrap_ls(ls_array: np.ndarray) -> np.ndarray:
    """
    将 Ls 数组展开为单调递增序列。
    火星太阳黄经 Ls 在 360° 时回绕到 0°，导致不连续。
    本函数检测跳变并加 360° 偏移使其单调。

    Args:
        ls_array: 原始 Ls 数组，可能有 360→0 跳变

    Returns:
        单调递增的 Ls 数组
    """
    ls = ls_array.copy().astype(np.float64)
    offset = 0.0
    for i in range(1, len(ls)):
        if ls[i] - ls[i - 1] < -180:  # 检测大幅回跳
            offset += 360.0
        ls[i] += offset
    return ls


def interpolate_mcd_to_openmars(
    mcd_data: np.ndarray,
    mcd_ls: np.ndarray,
    target_ls: np.ndarray,
) -> np.ndarray:
    """
    将 MCD 数据从其原生 Ls 时间格点插值到 OpenMARS 的 Ls 格点。

    Args:
        mcd_data:  MCD 变量数据，shape = (n_mcd_times, lat, lon)
        mcd_ls:    MCD 对应的 Ls 数组，shape = (n_mcd_times,)
        target_ls: 目标 Ls 数组（OpenMARS 的时间格点），shape = (n_target,)

    Returns:
        插值后的数据，shape = (n_target, lat, lon)
    """
    n_lat, n_lon = mcd_data.shape[1], mcd_data.shape[2]

    # 展开 Ls 使其单调
    mcd_ls_unwrapped = unwrap_ls(mcd_ls)
    target_ls_unwrapped = unwrap_ls(target_ls)

    # 确保目标范围在源范围内
    valid_mask = (
        (target_ls_unwrapped >= mcd_ls_unwrapped[0]) &
        (target_ls_unwrapped <= mcd_ls_unwrapped[-1])
    )
    target_valid = target_ls_unwrapped[valid_mask]

    result = np.full((len(target_ls), n_lat, n_lon), np.nan)

    # 逐网格点插值（利用向量化加速）
    for i in range(n_lat):
        for j in range(n_lon):
            series = mcd_data[:, i, j]
            # 跳过全 NaN 的网格点
            if np.all(np.isnan(series)):
                continue
            # 用线性插值
            f = interp1d(
                mcd_ls_unwrapped, series,
                kind="linear", bounds_error=False, fill_value=np.nan,
            )
            result[valid_mask, i, j] = f(target_valid)

    return result


def expand_sol_hour_to_timeline(
    sol_array: np.ndarray,
    n_hours: int = 8,
) -> tuple[np.ndarray, np.ndarray]:
    """
    将 MCD 的 sol 维度展开为 sol×hour 的连续时间索引。

    Args:
        sol_array: sol 数组, shape = (n_sol,)
        n_hours:   每 sol 的小时采样数（默认 8）

    Returns:
        (expanded_sol, expanded_hour) 两个一维数组
    """
    n_sol = len(sol_array)
    hours = np.linspace(0, 24, n_hours, endpoint=False)

    expanded_sol = np.repeat(sol_array, n_hours)
    expanded_hour = np.tile(hours, n_sol)

    return expanded_sol, expanded_hour
