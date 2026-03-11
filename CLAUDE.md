# CLAUDE.md

## Project Overview

AresVision (智绘赤星) is a Mars ozone column concentration prediction and visualization system built for the Shanghai University Student Computer Competency Competition. The backend uses PredRNNv2 spatiotemporal LSTM to predict Mars atmospheric ozone distributions based on OpenMARS reanalysis data (MY27/28) and MCD 6.1 climate simulation data. The frontend is a space-themed SPA providing interactive exploration, prediction, and AI-powered analysis.

---

## Development Commands

### Backend

Working directory: `AresVision_backend/backend/`

```bash
# Install dependencies
pip install -r requirements.txt

# PyTorch is NOT in requirements.txt — install separately:
pip install torch==2.5.1        # CPU
# or install GPU version appropriate for your CUDA

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API docs: http://localhost:8000/docs
```

### Frontend

Working directory: `frontend/`

```bash
npm install
npm run dev      # Vite dev server on port 5173
npm run build    # Production build
npm run preview  # Preview production build
```

---

## Architecture

### Backend

#### Startup Flow (`main.py` lifespan)

Services are created sequentially at startup and stored on `app.state`. Routers access them via `request.app.state`.

**4-step initialization:**

1. **`DataService`** (`services/data_service.py`) — Loads OpenMARS `.nc` files (ozone o3col) and MCD `.nc` files (6 env variables) into numpy arrays for MY27 and MY28. Aligns MCD Ls grid to OpenMARS Ls via `core/data_align.py` interpolation. Stores two aligned copies: `aligned_mcd` (analysis, no extrapolation) and `aligned_mcd_predict` (prediction, with extrapolation matching training).

2. **`AnalysisService`** (`services/analysis_service.py`) + **`PredictDataService`** (`services/predict_data_service.py`) — Domain services sitting on top of DataService:
   - `AnalysisService`: computes globe point clouds, Ls-lat heatmaps, 5-band seasonal curves, env variable heatmaps, Pearson correlation matrices, diurnal curves. Has in-memory dict cache.
   - `PredictDataService`: slices numpy arrays into `(window, C, H, W)` model input tensors and ground truth arrays.

3. **ML pipeline**:
   - `AnalysisTransforms` (`core/analysis_transforms.py`) — preprocessing for analysis
   - `PredictTransforms` (`core/predict_transforms.py`) — preprocessing matching `demo3.py` training: physical transforms (log1p for Dust, normalize Solar Flux) → StandardScaler (fit on MY27) → inverse transform for output
   - `PredictInference` (`core/predict_inference.py`) — loads PredRNNv2 weights from `backend/models/predrnnv2/`, auto-selects CUDA/CPU, runs forward pass
   - `PredictOrchestratorService` (`services/predict_service.py`) — orchestrates the full pipeline: channel masking → transforms → inference → metrics → result assembly. LRU cache (32 entries).

4. **`AIService`** (`services/ai_service.py`) — Calls an OpenAI-compatible chat API (configured for Google Gemini by default). Falls back to keyword-matched Chinese built-in replies when `AI_API_KEY` is not set.

#### Data File Layout

```
backend/data/
  openmars/          # OpenMARS nc files
    *my27*ls*.nc     # Mars Year 27, multiple Ls-segment files
    *my28*ls*.nc     # Mars Year 28, multiple Ls-segment files
  mcd/
    *my27*.nc        # MCD 6.1 data for MY27
    *my28*.nc        # MCD 6.1 data for MY28

backend/models/
  predrnnv2/
    *.pt / *.pth     # PredRNNv2 trained weights (e.g. predrnn_highlat_gpu.pth)
```

#### API Routes (all under `/api` prefix)

