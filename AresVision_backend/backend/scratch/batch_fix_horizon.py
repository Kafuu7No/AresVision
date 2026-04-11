import os
import glob

# 路径指向后端模型训练脚本目录
script_dir = r"D:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
pattern = os.path.join(script_dir, "demo3-*.py")

files = glob.glob(pattern)

search_str = "model = PredRNNv2(input_dim=C_feat, hidden_dims=hidden_dims, height=ST_H, width=ST_W).to(device)"
replace_str = "model = PredRNNv2(input_dim=C_feat, hidden_dims=hidden_dims, height=ST_H, width=ST_W, horizon=horizon).to(device)"

print(f"Found {len(files)} files to check...")

modified_count = 0
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if search_str in content:
        new_content = content.replace(search_str, replace_str)
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        modified_count += 1
        print(f"Fixed: {os.path.basename(f)}")
    else:
        # 检查是否已经修复过
        if replace_str in content:
            print(f"Skipped (Already fixed): {os.path.basename(f)}")
        else:
            print(f"Search string NOT found in {os.path.basename(f)}")

print(f"\nTotal files checked: {len(files)}")
print(f"Total files modified: {modified_count}")
