import os
import re
import glob

def repair_script(file_path):
    print(f"Repairing: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. 修复被损坏的类定义：class PredRNNv2(hidden_dims=hidden_dims, nn.Module): -> class PredRNNv2(nn.Module):
    content = re.sub(r'class PredRNNv2\(hidden_dims=hidden_dims, nn\.Module\):', 'class PredRNNv2(nn.Module):', content)
    
    # 2. 修复 __init__ 签名中被误删的 hidden_dims
    # 查找 def __init__(self, input_dim=2, height=H, width=W, horizon=horizon):
    # 并恢复 hidden_dims 参数
    content = re.sub(r'def __init__\(self, input_dim=2, height=H, width=W, horizon=horizon\):', 
                     'def __init__(self, input_dim=2, hidden_dims=[64, 64, 64], height=H, width=W, horizon=horizon):', content)

    # 3. 修复类体内被截断的 self.hidden_dims = hidden_dims
    # 查找 self.horizon = horizon\n        self.\n
    content = re.sub(r'self\.horizon = horizon\s+self\.\s*\n', 'self.horizon = horizon\n        self.hidden_dims = hidden_dims\n', content)

    # 4. 修复模型实例化逻辑 (确保 model = PredRNNv2(hidden_dims=hidden_dims, ...) 正确)
    # 如果实例化行已经被修好了，这步会保持原样
    if "model = PredRNNv2(" in content and "hidden_dims=hidden_dims" not in content:
        content = re.sub(r'model = PredRNNv2\(', 'model = PredRNNv2(hidden_dims=hidden_dims, ', content)

    # 5. 再次全局检查 base_dir 的括号
    content = re.sub(r'base_dir = os\.path\.dirname.*?\n', 'base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

if __name__ == "__main__":
    target_dir = os.path.dirname(os.path.abspath(__file__))
    files = glob.glob(os.path.join(target_dir, "demo3-*.py"))
    for file in files:
        repair_script(file)
    print(f"\n修复完成，处理脚本数量: {len(files)}")
