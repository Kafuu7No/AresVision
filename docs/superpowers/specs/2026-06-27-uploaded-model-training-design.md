# Uploaded Model Training Design

## Goal

Allow trusted lab users to upload their own PyTorch model definition, train it with the platform dataset, tune core training parameters from the existing model training page, and reuse the current task history, progress, logs, loss chart, and model testing workflow.

This feature is for trusted laboratory users, not arbitrary public users. The first version should be practical and controlled: users upload a model definition, while AresVision owns data loading, preprocessing, training loop, metrics, logging, and checkpoint output.

## Current Context

The training page currently starts tasks through `frontend/src/pages/ModelTrainingPage.jsx`, builds sanitized hyperparameters in `frontend/src/pages/ModelTrainingPage/trainingParamSanitizers.js`, and calls `POST /training/start` through `frontend/src/services/api.js`.

The backend currently exposes training routes in `AresVision_backend/backend/routers/training.py`. `TrainingService` forces all official training jobs to `demo3.py`, normalizes hyperparameters through `services/training_channels.py`, starts a Python subprocess, writes task logs, parses progress from log lines, and stores task state in `model_training_tasks`.

The design should preserve that contract where possible. Uploaded models should feed into the same task list and monitor instead of creating a separate training product.

## Non-Goals For Version 1

- Do not support full user-authored training scripts.
- Do not support ZIP or multi-file model packages.
- Do not support user-provided `pip install` dependencies.
- Do not provide public-user container isolation in the first version.
- Do not allow uploaded code to choose arbitrary data files or output paths.
- Do not rewrite the existing official `demo3.py` training path.

## Recommended Approach

Use a platform-owned training runner with user-provided model definitions.

Users upload one Python file that declares `MODEL_SPEC`, a `build_model(config)` factory, and any helper `torch.nn.Module` classes required by that factory. The platform validates the file, stores it as a versioned model package, and imports it from an isolated working directory when a training task starts.

This gives lab users meaningful model freedom while keeping the fragile parts of the system in platform code: tensor shape contract, dataset alignment, normalization, progress log format, early stopping, metrics, and checkpoint naming.

### Alternatives Considered

1. Full script upload.
   This is the most flexible option, but it duplicates data loading and training logic, makes progress parsing unreliable, and raises file access and dependency risks. It is not recommended for version 1.

2. Model definition upload with platform training runner.
   This is the recommended option. It covers the main lab need: testing custom architectures against the shared dataset. It also keeps the existing page, API, task monitor, and inference workflow coherent.

3. Admin-curated model registry only.
   Users submit code out-of-band and admins manually install it into the codebase. This is safest but too slow for experimentation and does not satisfy the upload-from-site requirement.

## User Model Contract

The uploaded file must be a single `.py` file under a size limit, defaulting to 256 KB for version 1.

Required exports:

```python
MODEL_SPEC = {
    "name": "MyModel",
    "description": "Short optional description",
    "parameters": {
        "hidden_dim": {"type": "int", "default": 64, "min": 8, "max": 512},
        "dropout": {"type": "float", "default": 0.1, "min": 0.0, "max": 0.9}
    }
}

def build_model(config):
    return MyModel(
        in_channels=config["in_channels"],
        window=config["window"],
        horizon=config["horizon"],
        hidden_dim=config["hidden_dim"],
        dropout=config["dropout"],
    )
```

The returned object must be a `torch.nn.Module`.

The model `forward` contract is:

```text
input:  x with shape [batch, window, channels, height, width]
output: y_hat with shape [batch, horizon, 1, height, width]
```

Version 1 allowed parameter types:

- `int`
- `float`
- `bool`
- `select`

Each parameter must have a default value. Numeric parameters must have min and max bounds. `select` parameters must have an `options` list and a default contained in that list.

Platform-provided config keys:

- `in_channels`
- `window`
- `horizon`
- `height`
- `width`
- `selected_channels`
- user-defined `MODEL_SPEC.parameters` values

## Validation

Uploaded model validation has two stages.

### Static Validation

The backend parses the file with Python `ast` before importing it.

Allowed imports for version 1:

- `torch`
- `torch.nn`
- `torch.nn.functional`
- `numpy`

Rejected patterns:

- `os`, `sys`, `subprocess`, `socket`, `requests`, `urllib`, `pathlib`, `shutil`
- `open`, `eval`, `exec`, `compile`, `__import__`
- dynamic import machinery
- shell execution
- top-level file IO
- top-level network calls

This is a guardrail for trusted users and accidental misuse. It is not a complete sandbox.

