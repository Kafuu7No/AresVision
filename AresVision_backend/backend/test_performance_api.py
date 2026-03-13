import os
import sys
import numpy as np

def test_performance_service():
    print("--- 开始测试 PredictOrchestratorService.get_performance_curve ---")
    
    # 将 backend 目录添加到 sys.path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(current_dir)
    
    from services.data_service import DataService
    from services.predict_data_service import PredictDataService
    from core.predict_transforms import PredictTransforms
    from core.predict_inference import PredictInference
    from services.predict_service import PredictOrchestratorService
    
    print("正在初始化服务...")
    ds = DataService()
    ml = PredictDataService()
    tr = PredictTransforms(ds)
    inf = PredictInference()
    svc = PredictOrchestratorService(ds, ml, tr, inf)
    
    selected_variables = ["Temperature", "Dust_Optical_Depth", "Solar_Flux_DN", "U_Wind", "V_Wind", "Pressure"]
    
    print("正在计算性能曲线 (测试集采样)...")
    items = svc.get_performance_curve(selected_variables)
    
    print(f"\n成功获取 {len(items)} 个采样点。")
    if items:
        print(f"采样步长点 1: {items[0]}")
        if len(items) > 1:
            print(f"采样步长点 2: {items[1]}")
        print(f"最后一个点: {items[-1]}")
        
        # 统计分析
        r2_values = [item['r2'] for item in items]
        print(f"\n统计结果:")
        print(f"  平均 R2: {np.mean(r2_values):.4f}")
        print(f"  最高 R2: {np.max(r2_values):.4f}")
        print(f"  最低 R2: {np.min(r2_values):.4f}")
    else:
        print("警告: 未返回任何采样点。")

if __name__ == "__main__":
    test_performance_service()
