import os
import sys
import json
import asyncio
import logging
import traceback
import psutil
import subprocess
import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import USER_UPLOADS_DIR
from database.engine import async_session_maker
from database.models import ModelTrainingTask
import config

logger = logging.getLogger("aresvision.training")

MODELS_DIR = Path(__file__).parent.parent / "models" / "训练模型"
LOGS_DIR = Path(__file__).parent.parent / "logs" / "training"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_MODELS_DIR = Path(__file__).parent.parent / "models" / "训练结果"
OUTPUT_MODELS_DIR.mkdir(parents=True, exist_ok=True)


class TrainingService:
    def get_available_scripts(self) -> list[str]:
        if not MODELS_DIR.exists():
            return []
        scripts = []
        for file in MODELS_DIR.iterdir():
            if file.is_file() and file.name.endswith(".py"):
                scripts.append(file.name)
        return scripts

    async def start_training(self, user_id: int | None, model_script: str, hyperparameters: dict, custom_model_name: str | None = None) -> ModelTrainingTask:
        if not MODELS_DIR.joinpath(model_script).exists():
            raise FileNotFoundError(f"Script {model_script} not found in {MODELS_DIR}")

        # ── 唯一性校验 ──
        if not custom_model_name or not custom_model_name.strip():
            raise ValueError("模型命名不能为空")
        async with async_session_maker() as session:
            existing = await session.execute(
                select(ModelTrainingTask).where(ModelTrainingTask.custom_model_name == custom_model_name.strip())
            )
            if existing.scalars().first():
                raise ValueError(f"模型名称 '{custom_model_name}' 已被使用，请换一个名称")

        async with async_session_maker() as session:
            task = ModelTrainingTask(
                user_id=user_id,
                model_script=model_script,
                hyperparameters=json.dumps(hyperparameters),
                custom_model_name=custom_model_name,
                status="pending",
            )
            session.add(task)
            await session.commit()
            await session.refresh(task)

            task_id = task.id
            log_file = LOGS_DIR / f"task_{task_id}.log"
            
            # Determine output filename
            if custom_model_name:
                # Sanitize: remove special characters, replace spaces with underscores
                safe_name = re.sub(r'[^\w\-]', '_', custom_model_name)
                # Still include task_id to avoid collisions if user reuses name
                output_filename = f"task_{task_id}_{safe_name}.pth"
            else:
                model_stem = Path(model_script).stem
                output_filename = f"task_{task_id}_{model_stem}.pth"
                
            output_path = OUTPUT_MODELS_DIR / output_filename
            
            task.log_file_path = str(log_file)
            task.output_model_path = str(output_path)
            await session.commit()
            
            # Start background execution
            asyncio.create_task(self._run_training_subprocess(task_id, model_script, hyperparameters, log_file, output_path))
            
            return task

    async def _run_training_subprocess(self, task_id: int, script_name: str, hyperparameters: dict, log_file: Path, output_path: Path):
        # Update status to running
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            if task:
                task.status = "running"
                await session.commit()

        script_path = MODELS_DIR / script_name
        
        # Prepare arguments (convert dict to --key value args)
        python_exe = getattr(config, "TRAINING_PYTHON_PATH", sys.executable)
        args = [python_exe, str(script_path)]
        for k, v in hyperparameters.items():
            args.extend([f"--{k}", str(v)])
        
        # Add output path argument
        args.extend(["--output_path", str(output_path)])
            
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"--- 启动训练任务 {task_id} ---\n")
            f.write(f"执行命令: {' '.join(args)}\n")
            f.flush()
        
        try:
            # Use sync subprocess.Popen with direct redirection for Windows compatibility
            # Open in "a" mode so starting info is preserved
            with open(log_file, "a", encoding="utf-8") as f:
                process = subprocess.Popen(
                    args,
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    cwd=str(MODELS_DIR),
                    env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
                    bufsize=1
                )

                # SAVE PID
                async with async_session_maker() as session:
                    task = await session.get(ModelTrainingTask, task_id)
                    if task:
                        task.pid = process.pid
                        await session.commit()
                
                # Wait for the process to finish
                returncode = await asyncio.to_thread(process.wait)

            status = "completed" if returncode == 0 else "failed"

            # Update status
            async with async_session_maker() as session:
                task = await session.get(ModelTrainingTask, task_id)
                if task:
                    task.status = status
                    task.end_time = datetime.now(timezone.utc)
                    if status == "completed":
                        # Attempt to parse metrics from log
                        parsed_metrics = self._extract_metrics_from_log(log_file)
                        if parsed_metrics:
                            task.metrics = json.dumps(parsed_metrics)
                        else:
                            task.metrics = json.dumps({"note": "completed successfully"})
                    await session.commit()
                    
        except Exception as repr_exc:
            error_msg = traceback.format_exc()
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"\n[系统错误]:\n{error_msg}")
            
            logger.error(f"Task {task_id} failed with error: {error_msg}")
            
            async with async_session_maker() as session:
                task = await session.get(ModelTrainingTask, task_id)
                if task:
                    task.status = "failed"
                    task.end_time = datetime.now(timezone.utc)
                    await session.commit()

    async def get_task(self, task_id: int) -> ModelTrainingTask:
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            return task

    async def get_all_tasks(self) -> list[ModelTrainingTask]:
        async with async_session_maker() as session:
            result = await session.execute(select(ModelTrainingTask).order_by(ModelTrainingTask.id.desc()))
            return result.scalars().all()

    async def stop_training(self, task_id: int):
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            if not task or task.status != "running" or not task.pid:
                return False
            
            try:
                parent = psutil.Process(task.pid)
                for child in parent.children(recursive=True):
                    child.terminate()
                parent.terminate()
                
                # Wait for termination
                _, alive = psutil.wait_procs([parent] + parent.children(), timeout=3)
                for p in alive:
                    p.kill()
                    
                task.status = "failed"
                task.end_time = datetime.now(timezone.utc)
                task.metrics = json.dumps({"note": "Stopped by user"})
                await session.commit()
                return True
            except psutil.NoSuchProcess:
                task.status = "failed"
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error stopping task {task_id}: {e}")
                return False

    async def delete_task(self, task_id: int):
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            if not task:
                return False
            
            # 1. Stop if running
            if task.status == "running":
                await self.stop_training(task_id)
                await session.refresh(task)

            # 2. Delete log file
            if task.log_file_path and os.path.exists(task.log_file_path):
                try:
                    os.remove(task.log_file_path)
                except: pass

            # 3. Delete model file
            if task.output_model_path and os.path.exists(task.output_model_path):
                try:
                    os.remove(task.output_model_path)
                except: pass

            # 4. Delete from DB
            await session.delete(task)
            await session.commit()
            return True

    def _extract_metrics_from_log(self, log_file: Path) -> dict | None:
        """从日志文件中使用正则提取训练指标"""
        if not log_file.exists():
            return None
        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            
            # 使用正则匹配 Metrics 之后的内容
            metrics = {}
            patterns = {
                "mse": r"MSE:\s*([\d\.]+)",
                "rmse": r"RMSE:\s*([\d\.]+)",
                "r2": r"R-Squared:\s*([\d\.\-]+)",
                "mape": r"MAPE:\s*([\d\.]+)%",
                "smape": r"SMAPE:\s*([\d\.]+)%"
            }
            
            for key, pattern in patterns.items():
                match = re.search(pattern, content)
                if match:
                    metrics[key] = float(match.group(1))
            
            return metrics if metrics else None
        except Exception as e:
            logger.error(f"Error extracting metrics from log: {e}")
            return None

    async def test_model(self, task_id: int):
        """执行模型推理测试，生成散点图数据"""
        # 这是一个占位，具体逻辑待实现
        return {"id": task_id, "status": "testing"}
