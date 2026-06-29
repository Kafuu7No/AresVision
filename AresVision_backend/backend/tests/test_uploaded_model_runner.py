import sys
import tempfile
import types
import uuid
from pathlib import Path

import netCDF4
import numpy as np
import torch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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
sklearn_metrics.mean_squared_error = lambda y_true, y_pred: float(
    np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)
)
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

from training_backbones.user_model_runner import (  # noqa: E402
    assert_prediction_shape,
    build_uploaded_model_config,
    load_uploaded_model,
    parse_json_arg,
    prepare_tensors,
)


MODEL_SOURCE = """
from torch import nn
MODEL_SPEC = {"name":"RunnerTiny", "parameters":{"hidden_dim":{"type":"int","default":8,"min":4,"max":32}}}
class RunnerTiny(nn.Module):
    def __init__(self, horizon):
        super().__init__()
        self.horizon = horizon
    def forward(self, x):
        return x[:, -1:, :1].repeat(1, self.horizon, 1, 1, 1)
def build_model(config):
    return RunnerTiny(config["horizon"])
"""

BAD_SHAPE_MODEL_SOURCE = """
from torch import nn
MODEL_SPEC = {"name":"BadShapeTiny", "parameters":{}}
class BadShapeTiny(nn.Module):
    def forward(self, x):
        return x[:, -1, 0]
def build_model(config):
    return BadShapeTiny()
"""


