# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AresVision（智绘赤星）is a Mars ozone column concentration prediction and visualization system built for the Shanghai University Student Computer Competency Competition. It uses PredRNNv2 deep learning to predict Mars atmospheric ozone based on OpenMARS reanalysis data and MCD 6.1 climate simulation data.

## Development Commands

### Backend (Python/FastAPI)

Working directory: `AresVision_backend/backend/`

```bash
# Install dependencies
pip install -r requirements.txt
# Note: PyTorch is NOT in requirements.txt (commented out). Install separately:
# pip install torch==2.5.1  (CPU) or appropriate GPU version

# Run the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API docs available at:
# http://localhost:8000/docs
```

### Frontend (React/Vite)

Working directory: `frontend/`

```bash
npm install
npm run dev      # Vite dev server on port 5173
npm run build    # Production build
npm run preview  # Preview production build
```

## Architecture

### Backend

The backend is a FastAPI application (`backend/main.py`) that preloads all data into memory at startup via `lifespan`. Services are stored on `app.state` and accessed by routers via `request.app.state`.

**Three services initialized at startup:**
1. `DataService` (`services/data_service.py`) — Loads OpenMARS `.nc` files (ozone data, MY27/28) and MCD `.nc` files (6 environmental variables) into numpy arrays. Interpolates MCD data to align with OpenMARS Ls grid. All data queries are numpy slices for millisecond response.
2. `PredictService` (`services/predict_service.py`) — Loads PredRNNv2 model weights from `backend/models/predrnnv2/*.pt`. Handles inference with dynamic channel masking (7 channels: O₃ + 6 env variables). Includes LRU cache for prediction results.
3. `AIService` (`services/ai_service.py`) — Calls OpenAI-compatible chat API for natural language interpretation. Falls back to keyword-matched built-in replies when `AI_API_KEY` is not set.

**Data layout:**
- `backend/data/openmars/` — Multiple segmented `.nc` files per Mars Year, pattern: `openmars_ozo_my{N}_ls*.nc`
- `backend/data/mcd/` — Single `.nc` file per Mars Year: `MCD_MY{N}_Lat-90-90_real.nc`
- `backend/models/predrnnv2/` — Model weight files (`.pt` or `.pth`)

**API routes** (all prefixed with `/api`):
- `/api/explore/` — Globe point cloud, Ls-latitude heatmaps, seasonal band curves, env variable heatmaps, correlation matrix
- `/api/predict/` — Run prediction, get metrics, ablation experiments, diurnal variation
- `/api/ai/` — Chat endpoint

**Key configuration** (`backend/config.py`):
- Grid: 36 lat × 72 lon (5° resolution)
- Supported Mars Years: 27, 28
- Model: 7 channels, input window 3 steps, predict 3 steps
- AI API: configured via env vars `AI_API_URL`, `AI_MODEL_NAME`, `AI_API_KEY`

**Core model** (`backend/core/predrnn_v2.py`) — PredRNNv2 spatiotemporal LSTM implementation. Model expects input shape `(batch, window, channels, H, W)` and outputs `(batch, horizon, 1, H, W)`.

### Frontend

Single-page React app using inline styles with a space/sci-fi aesthetic. No React Router — navigation is managed with `useState` in `App.jsx` with CSS fade transitions.

**Pages:** `home`, `explore`, `predict`, `ai`, `about`

**Design system:**
- Colors centralized in `src/constants/colors.js` (referenced as `C.mars`, `C.ice`, `C.blue`, etc.)
- Fonts: Orbitron (headings), Exo 2 (body) — loaded via Google Fonts in `index.html`
- Components: `StarField` (animated background), `GlowCard`, `Navbar`, `SectionTitle`, chart/3D placeholders

**Backend connection:** Vite dev server proxies API calls; CORS is configured on backend to allow `localhost:5173` and `localhost:3000`.

## Environment Variables (Backend)

