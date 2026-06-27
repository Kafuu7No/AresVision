import asyncio
import sys
import types
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

auth_dependencies = types.ModuleType("auth.dependencies")
auth_dependencies.get_optional_user = lambda: None
sys.modules["auth.dependencies"] = auth_dependencies

models = types.ModuleType("database.models")
models.User = object
sys.modules["database.models"] = models

analysis_service = types.ModuleType("services.analysis_service")
analysis_service.AnalysisService = object
sys.modules["services.analysis_service"] = analysis_service

personal_service = types.ModuleType("services.personal_data_source_service")
personal_service.SingleYearDataView = object
sys.modules["services.personal_data_source_service"] = personal_service

predict_data_service = types.ModuleType("services.predict_data_service")
predict_data_service.PredictDataService = object
sys.modules["services.predict_data_service"] = predict_data_service

predict_service = types.ModuleType("services.predict_service")
predict_service.PredictOrchestratorService = object
sys.modules["services.predict_service"] = predict_service

from routers import predict  # noqa: E402
from schemas.predict import PredictRequest  # noqa: E402


class FakeTrainingInferenceService:
    def __init__(self):
        self.prediction_calls = []
        self.metric_calls = []
        self.test_set_metric_calls = []
        self.compare_metric_calls = []
        self.error_distribution_calls = []
        self.pfi_calls = []

    async def predict_task(self, **kwargs):
        self.prediction_calls.append(kwargs)
        return {
            "ground_truth": [_field(1.0)],
            "prediction": [_field(2.0)],
            "residual": [_field(1.0)],
            "selected_variables": ["Temperature"],
            "horizon": 1,
            "ls_values": [95.0],
            "model_info": {
                "model_source": "trained_task",
                "training_task_id": kwargs["task_id"],
            },
            "metrics": {
                "overall": {"step": 0, "rmse": 1.0, "mae": 1.0, "ssim": 0.0, "r2": 0.0},
                "per_step": [{"step": 1, "rmse": 1.0, "mae": 1.0, "ssim": 0.0, "r2": 0.0}],
            },
        }

    async def task_metrics(self, **kwargs):
        self.metric_calls.append(kwargs)
        return {
            "overall": {"step": 0, "rmse": 1.0, "mae": 1.0, "ssim": 0.0, "r2": 0.0},
            "per_step": [{"step": 1, "rmse": 1.0, "mae": 1.0, "ssim": 0.0, "r2": 0.0}],
        }

    async def task_test_set_metrics(self, **kwargs):
        self.test_set_metric_calls.append(kwargs)
        return {
            "overall": {"step": 0, "rmse": 3.47, "mae": 2.46, "ssim": 0.49, "r2": 0.64},
            "per_step": [{"step": 1, "rmse": 3.47, "mae": 2.46, "ssim": 0.49, "r2": 0.64}],
        }

    async def compare_task_test_set_metrics(self, **kwargs):
        self.compare_metric_calls.append(kwargs)
        return {
            "items": [
                {
                    "task_id": 12,
                    "model_name": "model-a",
                    "model_source": "official",
                    "architecture": "predrnnv2",
                    "selected_channels": ["U", "V", "D"],
                    "hyperparameters": {"window": 3, "horizon": 3, "batch_size": 16},
                    "metrics": {
                        "overall": {"step": 0, "rmse": 3.47, "mae": 2.46, "ssim": 0.49, "r2": 0.64},
                        "per_step": [{"step": 1, "rmse": 3.47, "mae": 2.46, "ssim": 0.49, "r2": 0.64}],
                    },
                },
                {
                    "task_id": 18,
                    "model_name": "model-b",
                    "model_source": "uploaded",
                    "architecture": "custom",
                    "selected_channels": ["T"],
                    "hyperparameters": {"window": 4, "horizon": 3, "batch_size": 8},
                    "metrics": {
                        "overall": {"step": 0, "rmse": 2.9, "mae": 2.1, "ssim": 0.52, "r2": 0.7},
                        "per_step": [{"step": 1, "rmse": 2.9, "mae": 2.1, "ssim": 0.52, "r2": 0.7}],
                    },
                },
            ]
        }

    async def task_permutation_importance(self, **kwargs):
        self.pfi_calls.append(kwargs)
        return {
            "items": [
                {"name": "Ozone", "importance": 0.55},
                {"name": "Temperature", "importance": 0.25},
            ],
            "baseline_metric": "r2",
            "baseline_value": 0.5,
        }

    async def task_error_distribution(self, **kwargs):
        self.error_distribution_calls.append(kwargs)
        return {
            "scatter": {"trues": [1.0, 2.0], "preds": [1.5, 2.5], "density": [1.0, 1.0]},
            "hist_trues": {"bin_edges": [1.0, 2.0], "counts": [2]},
            "hist_preds": {"bin_edges": [1.5, 2.5], "counts": [2]},
            "hist_errors": {"bin_edges": [0.5, 0.6], "counts": [2]},
            "mae": 0.5,
            "rmse": 0.5,
        }


