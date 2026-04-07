import os

base_dir = r"d:\AApycharm\AresVision\AresVision_backend\backend\models\训练模型"
files = sorted([f for f in os.listdir(base_dir) if f.startswith("demo3-") and f.endswith(".py")])

# ── 1. 在 argparse 块尾添加 --early_stopping_patience ──
old_argparse_tail = 'parser.add_argument("--horizon", type=int, default=3)'
new_argparse_tail = (
    'parser.add_argument("--horizon", type=int, default=3)\n'
    'parser.add_argument("--early_stopping_patience", type=int, default=0)'
)

# ── 2. 在 args 解析后添加变量提取 ──
old_hidden_dims_block = """try:
    hidden_dims = json.loads(args.stlstm_hidden_dims.replace("'", "\\""))
except:
    hidden_dims = [64, 64, 64]"""

new_hidden_dims_block = """try:
    hidden_dims = json.loads(args.stlstm_hidden_dims.replace("'", "\\""))
except:
    hidden_dims = [64, 64, 64]
early_stopping_patience = args.early_stopping_patience"""

# ── 3. 替换训练循环，加入 early stopping 逻辑 ──
old_train_loop = """print("\\n[Step 3] Start Training...")
for ep in range(epochs):
    model.train()
    loss_sum = 0
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad(); pred = model(xb); loss = criterion(pred, yb)
        loss.backward(); opt.step(); loss_sum += loss.item()
    
    # Validation
    model.eval()
    val_loss = 0
    with torch.no_grad():
        for xv, yv in test_loader:
            xv, yv = xv.to(device), yv.to(device)
            p = model(xv); l = criterion(p, yv)
            val_loss += l.item()
    
    print(f"Epoch {ep+1}/{epochs} Loss={loss_sum/len(train_loader):.4f} Val Loss={val_loss/len(test_loader):.4f}")"""

new_train_loop = """print("\\n[Step 3] Start Training...")
best_val_loss = float('inf')
patience_counter = 0
for ep in range(epochs):
    model.train()
    loss_sum = 0
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad(); pred = model(xb); loss = criterion(pred, yb)
        loss.backward(); opt.step(); loss_sum += loss.item()
    
    # Validation
    model.eval()
    val_loss = 0
    with torch.no_grad():
        for xv, yv in test_loader:
            xv, yv = xv.to(device), yv.to(device)
            p = model(xv); l = criterion(p, yv)
            val_loss += l.item()
    
    avg_val_loss = val_loss / len(test_loader)
    print(f"Epoch {ep+1}/{epochs} Loss={loss_sum/len(train_loader):.4f} Val Loss={avg_val_loss:.4f}")

    # Early stopping
    if early_stopping_patience > 0:
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= early_stopping_patience:
                print(f"[Early Stopping] Val loss did not improve for {early_stopping_patience} epochs. Stopped at epoch {ep+1}.")
                break"""

count = 0
for filename in files:
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # Fix 1: argparse
    if old_argparse_tail in content:
        content = content.replace(old_argparse_tail, new_argparse_tail, 1)
        changed = True
    else:
        print(f"[WARN] argparse tail not found: {filename}")

    # Fix 2: variable extraction
    if old_hidden_dims_block in content:
        content = content.replace(old_hidden_dims_block, new_hidden_dims_block, 1)
        changed = True
    else:
        print(f"[WARN] hidden_dims block not found: {filename}")

    # Fix 3: training loop
    if old_train_loop in content:
        content = content.replace(old_train_loop, new_train_loop, 1)
        changed = True
    else:
        print(f"[WARN] training loop not found: {filename}")

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[Fixed] {filename}")
        count += 1

print(f"\nDone. Total fixed: {count}/{len(files)}")
