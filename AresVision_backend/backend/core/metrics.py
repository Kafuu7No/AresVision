"""
评估指标工具
专门用于计算 RMSE, MAE, R2, SSIM
"""
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from skimage.metrics import structural_similarity as ssim


def compute_metrics(truth: np.ndarray, pred: np.ndarray) -> dict:
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
            per_step.append(zero_metrics(step + 1))
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
        "rmse": round(float(np.mean([s["rmse"] for s in per_step])), 6),
        "mae": round(float(np.mean([s["mae"] for s in per_step])), 6),
        "ssim": round(float(np.mean([s["ssim"] for s in per_step])), 4),
        "r2": round(float(np.mean([s["r2"] for s in per_step])), 4),
    }

    return {"overall": overall, "per_step": per_step}


def zero_metrics(step: int) -> dict:
    return {"step": step, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0}


def empty_metrics(horizon: int) -> dict:
    per_step = [
        {"step": i + 1, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0}
        for i in range(horizon)
    ]
    return {
        "overall": {"step": 0, "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0},
        "per_step": per_step,
    }
