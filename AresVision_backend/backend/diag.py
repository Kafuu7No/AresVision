import subprocess
import sys
import time
import os

dummy_script_path = "dummy_script_diag.py"
with open(dummy_script_path, "w", encoding="utf-8") as f:
    f.write('import time, sys\n')
    f.write('class MockLogger:\n')
    f.write('    def __init__(self, target): self.target = target\n')
    f.write('    def write(self, m): self.target.write(m); self.target.flush()\n')
    f.write('    def flush(self): self.target.flush()\n')
    f.write('sys.stdout = MockLogger(sys.stdout)\n')
    f.write('for i in range(5):\n')
    f.write('    print(f"DIAG_MSG_{i}", flush=True)\n')
    f.write('    time.sleep(1)\n')

print("Starting robust diagnostic test...")
start = time.time()
process = subprocess.Popen(
    [sys.executable, "-u", dummy_script_path],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    bufsize=0,
    env={**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"}
)

while True:
    line = process.stdout.readline()
    if not line: break
    now = time.time()
    print(f"[{now - start:.2f}s] Received: {line.decode('utf-8', errors='replace').strip()}")

process.wait()
os.remove(dummy_script_path)
print("Diagnostic test finished.")
