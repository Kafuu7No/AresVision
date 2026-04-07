import os
import re

base_dir = r"d:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
files = sorted([f for f in os.listdir(base_dir) if f.startswith("demo3-") and f.endswith(".py")])

# 1. 在 argparse 块中添加 --window 和 --horizon 参数
# 原有最后一个 argparse 行：  parser.add_argument("--output_path", ...)
old_argparse_end = 'parser.add_argument("--output_path", type=str, default=None)'
new_argparse_end = (
    'parser.add_argument("--output_path", type=str, default=None)\n'
    'parser.add_argument("--window", type=int, default=3)\n'
    'parser.add_argument("--horizon", type=int, default=3)'
)

# 2. 把硬编码的 window, horizon = 3, 3 改为从 args 读取
old_window_horizon = 'window, horizon = 3, 3'
new_window_horizon = 'window, horizon = args.window, args.horizon'

count_argparse = 0
count_wh = 0
for filename in files:
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    if old_argparse_end in content:
        content = content.replace(old_argparse_end, new_argparse_end, 1)
        count_argparse += 1
        changed = True
    else:
        print(f"[WARN] argparse end not found: {filename}")

    if old_window_horizon in content:
        content = content.replace(old_window_horizon, new_window_horizon, 1)
        count_wh += 1
        changed = True
    else:
        print(f"[WARN] window/horizon line not found: {filename}")

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[Fixed] {filename}")

print(f"\nDone. argparse patched: {count_argparse}, window/horizon patched: {count_wh}")
