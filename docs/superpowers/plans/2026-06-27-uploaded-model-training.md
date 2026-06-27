# Uploaded Model Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trusted-lab uploaded PyTorch model definitions to the existing model training workflow.

**Architecture:** Store uploaded single-file model definitions as versioned user-owned packages, validate them with static AST checks plus a dummy tensor dry-run, and train them through a platform-owned runner. Official training remains on `demo3.py`; uploaded training uses the same task table, logs, progress parser, loss chart, history, stop/delete, and model-test modal.

**Tech Stack:** FastAPI, SQLAlchemy async SQLite, Pydantic v2, PyTorch, React 19, Vite, Node built-in test runner.

---

## Confirmed Scope

Implement the accepted design in `docs/superpowers/specs/2026-06-27-uploaded-model-training-design.md`.

Version 1 constraints:

- Single `.py` file only.
- User code defines `MODEL_SPEC`, `build_model(config)`, and `torch.nn.Module` classes.
- Platform owns data loading, preprocessing, training loop, logs, metrics, and checkpoint paths.
- No ZIP packages, no user-installed dependencies, no full custom training scripts.
- Trusted lab mode: subprocess isolation and guardrails are required; container isolation is not required.

## File Structure

Backend:

- Modify `AresVision_backend/backend/config.py`
  Add user model upload directory and limits.

- Modify `AresVision_backend/backend/database/models.py`
  Add `UserModelPackage` and add explicit uploaded-model columns to `ModelTrainingTask`.

- Modify `AresVision_backend/backend/database/init_db.py`
  Patch legacy SQLite columns for training tasks and ensure `user_model_packages` table is created.

- Modify `AresVision_backend/backend/schemas/training.py`
  Add `model_source`, `uploaded_model_id`, and `uploaded_model_version` to request/response schemas.

- Create `AresVision_backend/backend/schemas/user_models.py`
  Response schemas for upload/list/detail validation reports.

- Create `AresVision_backend/backend/services/user_model_validator.py`
  Validate extension, size, AST imports/calls, `MODEL_SPEC`, `build_model`, return type, and dummy output shape.

- Create `AresVision_backend/backend/services/user_model_service.py`
  Store files, compute hashes, create/list/detail/revalidate/soft-delete packages, and enforce owner checks.

- Create `AresVision_backend/backend/routers/user_models.py`
  Authenticated upload/list/detail/revalidate/delete endpoints.

- Modify `AresVision_backend/backend/main.py`
  Register the new router and create `USER_MODELS_DIR`.

- Modify `AresVision_backend/backend/services/training_service.py`
  Accept `model_source` and `uploaded_model_id`, validate package ownership/status, route uploaded jobs to `user_model_runner.py`, and preserve official jobs.

- Create `AresVision_backend/backend/training_backbones/user_model_runner.py`
  Training runner for uploaded model definitions with the existing log format.

- Modify `AresVision_backend/backend/services/inference_service.py`
  Support completed uploaded-model tasks in the model test modal by rebuilding the uploaded architecture and loading the saved state dict.

- Create backend tests:
  `AresVision_backend/backend/tests/test_user_model_validator.py`
  `AresVision_backend/backend/tests/test_user_model_service.py`
  `AresVision_backend/backend/tests/test_uploaded_training_contract.py`

Frontend:

- Modify `frontend/src/services/api.js`
  Add user model API helpers and extend `startTrainingTask`.

- Create `frontend/src/pages/ModelTrainingPage/uploadedModelParams.js`
  Normalize schema defaults, sanitize custom params, and validate bounds.

- Create `frontend/src/pages/ModelTrainingPage/uploadedModelParams.test.js`
  Node tests for dynamic parameter handling.

- Create `frontend/src/pages/ModelTrainingPage/ModelSourceSelector.jsx`
  Official/uploaded source segmented control.

- Create `frontend/src/pages/ModelTrainingPage/UploadedModelPanel.jsx`
  Upload control, list, validation report, revalidate and delete actions.

- Create `frontend/src/pages/ModelTrainingPage/DynamicModelParamsForm.jsx`
  Render dynamic controls for uploaded model parameters.

- Modify `frontend/src/pages/ModelTrainingPage.jsx`
  Wire model source, uploaded model list, custom params, start-button gating, and request payload.

Docs:

- Create `docs/uploaded-model-template.py`
  Copy-pasteable lab-user template.

- Create `docs/uploaded-model-training.md`
  Short user-facing guide.

---

## Task 1: Backend Schema, Config, And API Types

**Files:**

- Modify: `AresVision_backend/backend/config.py`
- Modify: `AresVision_backend/backend/database/models.py`
- Modify: `AresVision_backend/backend/database/init_db.py`
- Modify: `AresVision_backend/backend/schemas/training.py`
- Create: `AresVision_backend/backend/schemas/user_models.py`
- Test: `AresVision_backend/backend/tests/test_user_model_schema.py`

- [ ] **Step 1: Write the schema contract test**

Create `AresVision_backend/backend/tests/test_user_model_schema.py`:

```python
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from schemas.training import TrainingStartRequest  # noqa: E402
from schemas.user_models import UserModelPackageResponse, UserModelValidationReport  # noqa: E402


def test_training_start_request_defaults_to_official_model_source():
    request = TrainingStartRequest(
        model_script="demo3.py",
        model_name="baseline",
        hyperparameters={"epochs": 1},
    )

    assert request.model_source == "official"
    assert request.uploaded_model_id is None


def test_training_start_request_accepts_uploaded_model_source():
    request = TrainingStartRequest(
        model_source="uploaded",
        uploaded_model_id="4d24f680-5029-47d9-9890-a56a6247b20e",
        model_script="demo3.py",
        model_name="custom",
        hyperparameters={"custom_model_params": {"hidden_dim": 64}},
    )

    assert request.model_source == "uploaded"
    assert request.uploaded_model_id == "4d24f680-5029-47d9-9890-a56a6247b20e"


def test_user_model_response_shapes_validation_report_and_schema():
    report = UserModelValidationReport(
        ok=True,
        errors=[],
        warnings=["using default hidden_dim"],
        output_shape=[2, 3, 1, 8, 16],
    )
    response = UserModelPackageResponse(
        id="4d24f680-5029-47d9-9890-a56a6247b20e",
        user_id=7,
        display_name="LabModel",
        version=1,
        original_filename="lab_model.py",
        content_hash="a" * 64,
        param_schema={"hidden_dim": {"type": "int", "default": 64, "min": 8, "max": 512}},
        description="demo",
        validation_status="valid",
        validation_report=report,
        created_at="2026-06-27T00:00:00Z",
        updated_at="2026-06-27T00:00:00Z",
    )

    payload = json.loads(response.model_dump_json())
    assert payload["validation_report"]["ok"] is True
    assert payload["param_schema"]["hidden_dim"]["default"] == 64


if __name__ == "__main__":
    test_training_start_request_defaults_to_official_model_source()
    test_training_start_request_accepts_uploaded_model_source()
    test_user_model_response_shapes_validation_report_and_schema()
    print("user model schema tests passed")
```

- [ ] **Step 2: Run the schema test and confirm it fails**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_schema.py
```

Expected: fails because `schemas.user_models` does not exist or `TrainingStartRequest` lacks uploaded-model fields.

- [ ] **Step 3: Add user model config**

Modify `AresVision_backend/backend/config.py` near the upload constants:

```python
USER_MODELS_DIR = DATA_DIR / "user_models"
MAX_USER_MODEL_SIZE_KB = int(os.getenv("MAX_USER_MODEL_SIZE_KB", "256"))
ALLOWED_USER_MODEL_EXTENSIONS = [".py"]
USER_MODEL_TRAINING_TIMEOUT_SECONDS = int(os.getenv("USER_MODEL_TRAINING_TIMEOUT_SECONDS", "7200"))
```

- [ ] **Step 4: Add ORM fields and model package table**

Modify `AresVision_backend/backend/database/models.py`.

Add a relationship on `User`:

```python
    user_model_packages: Mapped[list["UserModelPackage"]] = relationship(
        "UserModelPackage",
        foreign_keys="UserModelPackage.user_id",
        back_populates="owner",
    )
```

Add this model before `ModelTrainingTask`:

```python
class UserModelPackage(Base):
    __tablename__ = "user_model_packages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    param_schema: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    validation_report: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="user_model_packages",
    )

    def __repr__(self) -> str:
        return f"<UserModelPackage id={self.id} name={self.display_name} status={self.validation_status}>"
```

Add explicit columns to `ModelTrainingTask`:

```python
    model_source: Mapped[str] = mapped_column(String(20), nullable=False, default="official")
    uploaded_model_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("user_model_packages.id"), nullable=True)
    uploaded_model_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

Add relationship:

```python
    uploaded_model: Mapped["UserModelPackage | None"] = relationship(
        "UserModelPackage",
        foreign_keys=[uploaded_model_id],
    )
```

- [ ] **Step 5: Patch legacy SQLite columns**

Modify `AresVision_backend/backend/database/init_db.py`.

Import `UserModelPackage` in the model import block:

```python
    UserModelPackage,
```

Extend `_patch_training_table_columns`:

```python
        ("model_source", "VARCHAR(20) DEFAULT 'official'"),
        ("uploaded_model_id", "VARCHAR(36)"),
        ("uploaded_model_version", "INTEGER"),
```

- [ ] **Step 6: Add Pydantic schemas**

Create `AresVision_backend/backend/schemas/user_models.py`:

```python
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class UserModelValidationReport(BaseModel):
    ok: bool = False
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    output_shape: list[int] | None = None


class UserModelPackageResponse(BaseModel):
    id: str
    user_id: int
    display_name: str
    version: int
    original_filename: str
    content_hash: str
    param_schema: dict[str, Any]
    description: str | None = None
    validation_status: str
    validation_report: UserModelValidationReport
    created_at: str
    updated_at: str


class UserModelListResponse(BaseModel):
    items: list[UserModelPackageResponse]
```

- [ ] **Step 7: Extend training schemas**

Modify `AresVision_backend/backend/schemas/training.py`.

