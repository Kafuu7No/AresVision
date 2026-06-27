# Predict Workflow Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled node-based workflow mode to the model prediction page that can run predictions and send training drafts to the existing training page.

**Architecture:** Use `@xyflow/react` for the canvas and keep workflow-specific logic isolated under `frontend/src/pages/PredictPage/WorkflowCanvas/`. Compile the graph into existing API calls and `sessionStorage` training drafts, avoiding backend changes.

**Tech Stack:** React 19, Vite, `@xyflow/react`, existing AresVision API wrappers, existing chart components, Node's built-in test runner for compiler logic.

---

## File Map

- Create `frontend/src/pages/PredictPage/WorkflowCanvas/workflowSchema.js`: node types, default data, channel ordering, valid edge rules.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.js`: graph validation, prediction compilation, training draft compilation.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js`: Node tests for script generation, validation, and prediction compilation.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/workflowLayout.js`: initial graph template and simple auto-arrange helper.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowNode.jsx`: shared React Flow node renderer.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/NodePalette.jsx`: draggable node palette.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowInspector.jsx`: selected-node editor and compiled summary.
- Create `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowCanvas.jsx`: canvas shell, actions, results, chart reuse.
- Modify `frontend/src/pages/PredictPage.jsx`: add Traditional Prediction / Workflow Canvas mode switch and render the canvas.
- Modify `frontend/src/pages/ModelTrainingPage.jsx`: consume `aresvision_training_draft` once and prefill existing training state.
- Modify `frontend/src/stores/predictCache.js`: persist workflow mode and graph state during SPA navigation.
- Modify `frontend/package.json` and `frontend/package-lock.json`: add `@xyflow/react`.

---

### Task 1: Add Dependency And Compiler Tests

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js`

- [ ] **Step 1: Install the canvas dependency**

Run:

```powershell
cd D:\AApycharm\AresVision\frontend
npm install @xyflow/react
```

Expected: `package.json` and `package-lock.json` include `@xyflow/react`.

- [ ] **Step 2: Write failing compiler tests**

Create `workflowCompiler.test.js` with tests that import `compilePredictionWorkflow`, `compileTrainingDraft`, and `validateWorkflowGraph`. The tests must cover baseline script generation, full channel script generation, invalid missing model validation, and prediction output compilation.

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
cd D:\AApycharm\AresVision\frontend
node --test src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js
```

Expected: FAIL because `workflowCompiler.js` does not exist yet.

---

### Task 2: Implement Workflow Schema And Compiler

**Files:**
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowSchema.js`
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.js`
- Test: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js`

- [ ] **Step 1: Implement schema constants**

Add node type IDs, channel definitions, channel order `U,V,D,S,T`, node defaults, and valid source/target edge pairs.

- [ ] **Step 2: Implement compiler functions**

Implement:

```js
validateWorkflowGraph(nodes, edges, mode)
compilePredictionWorkflow(nodes, edges)
compileTrainingDraft(nodes, edges, availableScripts)
getScriptForVariables(selectedVariables)
```

The compiler must return deterministic script names such as `demo3-.py`, `demo3-DT.py`, and `demo3-UVDST.py`.

- [ ] **Step 3: Run tests to verify GREEN**

Run:

```powershell
cd D:\AApycharm\AresVision\frontend
node --test src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js
```

Expected: PASS.

---

### Task 3: Build Canvas Support Components

**Files:**
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/workflowLayout.js`
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowNode.jsx`
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/NodePalette.jsx`
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowInspector.jsx`

- [ ] **Step 1: Add initial graph layout**

Create a default graph with Data Source, Mars Context, five Input Channel nodes, PredRNNv2 Model, Training Config, Triptych, and Metrics nodes.

- [ ] **Step 2: Add shared node UI**

Render cyan headers, dark node bodies, input/output handles, node status, and compact validation text.

- [ ] **Step 3: Add node palette**

Allow dragging configured node templates into the canvas.

- [ ] **Step 4: Add inspector**

Allow editing Data Source, Mars Context, Model horizon, and Training Config properties. Show compiled summary and validation errors when nothing is selected.

---

### Task 4: Implement WorkflowCanvas

**Files:**
- Create: `frontend/src/pages/PredictPage/WorkflowCanvas/WorkflowCanvas.jsx`

- [ ] **Step 1: Add React Flow shell**

Use `ReactFlowProvider`, `ReactFlow`, `Background`, `Controls`, and `MiniMap`. Support node drag/drop, connection validation, edge deletion, reset, and auto-arrange.

- [ ] **Step 2: Add Run Prediction action**

Compile graph and call existing API wrappers. Render selected output components with existing `PredictDisplay`, `PredictMetrics`, `ErrorDistributionChart`, and `PermutationImportanceChart`.

- [ ] **Step 3: Add Send To Training Page action**

Compile training draft, write `sessionStorage.aresvision_training_draft`, and navigate to `#/training?from=workflow`.

- [ ] **Step 4: Persist graph state**

Use `predictCache` to preserve workflow nodes and edges during SPA navigation.

---

### Task 5: Integrate With PredictPage

**Files:**
- Modify: `frontend/src/pages/PredictPage.jsx`
- Modify: `frontend/src/stores/predictCache.js`

- [ ] **Step 1: Add prediction mode state**

Add `predictionMode` with values `traditional` and `workflow`.

- [ ] **Step 2: Add segmented mode switch**

Render a compact switch below the title. Traditional mode renders the existing layout unchanged. Workflow mode renders `WorkflowCanvas`.

- [ ] **Step 3: Persist mode**

Store `predictionMode` in `predictCache`.

---

### Task 6: Integrate Training Draft Prefill

**Files:**
- Modify: `frontend/src/pages/ModelTrainingPage.jsx`

- [ ] **Step 1: Read draft once**

On mount, read `sessionStorage.aresvision_training_draft`, parse it, then remove it.

- [ ] **Step 2: Prefill training state**

Set selected channels, selected script, hyperparameters, and data source from the draft. Leave model name empty.

- [ ] **Step 3: Keep validation intact**

The existing script availability and model name validation remain authoritative before starting training.

---

### Task 7: Verify

**Files:**
- All modified frontend files.

- [ ] **Step 1: Run compiler tests**

Run:

```powershell
cd D:\AApycharm\AresVision\frontend
node --test src/pages/PredictPage/WorkflowCanvas/workflowCompiler.test.js
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
cd D:\AApycharm\AresVision\frontend
npm run build
```

Expected: build exits 0. A chunk-size warning is acceptable because it already exists in this project.

- [ ] **Step 3: Review diff**

Run:

```powershell
cd D:\AApycharm\AresVision
git diff --stat
git status --short
```

Expected: only planned files changed plus existing untracked `.codex_tmp/`.
