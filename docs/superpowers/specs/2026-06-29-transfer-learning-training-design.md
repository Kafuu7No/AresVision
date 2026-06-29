# Transfer Learning Training Design

## Goal

Add transfer learning to the model training workflow. A user should be able to start a new training task from either:

- a completed AresVision training task; or
- an uploaded `.pth` or `.pt` weight file.

The first implementation should be conservative and operationally useful. It should support both source types, load weights strictly by default, keep all existing task monitoring behavior, and avoid changing the prediction and testing contracts for completed models.

## Current Context

The training page starts tasks from `frontend/src/pages/ModelTrainingPage.jsx`, builds sanitized hyperparameters in `frontend/src/pages/ModelTrainingPage/trainingParamSanitizers.js`, and calls `POST /training/start` through `frontend/src/services/api.js`.

The backend exposes training routes in `AresVision_backend/backend/routers/training.py`. `TrainingService` normalizes hyperparameters through `services/training_channels.py`, creates `model_training_tasks`, and launches a subprocess for the actual training run.

Official models are trained through the configured official training script `demo3.py` under the backend training-models directory. That script builds the model with `training_backbones.model_zoo.build_forecaster`, trains it, prints progress lines that the service parses, and saves a pure PyTorch `state_dict` to the task output path.

Uploaded architecture training already exists through `training_backbones/user_model_runner.py`. It also saves a pure `state_dict`. Transfer learning should reuse these conventions instead of introducing a new checkpoint format in version 1.

## Recommended Approach

Use one transfer learning contract shared by both source types:

```json
{
  "transfer_learning": true,
  "transfer_source_type": "task",
  "transfer_source_task_id": 12,
  "transfer_weight_id": null,
  "transfer_load_mode": "strict",
  "freeze_mode": "none",
  "finetune_learning_rate": 0.00001
}
```

For uploaded weights:

```json
{
  "transfer_learning": true,
  "transfer_source_type": "upload",
  "transfer_source_task_id": null,
  "transfer_weight_id": "uuid-string",
  "transfer_load_mode": "strict",
  "freeze_mode": "none",
  "finetune_learning_rate": 0.00001
}
```

Version 1 should implement strict loading only. Strict mode requires the new model instance and the source state dict to match exactly. This is the safest first step because the existing prediction code also assumes exact `load_state_dict` compatibility.

Partial loading and multi-stage freeze-then-unfreeze training are future extensions.

## Alternatives Considered

1. Strict compatible fine-tuning only.
   This is the recommended version 1 behavior. It is predictable, easy to test, and fails early when a source model does not match the current configuration.

2. Partial state dict loading.
   This would load only matching tensor names and shapes, leaving the rest randomly initialized. It is useful for cross-channel or cross-architecture experiments, but it requires careful reporting so users understand how much of the source model was actually reused.

3. Full staged transfer learning.
   This would freeze a backbone for several epochs and then unfreeze the whole model. It is closer to a textbook transfer learning workflow, but the project has many model architectures and no shared head/backbone naming contract yet.

## Scope For Version 1

In scope:

- Add transfer learning controls to the existing model training page.
- Allow selecting a completed training task as the source.
- Allow uploading a `.pth` or `.pt` weight file as the source.
- Validate source ownership and file existence on the backend.
- Use strict state dict loading in official training.
- Use strict state dict loading in uploaded-architecture training where compatible.
- Persist transfer learning metadata in task hyperparameters.
- Show transfer source and mode in training history hyperparameter summaries.
- Print transfer loading details in training logs.

Out of scope:

- Partial state dict loading.
- Cross-architecture transfer.
- Cross-channel transfer.
- Automatic adapter layers.
- Public marketplace sharing of weight files.
- New checkpoint formats.
- Rewriting the existing training loop.

## Compatibility Rules

For a completed task source, the backend should require:

- source task exists;
- source task belongs to the current user, unless the current user is an admin;
- source task status is `completed`;
- source task has an existing output model path;
- source task model source is compatible with the current model source;
- source task core hyperparameters match the new training configuration:
  - `model_source`;
  - `model_architecture` for official models;
  - uploaded model id and version for uploaded-architecture models;
  - `selected_channels`;
  - `window`;
  - `horizon`;
  - `use_sphere`;
  - official architecture-specific parameters.

For an uploaded weight source, the backend can only validate file type, owner, size, existence, and loadability before training. Exact tensor compatibility should still be checked by the training subprocess after the model is constructed.

When compatibility fails, the task should fail before or during startup with a clear message. The frontend should display the backend error as normal training-start feedback.

## Data Model

Add a new table for uploaded weight files, for example `training_weight_files`.

Fields:

- `id`: UUID string
- `user_id`: owner
- `original_filename`
- `storage_path`
- `content_hash`
- `file_size`
- `status`: `ready` or `invalid`
- `validation_report`: JSON text
- `created_at`
- `deleted_at`

Do not store uploaded weight source code or expose arbitrary file download endpoints.

No new columns are required on `model_training_tasks` for version 1. Store transfer learning settings in `hyperparameters` because the task still has exactly one trained output model. If transfer usage becomes important for filtering or auditing later, add explicit nullable columns in a follow-up migration.

## Backend API

Add endpoints under the training domain:

- `POST /training/weights`
  Upload one `.pth` or `.pt` file. Auth required. Returns metadata and validation report.

- `GET /training/weights`
  List the current user's non-deleted uploaded weights.

- `DELETE /training/weights/{weight_id}`
  Soft-delete an uploaded weight. Existing training tasks that already reference the file keep their historical hyperparameters, but new training starts cannot use a deleted weight.

Extend `TrainingStartRequest.hyperparameters` with the transfer keys. The public request schema can remain a dictionary, but backend normalization should preserve and validate known transfer keys.

## Backend Services

Add a focused service, for example `services/training_weight_service.py`.

Responsibilities:

- accept one uploaded weight file;
- enforce `.pth` or `.pt`;
- enforce a size limit;
- write to a server-controlled directory outside any static web root;
- compute a content hash;
- optionally run a shallow `torch.load(..., map_location="cpu", weights_only=True)` validation;
- record metadata;
- enforce owner access.

Extend `TrainingService.start_training` to resolve transfer sources before subprocess launch.

For `transfer_source_type = "task"`:

- load the source task record;
- enforce access;
- enforce completed status;
- validate the output file exists;
- compare safe task hyperparameters against the requested new task;
- inject an internal `_transfer_weight_path` into the subprocess payload.

For `transfer_source_type = "upload"`:

- load the uploaded weight record;
- enforce ownership;
- verify not deleted;
- inject `_transfer_weight_path` into the subprocess payload.

The internal path key must not be serialized into CLI args by `build_hyperparameter_args` because keys beginning with `_` are already skipped.

## Training Script Changes

Update `demo3.py` to accept public transfer options:

- `--transfer_learning`
- `--transfer_source_type`
- `--transfer_load_mode`
- `--freeze_mode`
- `--finetune_learning_rate`

The actual file path should arrive through an internal argument or environment variable controlled by `TrainingService`, for example:

- `ARESVISION_TRANSFER_WEIGHT_PATH`

After model construction and before optimizer creation:

1. If transfer learning is enabled, resolve the internal weight path.
2. Load the state dict with `torch.load(path, map_location=device, weights_only=True)`.
3. Call `model.load_state_dict(state_dict, strict=True)`.
4. Print a log line with source type, load mode, and weight filename.
5. If `finetune_learning_rate` is provided, use it for the optimizer.
6. Apply `freeze_mode`.

Version 1 freeze modes:

- `none`: all parameters trainable.
- `backbone`: optional. If implemented, freeze parameters except obvious projection or output layers. If a safe shared naming rule is not available, keep the UI to `none` only and add backbone freezing later.

The optimizer must be built after freezing so it only receives trainable parameters.

## Uploaded Architecture Runner

Apply the same transfer loading contract in `training_backbones/user_model_runner.py`.