### Runtime Dry-Run Validation

After static validation, the backend imports the module from a generated server-side path, reads `MODEL_SPEC`, calls `build_model(config)`, and runs a dummy tensor through the model.

Dry-run defaults:

```text
batch=2
window=3
channels=1 + selected side channels
horizon=3
height=8
width=16
```

The validator fails the upload unless the output has exactly `[2, 3, 1, 8, 16]`. The validation report should include friendly details: import failure, missing `MODEL_SPEC`, bad parameter schema, bad return type, forward exception, or output shape mismatch.

## Data Model

Create a new table, `user_model_packages`.

Fields:

- `id`: random UUID string, public identifier
- `user_id`: owner
- `display_name`: model display name from `MODEL_SPEC.name` or user input
- `version`: monotonically increasing integer per owner and display name
- `original_filename`
- `storage_path`
- `content_hash`
- `param_schema`: JSON representation of validated `MODEL_SPEC.parameters`
- `description`
- `validation_status`: `pending`, `valid`, `invalid`
- `validation_report`: JSON
- `created_at`
- `updated_at`
- `deleted_at`

Extend `model_training_tasks` with:

- `model_source`: `official` or `uploaded`
- `uploaded_model_id`: nullable UUID string
- `uploaded_model_version`: nullable integer

These fields must be explicit columns in version 1. Task filtering, auditing, and model testing need stable references, and hiding uploaded-model identity inside `hyperparameters` would make the feature harder to operate.

## Backend API

Add `AresVision_backend/backend/routers/user_models.py`.

Endpoints:

- `POST /user-models`
  Upload one `.py` model file. Auth required. Returns the created package and validation report.

- `GET /user-models`
  List the current user's non-deleted model packages. Version 1 does not add an admin-wide package browser.

- `GET /user-models/{model_id}`
  Return model metadata, parameter schema, and validation report. Enforce ownership.

- `POST /user-models/{model_id}/validate`
  Re-run validation after server changes or dependency updates. Enforce ownership.

- `DELETE /user-models/{model_id}`
  Soft-delete a model package. Existing training tasks keep their historical reference and output paths.

Extend `POST /training/start` request schema:

```json
{
  "model_source": "official",
  "model_script": "demo3.py",
  "uploaded_model_id": null,
  "model_name": "Lab baseline run",
  "data_source": "default",
  "hyperparameters": {}
}
```

For uploaded model training:

```json
{
  "model_source": "uploaded",
  "model_script": "demo3.py",
  "uploaded_model_id": "uuid-string",
  "model_name": "My uploaded model run",
  "data_source": "default",
  "hyperparameters": {
    "epochs": 10,
    "batch_size": 32,
    "learning_rate": 0.001,
    "window": 3,
    "horizon": 3,
    "selected_channels": ["U", "V"],
    "custom_model_params": {
      "hidden_dim": 64,
      "dropout": 0.1
    }
  }
}
```

Backend validation remains authoritative. The service must reject uploaded-model training if the package is missing, owned by another user, soft-deleted, or not `valid`.

## Backend Services

Add `services/user_model_service.py`.

Responsibilities:

- Store uploaded files under a server-controlled directory.
- Generate UUID ids and safe server filenames.
- Compute content hashes.
- Create and update `user_model_packages` records.
- Enforce owner checks.
- Provide model metadata and source paths to the training service.

Add `services/user_model_validator.py`.

Responsibilities:

- Enforce extension and size limits.
- Parse AST and reject disallowed imports and calls.
- Import the module from a generated module name.
- Validate `MODEL_SPEC`.
- Sanitize and normalize parameter schema.
- Run dummy forward pass.
- Return structured validation reports.

Add `training_backbones/user_model_runner.py`.

Responsibilities:

- Load the validated uploaded model.
- Reuse platform dataset preparation and tensor conventions.
- Train with the same core hyperparameters as official training.
- Emit log lines matching the current parser:

```text
Epoch 1/10 Batch 1/100 Loss=0.1234
Epoch 1/10 Loss=0.1200 Val Loss=0.1400
```

- Save model weights to the output path assigned by `TrainingService`.
- Print final metrics using the same metric names that `_extract_metrics_from_log` already recognizes.

## Training Flow

Official training flow stays unchanged.

Uploaded model flow:

