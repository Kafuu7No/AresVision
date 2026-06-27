"""Sanitized backbone definitions imported from the ablation experiment folder.
Generated for AresVision training; top-level experiment runners are intentionally omitted.
"""
import os
import sys
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from .convlstm_mst_phasewarp_compare import ConvLSTMMSTForecaster
from .rnn_cnn_rnn_phasewarp_compare import EarlyStopping, Logger, load_aligned_cube
from .seed_utils import set_experiment_seed

def build_residual_grid_dataloaders(x_raw, y_raw, ls_raw, window, horizon, batch_size):
    """
    Build samples with both historical and future Ls.

    Returns:
    - train_loader/test_loader batches: (x_hist, ls_hist, ls_future, y_future_scaled)
    - y_mean/y_std from the training time range
    - split_sample_idx for constructing a train-only climatology table
    """
    (time_steps, lat_size, lon_size, channels) = x_raw.shape
    split_time_idx = int(0.8 * time_steps)
    x_train_raw = x_raw[:split_time_idx]
    y_train_raw = y_raw[:split_time_idx]
    x_scaled = np.zeros_like(x_raw, dtype=np.float32)
    for channel_idx in range(channels):
        train_flat = x_train_raw[..., channel_idx].reshape(split_time_idx, -1)
        all_flat = x_raw[..., channel_idx].reshape(time_steps, -1)
        mean = train_flat.mean(axis=0, keepdims=True)
        std = train_flat.std(axis=0, keepdims=True)
        std = np.where(std <= 1e-06, 1.0, std)
        x_scaled[..., channel_idx] = ((all_flat - mean) / std).reshape(time_steps, lat_size, lon_size)
    y_mean = float(y_train_raw.mean())
    y_std = float(y_train_raw.std())
    if y_std <= 0:
        raise ValueError('y_std must be positive.')
    y_scaled = (y_raw - y_mean) / y_std
    x_seq = []
    y_seq = []
    ls_hist_seq = []
    ls_future_seq = []
    for idx in range(time_steps - window - horizon + 1):
        x_seq.append(x_scaled[idx:idx + window])
        y_seq.append(y_scaled[idx + window:idx + window + horizon])
        ls_hist_seq.append(ls_raw[idx:idx + window])
        ls_future_seq.append(ls_raw[idx + window:idx + window + horizon])
    x_torch = torch.tensor(np.array(x_seq)).permute(0, 1, 4, 2, 3).float()
    y_torch = torch.tensor(np.array(y_seq)).float()
    ls_hist_torch = torch.tensor(np.array(ls_hist_seq)).float()
    ls_future_torch = torch.tensor(np.array(ls_future_seq)).float()
    split_sample_idx = max(0, min(split_time_idx - window - horizon + 1, len(x_torch)))
    train_dataset = TensorDataset(x_torch[:split_sample_idx], ls_hist_torch[:split_sample_idx], ls_future_torch[:split_sample_idx], y_torch[:split_sample_idx])
    test_dataset = TensorDataset(x_torch[split_sample_idx:], ls_hist_torch[split_sample_idx:], ls_future_torch[split_sample_idx:], y_torch[split_sample_idx:])
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    return (train_loader, test_loader, y_mean, y_std, split_sample_idx)