def _field(value):
    return {
        "points": [{"lat": 0.0, "lng": 0.0, "val": value}],
        "lat": [0.0],
        "lon": [0.0],
        "field": [[value]],
        "minVal": value,
        "maxVal": value,
    }


def _request(service=None):
    state = type("State", (), {})()
    if service is not None:
        state.training_inference_service = service
    app = type("App", (), {"state": state})()
    return type("Request", (), {"app": app})()


async def test_predict_run_uses_training_task_inference_when_task_id_is_present():
    service = FakeTrainingInferenceService()
    body = PredictRequest(training_task_id=42, selected_variables=["U_Wind"], horizon=3, ls_start=90, mars_year=27)

    payload = await predict.run_prediction(_request(service), body, data_source="default", current_user=None)

    assert payload["model_info"]["model_source"] == "trained_task"
    assert payload["model_info"]["training_task_id"] == 42
    assert service.prediction_calls[0]["task_id"] == 42
    assert service.prediction_calls[0]["current_user"] is None


async def test_predict_metrics_uses_training_task_test_set_metrics_when_task_id_is_present():
    service = FakeTrainingInferenceService()
    body = PredictRequest(training_task_id=42, selected_variables=["U_Wind"], horizon=3, ls_start=90, mars_year=27)

    payload = await predict.get_eval_metrics(_request(service), body, data_source="default", current_user=None)

    assert payload["overall"]["rmse"] == 3.47
    assert service.test_set_metric_calls[0]["task_id"] == 42
    assert service.metric_calls == []


async def test_trained_model_request_fails_when_training_inference_service_is_missing():
    body = PredictRequest(training_task_id=42, ls_start=90, mars_year=27)
    try:
        await predict.run_prediction(_request(), body, data_source="default", current_user=None)
    except predict.HTTPException as exc:
        assert exc.status_code == 500
        assert "training inference service unavailable" in exc.detail
    else:
        raise AssertionError("Expected HTTPException for missing training inference service")


async def test_permutation_importance_uses_training_task_service_when_task_id_is_present():
    service = FakeTrainingInferenceService()

    payload = await predict.get_permutation_importance(
        _request(service),
        vars="Temperature",
        training_task_id=42,
        mars_year=27,
        ls_start=90,
        horizon=3,
        current_user=None,
    )

    assert payload["items"][0]["name"] == "Ozone"
    assert service.pfi_calls[0]["task_id"] == 42
    assert service.pfi_calls[0]["selected_variables"] == ["Temperature"]


async def test_error_distribution_uses_training_task_test_set_when_task_id_is_present():
    service = FakeTrainingInferenceService()

    payload = await predict.get_error_distribution(
        _request(service),
        vars="Temperature",
        training_task_id=42,
        horizon=3,
        current_user=None,
    )

    assert payload["mae"] == 0.5
    assert service.error_distribution_calls[0]["task_id"] == 42
    assert service.error_distribution_calls[0]["selected_variables"] == ["Temperature"]


async def test_training_model_compare_uses_batch_test_set_metrics_service():
    service = FakeTrainingInferenceService()

    payload = await predict.compare_training_models(
        _request(service),
        predict.TrainingModelCompareRequest(task_ids=[12, 18], horizon=3),
        current_user=None,
    )

    assert payload["items"][0]["task_id"] == 12
    assert payload["items"][1]["metrics"]["overall"]["r2"] == 0.7
    assert service.compare_metric_calls[0]["task_ids"] == [12, 18]
    assert service.compare_metric_calls[0]["horizon"] == 3
    assert service.compare_metric_calls[0]["current_user"] is None


if __name__ == "__main__":
    asyncio.run(test_predict_run_uses_training_task_inference_when_task_id_is_present())
    asyncio.run(test_predict_metrics_uses_training_task_test_set_metrics_when_task_id_is_present())
    asyncio.run(test_trained_model_request_fails_when_training_inference_service_is_missing())
    asyncio.run(test_permutation_importance_uses_training_task_service_when_task_id_is_present())
    asyncio.run(test_error_distribution_uses_training_task_test_set_when_task_id_is_present())
    asyncio.run(test_training_model_compare_uses_batch_test_set_metrics_service())
    print("trained model predict contract tests passed")