1. User selects `model_source = uploaded`.
2. User selects a validated uploaded model package.
3. Frontend renders dynamic custom parameters from `param_schema`.
4. User clicks start training.
5. Backend verifies model ownership and validation status.
6. Backend normalizes core hyperparameters and custom model params.
7. `TrainingService` creates a normal `ModelTrainingTask`.
8. `TrainingService` starts a subprocess that runs `user_model_runner.py` instead of `demo3.py`.
9. Runner imports the uploaded model and trains it with platform data.
10. Existing polling, WebSocket updates, logs, loss chart, history, and test modal continue to work.

## Frontend Design

Keep the first screen as the actual training workflow, not a separate upload-only page.

Modify `frontend/src/pages/ModelTrainingPage.jsx` conservatively and extract uploaded-model UI into focused components:

- `ModelSourceSelector.jsx`
  Switches between official models and uploaded models.

- `UploadedModelPanel.jsx`
  Handles upload, model list, validation status, validation report, and selected uploaded model.

- `DynamicModelParamsForm.jsx`
  Renders bounded controls from uploaded model parameter schema.

Frontend state additions:

- `modelSource`: `official` or `uploaded`
- `uploadedModels`
- `selectedUploadedModelId`
- `customModelParams`
- `customModelParamErrors`
- `uploadingModel`
- `validatingModel`

Start button disable logic for uploaded models:

- user must be logged in
- selected uploaded model must exist
- selected uploaded model must have `validation_status === "valid"`
- custom model params must pass client-side bounds
- existing model name and script checks still apply where relevant

The frontend should show validation errors as text rendered through normal JSX. It should not render uploaded code or validation output as HTML.

## Security And Reliability For Trusted Lab Use

Version 1 is a trusted lab feature, so container isolation is not required. Still, the implementation must reduce accidental damage:

- Upload only `.py` files.
- Enforce file size limits.
- Store uploads outside any static web root.
- Generate server filenames; do not trust original filenames for paths.
- Use UUIDs instead of incrementing public ids for model packages.
- Reject dangerous imports and calls.
- Do not expose arbitrary file download endpoints for uploaded source in version 1.
- Run training in a subprocess with a controlled working directory.
- Pass subprocess args as a list, never through a shell.
- Set a max training runtime configuration.
- Keep dataset paths platform-controlled.
- Keep output paths platform-controlled.
- Record uploader, model id, model version, and content hash for audit.

Future public-user hardening should add container isolation, network disablement, cgroup memory limits, GPU quotas, dependency allowlisting, and admin approval.

## Error Handling

Upload errors:

- invalid extension
- file too large
- malformed Python syntax
- disallowed import or call
- missing `MODEL_SPEC`
- invalid parameter schema
- missing `build_model`
- `build_model` did not return `nn.Module`
- dry-run forward failed
- output shape mismatch

Training start errors:

- selected uploaded model not found
- selected uploaded model belongs to another user
- selected uploaded model is deleted
- selected uploaded model is not valid
- custom model param is outside schema bounds
- runner failed to import model

The backend should return structured `detail` messages. The frontend should show the message in the same tone as existing training start errors.

## Testing Strategy

Backend tests:

- valid uploaded model passes validation
- missing `MODEL_SPEC` fails validation
- disallowed import fails validation
- bad output shape fails validation
- invalid parameter schema fails validation
- non-owner cannot start training with another user's uploaded model
- invalid model cannot be trained
- uploaded model training uses `user_model_runner.py`
- official training still uses `demo3.py`
- custom model params are clamped or rejected according to schema

Frontend tests:

- uploaded model source disables start until a valid model is selected
- parameter schema renders the correct controls
- out-of-bounds custom parameter shows an error
- upload validation report is displayed safely as text
- official model path remains unchanged

Manual verification:

- Upload a valid sample model and train for 1 epoch.
- Confirm logs update.
- Confirm progress chart updates.
- Confirm completed task appears in history.
- Confirm model test modal still opens for completed uploaded-model task.

## Rollout Plan

1. Add backend schema, service, validator, and routes.
2. Add tests for model validation and ownership.
3. Add uploaded model runner with minimal training path.
4. Extend `TrainingService` and `TrainingStartRequest`.
5. Add frontend API helpers.
6. Add training page UI for uploaded models.
7. Add frontend tests.
8. Run a 1-epoch smoke test with a sample uploaded model.
9. Document the model file contract for lab users.

## Acceptance Criteria

- A logged-in lab user can upload a valid single-file PyTorch model definition.
- The platform validates the upload and reports actionable errors for invalid files.
- The user can select a validated uploaded model on the training page.
- The user can tune existing core training parameters and model-specific custom parameters.
- The training task appears in the existing task history.
- Existing progress, logs, loss chart, stop, delete, and completed-model test flows continue to work.
- Official model training behavior remains unchanged.