class SeasonalClimatologyTable(nn.Module):
    """Train-only Ls-bin climatology lookup table in standardized target units."""

    def __init__(self, table, bin_size, y_mean, y_std):
        super().__init__()
        if table.dim() != 3:
            raise ValueError(f'Expected table shape [num_bins, H, W], got {tuple(table.shape)}')
        self.register_buffer('table', table.float())
        self.bin_size = float(bin_size)
        self.y_mean = float(y_mean)
        self.y_std = float(y_std)

    @classmethod
    def from_training_series(cls, y_raw, ls_raw, train_time_steps, bin_size, y_mean, y_std):
        if train_time_steps <= 0:
            raise ValueError('train_time_steps must be positive.')
        y_train = np.asarray(y_raw[:train_time_steps], dtype=np.float32)
        ls_train = np.asarray(ls_raw[:train_time_steps], dtype=np.float32)
        if y_train.shape[0] != ls_train.shape[0]:
            raise ValueError('y_raw and ls_raw must share the time dimension.')
        num_bins = int(np.ceil(360.0 / float(bin_size)))
        bin_indices = np.floor(ls_train % 360.0 / float(bin_size)).astype(np.int64)
        bin_indices = np.clip(bin_indices, 0, num_bins - 1)
        global_mean = y_train.mean(axis=0)
        table = np.zeros((num_bins, *y_train.shape[1:]), dtype=np.float32)
        for bin_idx in range(num_bins):
            mask = bin_indices == bin_idx
            if np.any(mask):
                table[bin_idx] = y_train[mask].mean(axis=0)
            else:
                table[bin_idx] = global_mean
        table = (table - float(y_mean)) / float(y_std)
        return cls(table=torch.tensor(table, dtype=torch.float32), bin_size=bin_size, y_mean=y_mean, y_std=y_std)

    def lookup(self, ls_future):
        if ls_future.dim() != 2:
            raise ValueError(f'Expected ls_future shape [B, pred_len], got {tuple(ls_future.shape)}')
        num_bins = self.table.shape[0]
        bin_indices = torch.floor(ls_future.remainder(360.0) / self.bin_size).long()
        bin_indices = torch.clamp(bin_indices, 0, num_bins - 1)
        return self.table[bin_indices]

class ResidualClimatologyForecaster(nn.Module):
    """Wrap a residual backbone with a fixed climatology lookup."""

    def __init__(self, base_model, climatology_table):
        super().__init__()
        self.base_model = base_model
        self.climatology_table = climatology_table

    def predict_residual(self, x, ls_history):
        return self.base_model(x, ls_history)

    def lookup_climatology(self, ls_future):
        return self.climatology_table.lookup(ls_future)

    def forward(self, x, ls_history, ls_future):
        residual = self.predict_residual(x, ls_history)
        climatology = self.lookup_climatology(ls_future)
        return climatology + residual

def evaluate_residual_metrics(model, loader, device, y_std, y_mean):
    """Evaluate final prediction after adding climatology, then restore units."""
    model.eval()
    preds = []
    trues = []
    with torch.no_grad():
        for (xb, ls_hist, ls_future, yb) in loader:
            xb = xb.to(device)
            ls_hist = ls_hist.to(device)
            ls_future = ls_future.to(device)
            pred = model(xb, ls_hist, ls_future).cpu().numpy()
            preds.append(pred)
            trues.append(yb.numpy())
    preds = np.concatenate(preds, axis=0)
    trues = np.concatenate(trues, axis=0)
    y_pred_phys = preds * y_std + y_mean
    y_true_phys = trues * y_std + y_mean
    pred_flat = y_pred_phys.reshape(-1)
    true_flat = y_true_phys.reshape(-1)
    mse = np.mean((pred_flat - true_flat) ** 2)
    rmse = np.sqrt(mse)
    mae = np.mean(np.abs(pred_flat - true_flat))
    ss_res = np.sum((true_flat - pred_flat) ** 2)
    ss_tot = np.sum((true_flat - np.mean(true_flat)) ** 2)
    r2 = 1 - ss_res / ss_tot
    smape = np.mean(2.0 * np.abs(pred_flat - true_flat) / (np.abs(true_flat) + np.abs(pred_flat) + 1e-06))
    return {'rmse': rmse, 'mae': mae, 'r2': r2, 'smape': smape}

def evaluate_climatology_only(climatology_table, loader, device, y_std, y_mean):

    class _ClimatologyOnly(nn.Module):

        def __init__(self, table):
            super().__init__()
            self.table = table

        def forward(self, x, ls_history, ls_future):
            return self.table.lookup(ls_future)
    return evaluate_residual_metrics(_ClimatologyOnly(climatology_table).to(device), loader, device, y_std, y_mean)