Add fields to `TrainingStartRequest`:

```python
    model_source: str = Field(default="official", description="official | uploaded")
    uploaded_model_id: Optional[str] = Field(default=None, description="Validated uploaded model package id")
```

Add fields to `TrainingTaskResponse`:

```python
    model_source: str = "official"
    uploaded_model_id: Optional[str] = None
    uploaded_model_version: Optional[int] = None
```

- [ ] **Step 8: Run the schema test and commit**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_schema.py
```

Expected: `user model schema tests passed`.

Commit:

```powershell
git add AresVision_backend\backend\config.py AresVision_backend\backend\database\models.py AresVision_backend\backend\database\init_db.py AresVision_backend\backend\schemas\training.py AresVision_backend\backend\schemas\user_models.py AresVision_backend\backend\tests\test_user_model_schema.py
git commit -m "feat: add uploaded model schema"
```

---

## Task 2: Uploaded Model Validator

**Files:**

- Create: `AresVision_backend/backend/services/user_model_validator.py`
- Test: `AresVision_backend/backend/tests/test_user_model_validator.py`

- [ ] **Step 1: Write validator tests**

Create `AresVision_backend/backend/tests/test_user_model_validator.py`:

```python
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.user_model_validator import UserModelValidator  # noqa: E402


VALID_MODEL = '''
import torch
from torch import nn

MODEL_SPEC = {
    "name": "TinyModel",
    "description": "valid tiny model",
    "parameters": {
        "hidden_dim": {"type": "int", "default": 8, "min": 4, "max": 32},
        "dropout": {"type": "float", "default": 0.1, "min": 0.0, "max": 0.9},
        "use_bias": {"type": "bool", "default": True},
        "activation": {"type": "select", "default": "relu", "options": ["relu", "gelu"]},
    },
}

class TinyModel(nn.Module):
    def __init__(self, horizon):
        super().__init__()
        self.horizon = horizon
        self.proj = nn.Conv2d(1, 1, kernel_size=1)

    def forward(self, x):
        last_o3 = x[:, -1, :1]
        y = self.proj(last_o3)
        return y.unsqueeze(1).repeat(1, self.horizon, 1, 1, 1)

def build_model(config):
    return TinyModel(config["horizon"])
'''


def write_model(tmpdir, name, source):
    path = Path(tmpdir) / name
    path.write_text(source, encoding="utf-8")
    return path


def test_valid_model_passes_ast_schema_and_dry_run():
    with tempfile.TemporaryDirectory() as tmp:
        path = write_model(tmp, "valid_model.py", VALID_MODEL)
        result = UserModelValidator().validate_file(path)

    assert result.ok is True
    assert result.display_name == "TinyModel"
    assert result.param_schema["hidden_dim"]["default"] == 8
    assert result.output_shape == [2, 3, 1, 8, 16]


def test_disallowed_import_fails_before_import():
    source = VALID_MODEL.replace("import torch", "import os\\nimport torch")
    with tempfile.TemporaryDirectory() as tmp:
        path = write_model(tmp, "bad_import.py", source)
        result = UserModelValidator().validate_file(path)

    assert result.ok is False
    assert any("Disallowed import: os" in error for error in result.errors)


def test_missing_model_spec_fails():
    source = VALID_MODEL.replace("MODEL_SPEC", "MODEL_INFO", 1)
    with tempfile.TemporaryDirectory() as tmp:
        path = write_model(tmp, "missing_spec.py", source)
        result = UserModelValidator().validate_file(path)

    assert result.ok is False
    assert any("MODEL_SPEC" in error for error in result.errors)


