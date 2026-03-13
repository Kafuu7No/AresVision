import os
import sys
import torch
import numpy as np
import logging

# 设置路径以导入项目模块
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from services.data_service import DataService
from services.predict_data_service import PredictDataService
from core.predict_transforms import PredictTransforms
from core.predict_inference import PredictInference
from services.predict_service import PredictOrchestratorService

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify")

def verify():
    logger.info("开始验证集成后的预测链路...")
    
    # 实例化服务
    data_service = DataService()
    ml_data_prep = PredictDataService()
    transforms = PredictTransforms(data_service)
    inference = PredictInference()
    orchestrator = PredictOrchestratorService(data_service, ml_data_prep, transforms, inference)
    
    # 定义测试参数
    mars_year = 27
    ls_start = 90.0
    selected_vars = ["U_Wind", "V_Wind", "Pressure", "Temperature", "Dust_Optical_Depth", "Solar_Flux_DN"]
    
    # 执行预测
    try:
        result = orchestrator.predict(mars_year, ls_start, selected_vars, horizon=3)
        
        logger.info("✅ 预测执行成功！")
        logger.info(f"预测步数: {result['horizon']}")
        if result['metrics'] and 'overall' in result['metrics']:
            m = result['metrics']['overall']
            logger.info(f"指标 (RMSE): {m['rmse']:.4f}")
            logger.info(f"指标 (R2): {m['r2']:.4f}")
        
        # 验证是否使用了预处理数据
        if ml_data_prep.processed_data is not None:
            logger.info("✅ 确认: 已加载并使用预处理张量 (.pt 文件)")
        else:
            logger.error("❌ 错误: 未能加载预处理张量")
            
        # 验证标准化参数是否一致
        logger.info(f"标准化参数 y_std: {transforms.y_std:.4f}")
        
    except Exception as e:
        logger.error(f"❌ 预测执行失败: {e}", exc_info=True)

if __name__ == "__main__":
    verify()
