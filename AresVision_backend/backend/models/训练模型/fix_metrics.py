import os
import re

directory = r"d:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
files = [f for f in os.listdir(directory) if f.startswith("demo3-") and f.endswith(".py")]

# Updated old_snippet to match what's currently in the files (with the broken newline)
old_snippet_regex = r'trues = np\.concatenate\(trues, axis=0\); preds = np\.concatenate\(preds_all, axis=0\)\s+y_true = trues\.flatten\(\)\s+y_pred = preds\.flatten\(\)\s+mse = mean_squared_error\(y_true, y_pred\)\s+rmse = np\.sqrt\(mse\)\s+r2 = r2_score\(y_true, y_pred\)\s+mape = np\.mean\(np\.abs\(\(y_true - y_pred\) / \(np\.abs\(y_true\) \+ 1e-8\)\)\) \* 100\s+smape = np\.mean\(2 \* np\.abs\(y_pred - y_true\) / \(np\.abs\(y_true\) \+ np\.abs\(y_pred\) \+ 1e-8\)\) \* 100\s+print\(f"\s+Metrics:"\)'

# Corrected new_snippet
new_snippet = r"""trues = np.concatenate(trues, axis=0); preds = np.concatenate(preds_all, axis=0)
y_true = trues.flatten()
y_pred = preds.flatten()
mse = mean_squared_error(y_true, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_true, y_pred)
mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
smape = np.mean(2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100

print(f"\nMetrics:")
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
    
    # Try to find the broken block
    broken_mark = 'print(f"\nMetrics:")' # This is what I intended, but it might have been written as a literal newline
    # Let's search for the pattern I just added
    
    pattern = r'trues = np\.concatenate\(trues, axis=0\); preds = np\.concatenate\(preds_all, axis=0\)\n+y_true = trues\.flatten\(\)\n+y_pred = preds\.flatten\(\)\n+mse = mean_squared_error\(y_true, y_pred\)\n+rmse = np\.sqrt\(mse\)\n+r2 = r2_score\(y_true, y_pred\)\n+mape = np\.mean\(np\.abs\(\(y_true - y_pred\) / \(np\.abs\(y_true\) \+ 1e-8\)\)\) \* 100\n+smape = np\.mean\(2 \* np\.abs\(y_pred - y_true\) / \(np\.abs\(y_true\) \+ np\.abs\(y_pred\) \+ 1e-8\)\) \* 100\n+\n+print\(f"\nMetrics:"\)'
    
    # Actually, it's easier to just match from trues = np.concatenate... down to the SMAPE print and replace the whole block.
    
    block_start = "trues = np.concatenate(trues, axis=0); preds = np.concatenate(preds_all, axis=0)"
    block_end = 'print(f"SMAPE: {smape:.4f}%")'
    
    start_idx = content.find(block_start)
    end_idx = content.find(block_end)
    
    if start_idx != -1 and end_idx != -1:
        end_idx += len(block_end)
        new_content = content[:start_idx] + new_snippet + content[end_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed: {filename}")
        count += 1
    else:
        print(f"Skipped: {filename}")

print(f"\nTotal fixed: {count} files.")
