import torch
import os
import numpy as np

def analyze_split():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    tensor_path = os.path.join(current_dir, "data", "processed_tensors.pt")
    
    if not os.path.exists(tensor_path):
        print(f"Error: {tensor_path} not found")
        return

    data = torch.load(tensor_path, weights_only=False)
    ls_array = data['om_ls_raw']
    total_len = len(ls_array)
    split_idx = int(0.8 * total_len)
    
    # 找到跨年点 (MY27 结束, MY28 开始)
    diffs = np.diff(ls_array)
    split_years = np.where(diffs < -180)[0]
    if len(split_years) > 0:
        my28_start_idx = split_years[0] + 1
        print(f"MY27 结束索引: {my28_start_idx-1}, MY28 开始索引: {my28_start_idx}")
    else:
        my28_start_idx = 0
        print("未发现跨年点")

    print(f"总样本数: {total_len}")
    print(f"训练集划分点 (80%): {split_idx}")
    
    # 划分点所在的年份和 Ls
    split_ls = ls_array[split_idx]
    if split_idx >= my28_start_idx:
        print(f"划分点位于: MY28, Ls={split_ls:.2f}")
    else:
        print(f"划分点位于: MY27, Ls={split_ls:.2f}")
        
    # 测试集的范围
    test_ls_start = ls_array[split_idx]
    test_ls_end = ls_array[-1]
    
    print(f"\n测试集 (最后 20%) 的 Ls 范围:")
    if split_idx >= my28_start_idx:
        print(f"MY28 Ls {test_ls_start:.2f} 到 Ls {test_ls_end:.2f}")
    else:
        # 这种情况意味着测试集包含 MY27 后端和整个 MY28
        print(f"MY27 Ls {test_ls_start:.2f} 到 MY28 Ls {test_ls_end:.2f}")

if __name__ == "__main__":
    analyze_split()