Version 1 should only allow strict loading for uploaded architectures when the uploaded model package is the same as the source task or when the uploaded weight exactly matches the current uploaded model instance. Any mismatch should fail with a clear error.

This keeps custom model training consistent with official model training while avoiding partial compatibility promises.

## Frontend Design

Add a transfer learning section inside the existing training form, below core training parameters and above the start button.

Controls:

- toggle: enable transfer learning;
- source segmented control:
  - completed training task;
  - uploaded weight;
- completed task selector:
  - show only tasks with `status === "completed"`;
  - show model name, task id, architecture/source, channels, and data source;
- upload weight panel:
  - upload `.pth` or `.pt`;
  - list uploaded weights;
  - show validation status and file metadata;
- load mode:
  - fixed to strict in version 1;
- fine-tune learning rate:
  - default to `learning_rate * 0.1`;
- freeze mode:
  - fixed to none in version 1 unless a safe backend freeze implementation is added.

The start button should be disabled when transfer learning is enabled but no valid source is selected.

Training history should display a compact transfer indicator such as:

```text
Transfer: Task #12 / strict
```

or:

```text
Transfer: uploaded weight / strict
```

## Error Handling

Backend errors should be specific:

- source task not found;
- no permission to access source task;
- source task is not completed;
- source task output weight file is missing;
- source task configuration does not match current training configuration;
- uploaded weight not found;
- uploaded weight belongs to another user;
- uploaded weight file is missing;
- uploaded weight could not be loaded as a state dict;
- strict transfer loading failed because model parameters do not match.

The frontend should keep the user's selected parameters after an error so the user can adjust the transfer source or training configuration.

## Testing Strategy

Backend tests:

- normal training without transfer still builds the same subprocess args;
- transfer keys are preserved during hyperparameter normalization;
- internal `_transfer_weight_path` is not emitted as a public CLI arg;
- non-owner cannot use another user's completed task as a transfer source;
- incomplete source task is rejected;
- missing source weight path is rejected;
- mismatched completed task hyperparameters are rejected;
- uploaded weight upload rejects non-`.pth` and non-`.pt` files;
- uploaded weight upload records owner, hash, path, and status;
- `demo3.py` strict load path calls `load_state_dict(..., strict=True)`;
- uploaded model runner strict load path handles exact matches.

Frontend tests:

- transfer section is hidden or inactive by default;
- enabling transfer without a source disables start;
- completed task source appears only for completed tasks;
- uploaded weight source requires a ready uploaded weight;
- generated training hyperparameters include transfer keys when enabled;
- generated training hyperparameters omit transfer keys when disabled;
- training history renders transfer metadata safely.

Manual verification:

- Train a small official model for one epoch.
- Start a second task from that completed task with matching settings and lower fine-tune learning rate.
- Confirm logs show strict transfer loading.
- Confirm progress, loss chart, stop, delete, and completed-model test still work.
- Upload the saved `.pth` as an uploaded weight.
- Start a matching task from the uploaded weight and confirm strict transfer loading.

## Rollout Plan

1. Add transfer hyperparameter normalization and tests.
2. Add uploaded weight service, API, and tests.
3. Extend `TrainingService` to resolve completed-task and uploaded-weight transfer sources.
4. Add strict weight loading to `demo3.py`.
5. Add strict weight loading to `user_model_runner.py`.
6. Add frontend API helpers for training weights.
7. Add transfer learning controls to the training page.
8. Add frontend tests for hyperparameter generation and start-button guards.
9. Run the manual two-task smoke test.

## Acceptance Criteria

- A logged-in user can enable transfer learning from the training page.
- The user can select a completed compatible training task as the source.
- The user can upload and select a `.pth` or `.pt` weight file as the source.
- Starting transfer training with a compatible source loads the source weights before optimization.
- Incompatible strict loading fails with a clear message.
- Existing non-transfer training behavior remains unchanged.
- Existing task logs, progress updates, loss chart, task history, stop, delete, and completed-model testing continue to work.
