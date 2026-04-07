import subprocess
import sys
import os
import time

def test_child():
    # 模拟训练脚本的输出行为
    print("Child: Starting...", flush=True)
    time.sleep(1)
    print("Child: Step 1 complete", flush=True)
    time.sleep(1)
    print("Child: Step 2 complete", flush=True)
    time.sleep(1)
    print("Child: Done", flush=True)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--child":
        test_child()
    else:
        # Parent process
        python_exe = sys.executable
        cmd = [python_exe, "-u", __file__, "--child"]
        print(f"Running command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "PYTHONUNBUFFERED": "1"}
        )
        
        print("Parent: Start reading...")
        start_time = time.time()
        for line in iter(process.stdout.readline, ''):
            elapsed = time.time() - start_time
            print(f"[{elapsed:.2f}s] Received: {line.strip()}", flush=True)
        
        process.wait()
        print("Parent: Finished")
