import os
import re

directory = r"d:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
files = [f for f in os.listdir(directory) if f.startswith("demo3-") and f.endswith(".py")]

old_snippet = r'trues = np\.concatenate\(trues, axis=0\); preds = np\.concatenate\(preds_all, axis=0\)\s+print\(f"\\nRMSE: \{np\.sqrt\(mean_squared_error\(trues\.flatten\(\), preds\.flatten\(\)\)\):\.4f\}"\)'

new_snippet = """trues = np.concatenate(trues, axis=0); preds = np.concatenate(preds_all, axis=0)
y_true = trues.flatten()
y_pred = preds.flatten()
mse = mean_squared_error(y_true, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_true, y_pred)
mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
smape = np.mean(2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100

print(f"\\nMetrics:")
print(f"MSE: {mse:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"R-Squared: {r2:.4f}")
print(f"MAPE: {mape:.4f}%")
print(f"SMAPE: {smape:.4f}%")"""

count = 0
for filename in files:
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if re.search(old_snippet, content):
        new_content = re.sub(old_snippet, new_snippet, content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filename}")
        count += 1
    else:
        print(f"Skipped (not found): {filename}")

print(f"\nTotal updated: {count} files.")
