# 采样密度切换功能实现报告

## 修改记录

### 后端 (Backend)
- **`schemas/predict.py`**: 在 `PredictRequest` 中新增 `perf_density` 字段 (默认 80)。
- **`services/predict_service.py`**: 
    - 修改 `get_performance_curve` 接收 `perf_density`。
    - 将 `density` 参数加入 MD5 缓存 Key 生成逻辑。
    - 动态计算采样步长：`step = max(1, total_len // perf_density)`。
- **`routers/predict.py`**: 更新路由接口，确保单模型和多模型对比都能正确透传密度参数。

### 前端 (Frontend)
- **`services/api.js`**: 更新 `fetchPerformanceCurve` 和 `fetchPerformanceComparison` 接口定义。
- **`pages/PredictPage.jsx`**:
    - 新增 `perfDensity` 状态。
    - 在“属性分析”卡片标题栏添加了滑动条 UI。
    - 同步更新 API 调用逻辑。

## 验证结果
1.  **性能分析速度**：当设置较低密度（如 40 pts）时，计算速度显著提升。
2.  **数据准确性**：不同密度的结果会生成不同的缓存文件，不会发生覆盖或混淆。
3.  **UI 交互**：滑动条实时显示点数，点击生成后按选定点数渲染曲线。
