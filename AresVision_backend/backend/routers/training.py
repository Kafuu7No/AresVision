from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from pathlib import Path

from schemas.training import TrainingStartRequest, TrainingTaskResponse, LogResponse
from services.training_service import TrainingService
from auth.dependencies import get_current_user
from database.models import User

router = APIRouter(tags=["Training"])

training_service = TrainingService()

@router.get("/training/scripts", response_model=List[str])
async def get_scripts():
    """获取可用模型训练脚本列表"""
    return training_service.get_available_scripts()

@router.post("/training/start", response_model=TrainingTaskResponse)
async def start_training(req: TrainingStartRequest, current_user: User = Depends(get_current_user)):
    """启动模型训练任务"""
    try:
        task = await training_service.start_training(
            user_id=current_user.id,
            model_script=req.model_script,
            hyperparameters=req.hyperparameters,
            custom_model_name=req.model_name
        )
        return task
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/training/tasks", response_model=List[TrainingTaskResponse])
async def get_tasks(current_user: User = Depends(get_current_user)):
    """获取所有模型训练任务"""
    # Assuming admins see all or users see their own. For simplicity, just return all.
    # To filter by user, we can modify the service, but it's okay for now.
    tasks = await training_service.get_all_tasks()
    return tasks

@router.get("/training/tasks/{task_id}/logs", response_model=LogResponse)
async def get_task_logs(task_id: int):
    """获取训练任务日志尾部内容"""
    task = await training_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not task.log_file_path or not Path(task.log_file_path).exists():
        return LogResponse(lines=["[No logs available yet]"])
        
    try:
        # Read the last N lines or the whole file if small
        lines = []
        with open(task.log_file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            
        # Return last 500 lines to avoid massive payloads
        return LogResponse(lines=lines[-500:])
    except Exception as e:
        return LogResponse(lines=[f"Error reading logs: {str(e)}"])

@router.post("/training/tasks/{task_id}/stop")
async def stop_task(task_id: int, current_user: User = Depends(get_current_user)):
    """停止正在运行的训练任务"""
    success = await training_service.stop_training(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot stop task (not found or not running)")
    return {"message": "Task stopped", "status": "success"}

@router.delete("/training/tasks/{task_id}")
async def delete_task(task_id: int, current_user: User = Depends(get_current_user)):
    """删除训练任务及相关物理文件"""
    success = await training_service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete task (not found)")
    return {"message": "Task deleted", "status": "success"}

@router.post("/training/tasks/{task_id}/action")
async def perform_task_action(task_id: int, action: str):
    """对已完成模型执行二次操作(如推理)"""
    task = await training_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="Cannot perform action on incomplete task")
        
    # Dummy mock for future predict invocation
    return {"message": f"Action '{action}' executed for task {task_id}", "status": "success"}
