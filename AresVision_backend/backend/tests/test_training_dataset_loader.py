import importlib.util
import sys
import types
import uuid
from pathlib import Path

import netCDF4
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _load_demo3_module():
    scipy_module = types.ModuleType("scipy")
    scipy_interpolate = types.ModuleType("scipy.interpolate")
    scipy_interpolate.interp1d = lambda x, y, axis=0, bounds_error=False, fill_value=None: (
        lambda target: np.stack([
            np.interp(np.asarray(target, dtype=float), np.asarray(x, dtype=float), row)
            for row in np.moveaxis(np.asarray(y, dtype=float), axis, 0).reshape(len(x), -1).T
        ], axis=-1).reshape(np.asarray(target).shape + np.asarray(y).shape[1:])
    )
    sklearn_module = types.ModuleType("sklearn")
    sklearn_metrics = types.ModuleType("sklearn.metrics")
    sklearn_metrics.mean_squared_error = lambda y_true, y_pred: float(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2))
    sklearn_metrics.r2_score = lambda y_true, y_pred: 1.0
    sklearn_preprocessing = types.ModuleType("sklearn.preprocessing")

    class StandardScaler:
        def fit(self, values):
            arr = np.asarray(values, dtype=float)
            self.mean_ = arr.mean(axis=0, keepdims=True)
            self.scale_ = arr.std(axis=0, keepdims=True) + 1e-6
            return self

        def transform(self, values):
            return (np.asarray(values, dtype=float) - self.mean_) / self.scale_

    sklearn_preprocessing.StandardScaler = StandardScaler
    sys.modules["scipy"] = scipy_module
    sys.modules["scipy.interpolate"] = scipy_interpolate
    sys.modules["sklearn"] = sklearn_module
    sys.modules["sklearn.metrics"] = sklearn_metrics
    sys.modules["sklearn.preprocessing"] = sklearn_preprocessing

    script_path = BACKEND_DIR / "models" / "训练模型" / "demo3.py"
    spec = importlib.util.spec_from_file_location("aresvision_demo3_training_loader", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_overview_file(path: Path, offset: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with netCDF4.Dataset(str(path), "w", format="NETCDF4") as ds:
        ds.createDimension("time", 6)
        ds.createDimension("lat", 2)
        ds.createDimension("lon", 3)

        ls = ds.createVariable("Ls", "f4", ("time",))
        lat = ds.createVariable("lat", "f4", ("lat",))
        lon = ds.createVariable("lon", "f4", ("lon",))
        ls[:] = np.linspace(offset, offset + 5.0, 6, dtype=np.float32) % 360.0
        lat[:] = np.array([-45.0, 45.0], dtype=np.float32)
        lon[:] = np.array([0.0, 120.0, 240.0], dtype=np.float32)

        base = np.arange(36, dtype=np.float32).reshape(6, 2, 3) + offset
        for var_name, delta in {
            "o3col": 0.0,
            "U_Wind": 10.0,
            "V_Wind": 20.0,
            "Dust_Optical_Depth": 30.0,
            "Solar_Flux_DN": 40.0,
            "Temperature": 50.0,
        }.items():
            var = ds.createVariable(var_name, "f4", ("time", "lat", "lon"))
            var[:] = base + delta


def test_official_training_loader_builds_tensors_from_mcd_overview(tmp_path):
    workspace_tmp = BACKEND_DIR / ".test_tmp" / f"training_loader_{uuid.uuid4().hex}"
    overview_dir = workspace_tmp / "mcd_overview"
    first_file = overview_dir / "MCD_MY24_overview.nc"
    second_file = overview_dir / "MCD_MY25_overview.nc"
    _write_overview_file(first_file, 0.0)
    _write_overview_file(second_file, 10.0)

    try:
        demo3 = _load_demo3_module()

        x_torch, ls_torch, y_torch, height, width = demo3.prepare_training_tensors(
            openmars_dir=workspace_tmp / "openmars",
            mcd_dir=workspace_tmp / "MCD",
            mcd_overview_dir=overview_dir,
            selected_channels=["U", "T"],
            window=2,
            horizon=2,
            training_dataset="mcd_overview",
        )
    finally:
        if first_file.exists():
            first_file.unlink()
        if second_file.exists():
            second_file.unlink()
        if overview_dir.exists():
            overview_dir.rmdir()
        if workspace_tmp.exists():
            workspace_tmp.rmdir()

    assert list(x_torch.shape) == [9, 2, 3, 2, 3]
    assert list(y_torch.shape) == [9, 2, 1, 2, 3]
    assert list(ls_torch.shape) == [9, 2]
    assert height == 2
    assert width == 3
