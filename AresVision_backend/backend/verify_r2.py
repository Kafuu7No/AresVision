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
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger("verify_full")

def verify_full():
    print("开始全面 $R^2$ 指标统计分析...")
    
    data_service = DataService()
    ml_data_prep = PredictDataService()
    transforms = PredictTransforms(data_service)
    inference = PredictInference()
    orchestrator = PredictOrchestratorService(data_service, ml_data_prep, transforms, inference)
    
    selected_vars = ["U_Wind", "V_Wind", "Pressure", "Temperature", "Dust_Optical_Depth", "Solar_Flux_DN"]
    
    # 测试点：覆盖两年的不同季节
    test_points = [
        (27, 90.0, "MY27 Spring (Train)"),
        (27, 270.0, "MY27 Autumn (Train)"),
        (28, 30.0, "MY28 Spring (Test)"),
        (28, 50.0, "MY28 Spring (Test)"),
    ]
    
    all_r2 = []
    
    for my, ls, desc in test_points:
        try:
            result = orchestrator.predict(my, ls, selected_vars, horizon=3)
            r2 = result["metrics"]["overall"]["r2"]
            rmse = result["metrics"]["overall"]["rmse"]
            all_r2.append(r2)
            print(f"[{desc}] MY{my} Ls={ls:5.1f} | R2: {r2:8.4f} | RMSE: {rmse:8.4f}")
        except Exception as e:
            import traceback
            print(f"[{desc}] 失败: {e}")
            traceback.print_exc()
            
    if all_r2:
        print(f"\n平均 $R^2$: {np.mean(all_r2):.4f}")
        print(f"验证完成。")

if __name__ == "__main__":
    verify_full()
