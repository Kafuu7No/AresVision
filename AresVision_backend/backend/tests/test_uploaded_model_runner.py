import sys
import tempfile
from pathlib import Path

import torch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from training_backbones.user_model_runner import (  # noqa: E402
    assert_prediction_shape,
    build_uploaded_model_config,
    load_uploaded_model,
    parse_json_arg,
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


if __name__ == "__main__":
    test_parse_json_arg_accepts_dict_json_string_and_empty_values()
    test_build_uploaded_model_config_merges_core_custom_and_schema_defaults()
    test_load_uploaded_model_imports_build_model_and_returns_module()
    test_assert_prediction_shape_accepts_matching_shapes_and_rejects_mismatches()
    test_bad_shape_uploaded_model_is_caught_by_prediction_shape_guard()
    print("uploaded model runner tests passed")
