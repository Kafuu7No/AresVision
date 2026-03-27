"""
预测服务编排层
负责协调 MLDataPrepService, DataTransforms, ModelInferenceService, 获取结果并组装响应
"""
import itertools
import hashlib
import json
import logging
import asyncio
import numpy as np
import torch
import shap
from sklearn.metrics import r2_score

from cachetools import LRUCache

from config import MODEL_CONFIG
from services.data_service import DataService
from services.predict_data_service import PredictDataService
from core.predict_transforms import PredictTransforms
from core.metrics import compute_metrics, empty_metrics
from core.predict_inference import PredictInference

logger = logging.getLogger("aresvision.predict")


class PredictOrchestratorService:
    def __init__(
        self,
        data_service: DataService,
        ml_data_prep: PredictDataService,
        transforms: PredictTransforms,
        inference: PredictInference,
    ):
        self.data_service = data_service
        self.ml_data_prep = ml_data_prep
        self.transforms = transforms
        self.inference = inference

        self._result_cache = LRUCache(maxsize=32)

    def predict(
        self,
        mars_year: int,
        ls_start: float,
        selected_variables: list[str],
        horizon: int = 3,
    ) -> dict:
        cache_key = self._make_cache_key(mars_year, ls_start, selected_variables, horizon)
        if cache_key in self._result_cache:
            cached_res = self._result_cache[cache_key]
            if "model_info" in cached_res:
                logger.info("命中有效预测缓存")
                return cached_res
            else:
                logger.info("响应缓存存在但缺少元数据，强制刷新")

        cfg = MODEL_CONFIG
        window = cfg["input_window"]

        # 1. 获取输入数据 (使用预测专用对齐数据)
        input_arr, channel_mask, input_ls = self.ml_data_prep.get_model_input(
            mars_year, ls_start, window, selected_variables,
            use_predict_data=True
        )

        # 2. 获取真值
        try:
            truth_arr, truth_ls = self.ml_data_prep.get_ground_truth(
                mars_year, ls_start, window, horizon,
            )
        except ValueError as e:
            logger.warning(f"无法获取真值: {e}")
            truth_arr = None
            truth_ls = np.array([ls_start + i * 5.0 for i in range(horizon)])

        # 3. 编排并执行推理流程
        pred_arr, model_info = self._run_inference_pipeline(input_arr, channel_mask, ls_start, selected_variables, horizon)

        # 4. 计算指标与组装
        actual_horizon = pred_arr.shape[0]

        if truth_arr is not None:
            actual_horizon = min(actual_horizon, truth_arr.shape[0])
            pred_arr = pred_arr[:actual_horizon]
            truth_arr = truth_arr[:actual_horizon]
            residual_arr = pred_arr - truth_arr
            metrics = compute_metrics(truth_arr, pred_arr)
        else:
            residual_arr = np.zeros_like(pred_arr)
            metrics = empty_metrics(actual_horizon)

        om = self.data_service.get_openmars_data(mars_year)
        lat_arr = om["lat"]
        lon_arr = om["lon"]

        result = {
            "ground_truth": self._fields_to_dicts(
                truth_arr if truth_arr is not None else pred_arr,
                lat_arr, lon_arr
            ),
            "prediction": self._fields_to_dicts(pred_arr, lat_arr, lon_arr),
            "residual": self._fields_to_dicts(residual_arr, lat_arr, lon_arr),
            "ls_values": [float(v) for v in truth_ls[:actual_horizon]],
            "selected_variables": selected_variables,
            "horizon": actual_horizon,
            "metrics": metrics,
            "model_info": model_info,
        }

        self._result_cache[cache_key] = result
        return result

    def _run_inference_pipeline(
        self,
        input_arr: np.ndarray,
        channel_mask: np.ndarray,
        ls_start: float,
        selected_variables: list[str],
        horizon: int,
    ) -> tuple[np.ndarray, dict]:
        # a. 动态获取模型
        model, input_dim, model_info = self.inference.get_model_for_variables(selected_variables)

        # b. 构造满足模型维度要求的输入
        # ARESVISION IMPORTANT: 如果触发了回退 (is_fallback)，说明正在使用全量 6 通道模型
        # 此时必须跳过按需切片，直接传递全量 input_arr
        if model_info.get("is_fallback", False) or model_info.get("suffix") == "UVDST":
            final_input_arr = input_arr
            logger.info("回退机制激活: 强制使用全量 6 通道输入适配 UVDST 模型")
        elif input_dim < 7:
            indices = [0]
            from config import TRAINING_MASTER_ORDER
            for i, var in enumerate(TRAINING_MASTER_ORDER, start=1):
                if channel_mask[i] == 1.0:
                    indices.append(i)
            # 这里的 indices 顺序决定了 final_input_arr 的通道顺序
            final_input_arr = input_arr[:, indices[:input_dim]]
        else:
            final_input_arr = input_arr

        # c. 预处理与标准化
        # 如果数据源是预处理好的张量，则跳过标准化步骤
        if getattr(self.ml_data_prep, "processed_data", None) is not None:
            scaled_input = final_input_arr
            # 同步反标准化所需的均值和标准差，确保一致性
            self.transforms.y_mean = self.ml_data_prep.processed_data.get('y_mean', self.transforms.y_mean)
            self.transforms.y_std = self.ml_data_prep.processed_data.get('y_std', self.transforms.y_std)
        else:
            scaled_input = self.transforms.preprocess_input(final_input_arr, selected_variables)

        # d. 模型推理
        device = self.inference.device
        x = torch.from_numpy(scaled_input).unsqueeze(0).float().to(device)
        pred_scaled = self.inference.infer(model, x, horizon)

        # e. 反标准化
        pred_physical = self.transforms.postprocess_output(pred_scaled)
        return pred_physical, model_info

    def get_ablation_results(
        self,
        mars_year: int = 27,
        ls_start: float = 90.0,
    ) -> list[dict]:
        from config import MCD_VARIABLES
        combos = [
            ("Full (All 7ch)", MCD_VARIABLES.copy()),
            ("No Dust", [v for v in MCD_VARIABLES if v != "Dust_Optical_Depth"]),
            ("No Wind", [v for v in MCD_VARIABLES if "Wind" not in v]),
            ("Temp + Solar Only", ["Temperature", "Solar_Flux_DN"]),
            ("O3 Only (Baseline)", []),
        ]

        results = []
        for label, variables in combos:
            try:
                result = self.predict(mars_year, ls_start, variables, horizon=3)
                m = result["metrics"]["overall"]
                results.append({
                    "variable_combo": label,
                    "variables": variables,
                    "rmse": m["rmse"],
                    "mae": m["mae"],
                    "ssim": m["ssim"],
                    "r2": m["r2"],
                })
            except Exception as e:
                logger.warning(f"消融实验 '{label}' 失败: {e}")
                results.append({
                    "variable_combo": label,
                    "variables": variables,
                    "rmse": 0.0, "mae": 0.0, "ssim": 0.0, "r2": 0.0,
                })

        return results

    def get_performance_curve(self, selected_variables: list[str]) -> dict:
        """
        获取模型在测试集上的性能曲线数据 (R2 分数) 以及全局汇总 R2。
        引入文件持久化缓存以优化计算效率。
        """
        from config import PERF_CACHE_DIR
        
        # 构造持久化缓存 key
        perf_key_data = {
            "vars": sorted(selected_variables),
            "data_mtime": self.ml_data_prep.processed_data_mtime if hasattr(self.ml_data_prep, 'processed_data_mtime') else "default"
        }
        perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
        cache_file = PERF_CACHE_DIR / f"perf_{perf_hash}.json"

        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    logger.info(f"命中持久化性能缓存: {cache_file.name}")
                    return json.load(f)
            except Exception as e:
                logger.warning(f"读取性能缓存失败: {e}")

        if self.ml_data_prep.processed_data is None:
            logger.warning("未加载预处理数据，无法生成性能曲线")
            return {"items": [], "global_r2": 0.0}
            
        data = self.ml_data_prep.processed_data
        ls_array = data['om_ls_raw']
        total_len = len(ls_array)
        split_idx = int(0.8 * total_len)
        
        # 识别年份分界线
        diffs = np.diff(ls_array)
        split_indices = np.where(diffs < -180)[0]
        my28_start = split_indices[0] + 1 if len(split_indices) > 0 else total_len
        
        results = []
        all_truths = []
        all_preds = []

        # 为了保证前端渲染性能，我们对测试集进行抽样 (增加采样密度)
        test_samples_count = total_len - split_idx
        step = max(1, test_samples_count // 150) 
        
        logger.info(f"正在生成性能曲线 (测试集范围: {split_idx} -> {total_len}, 步长: {step})")
        
        for i in range(split_idx, total_len - 3, step):
            ls = float(ls_array[i])
            my = 27 if i < my28_start else 28
            
            try:
                # 调用 predict 获取指标
                res = self.predict(my, ls, selected_variables, horizon=3)
                m_overall = res["metrics"]["overall"]
                
                # 收集用于全局指标计算的数据
                for h_idx in range(res["horizon"]):
                    f_truth = np.array(res["ground_truth"][h_idx]["field"]).flatten()
                    f_pred = np.array(res["prediction"][h_idx]["field"]).flatten()
                    
                    valid = ~np.isnan(f_truth)
                    all_truths.append(f_truth[valid])
                    all_preds.append(f_pred[valid])

                results.append({
                    "ls": round(ls, 2),
                    "my": my,
                    "r2": round(float(m_overall["r2"]), 4),
                    "rmse": round(float(m_overall["rmse"]), 6),
                    "mae": round(float(m_overall["mae"]), 6),
                    "ssim": round(float(m_overall["ssim"]), 4),
                })
            except Exception as e:
                logger.debug(f"性能曲线采样失败 (MY{my} Ls{ls}): {e}")
                
        global_r2 = 0.0
        global_rmse = 0.0
        global_mae = 0.0
        global_ssim = 0.0
        
        if all_truths:
            t_cat = np.concatenate(all_truths)
            p_cat = np.concatenate(all_preds)
            if len(t_cat) > 10:
                global_r2 = float(r2_score(t_cat, p_cat))
                global_rmse = float(np.sqrt(np.mean((t_cat - p_cat)**2)))
                global_mae = float(np.mean(np.abs(t_cat - p_cat)))
                # 全局 SSIM 通常取采样点的均值比较有物理意义
                global_ssim = float(np.mean([r["ssim"] for r in results]))

        final_res = {
            "items": results,
            "global_r2": round(global_r2, 4),
            "global_rmse": round(global_rmse, 6),
            "global_mae": round(global_mae, 6),
            "global_ssim": round(global_ssim, 4),
        }

        # 写入持久化缓存
        try:
            if not PERF_CACHE_DIR.exists():
                PERF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(final_res, f, ensure_ascii=False, indent=2)
                logger.info(f"已保存性能分析结果至持久化缓存: {cache_file.name}")
        except Exception as e:
            logger.warning(f"保存性能缓存失败: {e}")

        return final_res

    def get_shapley_values(self, metric: str = "r2") -> dict:
        """
        计算各特征的 Shapley 值。利用持久化缓存快速读取所有变量组合的性能指标。
        """
        from config import MCD_VARIABLES
        import math
        import itertools

        n = len(MCD_VARIABLES)
        shapley_values = {var: 0.0 for var in MCD_VARIABLES}

        for var in MCD_VARIABLES:
            other_vars = [v for v in MCD_VARIABLES if v != var]
            # 遍历其他特征的所有可能子集 (大小从 0 到 n-1)
            for r in range(n):
                for subset in itertools.combinations(other_vars, r):
                    subset_list = list(subset)
                    subset_with_var = subset_list + [var]

                    # 读取不包含该特征的子集性能
                    perf_without = self.get_performance_curve(selected_variables=subset_list)
                    # 读取包含该特征的子集性能
                    perf_with = self.get_performance_curve(selected_variables=subset_with_var)

                    metric_key = f"global_{metric}"
                    val_without = perf_without.get(metric_key, 0.0)
                    val_with = perf_with.get(metric_key, 0.0)

                    marginal_contribution = val_with - val_without

                    # 计算 Shapley 权重: |S|! * (n - |S| - 1)! / n!
                    weight = math.factorial(r) * math.factorial(n - r - 1) / math.factorial(n)

                    shapley_values[var] += weight * marginal_contribution
        
        sorted_shapley = dict(sorted(shapley_values.items(), key=lambda item: item[1], reverse=metric in ['r2', 'ssim']))
        return {
            "metric": metric,
            "shapley_values": sorted_shapley
        }

    def get_error_distribution(self, selected_variables: list[str]) -> dict:
        """
        获取模型在测试集上整体的预测误差分布、KDE密度及直方图。
        引入文件持久化缓存以优化计算效率。
        """
        from scipy.stats import gaussian_kde
        from config import PERF_CACHE_DIR
        import hashlib
        import json
        
        perf_key_data = {
            "vars": sorted(selected_variables),
            "data_mtime": self.ml_data_prep.processed_data_mtime if hasattr(self.ml_data_prep, 'processed_data_mtime') else "default"
        }
        perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
        cache_file = PERF_CACHE_DIR / f"errdist_{perf_hash}.json"

        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    logger.info(f"命中持久化误差分布缓存: {cache_file.name}")
                    return json.load(f)
            except Exception as e:
                logger.warning(f"读取误差分布缓存失败: {e}")

        if self.ml_data_prep.processed_data is None:
            logger.warning("未加载预处理数据，无法生成误差分布")
            return self._empty_error_distribution()
            
        data = self.ml_data_prep.processed_data
        ls_array = data['om_ls_raw']
        total_len = len(ls_array)
        split_idx = int(0.8 * total_len)
        
        diffs = np.diff(ls_array)
        split_indices = np.where(diffs < -180)[0]
        my28_start = split_indices[0] + 1 if len(split_indices) > 0 else total_len

        all_truths = []
        all_preds = []

        test_samples_count = total_len - split_idx
        # 和性能曲线一样的采样密度
        step = max(1, test_samples_count // 150) 
        
        logger.info(f"正在生成全测试集误差分布 (采样步长: {step})")
        
        for i in range(split_idx, total_len - 3, step):
            ls = float(ls_array[i])
            my = 27 if i < my28_start else 28
            try:
                # 只获取当前时间的预测结果
                res = self.predict(my, ls, selected_variables, horizon=3)
                for h_idx in range(res["horizon"]):
                    f_truth = np.array(res["ground_truth"][h_idx]["field"]).flatten()
                    f_pred = np.array(res["prediction"][h_idx]["field"]).flatten()
                    valid = ~np.isnan(f_truth)
                    all_truths.append(f_truth[valid])
                    all_preds.append(f_pred[valid])
            except Exception as e:
                pass

        if not all_truths:
            return self._empty_error_distribution()

        t_clean = np.concatenate(all_truths)
        p_clean = np.concatenate(all_preds)
        
        valid_mask = np.isfinite(p_clean) & np.isfinite(t_clean)
        p_clean = p_clean[valid_mask]
        t_clean = t_clean[valid_mask]
        
        if len(p_clean) == 0:
            return self._empty_error_distribution()

        errors = p_clean - t_clean
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors**2)))
        
        num_points = min(8000, len(p_clean))
        if num_points > 0:
            indices = np.random.choice(len(p_clean), num_points, replace=False)
            p_sample = p_clean[indices]
            t_sample = t_clean[indices]
            
            noise_p = np.random.normal(0, 1e-6, len(p_sample))
            noise_t = np.random.normal(0, 1e-6, len(t_sample))
            xy = np.vstack([t_sample + noise_t, p_sample + noise_p])
            
            try:
                kde = gaussian_kde(xy)(xy)
            except Exception as e:
                kde = np.ones_like(p_sample)
        else:
            p_sample, t_sample, kde = np.array([]), np.array([]), np.array([])
            
        counts_t, edges_t = np.histogram(t_clean, bins=50)
        counts_p, edges_p = np.histogram(p_clean, bins=50)
        counts_e, edges_e = np.histogram(errors, bins=50)
        
        final_res = {
            "scatter": {
                "trues": t_sample.tolist(),
                "preds": p_sample.tolist(),
                "density": kde.tolist()
            },
            "hist_trues": {
                "bin_edges": edges_t.tolist(),
                "counts": counts_t.tolist()
            },
            "hist_preds": {
                "bin_edges": edges_p.tolist(),
                "counts": counts_p.tolist()
            },
            "hist_errors": {
                "bin_edges": edges_e.tolist(),
                "counts": counts_e.tolist()
            },
            "mae": mae,
            "rmse": rmse
        }

        try:
            if not PERF_CACHE_DIR.exists():
                PERF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(final_res, f, ensure_ascii=False, indent=2)
                logger.info(f"已保存全测试集误差分布结果至持久化缓存: {cache_file.name}")
        except Exception as e:
            logger.warning(f"保存误差分布缓存失败: {e}")

        return final_res

    def _empty_error_distribution(self):
        return {
            "scatter": {"trues": [], "preds": [], "density": []},
            "hist_trues": {"bin_edges": [], "counts": []},
            "hist_preds": {"bin_edges": [], "counts": []},
            "hist_errors": {"bin_edges": [], "counts": []},
            "mae": 0.0,
            "rmse": 0.0
        }

    async def ensure_performance_caches(self):
        """
        后台异步任务：检查并预生成所有 32 个变量组合的性能和误差分布缓存。
        """
        from config import MCD_VARIABLES
        logger.info("开始检查 32 个变量组合的性能和误差分布缓存...")
        
        # 生成所有组合 (C5_0 到 C5_5)
        all_combos = []
        for r in range(len(MCD_VARIABLES) + 1):
            for combo in itertools.combinations(MCD_VARIABLES, r):
                all_combos.append(list(combo))
        
        count_generated = 0
        count_skipped = 0
        
        for variables in all_combos:
            # 构造缓存文件名以进行预检查
            from config import PERF_CACHE_DIR
            perf_key_data = {
                "vars": sorted(variables),
                "data_mtime": self.ml_data_prep.processed_data_mtime if hasattr(self.ml_data_prep, 'processed_data_mtime') else "default"
            }
            perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
            perf_cache_file = PERF_CACHE_DIR / f"perf_{perf_hash}.json"
            errdist_cache_file = PERF_CACHE_DIR / f"errdist_{perf_hash}.json"
            pfi_cache_file = PERF_CACHE_DIR / f"pfi_{perf_hash}.json"
            
            needs_perf = not perf_cache_file.exists()
            needs_errdist = not errdist_cache_file.exists()
            needs_pfi = not pfi_cache_file.exists()
            
            if not needs_perf and not needs_errdist and not needs_pfi:
                count_skipped += 1
                continue
                
            # 缓存缺失，执行生成 (同步执行以防并发冲突，但此函数由后台 task 调用)
            try:
                logger.info(f"正在后台预生成持久化缓存: {variables}")
                if needs_perf:
                    self.get_performance_curve(variables)
                if needs_errdist:
                    self.get_error_distribution(variables)
                if needs_pfi:
                    self.get_permutation_importance(variables)
                count_generated += 1
                # 稍微出让 CPU 权限，避免完全阻塞事件循环
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.warning(f"预生成 {variables} 缓存失败: {e}")
                
        logger.info(f"后台缓存检查完成: 新生成 {count_generated} 项组, 已存在 {count_skipped} 项组 (总计组合 {len(all_combos)} 个)")


    def get_global_shap(self) -> dict:
        """
        计算模型在整个测试集上的特征归因 (SHAP)。
        为了防止 OOM，采用分批计算并对结果进行空间/时间维度的降采样。
        """
        import traceback
        try:
            from config import MCD_VARIABLES, TRAINING_MASTER_ORDER, PERF_CACHE_DIR
            import os

            # 持久化缓存检查
            perf_key_data = {
                "type": "global_shap_v1",
                "data_mtime": self.ml_data_prep.processed_data_mtime if hasattr(self.ml_data_prep, 'processed_data_mtime') else "default"
            }
            perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
            cache_file = PERF_CACHE_DIR / f"shap_global_{perf_hash}.json"

            if cache_file.exists():
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        logger.info("命中持久化全局 SHAP 缓存")
                        return json.load(f)
                except Exception as e:
                    logger.warning(f"读取全局 SHAP 缓存失败: {e}")

            # 1. 准备模型与包装器
            # 使用全量 6 通道模型进行分析 (O3 + 5 气象因子)
            model, input_dim, model_info = self.inference.get_model_for_variables(MCD_VARIABLES)
            
            class SHAPScalarWrapper(torch.nn.Module):
                def __init__(self, model):
                    super().__init__()
                    self.model = model
                def forward(self, x):
                    # x: [B, T, C, H, W]
                    # output: [B, Horizon, 1, H, W]
                    out = self.model(x)
                    # 聚合为标量：取预测第一步 (horizon=0) 的空间平均
                    # 重要：必须确保输出梯度正常，且返回 [B, 1] 以适配 GradientExplainer 的索引逻辑
                    return out[:, 0, 0, :, :].mean(dim=(1, 2)).unsqueeze(1)

            # ARESVISION: 用户要求切回 GPU 计算。由于 M=1 且采样降至 100，显存压力已极大释放，
            # 现在可以安全在 GPU 上运行，预计 1-2 分钟内即可完成。
            shap_device = self.inference.device
            wrapper = SHAPScalarWrapper(model).to(shap_device)
            wrapper.eval()

            # 2. 准备数据
            if self.ml_data_prep.processed_data is None:
                logger.warning("SHAP 计算失败: 缺失预处理数据")
                return {"bar_data": [], "summary_data": []}
                
            data = self.ml_data_prep.processed_data
            x_all = data['X_torch'] # [N, T, C, H, W]
            total_len = len(x_all)
            split_idx = int(0.8 * total_len)
            
            # 背景数据：极致优化方案 —— 使用训练集的均值作为唯一背景参考 (M=1)
            # 这能比之前的随机 16 样本方案快 16 倍，且对于全局趋势分析依然有效
            if isinstance(x_all, torch.Tensor):
                bg_mean = x_all[:split_idx].mean(dim=0, keepdim=True).float().to(shap_device)
            else:
                bg_mean = torch.from_numpy(x_all[:split_idx].mean(axis=0, keepdims=True)).float().to(shap_device)
            background_tensor = bg_mean
            
            # 测试数据：进一步下采样至 100 个点以确保分钟级完成
            test_x = x_all[split_idx:]
            num_test_total = len(test_x)
            if num_test_total > 100:
                sample_indices = np.random.choice(num_test_total, 100, replace=False)
                sample_indices.sort()
                test_x = test_x[sample_indices]
            
            # 3. 初始化 Explainer
            explainer = shap.GradientExplainer(wrapper, background_tensor)
            
            all_shap_values = []
            all_test_inputs = []
            
            batch_size = 4 # CPU 模式下 4~8 左右通常较稳
            num_test = len(test_x)
            
            logger.info(f"执行极致加速 SHAP 计算 (M=1 均值参考, 采样数: {num_test}, Batch: {batch_size})")
            
            for i in range(0, num_test, batch_size):
                end = min(i + batch_size, num_test)
                batch_x = test_x[i:end]
                if isinstance(batch_x, torch.Tensor):
                    batch_tensor = batch_x.float().to(shap_device)
                else:
                    batch_tensor = torch.from_numpy(batch_x).float().to(shap_device)
                
                # GradientExplainer 在 wrapper 返回单输出 [B, 1] 时返回一个列表 [shap_values]
                # 形状通常为 [Batch, 3, 6, 32, 64, 1]
                shap_v_list = explainer.shap_values(batch_tensor)
                if isinstance(shap_v_list, list):
                    shap_v = shap_v_list[0]
                else:
                    shap_v = shap_v_list
                
                # 若存在多余维度 (由于 [B, 1] 包装器产生)，则进行压缩以匹配后续处理逻辑
                if hasattr(shap_v, 'ndim') and shap_v.ndim == 6:
                    shap_v = shap_v.squeeze(-1)
                    
                all_shap_values.append(shap_v)
                all_test_inputs.append(batch_x)
                
                # 每计算完一个 batch 立即显示进度
                logger.info(f"SHAP 计算进度: {end}/{num_test} ({(end/num_test)*100:.1f}%)")

            # 聚合结果
            # 如果是 tensor，先转回 numpy 以便后续分析处理
            def to_np(obj):
                if isinstance(obj, torch.Tensor):
                    return obj.cpu().numpy()
                if isinstance(obj, list) and len(obj) > 0 and isinstance(obj[0], torch.Tensor):
                    return np.concatenate([o.cpu().numpy() for o in obj], axis=0)
                return np.concatenate(obj, axis=0)

            shap_concat = to_np(all_shap_values) # [N_test, T, C, H, W]
            input_concat = to_np(all_test_inputs)
            
            feature_names = ["Ozone"] + TRAINING_MASTER_ORDER
            
            # 4. 计算 Bar Chart 数据 (Mean Absolute SHAP)
            mean_abs_shap = np.mean(np.abs(shap_concat), axis=(0, 1, 3, 4))
            bar_data = []
            for name, val in zip(feature_names, mean_abs_shap):
                bar_data.append({"name": name, "value": float(val)})
            
            bar_data.sort(key=lambda x: x["value"], reverse=True)
            
            # 5. 计算 Summary Plot 数据 (特征降采样防止前端崩溃)
            summary_data = []
            max_points = 3000
            
            for c_idx, name in enumerate(feature_names):
                c_shap = shap_concat[:, :, c_idx, :, :].flatten()
                c_input = input_concat[:, :, c_idx, :, :].flatten()
                
                if len(c_shap) > max_points:
                    indices = np.random.choice(len(c_shap), max_points, replace=False)
                    c_shap = c_shap[indices]
                    c_input = c_input[indices]
                
                summary_data.append({
                    "name": name,
                    "shap_values": [float(v) for v in c_shap],
                    "feature_values": [float(v) for v in c_input]
                })
                
            final_res = {
                "bar_data": bar_data,
                "summary_data": summary_data
            }

            # 保存持久化缓存
            try:
                if not PERF_CACHE_DIR.exists():
                    PERF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(final_res, f, ensure_ascii=False)
                    logger.info(f"已保存全局 SHAP 分析数据至持久化缓存: {cache_file.name}")
            except Exception as e:
                logger.warning(f"保存 SHAP 缓存失败: {e}")

            return final_res
        except Exception as e:
            logger.error(f"全局 SHAP 分析核心流程崩溃: {e}")
            logger.error(traceback.format_exc())
            raise e


    def _fields_to_dicts(
        self,
        fields: np.ndarray,
        lat_arr: np.ndarray,
        lon_arr: np.ndarray,
    ) -> list[dict]:
        result = []
        for step in range(fields.shape[0]):
            field = fields[step]
            points = []
            for i, lat in enumerate(lat_arr):
                for j, lon in enumerate(lon_arr):
                    val = float(field[i, j])
                    if not np.isnan(val):
                        points.append({
                            "lat": float(lat),
                            "lng": float(lon) if lon <= 180 else float(lon - 360),
                            "val": val,
                        })

            valid = field[~np.isnan(field)]
            result.append({
                "points": points,
                "lat": [float(v) for v in lat_arr],
                "lon": [float(v) for v in lon_arr],
                "field": [[float(v) for v in row] for row in np.nan_to_num(field)],
                "minVal": float(np.nanmin(valid)) if len(valid) > 0 else 0.0,
                "maxVal": float(np.nanmax(valid)) if len(valid) > 0 else 1.0,
            })

        return result

    def get_permutation_importance(self, selected_variables: list[str]) -> dict:
        """
        计算排列特征重要性 (Permutation Feature Importance)。
        通过在测试集上打乱单个特征并测量 R2 指标的下降程度。
        """
        from config import MCD_VARIABLES, PERF_CACHE_DIR, TRAINING_MASTER_ORDER
        
        # 1. 持久化缓存检查
        perf_key_data = {
            "type": "pfi_v2",
            "vars": sorted(selected_variables),
            "data_mtime": self.ml_data_prep.processed_data_mtime if hasattr(self.ml_data_prep, 'processed_data_mtime') else "default"
        }
        perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
        cache_file = PERF_CACHE_DIR / f"pfi_{perf_hash}.json"

        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    logger.info("命中 PFI 持久化缓存")
                    return json.load(f)
            except Exception as e:
                logger.warning(f"读取 PFI 缓存失败: {e}")

        # 2. 获取基准性能 (利用已有方法)
        baseline_perf = self.get_performance_curve(selected_variables)
        baseline_r2 = baseline_perf.get("global_r2", 0.0)
        
        if self.ml_data_prep.processed_data is None:
            return {"items": [], "baseline_metric": "r2", "baseline_value": baseline_r2}

        # 3. 准备测试数据 [N_test, T, C, H, W]
        data = self.ml_data_prep.processed_data
        x_all = data['X_torch']
        total_len = len(x_all)
        split_idx = int(0.8 * total_len)
        test_x = x_all[split_idx:].cpu().numpy().copy()
        
        # 获取真值
        # 这里为了简化，我们直接使用 y_torch 及其对应的反标准化参数
        y_all = data['y_torch']
        test_y_scaled = y_all[split_idx:].cpu().numpy()
        y_mean = data.get('y_mean', 0.0)
        y_std = data.get('y_std', 1.0)
        test_y = test_y_scaled[:, 0, 0] * y_std + y_mean # [N_test, H, W]
        
        # 确定特征列表及其在 X 中的索引
        # Ozone 永远在 index 0，其他根据 TRAINING_MASTER_ORDER
        all_features = ["Ozone"] + TRAINING_MASTER_ORDER
        feature_indices = {name: i for i, name in enumerate(all_features)}
        
        # 只分析模型实际使用的特征
        active_features = ["Ozone"] + selected_variables
        
        results = []
        
        # 为了加速计算，PFI 采样点数设为 80 (平衡精度与速度)
        num_test = len(test_x)
        sample_size = min(80, num_test)
        indices = np.random.choice(num_test, sample_size, replace=False)
        
        # 基准 R2 (基于采样后的点，保证对比公平性)
        def compute_sampled_r2(x_data):
            # 推理封装
            preds = []
            truths = []
            
            # 动态获取模型
            model, input_dim, model_info = self.inference.get_model_for_variables(selected_variables)
            device = self.inference.device
            
            # 处理输入维度切片 (逻辑同 _run_inference_pipeline)
            if model_info.get("is_fallback", False) or model_info.get("suffix") == "UVDST":
                final_x = x_data
            elif input_dim < 7:
                # 重新计算索引映射
                # 这里的逻辑必须与 predict 严格同步
                # 其实我们可以直接用 self.predict，但那里有缓存且包含了大量多余组装逻辑，这里重写精简版
                # 找到当前模型需要的通道索引
                # channel_mask 逻辑这里不适用，因为我们已经有 selected_variables 了
                var_to_idx = {v: i+1 for i, v in enumerate(TRAINING_MASTER_ORDER)}
                sel_indices = [0] # Ozone
                for v in TRAINING_MASTER_ORDER:
                    if v in selected_variables:
                        sel_indices.append(var_to_idx[v])
                final_x = x_data[:, :, sel_indices[:input_dim]]
            else:
                final_x = x_data

            for idx in indices:
                sample_x = torch.from_numpy(final_x[idx]).unsqueeze(0).float().to(device)
                with torch.no_grad():
                    out = model(sample_x)
                    p_scaled = out[0, 0, 0].cpu().numpy()
                
                p_phys = p_scaled * y_std + y_mean
                t_phys = test_y[idx]
                
                valid = ~np.isnan(t_phys)
                preds.append(p_phys[valid])
                truths.append(t_phys[valid])
            
            if not truths: return 0.0
            t_cat = np.concatenate(truths)
            p_cat = np.concatenate(preds)
            return float(r2_score(t_cat, p_cat))

        logger.info(f"正在计算 PFI 基准分数 (采样数: {sample_size})")
        sampled_baseline_r2 = compute_sampled_r2(test_x)
        
        for feat in active_features:
            if feat not in feature_indices: continue
            f_idx = feature_indices[feat]
            
            logger.info(f"正在评估特征重要性: {feat}")
            
            # 克隆数据并打乱该维度
            shuffled_x = test_x.copy()
            # 打乱逻辑: 在 N_test 维度上进行置换，保留其它维度 (T, H, W) 
            # 实际上是把所有样本的该特征观测值随机重排
            perm = np.random.permutation(num_test)
            shuffled_x[:, :, f_idx] = test_x[perm, :, f_idx]
            
            shuffled_r2 = compute_sampled_r2(shuffled_x)
            importance = sampled_baseline_r2 - shuffled_r2
            
            results.append({
                "name": feat,
                "importance": round(importance, 6)
            })

        # 按重要性排序
        results.sort(key=lambda x: x["importance"], reverse=True)
        
        final_res = {
            "items": results,
            "baseline_metric": "r2",
            "baseline_value": round(sampled_baseline_r2, 4)
        }
        
        # 4. 保存持久化缓存
        try:
            if not PERF_CACHE_DIR.exists():
                PERF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(final_res, f, ensure_ascii=False, indent=2)
                logger.info(f"已保存 PFI 分析结果至持久化缓存: {cache_file.name}")
        except Exception as e:
            logger.warning(f"保存 PFI 缓存失败: {e}")

        return final_res

    @staticmethod
    def _make_cache_key(
        mars_year: int,
        ls_start: float,
        selected_variables: list[str],
        horizon: int,
    ) -> str:
        key_data = {
            "my": mars_year,
            "ls": round(ls_start, 2),
            "vars": sorted(selected_variables),
            "h": horizon,
        }
        return hashlib.md5(json.dumps(key_data).encode()).hexdigest()
