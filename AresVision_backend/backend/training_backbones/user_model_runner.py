from __future__ import annotations

import argparse
import importlib.machinery
import importlib.util
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

import netCDF4
import numpy as np
import sklearn.metrics as sk_metrics
import torch
import torch.nn as nn
from scipy.interpolate import interp1d
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

CHANNEL_ORDER = ["U", "V", "D", "S", "T"]
MCD_VARS_MAP = {
    "U": ("U_Wind", "u"),
    "V": ("V_Wind", "v"),
    "D": ("Dust_Optical_Depth", "dustq"),
    "S": ("Solar_Flux_DN", "fluxsurf_dn_sw"),
    "T": ("Temperature", "temp"),
}


def parse_json_arg(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if not isinstance(value, str):
        return {}

    stripped = value.strip()
    if not stripped:
        return {}

    try:
        parsed = json.loads(stripped)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_selected_channels(value: Any) -> list[str]:
    if value is None:
        raw_items: list[Any] = []
    elif isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
            except Exception:
                parsed = stripped
            raw_items = parsed if isinstance(parsed, list) else stripped.replace("+", ",").split(",")
        else:
            raw_items = stripped.replace("+", ",").split(",")
    elif isinstance(value, (list, tuple, set)):
        raw_items = list(value)
    else:
        raw_items = []

    selected = {str(item).strip().upper() for item in raw_items if str(item).strip()}
    return [channel for channel in CHANNEL_ORDER if channel in selected]


def build_uploaded_model_config(
    in_channels: int,
    window: int,
    horizon: int,
    height: int,
    width: int,
    selected_channels: Any,
    custom_model_params: Any,
    param_schema: Any,
) -> dict[str, Any]:
    selected = parse_selected_channels(selected_channels)
    custom_params = parse_json_arg(custom_model_params)
    schema = parse_json_arg(param_schema)

    config: dict[str, Any] = {
        "in_channels": int(in_channels),
        "window": int(window),
        "horizon": int(horizon),
        "height": int(height),
        "width": int(width),
        "selected_channels": selected,
    }
    for key, param in schema.items():
        if not isinstance(param, dict):
            continue
        config[key] = custom_params.get(key, param.get("default"))
    return config


def load_uploaded_model(model_path: Path, config: dict[str, Any]) -> nn.Module:
    path = Path(model_path)
    module_name = f"aresvision_uploaded_runner_{uuid.uuid4().hex}"
    loader = importlib.machinery.SourceFileLoader(module_name, str(path))
    spec = importlib.util.spec_from_loader(module_name, loader)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load uploaded model from {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
        build_model = getattr(module, "build_model", None)
        if not callable(build_model):
            raise TypeError("Uploaded model must export build_model(config)")
        model = build_model(config)
    finally:
        sys.modules.pop(module_name, None)

    if not isinstance(model, nn.Module):
        raise TypeError("build_model(config) must return torch.nn.Module")
    return model


def assert_prediction_shape(prediction: Any, target: Any, context: str) -> None:
    actual_shape = tuple(getattr(prediction, "shape", ()))
    expected_shape = tuple(getattr(target, "shape", ()))
    if actual_shape != expected_shape:
        raise ValueError(
            f"{context} prediction shape mismatch: "
            f"expected shape {expected_shape}, actual shape {actual_shape}"
        )


def natural_sort_key(value: Any) -> list[Any]:
    import re

    return [
        int(text) if text.isdigit() else text.lower()
        for text in re.split(r"([0-9]+)", str(value))
    ]


def unwrap_ls(ls_in: Any) -> np.ndarray:
    values = np.asarray(ls_in, dtype=np.float32).reshape(-1)
    out = values.copy()
    offset = 0.0
    for idx in range(1, len(out)):
        if values[idx] < values[idx - 1] - 180.0:
            offset += 360.0
        out[idx] += offset
    return out


def _clean_array(value: Any) -> np.ndarray:
    array = np.asanyarray(value)
    if np.ma.isMaskedArray(array):
        array = array.filled(np.nan)
    return np.nan_to_num(np.asarray(array, dtype=np.float32), nan=0.0, posinf=0.0, neginf=0.0)


def _read_ls_variable(dataset: Any, file_path: Path) -> np.ndarray:
    if "Ls" in dataset.variables:
        return _clean_array(dataset.variables["Ls"][:]).reshape(-1)
    if "ls" in dataset.variables:
        return _clean_array(dataset.variables["ls"][:]).reshape(-1)
    raise ValueError(f"Missing Ls variable in {file_path}")


def _merge_sol_hour(data: Any) -> np.ndarray:
    array = _clean_array(data)
    if array.ndim == 4:
        return array.reshape(array.shape[0] * array.shape[1], array.shape[2], array.shape[3])
    if array.ndim == 3:
        return array
    raise ValueError(f"Expected MCD variable to be 3D or 4D, got shape {array.shape}")


def _expand_mcd_ls(dataset: Any, file_path: Path, sample_var_name: str) -> np.ndarray:
    ls_values = _read_ls_variable(dataset, file_path)
    sample_shape = dataset.variables[sample_var_name].shape
    if len(sample_shape) >= 4:
        sol_count, hour_count = int(sample_shape[0]), int(sample_shape[1])
        target_count = sol_count * hour_count
        if len(ls_values) == target_count:
            return ls_values
        if len(ls_values) < sol_count:
            raise ValueError(f"Not enough Ls values in {file_path}")

        expanded = np.zeros(target_count, dtype=np.float32)
        for idx in range(sol_count):
            ls_start = float(ls_values[idx])
            if idx < sol_count - 1:
                ls_end = float(ls_values[idx + 1])
                if ls_end < ls_start:
                    ls_end += 360.0
            else:
                step = float(ls_values[1] - ls_values[0]) if sol_count > 1 else 0.5
                if step <= 0:
                    step += 360.0
                ls_end = ls_start + step
            expanded[idx * hour_count : (idx + 1) * hour_count] = np.linspace(
                ls_start,
                ls_end,
                hour_count,
                endpoint=False,
            )
        return expanded % 360.0

    target_count = int(sample_shape[0])
    if len(ls_values) < target_count:
        raise ValueError(f"Not enough Ls values in {file_path}")
    return ls_values[:target_count]


def _load_openmars(openmars_dir: Path) -> tuple[np.ndarray, np.ndarray]:
    o3_list: list[np.ndarray] = []
    ls_list: list[np.ndarray] = []
    for file_path in sorted(Path(openmars_dir).glob("*.nc"), key=natural_sort_key):
        with netCDF4.Dataset(str(file_path)) as dataset:
            if "o3col" not in dataset.variables:
                continue
            o3 = _clean_array(dataset.variables["o3col"][:])
            if o3.ndim == 4:
                o3 = np.nanmean(o3, axis=1)
            if o3.ndim != 3:
                raise ValueError(f"Invalid OpenMars o3col shape in {file_path}: {o3.shape}")
            o3_list.append(o3)
            ls_list.append(_read_ls_variable(dataset, file_path))

    if not o3_list:
        raise FileNotFoundError(f"No OpenMars .nc files found in {openmars_dir}")

    y_raw = _clean_array(np.concatenate(o3_list, axis=0))
    ls_raw = _clean_array(np.concatenate(ls_list, axis=0)).reshape(-1)
    time_count = min(int(y_raw.shape[0]), int(ls_raw.shape[0]))
    if time_count <= 0:
        raise ValueError("OpenMars timeline is empty")
    return y_raw[:time_count], ls_raw[:time_count]


def _load_mcd_features(
    mcd_dir: Path,
    selected_channels: list[str],
    om_ls_raw: np.ndarray,
) -> dict[str, np.ndarray]:
    if not selected_channels:
        return {}

    mcd_data = {MCD_VARS_MAP[channel][1]: [] for channel in selected_channels}
    mcd_ls: list[np.ndarray] = []
    first_var = MCD_VARS_MAP[selected_channels[0]][0]

    for file_path in sorted(Path(mcd_dir).glob("*.nc"), key=natural_sort_key):
        with netCDF4.Dataset(str(file_path)) as dataset:
            if first_var not in dataset.variables:
                continue
            missing = [
                MCD_VARS_MAP[channel][0]
                for channel in selected_channels
                if MCD_VARS_MAP[channel][0] not in dataset.variables
            ]
            if missing:
                raise ValueError(f"MCD file {file_path} is missing variables: {missing}")
            for channel in selected_channels:
                var_name, short_name = MCD_VARS_MAP[channel]
                mcd_data[short_name].append(_merge_sol_hour(dataset.variables[var_name][:]))
            mcd_ls.append(_expand_mcd_ls(dataset, file_path, first_var))

    if not mcd_ls:
        raise ValueError(f"No usable MCD files found for channels {selected_channels}")

    mcd_ls_continuous = unwrap_ls(np.concatenate(mcd_ls, axis=0))
    om_ls_continuous = unwrap_ls(om_ls_raw)
    sort_idx = np.argsort(mcd_ls_continuous)
    mcd_ls_continuous = mcd_ls_continuous[sort_idx]

    vars_dict: dict[str, np.ndarray] = {}
    for channel in selected_channels:
        short_name = MCD_VARS_MAP[channel][1]
        combined = _clean_array(np.concatenate(mcd_data[short_name], axis=0))[sort_idx]
        vars_dict[short_name] = _clean_array(
            interp1d(
                mcd_ls_continuous,
                combined,
                axis=0,
                bounds_error=False,
                fill_value="extrapolate",
            )(om_ls_continuous)
        )
    return vars_dict


def prepare_tensors(
    openmars_dir: Any,
    mcd_dir: Any,
    selected_channels: Any,
    window: int,
    horizon: int,
) -> tuple[torch.Tensor, torch.Tensor, float, float, int, int]:
    selected = parse_selected_channels(selected_channels)
    window = int(window)
    horizon = int(horizon)
    if window <= 0 or horizon <= 0:
        raise ValueError("window and horizon must be positive")

    y_raw, om_ls_raw = _load_openmars(Path(openmars_dir))
    vars_dict = _load_mcd_features(Path(mcd_dir), selected, om_ls_raw)
    feature_names = [MCD_VARS_MAP[channel][1] for channel in selected]
    features = [y_raw] + [vars_dict[name] for name in feature_names]

    min_time = min(int(feature.shape[0]) for feature in features)
    min_height = min(int(feature.shape[1]) for feature in features)
    min_width = min(int(feature.shape[2]) for feature in features)
    if min_time <= 0 or min_height <= 0 or min_width <= 0:
        raise ValueError("Loaded data has invalid dimensions")

    features = [
        _clean_array(feature[:min_time, :min_height, :min_width])
        for feature in features
    ]
    y_raw = features[0]
    x_raw = np.stack(features, axis=-1)
    total_time, height, width, channel_count = x_raw.shape
    sample_count = total_time - window - horizon + 1
    if sample_count <= 0:
        raise ValueError(
            "Not enough time steps for requested window and horizon: "
            f"time={total_time}, window={window}, horizon={horizon}"
        )

    split_idx = int(0.8 * sample_count) + window
    split_idx = max(1, min(total_time, split_idx))
    x_scaled = np.zeros_like(x_raw, dtype=np.float32)
    for channel_idx in range(channel_count):
        scaler = StandardScaler()
        scaler.fit(x_raw[:split_idx, ..., channel_idx].reshape(split_idx, -1))
        x_scaled[..., channel_idx] = scaler.transform(
            x_raw[..., channel_idx].reshape(total_time, -1)
        ).reshape(total_time, height, width)

    y_train_part = y_raw[:split_idx]
    y_mean = float(y_train_part.mean())
    y_std = float(y_train_part.std())
    y_scaled = (y_raw - y_mean) / (y_std + 1e-6)

    x_seq: list[np.ndarray] = []
    y_seq: list[np.ndarray] = []
    for idx in range(sample_count):
        x_seq.append(x_scaled[idx : idx + window])
        y_seq.append(y_scaled[idx + window : idx + window + horizon])

    x_torch = torch.tensor(np.array(x_seq)).permute(0, 1, 4, 2, 3).float()
    y_torch = torch.tensor(np.array(y_seq)).unsqueeze(2).float()
    return x_torch, y_torch, y_mean, y_std, height, width


def _split_train_test(
    x_torch: torch.Tensor,
    y_torch: torch.Tensor,
) -> tuple[TensorDataset, TensorDataset]:
    if len(x_torch) < 2:
        raise ValueError("At least two training samples are required")
    split = int(0.8 * len(x_torch))
    split = min(max(1, split), len(x_torch) - 1)
    return (
        TensorDataset(x_torch[:split], y_torch[:split]),
        TensorDataset(x_torch[split:], y_torch[split:]),
    )


def _evaluate_metrics(
    y_true_scaled: np.ndarray,
    y_pred_scaled: np.ndarray,
    y_mean: float,
    y_std: float,
) -> dict[str, float]:
    y_true = y_true_scaled.flatten() * (y_std + 1e-6) + y_mean
    y_pred = y_pred_scaled.flatten() * (y_std + 1e-6) + y_mean
    mse = float(sk_metrics.mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    try:
        r2 = float(sk_metrics.r2_score(y_true, y_pred))
    except Exception:
        r2 = 0.0
    mape = float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100.0)
    smape = float(
        np.mean(
            2.0
            * np.abs(y_pred - y_true)
            / (np.abs(y_true) + np.abs(y_pred) + 1e-8)
        )
        * 100.0
    )
    return {"mse": mse, "rmse": rmse, "r2": r2, "mape": mape, "smape": smape}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--learning_rate", type=float, default=0.001)
    parser.add_argument("--window", type=int, default=3)
    parser.add_argument("--horizon", type=int, default=3)
    parser.add_argument("--early_stopping_patience", type=int, default=0)
    parser.add_argument("--selected_channels", type=str, default="")
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--output_path", type=str, required=True)
    parser.add_argument("--uploaded_model_path", type=str, required=True)
    parser.add_argument("--uploaded_model_param_schema", type=str, default="{}")
    parser.add_argument("--custom_model_params", type=str, default="{}")
    args, _unknown = parser.parse_known_args()

    epochs = max(1, int(args.epochs))
    batch_size = max(1, int(args.batch_size))
    patience = max(0, int(args.early_stopping_patience))
    seed = max(0, int(args.seed))
    torch.manual_seed(seed)
    np.random.seed(seed)

    selected_channels = parse_selected_channels(args.selected_channels)
    openmars_dir = Path(os.environ.get("ARESVISION_OPENMARS_DIR", str(BACKEND_DIR / "data" / "openmars")))
    mcd_dir = Path(os.environ.get("ARESVISION_MCD_DIR", str(BACKEND_DIR / "data" / "MCD")))
    x_torch, y_torch, y_mean, y_std, height, width = prepare_tensors(
        openmars_dir,
        mcd_dir,
        selected_channels,
        args.window,
        args.horizon,
    )

    train_dataset, test_dataset = _split_train_test(x_torch, y_torch)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    param_schema = parse_json_arg(args.uploaded_model_param_schema)
    custom_params = parse_json_arg(args.custom_model_params)
    config = build_uploaded_model_config(
        in_channels=int(x_torch.shape[2]),
        window=args.window,
        horizon=args.horizon,
        height=height,
        width=width,
        selected_channels=selected_channels,
        custom_model_params=custom_params,
        param_schema=param_schema,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_uploaded_model(Path(args.uploaded_model_path), config).to(device)
    criterion = nn.SmoothL1Loss()
    trainable_params = [param for param in model.parameters() if param.requires_grad]
    optimizer = torch.optim.Adam(trainable_params, lr=float(args.learning_rate)) if trainable_params else None

    print(f"Training Device: {device}", flush=True)
    print(f"UploadedModel={args.uploaded_model_path}, Config={config}", flush=True)
    print("\n[Step 3] Start Training...", flush=True)

    best_val_loss = float("inf")
    patience_counter = 0
    for epoch in range(1, epochs + 1):
        model.train()
        loss_sum = 0.0
        for batch_idx, (xb, yb) in enumerate(train_loader, start=1):
            xb = xb.to(device)
            yb = yb.to(device)
            if optimizer is not None:
                optimizer.zero_grad()
            pred = model(xb)
            assert_prediction_shape(pred, yb, f"training epoch {epoch} batch {batch_idx}")
            loss = criterion(pred, yb)
            if optimizer is not None:
                loss.backward()
                optimizer.step()
            loss_sum += float(loss.item())
            if batch_idx % 20 == 0 or batch_idx == len(train_loader):
                print(
                    f"Epoch {epoch}/{epochs} Batch {batch_idx}/{len(train_loader)} "
                    f"Loss={loss.item():.4f}",
                    flush=True,
                )

        model.eval()
        val_loss_sum = 0.0
        with torch.no_grad():
            for xb, yb in test_loader:
                yb_device = yb.to(device)
                pred = model(xb.to(device))
                assert_prediction_shape(pred, yb_device, f"validation epoch {epoch}")
                val_loss_sum += float(criterion(pred, yb_device).item())
        train_loss = loss_sum / max(1, len(train_loader))
        val_loss = val_loss_sum / max(1, len(test_loader))
        print(f"Epoch {epoch}/{epochs} Loss={train_loss:.4f} Val Loss={val_loss:.4f}", flush=True)

        if patience > 0:
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(
                        "[Early Stopping] Val loss did not improve for "
                        f"{patience} epochs. Stopped at epoch {epoch}.",
                        flush=True,
                    )
                    break

    model.eval()
    true_batches: list[np.ndarray] = []
    pred_batches: list[np.ndarray] = []
    with torch.no_grad():
        for batch_idx, (xb, yb) in enumerate(test_loader, start=1):
            pred = model(xb.to(device))
            assert_prediction_shape(pred, yb.to(device), f"metrics batch {batch_idx}")
            pred_batches.append(pred.cpu().numpy())
            true_batches.append(yb.numpy())
    if not true_batches:
        raise ValueError("No test batches available for metrics")

    metrics = _evaluate_metrics(
        np.concatenate(true_batches, axis=0),
        np.concatenate(pred_batches, axis=0),
        y_mean,
        y_std,
    )
    print("\nMetrics:", flush=True)
    print(f"MSE: {metrics['mse']:.4f}", flush=True)
    print(f"RMSE: {metrics['rmse']:.4f}", flush=True)
    print(f"R-Squared: {metrics['r2']:.4f}", flush=True)
    print(f"MAPE: {metrics['mape']:.4f}%", flush=True)
    print(f"SMAPE: {metrics['smape']:.4f}%", flush=True)

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), output_path)
    print(f"Model saved: {output_path}", flush=True)


if __name__ == "__main__":
    main()
