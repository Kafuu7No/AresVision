import sys
import os
from pathlib import Path

# 添加路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

import torch
from core.predict_inference import PredictInference
from config import MODEL_DIR

def test_model_selection():
    inference = PredictInference()
    
    # 测试案例 1: 单变量 T (验证精确匹配)
    model, dim, info = inference.get_model_for_variables(["Temperature"])
    print(f"CASE 1 (Temperature): suffix={info['suffix']}, weight={info['weight_file']}, dim={dim}")
    assert info['suffix'] == "T"
    assert "DT.pth" not in info['weight_file']
    
    # 测试案例 2: 多变量 DST
    model, dim, info = inference.get_model_for_variables(["Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"])
    print(f"CASE 2 (DST): suffix={info['suffix']}, weight={info['weight_file']}, dim={dim}")
    assert info['suffix'] == "DST"
    
    # 测试案例 3: 回退逻辑
    model, dim, info = inference.get_model_for_variables(["UnknownVar"])
    print(f"CASE 3 (Fallback): is_fallback={info['is_fallback']}, suffix={info['suffix']}")
    assert info['is_fallback'] is True
    assert info['suffix'] == "UVDST"

if __name__ == "__main__":
    try:
        test_model_selection()
        print("\n[SUCCESS] 所有模型选择测试通过！")
    except Exception as e:
        print(f"\n[FAILURE] 测试失败: {e}")
        sys.exit(1)
