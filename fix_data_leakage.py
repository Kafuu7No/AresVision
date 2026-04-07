import os
import re

base_dir = r"d:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
files = sorted([f for f in os.listdir(base_dir) if f.startswith("demo3-") and f.endswith(".py")])

old_block = """X_scaled = np.zeros_like(X_raw)
for c in range(C_feat):
    X_scaled[..., c] = StandardScaler().fit_transform(X_raw[..., c].reshape(T, -1)).reshape(T, H_raw, W_raw)
y_scaled = (y_raw - y_raw.mean()) / (y_raw.std() + 1e-6)"""

new_block = """split_idx = int(0.8 * (T - window - horizon + 1)) + window
X_scaled = np.zeros_like(X_raw)
for c in range(C_feat):
    scaler = StandardScaler()
    scaler.fit(X_raw[:split_idx, ..., c].reshape(split_idx, -1))
    X_scaled[..., c] = scaler.transform(X_raw[..., c].reshape(T, -1)).reshape(T, H_raw, W_raw)
y_train_part = y_raw[:split_idx]
y_mean, y_std = y_train_part.mean(), y_train_part.std()
y_scaled = (y_raw - y_mean) / (y_std + 1e-6)"""

count = 0
for filename in files:
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if old_block in content:
        new_content = content.replace(old_block, new_block)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"[Fixed]   {filename}")
        count += 1
    elif "StandardScaler().fit_transform" in content:
        print(f"[WARN]  Pattern mismatch, manual check needed: {filename}")
    else:
        print(f"[Skip]    {filename}")

print(f"\nDone. Total fixed: {count}/{len(files)}")
