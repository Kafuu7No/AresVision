import time
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api/predict"

def test_performance_cache():
    payload = {
        "selected_variables": ["Temperature", "Dust_Optical_Depth"],
        "horizon": 3,
        "ls_start": 90.0,
        "mars_year": 27
    }

    print("--- 正在进行性能缓存测试 ---")
    
    # 第一次请求 (写入缓存)
    print("1. 首次请求 (正在计算，请稍候...)...")
    start_time = time.time()
    try:
        response1 = requests.post(f"{BASE_URL}/performance", json=payload)
        duration1 = time.time() - start_time
        if response1.status_code == 200:
            print(f"   首次耗时: {duration1:.2f}s")
        else:
            print(f"   错误: {response1.status_code}, {response1.text}")
            return
    except Exception as e:
        print(f"   请求失败: {e}")
        return

    # 第二次请求 (应命中缓存)
    print("2. 第二次请求 (应命中缓存)...")
    start_time = time.time()
    response2 = requests.post(f"{BASE_URL}/performance", json=payload)
    duration2 = time.time() - start_time
    if response2.status_code == 200:
        print(f"   二次耗时: {duration2:.4f}s")
        print(f"   加速比: {duration1 / duration2:.1f}x")
        
        # 验证结果一致性
        res1 = response1.json()
        res2 = response2.json()
        if res1 == res2:
            print("   结果验证: 一致 (MATCH)")
        else:
            print("   结果验证: 不一致 (MISMATCH)")
    else:
         print(f"   错误: {response2.status_code}, {response2.text}")

if __name__ == "__main__":
    # 注意：运行此脚本前请确保后端服务已启动
    test_performance_cache()
