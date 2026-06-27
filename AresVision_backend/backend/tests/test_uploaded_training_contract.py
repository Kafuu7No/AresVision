import asyncio
import sys
import types
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def import_training_service_with_stubs():
    if "sqlalchemy" not in sys.modules:
        sqlalchemy = types.ModuleType("sqlalchemy")
        sqlalchemy.select = lambda *args, **kwargs: None
        sqlalchemy.update = lambda *args, **kwargs: None
        sys.modules["sqlalchemy"] = sqlalchemy

    if "netCDF4" not in sys.modules:
        netcdf4 = types.ModuleType("netCDF4")
        netcdf4.Dataset = object
        sys.modules["netCDF4"] = netcdf4

    engine = types.ModuleType("database.engine")
    engine.async_session_maker = None
    sys.modules["database.engine"] = engine

    models = types.ModuleType("database.models")
    models.ModelTrainingTask = object
    models.User = object
    sys.modules["database.models"] = models

    data_service = types.ModuleType("services.data_service")
    data_service.DataService = object
    sys.modules["services.data_service"] = data_service

    personal_service = types.ModuleType("services.personal_data_source_service")
    personal_service.PersonalDataSourceService = object
    sys.modules["services.personal_data_source_service"] = personal_service

    from services.training_service import TrainingService

    return TrainingService


def import_training_router_with_stubs():
    import_training_service_with_stubs()

    if "fastapi" not in sys.modules:
        fastapi = types.ModuleType("fastapi")

        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                super().__init__(detail)
                self.status_code = status_code
                self.detail = detail

        class APIRouter:
            def __init__(self, *args, **kwargs):
                pass

            def get(self, *args, **kwargs):
                return lambda fn: fn

            def post(self, *args, **kwargs):
                return lambda fn: fn

            def delete(self, *args, **kwargs):
                return lambda fn: fn

            def websocket(self, *args, **kwargs):
                return lambda fn: fn

        fastapi.APIRouter = APIRouter
        fastapi.Depends = lambda dependency=None: dependency
        fastapi.HTTPException = HTTPException
        fastapi.Request = object
        fastapi.WebSocket = object
        fastapi.WebSocketDisconnect = Exception
        sys.modules["fastapi"] = fastapi

    auth_dependencies = types.ModuleType("auth.dependencies")
    auth_dependencies.get_current_user = lambda: None
    sys.modules["auth.dependencies"] = auth_dependencies

    schemas_training = types.ModuleType("schemas.training")
    schemas_training.LogResponse = object
    schemas_training.TrainingStartRequest = object
    schemas_training.TrainingTaskResponse = object
    sys.modules["schemas.training"] = schemas_training

    inference_service = types.ModuleType("services.inference_service")
    inference_service.InferenceService = lambda: object()
    sys.modules["services.inference_service"] = inference_service

    from routers import training

    return training


class FakePackage:
    id = "4d24f680-5029-47d9-9890-a56a6247b20e"
    user_id = 3
    version = 2
    validation_status = "valid"
    storage_path = "D:/tmp/model.py"
    param_schema = '{"hidden_dim": {"type": "integer", "default": 32}}'


class FakeUserModelService:
    async def get_package_for_user(self, package_id, user_id):
        assert package_id == FakePackage.id
        assert user_id == FakePackage.user_id
        return FakePackage


async def test_uploaded_training_contract():
    TrainingService = import_training_service_with_stubs()
    service = TrainingService()

    official_script, official_hypers = service._resolve_training_entrypoint(
        user_id=3,
        model_source="official",
        uploaded_model_id=None,
        hyperparameters={"epochs": 1},
        user_model_service=None,
    )

    assert official_script == "demo3.py"
    assert official_hypers["epochs"] == 1
    assert official_hypers["model_source"] == "official"

    uploaded_script, uploaded_hypers = await service._resolve_uploaded_training_entrypoint(
        user_id=3,
        uploaded_model_id=FakePackage.id,
        hyperparameters={"custom_model_params": {"hidden_dim": 16}},
        user_model_service=FakeUserModelService(),
    )

    assert uploaded_script == "__user_model_runner__"
    assert uploaded_hypers["model_source"] == "uploaded"
    assert uploaded_hypers["_uploaded_model_id"] == FakePackage.id
    assert uploaded_hypers["_uploaded_model_version"] == FakePackage.version
    assert uploaded_hypers["_uploaded_model_path"] == FakePackage.storage_path
    assert uploaded_hypers["_uploaded_model_param_schema"]["hidden_dim"]["default"] == 32
    assert uploaded_hypers["custom_model_params"]["hidden_dim"] == 16


def test_official_entrypoint_strips_uploaded_private_fields():
    TrainingService = import_training_service_with_stubs()
    service = TrainingService()

    _script, hypers = service._resolve_training_entrypoint(
        user_id=3,
        model_source="official",
        uploaded_model_id=None,
        hyperparameters={
            "epochs": 1,
            "_uploaded_model_id": FakePackage.id,
            "_uploaded_model_version": FakePackage.version,
            "_uploaded_model_path": FakePackage.storage_path,
            "_uploaded_model_param_schema": {"hidden_dim": {"default": 32}},
            "custom_model_params": {"hidden_dim": 16},
        },
        user_model_service=None,
    )

    assert hypers["model_source"] == "official"
    assert "_uploaded_model_id" not in hypers
    assert "_uploaded_model_version" not in hypers
    assert "_uploaded_model_path" not in hypers
    assert "_uploaded_model_param_schema" not in hypers
    assert "custom_model_params" not in hypers


async def test_training_route_maps_permission_error_to_403():
    training = import_training_router_with_stubs()

    class PermissionDeniedTrainingService:
        async def start_training(self, **kwargs):
            raise PermissionError("No permission to access this uploaded model")

    request = type("Request", (), {
        "app": type("App", (), {"state": type("State", (), {})()})()
    })()
    req = type("Req", (), {
        "model_script": "demo3.py",
        "hyperparameters": {},
        "model_name": "permission-case",
        "data_source": "default",
        "model_source": "uploaded",
        "uploaded_model_id": FakePackage.id,
    })()
    current_user = type("User", (), {"id": 3})()
    original_service = training.training_service
    training.training_service = PermissionDeniedTrainingService()

    try:
        try:
            await training.start_training(req, request, current_user)
        except training.HTTPException as exc:
            assert exc.status_code == 403
            assert exc.detail == "No permission to access this uploaded model"
        else:
            raise AssertionError("Expected HTTPException")
    finally:
        training.training_service = original_service


if __name__ == "__main__":
    asyncio.run(test_uploaded_training_contract())
    test_official_entrypoint_strips_uploaded_private_fields()
    asyncio.run(test_training_route_maps_permission_error_to_403())
    print("uploaded training contract tests passed")
