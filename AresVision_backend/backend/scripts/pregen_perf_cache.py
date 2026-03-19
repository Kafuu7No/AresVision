import logging
import asyncio
import itertools
from typing import List

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("aresvision.pregen")

async def pregenerate_perf_cache(predict_service):
    """
    预生成所有变量组合的性能曲线缓存 (2^5 = 32 种组合)
    """
    from config import MCD_VARIABLES, PERF_CACHE_DIR
    import hashlib
    import json
    
    logger.info("开始检查并预生成 32 条性能分析曲线缓存...")
    
    # 辅助：获取预处理数据时间戳 (用于校验缓存有效性)
    data_mtime = predict_service.ml_data_prep.processed_data_mtime if hasattr(predict_service.ml_data_prep, 'processed_data_mtime') else "default"
    
    # 生成所有可能的组合
    all_combos = []
    for r in range(len(MCD_VARIABLES) + 1):
        for combo in itertools.combinations(MCD_VARIABLES, r):
            all_combos.append(list(combo))
            
    skipped_count = 0
    for i, combo in enumerate(all_combos):
        combo_str = "+".join(combo) if combo else "Baseline"
        
        # 预先检查缓存是否存在 (逻辑与 PredictOrchestratorService 保持一致)
        perf_key_data = {
            "vars": sorted(combo),
            "data_mtime": data_mtime
        }
        perf_hash = hashlib.md5(json.dumps(perf_key_data).encode()).hexdigest()
        cache_file = PERF_CACHE_DIR / f"perf_{perf_hash}.json"
        
        if cache_file.exists():
            skipped_count += 1
            continue
            
        logger.info(f"[{i+1}/{len(all_combos)}] 正在补全缺失缓存: {combo_str}")
        try:
            predict_service.get_performance_curve(combo)
        except Exception as e:
            logger.error(f"生成组合 {combo_str} 缓存失败: {e}")
            
    if skipped_count > 0:
        logger.info(f"检查完成：跳过了 {skipped_count} 个已存在的有效缓存。")
    logger.info("性能分析曲线预生成任务处理完毕。")

if __name__ == "__main__":
    # 此脚本可以通过以下方式独立运行测试:
    # python backend/scripts/pregen_perf_cache.py
    import sys
    import os
    from pathlib import Path
    
    # 确保能找到 backend 目录下的模块
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    
    from services.data_service import DataService
    from services.predict_data_service import PredictDataService
    from core.predict_transforms import PredictTransforms
    from core.predict_inference import PredictInference
    from services.predict_service import PredictOrchestratorService
    
    async def main():
        ds = DataService()
        pds = PredictDataService(ds)
        pt = PredictTransforms(ds)
        pi = PredictInference()
        pos = PredictOrchestratorService(ds, pds, pt, pi)
        
        await pregenerate_perf_cache(pos)
        
    asyncio.run(main())
