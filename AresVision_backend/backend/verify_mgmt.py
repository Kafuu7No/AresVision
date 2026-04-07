import asyncio
import os
import sys
import psutil

# Add backend to path
sys.path.append(os.path.join(os.getcwd()))

from services.training_service import TrainingService
from database.models import ModelTrainingTask
from database.engine import async_session_maker

async def verify_management():
    service = TrainingService()
    user_id = 1
    model_script = "demo3-.py"
    hyperparameters = {"epochs": 30, "batch_size": 16} # Long task
    
    print("\n[1] Testing Start & PID Capture...")
    task = await service.start_training(user_id, model_script, hyperparameters)
    print(f"Task {task.id} started. Waiting for PID...")
    
    # Wait for PID to be saved
    pid = None
    for _ in range(10):
        await asyncio.sleep(2)
        async with async_session_maker() as session:
            db_task = await session.get(ModelTrainingTask, task.id)
            if db_task and db_task.pid:
                pid = db_task.pid
                print(f"Captured PID: {pid}")
                break
    
    if not pid:
        print("FAILED: PID not captured!")
        return
    
    if psutil.pid_exists(pid):
        print("SUCCESS: Process is running.")
    else:
        print("FAILED: Process not found!")
        return

    print("\n[2] Testing Stop Task...")
    success = await service.stop_training(task.id)
    if success:
        print("Stop method returned success.")
        await asyncio.sleep(2)
        if not psutil.pid_exists(pid):
            print("SUCCESS: Process was killed.")
        else:
            print("FAILED: Process still exists after stop!")
    else:
        print("FAILED: Stop method returned False!")

    print("\n[3] Testing Delete Task...")
    log_path = task.log_file_path
    model_path = task.output_model_path
    
    # Pre-check files existence (log should exist, model might not yet)
    print(f"Log path: {log_path}")
    print(f"Model path: {model_path}")
    
    success = await service.delete_task(task.id)
    if success:
        print("Delete method returned success.")
        if not os.path.exists(log_path):
            print("SUCCESS: Log file deleted.")
        else:
            print(f"FAILED: Log file still exists at {log_path}!")
            
        async with async_session_maker() as session:
            db_task = await session.get(ModelTrainingTask, task.id)
            if db_task is None:
                print("SUCCESS: DB record deleted.")
            else:
                print("FAILED: DB record still exists!")
    else:
        print("FAILED: Delete method returned False!")

if __name__ == "__main__":
    asyncio.run(verify_management())
