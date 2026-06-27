from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect

from auth.dependencies import get_current_user
from database.models import ModelTrainingTask, User
from schemas.training import LogResponse, TrainingStartRequest, TrainingTaskResponse
from services.inference_service import InferenceService
from services.training_service import TrainingService

router = APIRouter(tags=["Training"])

training_service = TrainingService()
inference_service = InferenceService()


def _is_admin(user: User) -> bool:
    return (user.role or "").lower() == "admin"


async def _get_task_with_access_check(task_id: int, current_user: User) -> ModelTrainingTask:
    task = await training_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not _is_admin(current_user) and task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No permission to access this task")

    return task


@router.websocket("/ws/training/{task_id}")
async def training_ws(websocket: WebSocket, task_id: str):
    from services.ws_manager import manager as ws_manager

    await ws_manager.connect(websocket, task_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, task_id)
    except Exception:
        ws_manager.disconnect(websocket, task_id)


@router.get("/training/scripts", response_model=List[str])
async def get_scripts():
    return training_service.get_available_scripts()


@router.post("/training/start", response_model=TrainingTaskResponse)
async def start_training(
    req: TrainingStartRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    try:
        task = await training_service.start_training(
            user_id=current_user.id,
            model_script=req.model_script,
            hyperparameters=req.hyperparameters,
            custom_model_name=req.model_name,
            data_source=req.data_source,
            data_service=getattr(request.app.state, "data_service", None),
            personal_source_service=getattr(request.app.state, "personal_data_source_service", None),
            model_source=req.model_source,
            uploaded_model_id=req.uploaded_model_id,
            user_model_service=getattr(request.app.state, "user_model_service", None),
        )
        return task
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/tasks", response_model=List[TrainingTaskResponse])
async def get_tasks(current_user: User = Depends(get_current_user)):
    tasks = await training_service.get_all_tasks()
    if _is_admin(current_user):
        return tasks
    return [task for task in tasks if task.user_id == current_user.id]


@router.get("/training/tasks/{task_id}/logs", response_model=LogResponse)
async def get_task_logs(task_id: int, current_user: User = Depends(get_current_user)):
    task = await _get_task_with_access_check(task_id, current_user)

    if not task.log_file_path or not Path(task.log_file_path).exists():
        return LogResponse(lines=["[No logs available yet]"])

    try:
        with open(task.log_file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        if not lines:
            return LogResponse(lines=["[Waiting for log output...]"])
        return LogResponse(lines=lines[-500:])
    except Exception as e:
        return LogResponse(lines=[f"Error reading logs: {e}"])


@router.post("/training/tasks/{task_id}/stop")
async def stop_task(task_id: int, current_user: User = Depends(get_current_user)):
    await _get_task_with_access_check(task_id, current_user)

    success = await training_service.stop_training(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot stop task (not found or not running)")
    return {"message": "Task stopped", "status": "success"}


@router.delete("/training/tasks/{task_id}")
async def delete_task(task_id: int, current_user: User = Depends(get_current_user)):
    await _get_task_with_access_check(task_id, current_user)

    success = await training_service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete task (not found)")
    return {"message": "Task deleted", "status": "success"}


@router.post("/training/tasks/{task_id}/action")
async def perform_task_action(
    task_id: int,
    action: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_with_access_check(task_id, current_user)

    if task.status != "completed":
        raise HTTPException(status_code=400, detail="Cannot perform action on incomplete task")

    if action == "test":
        temp_data_root = None
        try:
            data_dirs, temp_data_root = await training_service.prepare_task_inference_data_env(
                task,
                data_service=getattr(request.app.state, "data_service", None),
                personal_source_service=getattr(request.app.state, "personal_data_source_service", None),
            )
            results = await inference_service.get_test_results(task_id, data_dirs=data_dirs)
            return {"status": "success", "data": results}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
        finally:
            training_service.cleanup_temp_data_root(temp_data_root)

    return {"message": f"Action '{action}' executed for task {task_id}", "status": "success"}
