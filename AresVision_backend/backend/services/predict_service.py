"""
预测服务编排层
负责协调 MLDataPrepService, DataTransforms, ModelInferenceService, 获取结果并组装响应
"""
import logging
import hashlib
import json
import numpy as np
import torch
import asyncio
import itertools
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
            
            needs_perf = not perf_cache_file.exists()
            needs_errdist = not errdist_cache_file.exists()
            
            if not needs_perf and not needs_errdist:
                count_skipped += 1
                continue
                
            # 缓存缺失，执行生成 (同步执行以防并发冲突，但此函数由后台 task 调用)
            try:
                logger.info(f"正在后台预生成持久化缓存: {variables}")
                if needs_perf:
                    self.get_performance_curve(variables)
                if needs_errdist:
                    self.get_error_distribution(variables)
                count_generated += 1
                # 稍微出让 CPU 权限，避免完全阻塞事件循环
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.warning(f"预生成 {variables} 缓存失败: {e}")
                
        logger.info(f"后台缓存检查完成: 新生成 {count_generated} 项组, 已存在 {count_skipped} 项组 (总计组合 {len(all_combos)} 个)")


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
