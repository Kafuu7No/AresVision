import sys
import os
from pathlib import Path

# 添加路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from core.predict_inference import PredictInference

def test_dynamic_shorthand():
    inference = PredictInference()
    
    test_cases = [
        ([], "baseline"),
        (["Temperature"], "T"),
        (["U_Wind", "V_Wind"], "UV"),
        (["U_Wind", "V_Wind", "Temperature"], "UVT"),
        (["Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"], "DST"),
        (["U_Wind", "V_Wind", "Dust_Optical_Depth", "Solar_Flux_DN", "Temperature"], "UVDST"),
    ]
    
    for vars_in, expected_suffix in test_cases:
        _, _, info = inference.get_model_for_variables(vars_in)
        print(f"INPUT: {vars_in:50} -> SUFFIX: {info['suffix']:10} (Expected: {expected_suffix:10}) | Fallback: {info['is_fallback']}")
        assert info['suffix'] == expected_suffix
        if not info['is_fallback']:
            print(f"  [OK] Successfully matched weight file: {info['weight_file']}")
        else:
            print(f"  [WARNING] Fallback triggered! Reason: {info['fallback_reason']}")

if __name__ == "__main__":
    test_dynamic_shorthand()
    print("\n[SUCCESS] 动态分支匹配逻辑验证通过！")