def test_bad_output_shape_fails():
    source = VALID_MODEL.replace(
        "return y.unsqueeze(1).repeat(1, self.horizon, 1, 1, 1)",
        "return y",
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = write_model(tmp, "bad_shape.py", source)
        result = UserModelValidator().validate_file(path)

    assert result.ok is False
    assert any("output shape" in error.lower() for error in result.errors)


def test_invalid_param_schema_fails():
    source = VALID_MODEL.replace('"min": 4, "max": 32', '"min": 64, "max": 32')
    with tempfile.TemporaryDirectory() as tmp:
        path = write_model(tmp, "bad_schema.py", source)
        result = UserModelValidator().validate_file(path)

    assert result.ok is False
    assert any("hidden_dim" in error for error in result.errors)


if __name__ == "__main__":
    test_valid_model_passes_ast_schema_and_dry_run()
    test_disallowed_import_fails_before_import()
    test_missing_model_spec_fails()
    test_bad_output_shape_fails()
    test_invalid_param_schema_fails()
    print("user model validator tests passed")
```

- [ ] **Step 2: Run the validator test and confirm it fails**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_validator.py
```

Expected: fails because `services.user_model_validator` does not exist.

- [ ] **Step 3: Implement the validator**

Create `AresVision_backend/backend/services/user_model_validator.py`:

```python
from __future__ import annotations

import ast
import importlib.util
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import torch
from torch import nn

from config import MAX_USER_MODEL_SIZE_KB


ALLOWED_IMPORT_ROOTS = {"torch", "numpy"}
DISALLOWED_CALLS = {"open", "eval", "exec", "compile", "__import__"}
DISALLOWED_IMPORT_ROOTS = {"os", "sys", "subprocess", "socket", "requests", "urllib", "pathlib", "shutil"}
EXPECTED_DRY_RUN_SHAPE = [2, 3, 1, 8, 16]


@dataclass
class UserModelValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    display_name: str | None = None
    description: str | None = None
    param_schema: dict[str, Any] = field(default_factory=dict)
    output_shape: list[int] | None = None

    def report_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "errors": self.errors,
            "warnings": self.warnings,
            "output_shape": self.output_shape,
        }


class UserModelValidator:
    def validate_file(self, file_path: Path) -> UserModelValidationResult:
        path = Path(file_path)
        errors: list[str] = []
        warnings: list[str] = []

        if path.suffix.lower() != ".py":
            return UserModelValidationResult(ok=False, errors=[f"Only .py files are supported: {path.name}"])
        if path.stat().st_size > MAX_USER_MODEL_SIZE_KB * 1024:
            return UserModelValidationResult(
                ok=False,
                errors=[f"File is larger than {MAX_USER_MODEL_SIZE_KB} KB"],
            )

        source = path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            return UserModelValidationResult(ok=False, errors=[f"Python syntax error: {exc}"])

        errors.extend(self._validate_ast(tree))
        if errors:
            return UserModelValidationResult(ok=False, errors=errors, warnings=warnings)

        try:
            module = self._import_module(path)
        except Exception as exc:
            return UserModelValidationResult(ok=False, errors=[f"Import failed: {exc}"], warnings=warnings)

        if not hasattr(module, "MODEL_SPEC"):
            return UserModelValidationResult(ok=False, errors=["Missing required MODEL_SPEC"], warnings=warnings)
        if not hasattr(module, "build_model"):
            return UserModelValidationResult(ok=False, errors=["Missing required build_model(config)"], warnings=warnings)

        spec = getattr(module, "MODEL_SPEC")
        spec_errors, display_name, description, param_schema = self._normalize_model_spec(spec)
        if spec_errors:
            return UserModelValidationResult(ok=False, errors=spec_errors, warnings=warnings)

        config = {
            "in_channels": 1,
            "window": 3,
            "horizon": 3,
            "height": 8,
            "width": 16,
            "selected_channels": [],
            **{key: field_spec["default"] for key, field_spec in param_schema.items()},
        }

        try:
            model = module.build_model(config)
        except Exception as exc:
            return UserModelValidationResult(ok=False, errors=[f"build_model failed: {exc}"], warnings=warnings)

        if not isinstance(model, nn.Module):
            return UserModelValidationResult(
                ok=False,
                errors=["build_model(config) must return torch.nn.Module"],
                warnings=warnings,
            )

        try:
            model.eval()
            with torch.no_grad():
                output = model(torch.zeros(2, 3, 1, 8, 16))
        except Exception as exc:
            return UserModelValidationResult(ok=False, errors=[f"Dry-run forward failed: {exc}"], warnings=warnings)

        output_shape = list(output.shape)
        if output_shape != EXPECTED_DRY_RUN_SHAPE:
            return UserModelValidationResult(
                ok=False,
                errors=[f"Dry-run output shape must be {EXPECTED_DRY_RUN_SHAPE}, got {output_shape}"],
                warnings=warnings,
                output_shape=output_shape,
            )

        return UserModelValidationResult(
            ok=True,
            errors=[],
            warnings=warnings,
            display_name=display_name,
            description=description,
            param_schema=param_schema,
            output_shape=output_shape,
        )

    def _validate_ast(self, tree: ast.AST) -> list[str]:
        errors: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root = alias.name.split(".", 1)[0]
                    if root in DISALLOWED_IMPORT_ROOTS:
                        errors.append(f"Disallowed import: {alias.name}")
                    elif root not in ALLOWED_IMPORT_ROOTS:
                        errors.append(f"Unsupported import: {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                root = (node.module or "").split(".", 1)[0]
                if root in DISALLOWED_IMPORT_ROOTS:
                    errors.append(f"Disallowed import: {node.module}")
                elif root not in ALLOWED_IMPORT_ROOTS:
                    errors.append(f"Unsupported import: {node.module}")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in DISALLOWED_CALLS:
                    errors.append(f"Disallowed call: {node.func.id}")
                if isinstance(node.func, ast.Attribute) and node.func.attr in {"system", "popen", "Popen", "run"}:
                    errors.append(f"Disallowed call: {node.func.attr}")
        return errors

    def _import_module(self, path: Path):
        module_name = f"aresvision_user_model_{uuid.uuid4().hex}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load module spec for {path}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
            return module
        finally:
            sys.modules.pop(module_name, None)

    def _normalize_model_spec(self, spec: Any) -> tuple[list[str], str | None, str | None, dict[str, Any]]:
        if not isinstance(spec, dict):
            return ["MODEL_SPEC must be a dict"], None, None, {}
        name = str(spec.get("name") or "").strip()
        if not name:
            return ["MODEL_SPEC.name is required"], None, None, {}
        description = spec.get("description")
        if description is not None:
            description = str(description)
        raw_params = spec.get("parameters", {})
        if raw_params is None:
            raw_params = {}
        if not isinstance(raw_params, dict):
            return ["MODEL_SPEC.parameters must be a dict"], None, None, {}

        normalized: dict[str, Any] = {}
        errors: list[str] = []
        for key, value in raw_params.items():
            field_key = str(key).strip()
            if not field_key.isidentifier():
                errors.append(f"Invalid parameter name: {field_key}")
                continue
            if not isinstance(value, dict):
                errors.append(f"{field_key} schema must be a dict")
                continue
            field_type = value.get("type")
            if field_type not in {"int", "float", "bool", "select"}:
                errors.append(f"{field_key} has unsupported type: {field_type}")
                continue
            if "default" not in value:
                errors.append(f"{field_key} must define a default")
                continue
            if field_type in {"int", "float"}:
                if "min" not in value or "max" not in value:
                    errors.append(f"{field_key} numeric schema must define min and max")
                    continue
                minimum = value["min"]
                maximum = value["max"]
                default = value["default"]
                if not isinstance(minimum, (int, float)) or not isinstance(maximum, (int, float)):
                    errors.append(f"{field_key} min and max must be numeric")
                    continue
                if minimum > maximum:
                    errors.append(f"{field_key} min must be <= max")
                    continue
                if not isinstance(default, (int, float)) or default < minimum or default > maximum:
                    errors.append(f"{field_key} default must be within min and max")
                    continue
                normalized[field_key] = {
                    "type": field_type,
                    "default": int(default) if field_type == "int" else float(default),
                    "min": int(minimum) if field_type == "int" else float(minimum),
                    "max": int(maximum) if field_type == "int" else float(maximum),
                }
            elif field_type == "bool":
                if not isinstance(value["default"], bool):
                    errors.append(f"{field_key} bool default must be true or false")
                    continue
                normalized[field_key] = {"type": "bool", "default": value["default"]}
            elif field_type == "select":
                options = value.get("options")
                default = value["default"]
                if not isinstance(options, list) or not options:
                    errors.append(f"{field_key} select schema must define non-empty options")
                    continue
                if default not in options:
                    errors.append(f"{field_key} default must be one of options")
                    continue
                normalized[field_key] = {"type": "select", "default": default, "options": options}

        return errors, name, description, normalized
```

- [ ] **Step 4: Run the validator test and commit**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_validator.py
```

Expected: `user model validator tests passed`.

Commit:

```powershell
git add AresVision_backend\backend\services\user_model_validator.py AresVision_backend\backend\tests\test_user_model_validator.py
git commit -m "feat: validate uploaded model definitions"
```

---

## Task 3: User Model Service And Router

**Files:**

- Create: `AresVision_backend/backend/services/user_model_service.py`
- Create: `AresVision_backend/backend/routers/user_models.py`
- Modify: `AresVision_backend/backend/main.py`
- Test: `AresVision_backend/backend/tests/test_user_model_service.py`

- [ ] **Step 1: Write service tests with a temporary database and upload dir**

Create `AresVision_backend/backend/tests/test_user_model_service.py`:

```python
import asyncio
import sys
import tempfile
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.engine import Base  # noqa: E402
from database.models import User  # noqa: E402
from services.user_model_service import UserModelService  # noqa: E402


VALID_MODEL = '''
import torch
from torch import nn

MODEL_SPEC = {
    "name": "StoredTiny",
    "parameters": {
        "hidden_dim": {"type": "int", "default": 8, "min": 4, "max": 32}
    },
}

class StoredTiny(nn.Module):
    def __init__(self, horizon):
        super().__init__()
        self.horizon = horizon

    def forward(self, x):
        return x[:, -1:, :1].repeat(1, self.horizon, 1, 1, 1)

def build_model(config):
    return StoredTiny(config["horizon"])
'''


async def make_sessionmaker(db_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return async_sessionmaker(engine, expire_on_commit=False)


async def test_service_creates_lists_revalidates_and_soft_deletes_model():
    with tempfile.TemporaryDirectory() as tmp:
        sessionmaker = await make_sessionmaker(Path(tmp) / "service.db")
        upload_root = Path(tmp) / "models"
        service = UserModelService(storage_root=upload_root, sessionmaker=sessionmaker)

        async with sessionmaker() as session:
            user = User(email="lab@example.com", username="Lab", password_hash="x")
            session.add(user)
            await session.commit()
            await session.refresh(user)
            user_id = user.id

        package = await service.create_from_source(
            user_id=user_id,
            original_filename="stored_tiny.py",
            source=VALID_MODEL.encode("utf-8"),
        )

        assert package.validation_status == "valid"
        assert Path(package.storage_path).exists()
        assert package.version == 1

        listed = await service.list_user_packages(user_id)
        assert [item.id for item in listed] == [package.id]

        revalidated = await service.revalidate_package(package.id, user_id)
        assert revalidated.validation_status == "valid"

        await service.soft_delete_package(package.id, user_id)
        assert await service.list_user_packages(user_id) == []


async def test_service_rejects_non_owner_access():
    with tempfile.TemporaryDirectory() as tmp:
        sessionmaker = await make_sessionmaker(Path(tmp) / "owner.db")
        service = UserModelService(storage_root=Path(tmp), sessionmaker=sessionmaker)
        async with sessionmaker() as session:
            owner = User(email="owner@example.com", username="Owner", password_hash="x")
            other = User(email="other@example.com", username="Other", password_hash="x")
            session.add_all([owner, other])
            await session.commit()
            await session.refresh(owner)
            await session.refresh(other)
            owner_id = owner.id
            other_id = other.id

        package = await service.create_from_source(
            user_id=owner_id,
            original_filename="stored_tiny.py",
            source=VALID_MODEL.encode("utf-8"),
        )

        try:
            await service.get_package_for_user(package.id, other_id)
        except PermissionError:
            pass
        else:
            raise AssertionError("Expected PermissionError")


if __name__ == "__main__":
    asyncio.run(test_service_creates_lists_revalidates_and_soft_deletes_model())
    asyncio.run(test_service_rejects_non_owner_access())
    print("user model service tests passed")
```

- [ ] **Step 2: Run service tests and confirm they fail**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_service.py
```

Expected: fails because `services.user_model_service` does not exist.

- [ ] **Step 3: Implement the service**

Create `AresVision_backend/backend/services/user_model_service.py`:

```python
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select

from config import USER_MODELS_DIR
from database.engine import async_session_maker
from database.models import UserModelPackage
from services.user_model_validator import UserModelValidator


class UserModelService:
    def __init__(self, storage_root: Path | None = None, sessionmaker=None, validator: UserModelValidator | None = None):
        self.storage_root = Path(storage_root or USER_MODELS_DIR)
        self.sessionmaker = sessionmaker or async_session_maker
        self.validator = validator or UserModelValidator()
        self.storage_root.mkdir(parents=True, exist_ok=True)

    async def create_from_source(self, user_id: int, original_filename: str, source: bytes) -> UserModelPackage:
        package_id = str(uuid.uuid4())
        safe_name = self._safe_filename(original_filename)
        package_dir = self.storage_root / str(user_id)
        package_dir.mkdir(parents=True, exist_ok=True)
        storage_path = package_dir / f"{package_id}_{safe_name}"
        storage_path.write_bytes(source)

        result = self.validator.validate_file(storage_path)
        display_name = result.display_name or Path(original_filename).stem
        content_hash = hashlib.sha256(source).hexdigest()
        version = await self._next_version(user_id, display_name)

        package = UserModelPackage(
            id=package_id,
            user_id=user_id,
            display_name=display_name,
            version=version,
            original_filename=original_filename,
            storage_path=str(storage_path),
            content_hash=content_hash,
            param_schema=json.dumps(result.param_schema),
            description=result.description,
            validation_status="valid" if result.ok else "invalid",
            validation_report=json.dumps(result.report_dict()),
        )

        async with self.sessionmaker() as session:
            session.add(package)
            await session.commit()
            await session.refresh(package)
            return package

    async def list_user_packages(self, user_id: int) -> list[UserModelPackage]:
        async with self.sessionmaker() as session:
            result = await session.execute(
                select(UserModelPackage)
                .where(UserModelPackage.user_id == user_id, UserModelPackage.deleted_at.is_(None))
                .order_by(UserModelPackage.created_at.desc())
            )
            return list(result.scalars().all())

    async def get_package_for_user(self, package_id: str, user_id: int) -> UserModelPackage:
        async with self.sessionmaker() as session:
            package = await session.get(UserModelPackage, package_id)
            if package is None or package.deleted_at is not None:
                raise FileNotFoundError("Uploaded model not found")
            if package.user_id != user_id:
                raise PermissionError("No permission to access this uploaded model")
            return package

    async def revalidate_package(self, package_id: str, user_id: int) -> UserModelPackage:
        async with self.sessionmaker() as session:
            package = await session.get(UserModelPackage, package_id)
            if package is None or package.deleted_at is not None:
                raise FileNotFoundError("Uploaded model not found")
            if package.user_id != user_id:
                raise PermissionError("No permission to access this uploaded model")

            result = self.validator.validate_file(Path(package.storage_path))
            package.validation_status = "valid" if result.ok else "invalid"
            package.validation_report = json.dumps(result.report_dict())
            package.param_schema = json.dumps(result.param_schema)
            package.description = result.description
            package.updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(package)
            return package

    async def soft_delete_package(self, package_id: str, user_id: int) -> None:
        async with self.sessionmaker() as session:
            package = await session.get(UserModelPackage, package_id)
            if package is None or package.deleted_at is not None:
                raise FileNotFoundError("Uploaded model not found")
            if package.user_id != user_id:
                raise PermissionError("No permission to delete this uploaded model")
            package.deleted_at = datetime.now(timezone.utc)
            package.updated_at = datetime.now(timezone.utc)
            await session.commit()

    async def _next_version(self, user_id: int, display_name: str) -> int:
        async with self.sessionmaker() as session:
            result = await session.execute(
                select(func.max(UserModelPackage.version)).where(
                    UserModelPackage.user_id == user_id,
                    UserModelPackage.display_name == display_name,
                )
            )
            current = result.scalar_one_or_none()
            return int(current or 0) + 1

    def _safe_filename(self, original_filename: str) -> str:
        name = Path(original_filename or "model.py").name
        name = re.sub(r"[^A-Za-z0-9_.-]", "_", name)
        if not name.endswith(".py"):
            name = f"{name}.py"
        return name
```

- [ ] **Step 4: Implement the router**

Create `AresVision_backend/backend/routers/user_models.py`:

```python
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from auth.dependencies import get_current_user
from database.models import User, UserModelPackage
from schemas.user_models import UserModelListResponse, UserModelPackageResponse, UserModelValidationReport
from services.user_model_service import UserModelService

router = APIRouter(prefix="/user-models", tags=["User Models"])


def _service(request: Request) -> UserModelService:
    service = getattr(request.app.state, "user_model_service", None)
    return service or UserModelService()


def _serialize_package(package: UserModelPackage) -> UserModelPackageResponse:
    report = json.loads(package.validation_report or "{}")
    return UserModelPackageResponse(
        id=package.id,
        user_id=package.user_id,
        display_name=package.display_name,
        version=package.version,
        original_filename=package.original_filename,
        content_hash=package.content_hash,
        param_schema=json.loads(package.param_schema or "{}"),
        description=package.description,
        validation_status=package.validation_status,
        validation_report=UserModelValidationReport(**report),
        created_at=package.created_at.isoformat(),
        updated_at=package.updated_at.isoformat(),
    )


@router.post("", response_model=UserModelPackageResponse)
async def upload_user_model(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not (file.filename or "").lower().endswith(".py"):
        raise HTTPException(status_code=400, detail="Only .py model files are supported")
    try:
        source = await file.read()
        package = await _service(request).create_from_source(
            user_id=current_user.id,
            original_filename=file.filename or "model.py",
            source=source,
        )
        return _serialize_package(package)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("", response_model=UserModelListResponse)
async def list_user_models(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    packages = await _service(request).list_user_packages(current_user.id)
    return UserModelListResponse(items=[_serialize_package(package) for package in packages])


@router.get("/{model_id}", response_model=UserModelPackageResponse)
async def get_user_model(
    model_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    try:
        package = await _service(request).get_package_for_user(model_id, current_user.id)
        return _serialize_package(package)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.post("/{model_id}/validate", response_model=UserModelPackageResponse)
async def revalidate_user_model(
    model_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    try:
        package = await _service(request).revalidate_package(model_id, current_user.id)
        return _serialize_package(package)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/{model_id}")
async def delete_user_model(
    model_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    try:
        await _service(request).soft_delete_package(model_id, current_user.id)
        return {"status": "success", "message": "Uploaded model deleted"}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
```

- [ ] **Step 5: Register the service and router**

Modify `AresVision_backend/backend/main.py`.

Add imports:

```python
from config import API_PREFIX, USER_UPLOADS_DIR, PENDING_REVIEW_DIR, USER_MODELS_DIR
from services.user_model_service import UserModelService
from routers import user_models as user_models_router_module
```

Inside `lifespan`, immediately after the existing upload directory initialization:

```python
    USER_MODELS_DIR.mkdir(parents=True, exist_ok=True)
```

That block should sit next to:

```python
    USER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
```

Then, immediately after:

```python
    upload_service = UploadService(data_service)
    app.state.upload_service = upload_service
```

add:

```python
    app.state.user_model_service = UserModelService(storage_root=USER_MODELS_DIR)
```

Register the router near other routers:

```python
app.include_router(user_models_router_module.router, prefix=API_PREFIX)
```

- [ ] **Step 6: Run service tests and commit**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_service.py
```

Expected: `user model service tests passed`.

Commit:

```powershell
git add AresVision_backend\backend\services\user_model_service.py AresVision_backend\backend\routers\user_models.py AresVision_backend\backend\main.py AresVision_backend\backend\tests\test_user_model_service.py
git commit -m "feat: add uploaded model API"
```

---

## Task 4: Training Service Contract For Uploaded Models

**Files:**

- Modify: `AresVision_backend/backend/services/training_service.py`
- Modify: `AresVision_backend/backend/routers/training.py`
- Test: `AresVision_backend/backend/tests/test_uploaded_training_contract.py`

- [ ] **Step 1: Write training contract tests**

Create `AresVision_backend/backend/tests/test_uploaded_training_contract.py`:

```python
import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.training_service import TrainingService  # noqa: E402


class FakePackage:
    id = "4d24f680-5029-47d9-9890-a56a6247b20e"
    user_id = 3
    version = 2
    validation_status = "valid"
    storage_path = "D:/tmp/model.py"
    param_schema = json.dumps({"hidden_dim": {"type": "int", "default": 8, "min": 4, "max": 32}})


class FakeUserModelService:
    async def get_package_for_user(self, package_id, user_id):
        assert package_id == FakePackage.id
        assert user_id == 3
        return FakePackage()


def test_build_training_command_uses_official_demo3_for_official_source():
    service = TrainingService()
    script_name, hypers = service._resolve_training_entrypoint(
        user_id=3,
        model_source="official",
        uploaded_model_id=None,
        hyperparameters={"epochs": 1},
        user_model_service=None,
    )

    assert script_name == "demo3.py"
    assert hypers["model_source"] == "official"


async def test_build_training_command_uses_uploaded_runner_and_records_model_identity():
    service = TrainingService()
    script_name, hypers = await service._resolve_uploaded_training_entrypoint(
        user_id=3,
        uploaded_model_id=FakePackage.id,
        hyperparameters={"custom_model_params": {"hidden_dim": 16}},
        user_model_service=FakeUserModelService(),
    )

    assert script_name == "__user_model_runner__"
    assert hypers["_uploaded_model_id"] == FakePackage.id
    assert hypers["_uploaded_model_version"] == 2
    assert hypers["_uploaded_model_path"] == "D:/tmp/model.py"
    assert hypers["custom_model_params"]["hidden_dim"] == 16


if __name__ == "__main__":
    test_build_training_command_uses_official_demo3_for_official_source()
    asyncio.run(test_build_training_command_uses_uploaded_runner_and_records_model_identity())
    print("uploaded training contract tests passed")
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run:

```powershell
python AresVision_backend\backend\tests\test_uploaded_training_contract.py
```

Expected: fails because helper methods do not exist.

- [ ] **Step 3: Update training route to pass uploaded model fields**

Modify `AresVision_backend/backend/routers/training.py` in `start_training`:

```python
            model_source=req.model_source,
            uploaded_model_id=req.uploaded_model_id,
            user_model_service=getattr(request.app.state, "user_model_service", None),
```

- [ ] **Step 4: Extend `TrainingService.start_training` signature**

Modify `AresVision_backend/backend/services/training_service.py`:

```python
        model_source: str = "official",
        uploaded_model_id: str | None = None,
        user_model_service: Any | None = None,
```

Normalize source near the current `model_script = UNIFIED_TRAINING_SCRIPT` logic:

```python
        model_source = (model_source or "official").strip().lower()
        if model_source not in ("official", "uploaded"):
            model_source = "official"
```

Move the current official script existence check so it happens after entrypoint resolution. The official branch should still raise if `MODELS_DIR / "demo3.py"` is missing; the uploaded branch should check that `training_backbones/user_model_runner.py` exists instead. Do not check `MODELS_DIR / "__user_model_runner__"`.

- [ ] **Step 5: Add entrypoint resolution helpers**

Add these methods to `TrainingService`:

```python
    def _resolve_training_entrypoint(
        self,
        user_id: int | None,
        model_source: str,
        uploaded_model_id: str | None,
        hyperparameters: dict,
        user_model_service: Any | None,
    ) -> tuple[str, dict]:
        payload = dict(hyperparameters or {})
        payload["model_source"] = "official"
        return UNIFIED_TRAINING_SCRIPT, payload

    async def _resolve_uploaded_training_entrypoint(
        self,
        user_id: int | None,
        uploaded_model_id: str | None,
        hyperparameters: dict,
        user_model_service: Any | None,
    ) -> tuple[str, dict]:
        if not uploaded_model_id:
            raise ValueError("uploaded_model_id is required for uploaded model training")
        if user_id is None:
            raise ValueError("Uploaded model training requires a user")
        if user_model_service is None:
            raise ValueError("Uploaded model service is unavailable")

        package = await user_model_service.get_package_for_user(uploaded_model_id, user_id)
        if package.validation_status != "valid":
            raise ValueError("Uploaded model must pass validation before training")

        payload = dict(hyperparameters or {})
        payload["model_source"] = "uploaded"
        payload["_uploaded_model_id"] = package.id
        payload["_uploaded_model_version"] = package.version
        payload["_uploaded_model_path"] = package.storage_path
        payload["_uploaded_model_param_schema"] = json.loads(package.param_schema or "{}")
        payload.setdefault("custom_model_params", {})
        return "__user_model_runner__", payload
```

- [ ] **Step 6: Route task creation to the selected entrypoint**

Inside `start_training`, after source/data-source normalization and before `normalize_training_hyperparameters`, add:

```python
        if model_source == "uploaded":
            model_script, raw_hypers = await self._resolve_uploaded_training_entrypoint(
                user_id=user_id,
                uploaded_model_id=uploaded_model_id,
                hyperparameters=hyperparameters,
                user_model_service=user_model_service,
            )
        else:
            model_script, raw_hypers = self._resolve_training_entrypoint(
                user_id=user_id,
                model_source=model_source,
                uploaded_model_id=uploaded_model_id,
                hyperparameters=hyperparameters,
                user_model_service=user_model_service,
            )
```

Then normalize `raw_hypers`:

```python
        payload_hypers = normalize_training_hyperparameters(raw_hypers)
```

After normalization, preserve uploaded private fields:

```python
        for private_key in (
            "_uploaded_model_id",
            "_uploaded_model_version",
            "_uploaded_model_path",
            "_uploaded_model_param_schema",
            "custom_model_params",
            "model_source",
        ):
            if private_key in raw_hypers:
                payload_hypers[private_key] = raw_hypers[private_key]
```

When constructing `ModelTrainingTask`, set:

```python
                model_source=model_source,
                uploaded_model_id=payload_hypers.get("_uploaded_model_id"),
                uploaded_model_version=payload_hypers.get("_uploaded_model_version"),
```

- [ ] **Step 7: Teach subprocess launcher about the uploaded runner**

In `_run_training_subprocess`, replace:

```python
        script_path = MODELS_DIR / script_name
```

with:

```python
        if script_name == "__user_model_runner__":
            script_path = Path(__file__).parent.parent / "training_backbones" / "user_model_runner.py"
        else:
            script_path = MODELS_DIR / script_name
```

After the existing line that extends args with `build_hyperparameter_args(hyperparameters)`, append uploaded-runner private paths explicitly because `build_hyperparameter_args` intentionally skips underscore-prefixed keys:

```python
        if script_name == "__user_model_runner__":
            args.extend([
                "--uploaded_model_path",
                str(hyperparameters["_uploaded_model_path"]),
                "--uploaded_model_param_schema",
                json.dumps(hyperparameters.get("_uploaded_model_param_schema", {})),
            ])
```

Keep `args` as a list. Do not use shell execution.

- [ ] **Step 8: Run contract and existing channel tests**

Run:

```powershell
python AresVision_backend\backend\tests\test_uploaded_training_contract.py
python AresVision_backend\backend\tests\test_training_channels.py
```

Expected:

```text
uploaded training contract tests passed
backend unified training channel tests passed
```

Commit:

```powershell
git add AresVision_backend\backend\services\training_service.py AresVision_backend\backend\routers\training.py AresVision_backend\backend\tests\test_uploaded_training_contract.py
git commit -m "feat: route uploaded model training tasks"
```

---

## Task 5: Uploaded Model Runner And Model Test Support

**Files:**

- Create: `AresVision_backend/backend/training_backbones/user_model_runner.py`
- Modify: `AresVision_backend/backend/services/inference_service.py`
- Test: `AresVision_backend/backend/tests/test_uploaded_model_runner.py`

- [ ] **Step 1: Write runner helper tests**

Create `AresVision_backend/backend/tests/test_uploaded_model_runner.py`:

```python
import json
import sys
import tempfile
from pathlib import Path

import torch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from training_backbones.user_model_runner import (  # noqa: E402
    build_uploaded_model_config,
    load_uploaded_model,
    parse_json_arg,
)


VALID_MODEL = '''
from torch import nn

MODEL_SPEC = {
    "name": "RunnerTiny",
    "parameters": {
        "hidden_dim": {"type": "int", "default": 8, "min": 4, "max": 32}
    },
}

class RunnerTiny(nn.Module):
    def __init__(self, horizon):
        super().__init__()
        self.horizon = horizon

    def forward(self, x):
        return x[:, -1:, :1].repeat(1, self.horizon, 1, 1, 1)

def build_model(config):
    return RunnerTiny(config["horizon"])
'''


def test_parse_json_arg_handles_dict_and_json_string():
    assert parse_json_arg({"hidden_dim": 16}) == {"hidden_dim": 16}
    assert parse_json_arg('{"hidden_dim": 16}') == {"hidden_dim": 16}
    assert parse_json_arg("") == {}


def test_build_uploaded_model_config_merges_core_and_custom_params():
    config = build_uploaded_model_config(
        in_channels=3,
        window=4,
        horizon=2,
        height=36,
        width=72,
        selected_channels=["U", "D"],
        custom_model_params={"hidden_dim": 16},
        param_schema={"hidden_dim": {"type": "int", "default": 8, "min": 4, "max": 32}},
    )

    assert config["in_channels"] == 3
    assert config["selected_channels"] == ["U", "D"]
    assert config["hidden_dim"] == 16


def test_load_uploaded_model_returns_module_with_expected_forward_shape():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "runner_tiny.py"
        path.write_text(VALID_MODEL, encoding="utf-8")
        model = load_uploaded_model(path, {
            "in_channels": 1,
            "window": 3,
            "horizon": 3,
            "height": 8,
            "width": 16,
            "selected_channels": [],
            "hidden_dim": 8,
        })

    output = model(torch.zeros(2, 3, 1, 8, 16))
    assert list(output.shape) == [2, 3, 1, 8, 16]


if __name__ == "__main__":
    test_parse_json_arg_handles_dict_and_json_string()
    test_build_uploaded_model_config_merges_core_and_custom_params()
    test_load_uploaded_model_returns_module_with_expected_forward_shape()
    print("uploaded model runner tests passed")
```

- [ ] **Step 2: Run runner tests and confirm they fail**

Run:

```powershell
python AresVision_backend\backend\tests\test_uploaded_model_runner.py
```

Expected: fails because `training_backbones.user_model_runner` does not exist.

- [ ] **Step 3: Create runner helper functions and CLI shell**

Create `AresVision_backend/backend/training_backbones/user_model_runner.py`.

The file must include these helpers exactly because tests and inference reuse them:

```python
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

import netCDF4 as nc
import numpy as np
import torch
import torch.nn as nn
from scipy.interpolate import interp1d
from sklearn.metrics import mean_squared_error, r2_score
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
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        return dict(value)
    try:
        parsed = json.loads(str(value))
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_selected_channels(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw = [item.strip().upper() for item in value.replace("+", ",").split(",")]
    else:
        raw = [str(item).strip().upper() for item in value]
    selected = set(raw)
    return [channel for channel in CHANNEL_ORDER if channel in selected]


def build_uploaded_model_config(
    in_channels: int,
    window: int,
    horizon: int,
    height: int,
    width: int,
    selected_channels: list[str],
    custom_model_params: dict[str, Any],
    param_schema: dict[str, Any],
) -> dict[str, Any]:
    config = {
        "in_channels": in_channels,
        "window": window,
        "horizon": horizon,
        "height": height,
        "width": width,
        "selected_channels": selected_channels,
    }
    for key, schema in (param_schema or {}).items():
        value = custom_model_params.get(key, schema.get("default"))
        config[key] = value
    return config


def load_uploaded_model(model_path: Path, config: dict[str, Any]) -> nn.Module:
    module_name = f"aresvision_uploaded_runner_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, model_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load uploaded model from {model_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
        model = module.build_model(config)
    finally:
        sys.modules.pop(module_name, None)
    if not isinstance(model, nn.Module):
        raise TypeError("build_model(config) must return torch.nn.Module")
    return model
```

- [ ] **Step 4: Add data prep and training loop**

Continue in `user_model_runner.py` with platform-owned data prep. Reuse the logic from `demo3.py`:

```python
def natural_sort_key(value):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split("([0-9]+)", str(value))]


def unwrap_ls(ls_in):
    out = np.copy(ls_in)
    offset = 0
    for idx in range(1, len(out)):
        if ls_in[idx] < ls_in[idx - 1] - 180:
            offset += 360
        out[idx] += offset
    return out


def prepare_tensors(openmars_dir, mcd_dir, selected_channels, window, horizon):
    o3_list, om_ls_list = [], []
    for file_path in sorted(Path(openmars_dir).glob("*.nc"), key=natural_sort_key):
        with nc.Dataset(file_path) as ds:
            o3_list.append(ds.variables["o3col"][:])
            ls_var = ds.variables["Ls"] if "Ls" in ds.variables else ds.variables["ls"]
            om_ls_list.append(ls_var[:])
    if not o3_list:
        raise FileNotFoundError(f"No OpenMars .nc files found in {openmars_dir}")

    y_raw = np.concatenate(o3_list, axis=0)
    om_ls_raw = np.concatenate(om_ls_list, axis=0)
    vars_dict = {}
    if selected_channels:
        mcd_data = {MCD_VARS_MAP[channel][1]: [] for channel in selected_channels}
        mcd_ls = []
        first_var = MCD_VARS_MAP[selected_channels[0]][0]
        for file_path in sorted(Path(mcd_dir).glob("*.nc"), key=natural_sort_key):
            with nc.Dataset(file_path) as ds:
                if first_var not in ds.variables:
                    continue
                for channel in selected_channels:
                    var_name, short_name = MCD_VARS_MAP[channel]
                    data = ds.variables[var_name][:]
                    mcd_data[short_name].append(data.reshape(data.shape[0] * data.shape[1], data.shape[2], data.shape[3]))
                ls_var = ds.variables["Ls"] if "Ls" in ds.variables else ds.variables["ls"]
                ls_t = ls_var[:]
                sol_count, hour_count = ds.variables[first_var].shape[:2]
                expanded_ls = np.zeros(sol_count * hour_count)
                for idx in range(sol_count):
                    ls_start = ls_t[idx]
                    ls_end = ls_t[idx + 1] if idx < sol_count - 1 else ls_start + 0.5
                    expanded_ls[idx * hour_count:(idx + 1) * hour_count] = np.linspace(ls_start, ls_end, hour_count, endpoint=False)
                mcd_ls.append(expanded_ls % 360.0)
        if not mcd_ls:
            raise ValueError(f"No usable MCD files found for channels {selected_channels}")
        mcd_ls_c = unwrap_ls(np.concatenate(mcd_ls))
        om_ls_c = unwrap_ls(om_ls_raw)
        for channel in selected_channels:
            short_name = MCD_VARS_MAP[channel][1]
            combined = np.concatenate(mcd_data[short_name], axis=0)
            vars_dict[short_name] = interp1d(mcd_ls_c, combined, axis=0, bounds_error=False, fill_value="extrapolate")(om_ls_c)

    feature_names = [MCD_VARS_MAP[channel][1] for channel in selected_channels]
    x_raw = np.stack([y_raw] + [vars_dict[name] for name in feature_names], axis=-1)
    total_time, height, width, channel_count = x_raw.shape
    split_idx = int(0.8 * (total_time - window - horizon + 1)) + window

    x_scaled = np.zeros_like(x_raw)
    for channel_idx in range(channel_count):
        scaler = StandardScaler()
        scaler.fit(x_raw[:split_idx, ..., channel_idx].reshape(split_idx, -1))
        x_scaled[..., channel_idx] = scaler.transform(x_raw[..., channel_idx].reshape(total_time, -1)).reshape(total_time, height, width)

    y_train_part = y_raw[:split_idx]
    y_mean, y_std = y_train_part.mean(), y_train_part.std()
    y_scaled = (y_raw - y_mean) / (y_std + 1e-6)

    x_seq, y_seq = [], []
    for idx in range(total_time - window - horizon + 1):
        x_seq.append(x_scaled[idx: idx + window])
        y_seq.append(y_scaled[idx + window: idx + window + horizon])

    x_torch = torch.tensor(np.array(x_seq)).permute(0, 1, 4, 2, 3).float()
    y_torch = torch.tensor(np.array(y_seq)).unsqueeze(2).float()
    return x_torch, y_torch, float(y_mean), float(y_std), height, width
```

Add `main()` with these required args:

```python
def main():
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
    args, _ = parser.parse_known_args()

    torch.manual_seed(max(0, int(args.seed)))
    np.random.seed(max(0, int(args.seed)))

    selected_channels = parse_selected_channels(args.selected_channels)
    openmars_dir = os.environ.get("ARESVISION_OPENMARS_DIR", str(BACKEND_DIR / "data" / "openmars"))
    mcd_dir = os.environ.get("ARESVISION_MCD_DIR", str(BACKEND_DIR / "data" / "MCD"))
    x_torch, y_torch, y_mean, y_std, height, width = prepare_tensors(openmars_dir, mcd_dir, selected_channels, args.window, args.horizon)

    split = int(0.8 * len(x_torch))
    train_loader = DataLoader(TensorDataset(x_torch[:split], y_torch[:split]), batch_size=args.batch_size, shuffle=True)
    test_loader = DataLoader(TensorDataset(x_torch[split:], y_torch[split:]), batch_size=args.batch_size, shuffle=False)

    param_schema = parse_json_arg(args.uploaded_model_param_schema)
    custom_params = parse_json_arg(args.custom_model_params)
    config = build_uploaded_model_config(
        in_channels=x_torch.shape[2],
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
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    criterion = nn.SmoothL1Loss()
    print(f"Training Device: {device}")
    print(f"UploadedModel={args.uploaded_model_path}, Config={config}")
    print("\\n[Step 3] Start Training...")

    best_val_loss = float("inf")
    patience_counter = 0
    for epoch in range(args.epochs):
        model.train()
        loss_sum = 0.0
        for batch_idx, (xb, yb) in enumerate(train_loader, start=1):
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item()
            if batch_idx % 20 == 0 or batch_idx == len(train_loader):
                print(f"Epoch {epoch + 1}/{args.epochs} Batch {batch_idx}/{len(train_loader)} Loss={loss.item():.4f}")

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for xv, yv in test_loader:
                val_loss += criterion(model(xv.to(device)), yv.to(device)).item()
        avg_val_loss = val_loss / max(1, len(test_loader))
        print(f"Epoch {epoch + 1}/{args.epochs} Loss={loss_sum / max(1, len(train_loader)):.4f} Val Loss={avg_val_loss:.4f}")

        if args.early_stopping_patience > 0:
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= args.early_stopping_patience:
                    print(f"[Early Stopping] Val loss did not improve for {args.early_stopping_patience} epochs. Stopped at epoch {epoch + 1}.")
                    break

    model.eval()
    trues, preds_all = [], []
    with torch.no_grad():
        for xb, yb in test_loader:
            preds_all.append(model(xb.to(device)).cpu().numpy())
            trues.append(yb.numpy())
    trues = np.concatenate(trues, axis=0)
    preds = np.concatenate(preds_all, axis=0)
    y_true = (trues.flatten() * (y_std + 1e-6)) + y_mean
    y_pred = (preds.flatten() * (y_std + 1e-6)) + y_mean
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
    smape = np.mean(2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100

    print("\\nMetrics:")
    print(f"MSE: {mse:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R-Squared: {r2:.4f}")
    print(f"MAPE: {mape:.4f}%")
    print(f"SMAPE: {smape:.4f}%")
    torch.save(model.state_dict(), args.output_path)
    print(f"Model saved: {args.output_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Update model test inference for uploaded models**

Modify `AresVision_backend/backend/services/inference_service.py` in `get_test_results`.

After loading `hypers`, branch on `task.model_source`:

```python
            if getattr(task, "model_source", "official") == "uploaded":
                return await self._get_uploaded_model_test_results(task, hypers, data_dirs=data_dirs)
```

Add `_get_uploaded_model_test_results`:

```python
    async def _get_uploaded_model_test_results(self, task, hypers, data_dirs=None):
        from training_backbones.user_model_runner import (
            build_uploaded_model_config,
            load_uploaded_model,
            parse_selected_channels,
            prepare_tensors,
        )

        selected_channels = parse_selected_channels(hypers.get("selected_channels", []))
        openmars_dir = Path((data_dirs or {}).get("ARESVISION_OPENMARS_DIR") or self.openmars_dir)
        mcd_dir = Path((data_dirs or {}).get("ARESVISION_MCD_DIR") or self.mcd_dir)
        window = hypers.get("window", 3)
        horizon = hypers.get("horizon", 3)
        x_torch, y_torch, y_mean, y_std, height, width = prepare_tensors(openmars_dir, mcd_dir, selected_channels, window, horizon)
        config = build_uploaded_model_config(
            in_channels=x_torch.shape[2],
            window=window,
            horizon=horizon,
            height=height,
            width=width,
            selected_channels=selected_channels,
            custom_model_params=hypers.get("custom_model_params", {}),
            param_schema=hypers.get("_uploaded_model_param_schema", {}),
        )
        model = load_uploaded_model(Path(hypers["_uploaded_model_path"]), config).to(self.device)
        state_dict = torch.load(task.output_model_path, map_location=self.device, weights_only=True)
        model.load_state_dict(state_dict)
        model.eval()
        split = int(0.8 * len(x_torch))
        sample_size = min(len(x_torch[split:]), 50)
        indices = np.linspace(0, len(x_torch[split:]) - 1, sample_size, dtype=int)
        with torch.no_grad():
            preds = model(x_torch[split:][indices].to(self.device)).cpu().numpy()
            trues = y_torch[split:][indices].numpy()
        y_pred_raw = preds * (y_std + 1e-6) + y_mean
        y_true_raw = trues * (y_std + 1e-6) + y_mean
        y_true_flat = y_true_raw.flatten()
        y_pred_flat = y_pred_raw.flatten()
        if len(y_true_flat) > 50000:
            step = len(y_true_flat) // 50000
            y_true_flat = y_true_flat[::step]
            y_pred_flat = y_pred_flat[::step]
        return {
            "y_true": y_true_flat.tolist(),
            "y_pred": y_pred_flat.tolist(),
            "metrics": json.loads(task.metrics) if task.metrics else {},
        }
```

- [ ] **Step 6: Run runner tests**

Run:

```powershell
python AresVision_backend\backend\tests\test_uploaded_model_runner.py
```

Expected: `uploaded model runner tests passed`.

Commit:

```powershell
git add AresVision_backend\backend\training_backbones\user_model_runner.py AresVision_backend\backend\services\inference_service.py AresVision_backend\backend\tests\test_uploaded_model_runner.py
git commit -m "feat: train uploaded model definitions"
```

---

## Task 6: Frontend API And Dynamic Parameter Utilities

**Files:**

- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/ModelTrainingPage/uploadedModelParams.js`
- Create: `frontend/src/pages/ModelTrainingPage/uploadedModelParams.test.js`

- [ ] **Step 1: Write dynamic parameter utility tests**

Create `frontend/src/pages/ModelTrainingPage/uploadedModelParams.test.js`:

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCustomModelParams,
  createDefaultCustomModelParams,
  validateCustomModelParams,
} from './uploadedModelParams.js';

const schema = {
  hidden_dim: { type: 'int', default: 8, min: 4, max: 32 },
  dropout: { type: 'float', default: 0.1, min: 0, max: 0.9 },
  use_bias: { type: 'bool', default: true },
  activation: { type: 'select', default: 'relu', options: ['relu', 'gelu'] },
};

test('creates default custom model params from schema', () => {
  assert.deepEqual(createDefaultCustomModelParams(schema), {
    hidden_dim: 8,
    dropout: 0.1,
    use_bias: true,
    activation: 'relu',
  });
});

test('builds sanitized custom params within schema bounds', () => {
  assert.deepEqual(buildCustomModelParams(schema, {
    hidden_dim: 100,
    dropout: -2,
    use_bias: false,
    activation: 'bad',
  }), {
    hidden_dim: 32,
    dropout: 0,
    use_bias: false,
    activation: 'relu',
  });
});

test('validates missing schema and out-of-range params', () => {
  assert.deepEqual(validateCustomModelParams(null, {}), { ok: true, errors: {} });
  assert.deepEqual(validateCustomModelParams(schema, { hidden_dim: 33 }).errors, {
    hidden_dim: 'Value must be between 4 and 32',
  });
});
```

- [ ] **Step 2: Run frontend utility tests and confirm they fail**

Run:

```powershell
cd frontend
node --test src/pages/ModelTrainingPage/uploadedModelParams.test.js
```

Expected: fails because `uploadedModelParams.js` does not exist.

- [ ] **Step 3: Implement dynamic parameter utilities**

Create `frontend/src/pages/ModelTrainingPage/uploadedModelParams.js`:

```javascript
export function createDefaultCustomModelParams(schema = {}) {
  return Object.fromEntries(
    Object.entries(schema || {}).map(([key, field]) => [key, field?.default])
  );
}

function clampNumber(value, min, max, fallback, integer = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(bounded) : bounded;
}

export function buildCustomModelParams(schema = {}, values = {}) {
  const result = {};
  for (const [key, field] of Object.entries(schema || {})) {
    const value = values[key] ?? field.default;
    if (field.type === 'int') {
      result[key] = clampNumber(value, field.min, field.max, field.default, true);
    } else if (field.type === 'float') {
      result[key] = clampNumber(value, field.min, field.max, field.default, false);
    } else if (field.type === 'bool') {
      result[key] = Boolean(value);
    } else if (field.type === 'select') {
      result[key] = Array.isArray(field.options) && field.options.includes(value)
        ? value
        : field.default;
    }
  }
  return result;
}

export function validateCustomModelParams(schema = {}, values = {}) {
  if (!schema) return { ok: true, errors: {} };
  const errors = {};
  for (const [key, field] of Object.entries(schema || {})) {
    const value = values[key];
    if (value === '' || value === null || value === undefined) continue;
    if (field.type === 'int' || field.type === 'float') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
        errors[key] = `Value must be between ${field.min} and ${field.max}`;
      }
    }
    if (field.type === 'select' && Array.isArray(field.options) && !field.options.includes(value)) {
      errors[key] = 'Select a supported option';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
```

- [ ] **Step 4: Add API helpers**

Modify `frontend/src/services/api.js`.

Change `authedFetch` to allow `FormData` without forcing JSON:

```javascript
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
```

Extend `startTrainingTask` without breaking official callers:

```javascript
export async function startTrainingTask(
  model_script,
  hyperparameters,
  model_name = null,
  data_source = 'default',
  options = {}
) {
  const res = await authedFetch(`${BASE}/training/start`, {
    method: 'POST',
    body: JSON.stringify({
      model_script,
      hyperparameters,
      model_name,
      data_source,
      model_source: options.modelSource || 'official',
      uploaded_model_id: options.uploadedModelId || null,
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
```

Add user model helpers:

```javascript
export async function uploadUserModel(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authedFetch(`${BASE}/user-models`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function fetchUserModels() {
  const res = await authedFetch(`${BASE}/user-models`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function revalidateUserModel(modelId) {
  const res = await authedFetch(`${BASE}/user-models/${modelId}/validate`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function deleteUserModel(modelId) {
  const res = await authedFetch(`${BASE}/user-models/${modelId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 5: Run frontend utility tests and commit**

Run:

```powershell
cd frontend
node --test src/pages/ModelTrainingPage/uploadedModelParams.test.js
```

Expected: all tests pass.

Commit:

```powershell
git add frontend/src/services/api.js frontend/src/pages/ModelTrainingPage/uploadedModelParams.js frontend/src/pages/ModelTrainingPage/uploadedModelParams.test.js
git commit -m "feat: add uploaded model frontend utilities"
```

---

## Task 7: Training Page UI Integration

**Files:**

- Create: `frontend/src/pages/ModelTrainingPage/ModelSourceSelector.jsx`
- Create: `frontend/src/pages/ModelTrainingPage/UploadedModelPanel.jsx`
- Create: `frontend/src/pages/ModelTrainingPage/DynamicModelParamsForm.jsx`
- Modify: `frontend/src/pages/ModelTrainingPage.jsx`

- [ ] **Step 1: Create the source selector**

Create `frontend/src/pages/ModelTrainingPage/ModelSourceSelector.jsx`:

```jsx
import React from 'react';
import C from '../../constants/colors';

export default function ModelSourceSelector({ value, onChange, labels, disabled = false }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      padding: 5,
      borderRadius: 16,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${C.border}`,
    }}>
      {[
        { id: 'official', label: labels.official },
        { id: 'uploaded', label: labels.uploaded },
      ].map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: active ? 'rgba(74,158,255,0.14)' : 'transparent',
              color: active ? C.blue : C.ice60,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create dynamic params form**

Create `frontend/src/pages/ModelTrainingPage/DynamicModelParamsForm.jsx`:

```jsx
import React from 'react';

export default function DynamicModelParamsForm({ schema = {}, values = {}, errors = {}, onChange, inputStyle, fieldLabelStyle, fieldHintStyle }) {
  const entries = Object.entries(schema || {});
  if (entries.length === 0) return null;

  return (
    <div className="model-training-field-grid" style={{ marginTop: 12 }}>
      {entries.map(([key, field]) => (
        <div key={key}>
          <div style={fieldLabelStyle}>{key}</div>
          {field.type === 'bool' ? (
            <button
              type="button"
              onClick={() => onChange(key, !Boolean(values[key]))}
              style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}
            >
              {Boolean(values[key]) ? 'ON' : 'OFF'}
            </button>
          ) : field.type === 'select' ? (
            <select
              value={values[key] ?? field.default}
              onChange={(event) => onChange(key, event.target.value)}
              style={inputStyle}
            >
              {(field.options || []).map((option) => (
                <option key={String(option)} value={option}>{String(option)}</option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              value={values[key] ?? field.default}
              min={field.min}
              max={field.max}
              step={field.type === 'int' ? 1 : 0.01}
              onChange={(event) => onChange(key, event.target.value)}
              style={inputStyle}
            />
          )}
          {errors[key] ? (
            <div style={{ ...fieldHintStyle, color: '#d95c5c' }}>{errors[key]}</div>
          ) : (
            <div style={fieldHintStyle}>
              {field.type === 'int' || field.type === 'float'
                ? `${field.min} - ${field.max}`
                : field.type}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create uploaded model panel**

Create `frontend/src/pages/ModelTrainingPage/UploadedModelPanel.jsx`:

```jsx
import React, { useRef } from 'react';
import C from '../../constants/colors';

export default function UploadedModelPanel({
  models,
  selectedId,
  onSelect,
  onUpload,
  onRevalidate,
  onDelete,
  uploading,
  labels,
  sectionTitleStyle,
  fieldHintStyle,
}) {
  const fileRef = useRef(null);
  const selected = models.find((item) => item.id === selectedId);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={sectionTitleStyle}>{labels.title}</div>
          <div style={{ ...fieldHintStyle, marginTop: 0 }}>{labels.hint}</div>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '9px 12px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.bgMuted,
            color: C.ice,
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {uploading ? labels.uploading : labels.upload}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".py"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = '';
          }}
        />
      </div>

      {models.length === 0 ? (
        <div style={{ ...fieldHintStyle, padding: 12, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
          {labels.empty}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {models.map((model) => {
            const active = selectedId === model.id;
            const valid = model.validation_status === 'valid';
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelect(model.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'rgba(74,158,255,0.24)' : C.border}`,
                  background: active ? 'rgba(74,158,255,0.10)' : C.bgMuted,
                  color: C.ice,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{model.display_name}</strong>
                  <span style={{ color: valid ? C.green : '#d95c5c' }}>
                    {valid ? labels.valid : labels.invalid}
                  </span>
                </div>
                <div style={{ ...fieldHintStyle, marginTop: 4 }}>
                  v{model.version} / {model.original_filename}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div style={{ padding: 12, borderRadius: 12, background: C.bgMuted, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button type="button" onClick={() => onRevalidate(selected.id)}>{labels.revalidate}</button>
            <button type="button" onClick={() => onDelete(selected.id)}>{labels.delete}</button>
          </div>
          {(selected.validation_report?.errors || []).length > 0 ? (
            <div style={{ ...fieldHintStyle, color: '#d95c5c' }}>
              {selected.validation_report.errors.join(' / ')}
            </div>
          ) : (
            <div style={{ ...fieldHintStyle, color: C.green }}>{labels.ready}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire `ModelTrainingPage.jsx` state and API imports**

Modify imports in `frontend/src/pages/ModelTrainingPage.jsx`:

```javascript
  uploadUserModel,
  fetchUserModels,
  revalidateUserModel,
  deleteUserModel,
```

Add imports:

```javascript
import ModelSourceSelector from './ModelTrainingPage/ModelSourceSelector';
import UploadedModelPanel from './ModelTrainingPage/UploadedModelPanel';
import DynamicModelParamsForm from './ModelTrainingPage/DynamicModelParamsForm';
import {
  buildCustomModelParams,
  createDefaultCustomModelParams,
  validateCustomModelParams,
} from './ModelTrainingPage/uploadedModelParams';
```

Add state near existing training state:

```javascript
  const [modelSource, setModelSource] = useState('official');
  const [uploadedModels, setUploadedModels] = useState([]);
  const [selectedUploadedModelId, setSelectedUploadedModelId] = useState('');
  const [customModelParams, setCustomModelParams] = useState({});
  const [customModelParamErrors, setCustomModelParamErrors] = useState({});
  const [uploadingModel, setUploadingModel] = useState(false);
```

Add selected model derived state:

```javascript
  const selectedUploadedModel = useMemo(
    () => uploadedModels.find((item) => item.id === selectedUploadedModelId) || null,
    [selectedUploadedModelId, uploadedModels]
  );
  const selectedUploadedParamSchema = selectedUploadedModel?.param_schema || {};
```

- [ ] **Step 5: Load uploaded models and initialize params**

Add effect:

```javascript
  useEffect(() => {
    if (!user) {
      setUploadedModels([]);
      setSelectedUploadedModelId('');
      return undefined;
    }
    let active = true;
    fetchUserModels()
      .then((payload) => {
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setUploadedModels(items);
        setSelectedUploadedModelId((current) => current || items.find((item) => item.validation_status === 'valid')?.id || '');
      })
      .catch(() => {
        if (!active) return;
        setUploadedModels([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    setCustomModelParams(createDefaultCustomModelParams(selectedUploadedParamSchema));
    setCustomModelParamErrors({});
  }, [selectedUploadedModelId]);
```

- [ ] **Step 6: Add upload/revalidate/delete handlers**

Add handlers before `handleStartTraining`:

```javascript
  const refreshUploadedModels = async () => {
    const payload = await fetchUserModels();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    setUploadedModels(items);
    return items;
  };

  const handleUploadModel = async (file) => {
    try {
      setUploadingModel(true);
      const uploaded = await uploadUserModel(file);
      const items = await refreshUploadedModels();
      setSelectedUploadedModelId(uploaded.id || items[0]?.id || '');
      showToast(uploaded.validation_status === 'valid' ? 'Model validation passed' : 'Model validation failed', uploaded.validation_status === 'valid' ? 'success' : 'error');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setUploadingModel(false);
    }
  };

  const handleRevalidateModel = async (modelId) => {
    try {
      await revalidateUserModel(modelId);
      await refreshUploadedModels();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDeleteUploadedModel = async (modelId) => {
    try {
      await deleteUserModel(modelId);
      const items = await refreshUploadedModels();
      setSelectedUploadedModelId(items.find((item) => item.validation_status === 'valid')?.id || '');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleCustomModelParamChange = (key, value) => {
    setCustomModelParams((previous) => ({ ...previous, [key]: value }));
  };
```

- [ ] **Step 7: Update start-disabled and start-training payload**

Change `startDisabled` to include uploaded model gates:

```javascript
  const customParamValidation = validateCustomModelParams(selectedUploadedParamSchema, customModelParams);
  const uploadedModelStartBlocked =
    modelSource === 'uploaded' &&
    (!selectedUploadedModel || selectedUploadedModel.validation_status !== 'valid' || !customParamValidation.ok);
  const startDisabled = user
    ? !selectedScriptAvailable || !!modelNameError || !customModelName.trim() || isProcessing || uploadedModelStartBlocked
    : false;
```

Inside `handleStartTraining`, before calling `startTrainingTask`, validate custom params:

```javascript
      const customValidation = validateCustomModelParams(selectedUploadedParamSchema, customModelParams);
      if (modelSource === 'uploaded' && !customValidation.ok) {
        setCustomModelParamErrors(customValidation.errors);
        return;
      }
```

Add `custom_model_params` when building hyperparameters:

```javascript
      const requestHyperparameters = {
        ...hyperparameters,
        ...(modelSource === 'uploaded'
          ? { custom_model_params: buildCustomModelParams(selectedUploadedParamSchema, customModelParams) }
          : {}),
      };
```

Change the API call:

```javascript
      const task = await startTrainingTask(
        selectedScript,
        requestHyperparameters,
        customModelName.trim(),
        dataSourceMode,
        {
          modelSource,
          uploadedModelId: modelSource === 'uploaded' ? selectedUploadedModelId : null,
        }
      );
```

- [ ] **Step 8: Insert UI sections**

In the left parameter card, insert model source selector before model naming:

```jsx
              <div style={{ ...summaryCardStyle, padding: '16px 16px 14px' }}>
                <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>
                  {isZh ? '模型来源' : 'Model source'}
                </div>
                <ModelSourceSelector
                  value={modelSource}
                  onChange={setModelSource}
                  labels={{
                    official: isZh ? '官方模型' : 'Official',
                    uploaded: isZh ? '我的模型' : 'My models',
                  }}
                  disabled={!user}
                />
              </div>

              {modelSource === 'uploaded' ? (
                <div style={{ ...summaryCardStyle, padding: '16px 16px 14px' }}>
                  <UploadedModelPanel
                    models={uploadedModels}
                    selectedId={selectedUploadedModelId}
                    onSelect={setSelectedUploadedModelId}
                    onUpload={handleUploadModel}
                    onRevalidate={handleRevalidateModel}
                    onDelete={handleDeleteUploadedModel}
                    uploading={uploadingModel}
                    labels={{
                      title: isZh ? '我的模型' : 'Uploaded models',
                      hint: isZh ? '上传单文件 PyTorch 模型定义。' : 'Upload a single-file PyTorch model definition.',
                      upload: isZh ? '上传 .py' : 'Upload .py',
                      uploading: isZh ? '上传中...' : 'Uploading...',
                      empty: isZh ? '还没有上传模型。' : 'No uploaded models yet.',
                      valid: isZh ? '可训练' : 'Valid',
                      invalid: isZh ? '需修正' : 'Invalid',
                      revalidate: isZh ? '重新校验' : 'Revalidate',
                      delete: isZh ? '删除' : 'Delete',
                      ready: isZh ? '模型已通过校验。' : 'Model is ready for training.',
                    }}
                    sectionTitleStyle={sectionTitleStyle}
                    fieldHintStyle={fieldHintStyle}
                  />
                  <DynamicModelParamsForm
                    schema={selectedUploadedParamSchema}
                    values={customModelParams}
                    errors={customModelParamErrors}
                    onChange={handleCustomModelParamChange}
                    inputStyle={inputStyle}
                    fieldLabelStyle={fieldLabelStyle}
                    fieldHintStyle={fieldHintStyle}
                  />
                </div>
              ) : null}
```

- [ ] **Step 9: Run frontend checks and commit**

Run:

```powershell
cd frontend
node --test src/pages/ModelTrainingPage/uploadedModelParams.test.js
npm run build
```

Expected:

- Node test passes.
- Vite build completes successfully.

Commit:

```powershell
git add frontend/src/pages/ModelTrainingPage.jsx frontend/src/pages/ModelTrainingPage/ModelSourceSelector.jsx frontend/src/pages/ModelTrainingPage/UploadedModelPanel.jsx frontend/src/pages/ModelTrainingPage/DynamicModelParamsForm.jsx
git commit -m "feat: add uploaded model training UI"
```

---

## Task 8: Documentation And End-To-End Verification

**Files:**

- Create: `docs/uploaded-model-template.py`
- Create: `docs/uploaded-model-training.md`
- Verify: backend and frontend tests

- [ ] **Step 1: Add lab-user model template**

Create `docs/uploaded-model-template.py`:

```python
import torch
from torch import nn

MODEL_SPEC = {
    "name": "ExampleUploadedModel",
    "description": "Minimal model definition for AresVision uploaded-model training.",
    "parameters": {
        "hidden_dim": {"type": "int", "default": 16, "min": 4, "max": 128},
        "dropout": {"type": "float", "default": 0.1, "min": 0.0, "max": 0.9},
    },
}


class ExampleUploadedModel(nn.Module):
    def __init__(self, in_channels, horizon, hidden_dim, dropout):
        super().__init__()
        self.horizon = horizon
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dim, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Dropout2d(dropout),
            nn.Conv2d(hidden_dim, 1, kernel_size=1),
        )

    def forward(self, x):
        # x shape: [batch, window, channels, height, width]
        last_frame = x[:, -1]
        prediction = self.encoder(last_frame)
        return prediction.unsqueeze(1).repeat(1, self.horizon, 1, 1, 1)


def build_model(config):
    return ExampleUploadedModel(
        in_channels=config["in_channels"],
        horizon=config["horizon"],
        hidden_dim=config["hidden_dim"],
        dropout=config["dropout"],
    )
```

- [ ] **Step 2: Add user-facing guide**

Create `docs/uploaded-model-training.md`:

````markdown
# Uploaded Model Training

Trusted lab users can upload a single `.py` PyTorch model definition from the model training page.

The platform provides data loading, normalization, training, metrics, logs, checkpoints, and model testing. Your file only defines the architecture.

Required exports:

- `MODEL_SPEC`
- `build_model(config)`
- one or more `torch.nn.Module` classes

Input shape:

```text
[batch, window, channels, height, width]
```

Output shape:

```text
[batch, horizon, 1, height, width]
```

Allowed imports in version 1:

- `torch`
- `torch.nn`
- `torch.nn.functional`
- `numpy`

The upload validator rejects filesystem, subprocess, network, and dynamic execution APIs. Use `docs/uploaded-model-template.py` as the starting point.
````

- [ ] **Step 3: Run all focused backend tests**

Run:

```powershell
python AresVision_backend\backend\tests\test_user_model_schema.py
python AresVision_backend\backend\tests\test_user_model_validator.py
python AresVision_backend\backend\tests\test_user_model_service.py
python AresVision_backend\backend\tests\test_uploaded_training_contract.py
python AresVision_backend\backend\tests\test_uploaded_model_runner.py
python AresVision_backend\backend\tests\test_training_channels.py
python AresVision_backend\backend\tests\test_training_channel_contract.py
```

Expected: each command prints its success message or completes with exit code 0.

- [ ] **Step 4: Run focused frontend tests and build**

Run:

```powershell
cd frontend
node --test src/pages/ModelTrainingPage/uploadedModelParams.test.js
node --test src/pages/ModelTrainingPage/trainingParamSanitizers.test.js
npm run build
```

Expected: tests pass and Vite build completes.

- [ ] **Step 5: Manual smoke test**

Start backend and frontend by the project's normal local workflow, then:

1. Log in.
2. Open the model training page.
3. Select `My models`.
4. Upload `docs/uploaded-model-template.py`.
5. Confirm the uploaded model is marked valid.
6. Set epochs to `1`.
7. Start training with a unique model name.
8. Confirm a task appears in history.
9. Confirm logs show `Epoch 1/1`.
10. Confirm the loss chart receives at least one train value.
11. Confirm completed tasks expose the model test action.

- [ ] **Step 6: Commit docs**

Commit:

```powershell
git add docs/uploaded-model-template.py docs/uploaded-model-training.md
git commit -m "docs: add uploaded model training guide"
```

---

## Self-Review Checklist

- Spec coverage:
  - Upload, list, detail, revalidate, delete: Task 3.
  - Static validation and dry-run: Task 2.
  - Explicit database columns: Task 1.
  - Training start support: Task 4.
  - Platform-owned uploaded runner: Task 5.
  - Existing progress/log/history reuse: Task 4 and Task 5.
  - Frontend model source, upload list, dynamic params: Task 6 and Task 7.
  - Docs and smoke test: Task 8.

- Type consistency:
  - Backend API uses `model_source` and `uploaded_model_id`.
  - Frontend wrapper uses `modelSource` and `uploadedModelId`, translated in `api.js`.
  - Task private hyperparameter keys use `_uploaded_model_id`, `_uploaded_model_version`, `_uploaded_model_path`, and `_uploaded_model_param_schema`.

- Verification commands:
  - Backend commands use the existing direct Python test style.
  - Frontend commands use `node --test` and `npm run build`.