def train_and_evaluate(label, use_phase_warp, climatology_table, train_loader, test_loader, device, y_std, y_mean, lat_size, lon_size, horizon, hidden_dims, mst_spatial_hidden_dim, mst_temporal_hidden_dim, mst_num_downsample, mst_temporal_depth, dropout, epochs, learning_rate, early_stopping_patience, base_dir):
    print(f'\n[Experiment] {label}')
    base_model = ConvLSTMMSTForecaster(pred_len=horizon, lat_size=lat_size, lon_size=lon_size, use_phase_warp=use_phase_warp, hidden_dims=hidden_dims, mst_spatial_hidden_dim=mst_spatial_hidden_dim, mst_temporal_hidden_dim=mst_temporal_hidden_dim, mst_num_downsample=mst_num_downsample, mst_temporal_depth=mst_temporal_depth, dropout=dropout)
    model = ResidualClimatologyForecaster(base_model=base_model, climatology_table=climatology_table).to(device)
    optimizer = torch.optim.Adam(model.base_model.parameters(), lr=learning_rate)
    criterion = nn.SmoothL1Loss()
    checkpoint_path = os.path.join(base_dir, 'models', TRAIN_RESULT_DIR, f'{label.lower()}_checkpoint.pth')
    early_stopping = EarlyStopping(patience=early_stopping_patience, verbose=True, path=checkpoint_path)
    for epoch_idx in range(epochs):
        model.train()
        train_loss_sum = 0.0
        for (xb, ls_hist, ls_future, yb) in train_loader:
            xb = xb.to(device)
            ls_hist = ls_hist.to(device)
            ls_future = ls_future.to(device)
            yb = yb.to(device)
            optimizer.zero_grad()
            pred = model(xb, ls_hist, ls_future)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            train_loss_sum += loss.item()
        avg_train_loss = train_loss_sum / len(train_loader)
        model.eval()
        val_loss_sum = 0.0
        with torch.no_grad():
            for (xb, ls_hist, ls_future, yb) in test_loader:
                xb = xb.to(device)
                ls_hist = ls_hist.to(device)
                ls_future = ls_future.to(device)
                yb = yb.to(device)
                pred = model(xb, ls_hist, ls_future)
                loss = criterion(pred, yb)
                val_loss_sum += loss.item()
        avg_val_loss = val_loss_sum / len(test_loader)
        print(f'{label} | Epoch {epoch_idx + 1}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f}')
        early_stopping(avg_val_loss, model)
        if early_stopping.early_stop:
            print(f'{label} triggered early stopping.')
            break
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    metrics = evaluate_residual_metrics(model, test_loader, device, y_std, y_mean)
    baseline_weight = torch.sigmoid(model.base_model.mst_block.residual_logit).item()
    save_path = os.path.join(base_dir, 'models', TRAIN_RESULT_DIR, f'{label.lower()}.pth')
    torch.save(model.state_dict(), save_path)
    print(f'{label} weights saved to: {save_path}')
    print(f'{label} learned ConvLSTM baseline fusion weight: {baseline_weight:.4f}')
    print(f"{label} Metrics | RMSE: {metrics['rmse']:.4f} | MAE: {metrics['mae']:.4f} | R^2: {metrics['r2']:.4f} | SMAPE: {metrics['smape']:.2%}")
    return metrics

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.makedirs(os.path.join(base_dir, 'models', TRAIN_LOG_DIR), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'models', TRAIN_RESULT_DIR), exist_ok=True)
    sys.stdout = Logger(os.path.join(base_dir, 'models', TRAIN_LOG_DIR, 'ConvLSTM_MST_Residual_Climatology.txt'))
    seed = 11
    set_experiment_seed(seed)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Training Device: {device}')
    print(f'Single Seed: {seed}')
    print('Model: ConvLSTM_MST_Residual_Climatology')
    window = 3
    horizon = 3
    batch_size = 4
    hidden_dim = 32
    num_layers = 2
    hidden_dims = [hidden_dim] * num_layers
    mst_spatial_hidden_dim = 32
    mst_temporal_hidden_dim = 128
    mst_num_downsample = 2
    mst_temporal_depth = 4
    dropout = 0.1
    epochs = 20
    learning_rate = 0.001
    early_stopping_patience = 5
    climatology_bin_size = 10.0
    (x_raw, y_raw, ls_raw) = load_aligned_cube(base_dir)
    (lat_size, lon_size) = (y_raw.shape[1], y_raw.shape[2])
    (train_loader, test_loader, y_mean, y_std, split_sample_idx) = build_residual_grid_dataloaders(x_raw=x_raw, y_raw=y_raw, ls_raw=ls_raw, window=window, horizon=horizon, batch_size=batch_size)
    train_time_steps = int(0.8 * y_raw.shape[0])
    climatology_table = SeasonalClimatologyTable.from_training_series(y_raw=y_raw, ls_raw=ls_raw, train_time_steps=train_time_steps, bin_size=climatology_bin_size, y_mean=y_mean, y_std=y_std).to(device)
    clim_metrics = evaluate_climatology_only(climatology_table, test_loader, device, y_std, y_mean)
    print(f"Fixed_Climatology Metrics | RMSE: {clim_metrics['rmse']:.4f} | MAE: {clim_metrics['mae']:.4f} | R^2: {clim_metrics['r2']:.4f} | SMAPE: {clim_metrics['smape']:.2%}")
    raw_metrics = train_and_evaluate(label=f'ConvLSTM_MST_ResidualClim_Raw_seed{seed}', use_phase_warp=False, climatology_table=climatology_table, train_loader=train_loader, test_loader=test_loader, device=device, y_std=y_std, y_mean=y_mean, lat_size=lat_size, lon_size=lon_size, horizon=horizon, hidden_dims=hidden_dims, mst_spatial_hidden_dim=mst_spatial_hidden_dim, mst_temporal_hidden_dim=mst_temporal_hidden_dim, mst_num_downsample=mst_num_downsample, mst_temporal_depth=mst_temporal_depth, dropout=dropout, epochs=epochs, learning_rate=learning_rate, early_stopping_patience=early_stopping_patience, base_dir=base_dir)
    set_experiment_seed(seed)
    phase_metrics = train_and_evaluate(label=f'ConvLSTM_MST_ResidualClim_PhaseWarp_seed{seed}', use_phase_warp=True, climatology_table=climatology_table, train_loader=train_loader, test_loader=test_loader, device=device, y_std=y_std, y_mean=y_mean, lat_size=lat_size, lon_size=lon_size, horizon=horizon, hidden_dims=hidden_dims, mst_spatial_hidden_dim=mst_spatial_hidden_dim, mst_temporal_hidden_dim=mst_temporal_hidden_dim, mst_num_downsample=mst_num_downsample, mst_temporal_depth=mst_temporal_depth, dropout=dropout, epochs=epochs, learning_rate=learning_rate, early_stopping_patience=early_stopping_patience, base_dir=base_dir)
    print('\n[Comparison Summary]')
    print(f"ConvLSTM_MST_ResidualClim_Raw Metrics | RMSE: {raw_metrics['rmse']:.4f} | MAE: {raw_metrics['mae']:.4f} | R^2: {raw_metrics['r2']:.4f} | SMAPE: {raw_metrics['smape']:.2%}")
    print(f"ConvLSTM_MST_ResidualClim_PhaseWarp Metrics | RMSE: {phase_metrics['rmse']:.4f} | MAE: {phase_metrics['mae']:.4f} | R^2: {phase_metrics['r2']:.4f} | SMAPE: {phase_metrics['smape']:.2%}")
    print(f"RMSE improvement: {raw_metrics['rmse'] - phase_metrics['rmse']:.4f}")
    print(f"MAE improvement : {raw_metrics['mae'] - phase_metrics['mae']:.4f}")
    print(f"R^2 gain        : {phase_metrics['r2'] - raw_metrics['r2']:.4f}")
    print(f"SMAPE gain      : {raw_metrics['smape'] - phase_metrics['smape']:.2%}")
