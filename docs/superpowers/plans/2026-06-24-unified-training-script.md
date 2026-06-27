# Unified Training Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 32 channel-specific training scripts with one configurable `demo3.py` script while preserving old training history.

**Architecture:** The backend exposes one trainable script and passes channel selection through hyperparameters/CLI args. The frontend keeps channel selection as UI state and no longer treats script filenames as channel presets. Existing historical `demo3-*.py` task records remain readable by parsing either `selected_channels` from hyperparameters or the old script suffix.

**Tech Stack:** FastAPI, Python subprocess training scripts, React/Vite, Node tests.

---

### Task 1: Centralize Channel Selection

**Files:**
- Create: `AresVision_backend/backend/models/训练模型/demo3.py`
- Modify: `AresVision_backend/backend/services/training_service.py`
- Modify: `AresVision_backend/backend/services/inference_service.py`

- [ ] Add `--selected_channels` to the unified script.
- [ ] Make backend return only `demo3.py` from `/training/scripts`.
- [ ] Store normalized `selected_channels` in task hyperparameters.
- [ ] Parse old tasks from script suffix as fallback.

### Task 2: Frontend Training Contract

**Files:**
- Modify: `frontend/src/pages/ModelTrainingPage.jsx`
- Modify: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.js`
- Modify: `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowInspector.jsx`

- [ ] Keep one script name, `demo3.py`.
- [ ] Add selected channels to hyperparameters.
- [ ] Show channel summary from hyperparameters when available.
- [ ] Compile workflow training drafts to `demo3.py`.

### Task 3: Verification

**Files:**
- Test: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js`

- [ ] Update workflow compiler tests for `demo3.py`.
- [ ] Run Node tests.
- [ ] Run Python syntax checks.
- [ ] Run frontend build.