**Analysis routes** (`routers/analysis.py` → prefix `/explore`):
- `GET /api/explore/globe?my=&ls=` — 3D point cloud for one Ls snapshot
- `GET /api/explore/seasonal-heatmap?my=` — Ls-latitude ozone heatmap (zonal mean)
- `GET /api/explore/seasonal-bands?my=` — 5-band seasonal ozone curves
- `GET /api/explore/env-heatmap?my=&variable=` — env variable Ls-lat heatmap
- `GET /api/explore/correlation?my=` — Pearson correlation matrix (O3 vs 6 env vars)
- `GET /api/explore/info` — available years and Ls ranges

**Prediction routes** (`routers/predict.py` → prefix `/predict`):
- `POST /api/predict/run` — run prediction, returns ground_truth/prediction/residual fields
- `POST /api/predict/metrics` — return RMSE/MAE/SSIM/R2 metrics (reuses cached prediction)
- `GET /api/predict/ablation?my=&ls=` — 5-combo ablation study
- `GET /api/predict/diurnal?my=&ls=&lat_band=` — diurnal variation curve for a latitude band
- `GET /api/predict/model-info` — model metadata

**AI route** (`routers/ai.py` → prefix `/ai`):
- `POST /api/ai/chat` — LLM chat with optional prediction context

#### Core Configuration (`config.py`)

| Constant | Value | Description |
|---|---|---|
| `N_LAT / N_LON` | 36 / 72 | Grid size (5 degree resolution) |
| `SUPPORTED_MARS_YEARS` | [27, 28] | Available Mars Years |
| `MCD_VARIABLES` | 6 vars | U_Wind, V_Wind, Pressure, Temperature, Dust_Optical_Depth, Solar_Flux_DN |
| `MODEL_CONFIG.total_channels` | 7 | O3 + 6 env variables |
| `MODEL_CONFIG.num_hidden` | [64, 64, 64] | 3-layer PredRNNv2 |
| `MODEL_CONFIG.input_window` | 3 | Encoder steps |
| `MODEL_CONFIG.pred_horizon` | 3 | Decoder steps |
| `MAX_LS_POINTS` | 500 | Heatmap/curve downsampling cap |

#### PredRNNv2 Model (`core/predict_model.py`)

- Architecture: 3-layer spatiotemporal LSTM with zigzag memory `M`
- Input: `(batch, window=3, channels=7, height=36, width=72)`
- Output: `(batch, horizon=3, 1, height=36, width=72)` — ozone channel only
- Decoder uses last encoder input frame (not autoregressive prediction), matching `demo3.py` training
- Key detail: forget gate has `+1.0` bias; `conv_last = Conv2d(num_hidden*2, num_hidden, 1)`

---

### Frontend

#### Page Structure

Navigation state managed by `useState` in `App.jsx` with CSS fade transitions. No React Router.

| State key | Component | Description |
|---|---|---|
| `home` | `HomePage.jsx` | Hero landing with Mars 3D sphere and feature cards |
| `overview` | `DataOverviewPage.jsx` | Data center with 3D globe, heatmaps, and 6 data windows |
| `explore` | `ExplorePage.jsx` | Full data exploration: globe, heatmaps, bands, correlation |
| `predict` | `PredictPage.jsx` | PredRNNv2 prediction with Canvas field visualization |
| `ai` | `AIPage.jsx` | AI chat assistant with context injection |
| `about` | `AboutPage.jsx` | Project introduction |

#### Active Components

| Component | Used by |
|---|---|
| `Navbar.jsx` | App.jsx |
| `StarField.jsx` | App.jsx — animated star background |
| `GlowCard.jsx` | Multiple pages |
| `SectionTitle.jsx` | Multiple pages |
| `ChartPlaceholder.jsx` | Multiple pages |
| `Mars3DPlaceholder.jsx` | HomePage — Three.js Mars sphere with 3-light system |
| `SphericalFieldCanvas.jsx` | DataOverviewPage — spherical ozone field rendering |

#### Active Contexts

- `DataOverviewContext.jsx` — provides globe zoom/active-window state to `DataOverviewPage`

#### Design System