def _write_overview_file(path: Path, offset: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with netCDF4.Dataset(str(path), "w", format="NETCDF4") as ds:
        ds.createDimension("time", 6)
        ds.createDimension("lat", 2)
        ds.createDimension("lon", 3)

        ds.createVariable("Ls", "f4", ("time",))[:] = np.linspace(
            offset,
            offset + 5.0,
            6,
            dtype=np.float32,
        ) % 360.0
        ds.createVariable("lat", "f4", ("lat",))[:] = np.array([-45.0, 45.0], dtype=np.float32)
        ds.createVariable("lon", "f4", ("lon",))[:] = np.array([0.0, 120.0, 240.0], dtype=np.float32)

        base = np.arange(36, dtype=np.float32).reshape(6, 2, 3) + offset
        for var_name, delta in {
            "o3col": 0.0,
            "U_Wind": 10.0,
            "V_Wind": 20.0,
            "Dust_Optical_Depth": 30.0,
            "Solar_Flux_DN": 40.0,
            "Temperature": 50.0,
        }.items():
            ds.createVariable(var_name, "f4", ("time", "lat", "lon"))[:] = base + delta


def test_parse_json_arg_accepts_dict_json_string_and_empty_values():
    assert parse_json_arg({"hidden_dim": 16}) == {"hidden_dim": 16}
    assert parse_json_arg('{"hidden_dim":16}') == {"hidden_dim": 16}
    assert parse_json_arg("") == {}
    assert parse_json_arg(None) == {}


def test_build_uploaded_model_config_merges_core_custom_and_schema_defaults():
    config = build_uploaded_model_config(
        in_channels=3,
        window=4,
        horizon=5,
        height=8,
        width=16,
        selected_channels=["U", "T"],
        custom_model_params={"hidden_dim": 16},
        param_schema={
            "hidden_dim": {"type": "int", "default": 8},
            "dropout": {"type": "float", "default": 0.25},
        },
    )

    assert config == {
        "in_channels": 3,
        "window": 4,
        "horizon": 5,
        "height": 8,
        "width": 16,
        "selected_channels": ["U", "T"],
        "hidden_dim": 16,
        "dropout": 0.25,
    }


def test_load_uploaded_model_imports_build_model_and_returns_module():
    with tempfile.TemporaryDirectory() as temp_dir:
        model_path = Path(temp_dir) / "runner_tiny.py"
        model_path.write_text(MODEL_SOURCE, encoding="utf-8")
        config = build_uploaded_model_config(
            in_channels=3,
            window=3,
            horizon=3,
            height=8,
            width=16,
            selected_channels=["U", "V"],
            custom_model_params={},
            param_schema={"hidden_dim": {"type": "int", "default": 8}},
        )

        model = load_uploaded_model(model_path, config)
        output = model(torch.zeros(2, 3, 1, 8, 16))

    assert isinstance(model, torch.nn.Module)
    assert list(output.shape) == [2, 3, 1, 8, 16]


def test_load_uploaded_model_reads_python_source_from_non_py_storage_path():
    with tempfile.TemporaryDirectory() as temp_dir:
        model_path = Path(temp_dir) / "runner_tiny.py.user"
        model_path.write_text(MODEL_SOURCE, encoding="utf-8")
        config = build_uploaded_model_config(
            in_channels=3,
            window=3,
            horizon=3,
            height=8,
            width=16,
            selected_channels=["U", "V"],
            custom_model_params={},
            param_schema={"hidden_dim": {"type": "int", "default": 8}},
        )

        model = load_uploaded_model(model_path, config)
        output = model(torch.zeros(2, 3, 1, 8, 16))

    assert isinstance(model, torch.nn.Module)
    assert list(output.shape) == [2, 3, 1, 8, 16]


def test_assert_prediction_shape_accepts_matching_shapes_and_rejects_mismatches():
    prediction = torch.zeros(2, 3, 1, 8, 16)
    target = torch.ones(2, 3, 1, 8, 16)
    assert_prediction_shape(prediction, target, "unit-test")

    try:
        assert_prediction_shape(torch.zeros(2, 1, 8, 16), target, "bad-batch")
    except ValueError as exc:
        message = str(exc)
        assert "bad-batch" in message
        assert "expected" in message
        assert "actual" in message
        assert "shape" in message
    else:
        raise AssertionError("mismatched prediction shape should raise ValueError")


def test_bad_shape_uploaded_model_is_caught_by_prediction_shape_guard():
    with tempfile.TemporaryDirectory() as temp_dir:
        model_path = Path(temp_dir) / "bad_shape_tiny.py"
        model_path.write_text(BAD_SHAPE_MODEL_SOURCE, encoding="utf-8")
        config = build_uploaded_model_config(
            in_channels=1,
            window=3,
            horizon=3,
            height=8,
            width=16,
            selected_channels=[],
            custom_model_params={},
            param_schema={},
        )

        model = load_uploaded_model(model_path, config)
        prediction = model(torch.zeros(2, 3, 1, 8, 16))
        target = torch.zeros(2, 3, 1, 8, 16)

    try:
        assert_prediction_shape(prediction, target, "bad-shape-forward")
    except ValueError as exc:
        message = str(exc)
        assert "bad-shape-forward" in message
        assert "expected" in message
        assert "actual" in message
    else:
        raise AssertionError("bad-shape uploaded model output should raise ValueError")


def test_prepare_tensors_builds_uploaded_runner_dataset_from_mcd_overview():
    workspace_tmp = BACKEND_DIR / ".test_tmp" / f"uploaded_runner_{uuid.uuid4().hex}"
    overview_dir = workspace_tmp / "mcd_overview"
    first_file = overview_dir / "MCD_MY24_overview.nc"
    second_file = overview_dir / "MCD_MY25_overview.nc"
    _write_overview_file(first_file, 0.0)
    _write_overview_file(second_file, 10.0)

    try:
        x_torch, y_torch, _y_mean, _y_std, height, width = prepare_tensors(
            workspace_tmp / "openmars",
            workspace_tmp / "MCD",
            ["U", "T"],
            window=2,
            horizon=2,
            training_dataset="mcd_overview",
            mcd_overview_dir=overview_dir,
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
    assert height == 2
    assert width == 3


if __name__ == "__main__":
    test_parse_json_arg_accepts_dict_json_string_and_empty_values()
    test_build_uploaded_model_config_merges_core_custom_and_schema_defaults()
    test_load_uploaded_model_imports_build_model_and_returns_module()
    test_load_uploaded_model_reads_python_source_from_non_py_storage_path()
    test_assert_prediction_shape_accepts_matching_shapes_and_rejects_mismatches()
    test_bad_shape_uploaded_model_is_caught_by_prediction_shape_guard()
    test_prepare_tensors_builds_uploaded_runner_dataset_from_mcd_overview()
    print("uploaded model runner tests passed")