| Variable | Default | Description |
|---|---|---|
| `AI_API_URL` | `https://api.openai.com/v1/chat/completions` | LLM API endpoint |
| `AI_MODEL_NAME` | `gpt-4o-mini` | Model name |
| `AI_API_KEY` | `""` | API key (required for AI chat) |

Without `AI_API_KEY`, the AI chat falls back to keyword-matched built-in responses in Chinese.

## Changelog

<<<<<<< Updated upstream
<<<<<<< Updated upstream
### 2026-03-07 预测分析页视觉修复 + UI 恢复
涉及文件：`frontend/src/pages/PredictPage.jsx`（仅此一个文件）

- **恢复 FILE UPLOAD 区域**：左侧面板顶部第一个 GlowCard，标题 "FILE UPLOAD"，虚线边框 + 📁图标 + 拖拽提示，UI 占位（无真实上传逻辑）
- **恢复视图切换 Tab**：右侧结果区顶部 4 个 Tab（三联对比 / 原始数据 / 预测结果 / 差值分析），`viewMode` state 控制显示模式；triptych=三图并排，其余=单张全宽大图（h=400）
- **FieldCanvas 可视化质量全面提升**：Canvas 内部 720px 宽，带完整坐标轴（X 轴 7 个经度刻度 0°~360° 每 60°，Y 轴 7 个纬度刻度 -90°~90° 每 30°，含旋转轴标签），右侧 14px Colorbar（像素渲染渐变条 + top/mid/bot 三标签 + 旋转单位 μm-atm）
- **Inferno 色阶**（`infernoRgb`）：真值图和预测图使用，8-stop 标准 Inferno
- **RdBu 发散色阶**（`rdbuRgb`）：差值图使用，11-stop 标准 RdBu（深蓝→白→深红），以 0 为对称中心（[-absMax, +absMax]），Colorbar 标注 -maxAbs / 0 / +maxAbs
- **指标解读文字**：评估指标区底部添加带左边框 blockquote 风格解读文本，填入 lsStart/marsYear/horizon/变量列表/RMSE/SSIM/R² 真实值

### 2026-03-07 预测分析流水线修复 + 前端对接
涉及文件：`AresVision_backend/backend/config.py`、`AresVision_backend/backend/core/predrnn_v2.py`、`AresVision_backend/backend/services/predict_service.py`、`frontend/src/pages/PredictPage.jsx`

**`config.py`**
- `MODEL_CONFIG.num_hidden`：`[64,64,64,64]`（4层）→ `[64,64,64]`（3层，与训练权重匹配）
- `MODEL_CONFIG.filter_size`：`5` → `3`
- `MODEL_CONFIG.layer_norm`：`True` → `False`

**`core/predrnn_v2.py`（完全重写）**
- 替换为训练脚本 demo3.py 的原版 `SpatioTemporalLSTMCellv2` 结构，与 `predrnn_highlat_gpu.pth` 权重精确匹配
- 关键差异：`conv_last = Conv2d(num_hidden*2, num_hidden, 1)`；遗忘门含 `+1.0` bias；无 layer_norm / input_adapter / channel_mask 参数
- `forward(x)` 签名简化为只接收输入张量，Decoder 固定用 `x[:, -1]` 作为所有步的解码输入（与训练一致）

**`services/predict_service.py`（重大重写）**
- `_load_model`：使用新 `PredRNNv2(input_dim=7, hidden_dims=[64,64,64], height=36, width=72, horizon=3)`；先尝试 strict=True 加载，失败回退 strict=False 并记录 warning
- `_compute_scalers`：启动时从 MY27 全量数据计算 7 通道 StandardScaler 和臭氧全局 y_mean/y_std
- `_apply_physical_preprocess`：通道 5（Dust_Optical_Depth）log1p 变换，通道 6（Solar_Flux_DN）除以全局最大值归一化（与训练时一致，在标准化前做）
- `_preprocess_input`：物理预处理 → StandardScaler 变换
- `_postprocess_output`：`pred * y_std + y_mean` 反标准化回物理单位 μm-atm
- `_run_inference`：通道掩码置零 → 预处理 → 推理（无 channel_mask 参数）→ 取前 horizon 步 → 反标准化