- **Colors**: `src/constants/colors.js` — import as `C.mars`, `C.ice`, `C.blue`, etc.
- **Fonts**: Orbitron (headings) + Exo 2 (body) loaded via Google Fonts in `index.html`
- **Style approach**: inline styles throughout (no Tailwind in practice despite config presence)
- **Key libraries**: React 19, Three.js 0.183, react-globe.gl, react-plotly.js, d3-scale, @mui/material

#### Backend Connection

Vite dev server proxies `/api/*` → `http://localhost:8000/api/*` (configured in `vite.config.js`). All API calls go through `src/services/api.js` using native `fetch`.

---

## Environment Variables (Backend)

Set in `AresVision_backend/backend/.env` (not committed to git):

| Variable | Default | Description |
|---|---|---|
| `AI_API_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | LLM API endpoint |
| `AI_MODEL_NAME` | `gemini-1.5-flash` | Model name |
| `AI_API_KEY` | `""` | API key — required for live AI chat; falls back to keyword replies if empty |

---

## Data Preparation

Before running the backend, place the following files:

```
backend/data/openmars/     <- OpenMARS nc files matching pattern *my{N}*ls*.nc
backend/data/mcd/          <- MCD nc files matching pattern *my{N}*.nc
backend/models/predrnnv2/  <- Model weights (.pt or .pth)
frontend/public/           <- mars_texture.jpg (local Mars texture, excluded from git)
```

The backend logs warnings and continues if files are missing (model uses random weights without weights file).

---

## Changelog

### 2026-03-11 — Project cleanup
- Deleted 15 orphaned/debug files (see CLEANUP_REPORT.md)
- Completed .gitignore with missing entries
- Rewrote CLAUDE.md to reflect current architecture

### 2026-03-07 — Prediction pipeline fix + frontend integration
- `config.py`: `num_hidden` corrected to `[64,64,64]` (3 layers), `filter_size=3`, `layer_norm=False`
- `core/predict_model.py`: Rewrote to exactly match `demo3.py` training structure
- `services/predict_service.py`: Major rewrite — StandardScaler on MY27, physical preprocessing, inverse transform
- `frontend/src/pages/PredictPage.jsx`: FieldCanvas (Canvas 720px, Inferno/RdBu colormaps, axes, colorbar), triptych view, FILE UPLOAD placeholder

### 2026-03-06 — DataOverview page + 3D globe
- Added `DataOverviewPage.jsx` with react-globe.gl 3D Mars globe and 6 data windows
- `Mars3DPlaceholder.jsx` rewritten with Three.js (MeshStandardMaterial, 3-light system, local texture)
- `DataOverviewContext.jsx` for globe zoom/window interaction state

### 2026-03-05 — Data exploration performance + visualization
- Backend downsampling (MAX_LS_POINTS=500) + Canvas rendering
- Heatmap/line chart quality improvements

### 2026-03-05 — Initial commit
- FastAPI backend: DataService / PredictService / AIService architecture
- React frontend: 5-page SPA with space/sci-fi aesthetic
- PredRNNv2 spatiotemporal LSTM model integration

---

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AresVision**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping.
- When you need full context on a specific symbol, use `gitnexus_context({name: "symbolName"})`.

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first.
- **Extracting/Splitting**: MUST run `gitnexus_context` then `gitnexus_impact` before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a symbol without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename`.
- NEVER commit without running `gitnexus_detect_changes()`.

## Tools Quick Reference

| Tool | When to use |
|------|-------------|
| `gitnexus_query({query: "..."})` | Find code by concept |
| `gitnexus_context({name: "..."})` | 360-degree view of one symbol |
| `gitnexus_impact({target: "...", direction: "upstream"})` | Blast radius before editing |
| `gitnexus_detect_changes({scope: "staged"})` | Pre-commit scope check |
| `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` | Safe rename |

## Keeping the Index Fresh

```bash
npx gitnexus analyze            # re-index after commits
npx gitnexus analyze --embeddings  # preserve embeddings
npx gitnexus status             # check freshness
```