**`frontend/src/pages/PredictPage.jsx`（完全重写）**
- 新增 `FieldCanvas` 组件（Canvas 渲染 36×72 lat-lon 热力图，Inferno / RdBu 色阶）
- 新增状态：`lsStart`（Ls 滑块 0°-355°，步长 5°）、`marsYear`（MY27/28 切换）、`loading`、`results`、`metrics`、`activeHorizon`
- `handlePredict`：并发调用 `/predict/run` + `/predict/metrics`，完整 loading 状态管理
- 三联对比图实时渲染真值/预测/差值；逐步指标表格行可点击联动 activeHorizon；整体指标卡片动态显示
=======
=======
>>>>>>> Stashed changes
### 2026-03-06 数据总览页面开发 🚀
- **新增 DataOverviewPage 组件**：实现高科技感数据中心界面
  - 中心3D火星球：基于 react-globe.gl，显示臭氧浓度数据点
  - 动态数据窗口：6个可视化窗口，支持缩放联动和点击放大
  - 球体缩放交互：滚轮控制，窗口透明度和位置动态变化
- **依赖升级**：添加 react-globe.gl、d3-scale、react-plotly.js 等可视化库
- **DataOverviewContext**：创建数据上下文管理状态
- **导航更新**：在 Navbar 中添加"数据总览"页面入口
- **视觉效果**：太空主题背景、霓虹发光边框、动态粒子效果
- **交互体验**：球体放大时窗口后移变透明，缩小时窗口前移变不透明
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

### 2026-03-06 Three.js 火星球体 + 光照调优 + 纹理本地化
- `Mars3DPlaceholder.jsx` 用 Three.js 彻底重写，替换 CSS background-position 方案
- SphereGeometry + MeshStandardMaterial（roughness 0.95）实现写实 3D 球体
- 三光源体系：DirectionalLight(0.9) + AmbientLight(0.5) + 背面 PointLight(0xaaccff, 0.3)，暗面柔和不纯黑
- 纹理 URL 从远程 NASA/Wikipedia 改为本地 `/mars_texture.jpg`（跨域问题）
- 纹理加载失败链式 fallback → 纯色球体 → WebGL 失败时 CSS 渐变 fallback
- 大气壳层（BackSide 半透明球）+ CSS box-shadow 光晕保留

### 2026-03-06 首页视觉升级
- `Mars3DPlaceholder.jsx` 从静态图片 + CSS spin-slow 改为 CSS background-position 滚动纹理（后被 Three.js 方案替代）
- 添加 limb darkening radial-gradient 和大气散射效果
- `HomePage.jsx` SCROLL 指示器从 `position: absolute` 改为文档流内元素，修复漂移到卡片区域的闪烁 bug
- `index.css` 添加 `mars-rotate` 关键帧（后被移除）
- 生成项目根目录 `README.md`

### 2026-03-05 数据探索页性能优化 + 可视化质量提升 + 交互增强
- 后端降采样 + Canvas 渲染优化
- 热力图、折线图可视化质量提升
- 交互增强与 bug 修复

### 2026-03-05 初始提交
- FastAPI 后端：DataService / PredictService / AIService 三服务架构
- React 前端：5 页面 SPA，太空科幻视觉风格
- PredRNNv2 时空 LSTM 模型集成

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AresVision** (373 symbols, 776 relationships, 28 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/AresVision/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AresVision/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AresVision/clusters` | All functional areas |
| `gitnexus://repo/AresVision/processes` | All execution flows |
| `gitnexus://repo/AresVision/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->
