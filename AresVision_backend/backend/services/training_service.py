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

import time
from sqlalchemy import select, update
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
        # Update status to running and set total_epochs
        total_epochs = hyperparameters.get("epochs", 1)
        async with async_session_maker() as session:
            task = await session.get(ModelTrainingTask, task_id)
            if task:
                task.status = "running"
                task.total_epochs = total_epochs
                await session.commit()

        script_path = MODELS_DIR / script_name
        python_exe = getattr(config, "TRAINING_PYTHON_PATH", sys.executable)
        
        # Prepare arguments
        args = [python_exe, str(script_path)]
        for k, v in hyperparameters.items():
            args.extend([f"--{k}", str(v)])
        args.extend(["--output_path", str(output_path)])
            
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"--- 训练任务 {task_id} 已启动 ---\n")
            f.flush()

        try:
            # 使用同步 Popen + PIPE 以确保 Windows 兼容性
            process = subprocess.Popen(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(MODELS_DIR),
                env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
                text=True,
                bufsize=1,
                encoding='utf-8',
                errors='replace'
            )

            # 更新 PID
            async with async_session_maker() as session:
                task = await session.get(ModelTrainingTask, task_id)
                if task:
                    task.pid = process.pid
                    await session.commit()

            start_time_ts = time.time()
            from services.ws_manager import manager as ws_manager
            loop = asyncio.get_event_loop()

            # 初始化损失历史缓冲区
            loss_history_buf = {"train": [], "val": []}
            async with async_session_maker() as session:
                task = await session.get(ModelTrainingTask, task_id)
                if task and task.loss_history:
                    try:
                        loss_history_buf = json.loads(task.loss_history)
                    except: pass

            # 定义一个同步的读取函数，在线程中运行
            def read_and_parse_thread():
                with open(log_file, "a", encoding="utf-8") as f:
                    # 使用迭代器逐行读取管道内容
                    for line in iter(process.stdout.readline, ""):
                        f.write(line)
                        f.flush()
                        
                        # 解析进度
                        progress_data = self._parse_progress_from_log(line, total_epochs, start_time_ts, loss_history_buf)
                        if progress_data:
                            # 将数据库更新和广播任务发回主线程异步循环
                            asyncio.run_coroutine_threadsafe(
                                self._update_task_progress(task_id, progress_data, ws_manager), 
                                loop
                            )
                    process.stdout.close()

            # 在线程池中执行读取，避免阻塞主循环
            await asyncio.to_thread(read_and_parse_thread)
            
            # 等待进程结束
            returncode = await asyncio.to_thread(process.wait)
            status = "completed" if returncode == 0 else "failed"

            async with async_session_maker() as session:
                task = await session.get(ModelTrainingTask, task_id)
                if task:
                    task.status = status
                    task.end_time = datetime.now(timezone.utc)
                    task.progress = 100.0 if status == "completed" else task.progress
                    if status == "completed":
                        parsed_metrics = self._extract_metrics_from_log(log_file)
                        task.metrics = json.dumps(parsed_metrics) if parsed_metrics else json.dumps({"note": "completed"})
                    await session.commit()
                    
                    # 最后一次广播状态变更
                    await ws_manager.broadcast_to_task(str(task_id), {
                        "type": "status_update",
                        "task_id": task_id,
                        "status": status
                    })
                    
        except Exception:
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

    async def _update_task_progress(self, task_id: int, progress_data: dict, ws_manager):
        """异步更新任务进度并广播消息 (供线程调用)"""
        async with async_session_maker() as session:
            await session.execute(
                update(ModelTrainingTask)
                .where(ModelTrainingTask.id == task_id)
                .values(
                    progress=progress_data["progress"],
                    current_epoch=progress_data["current_epoch"],
                    current_loss=progress_data["current_loss"],
                    eta=progress_data["eta"],
                    loss_history=json.dumps(progress_data["loss_history"]) if "loss_history" in progress_data else None
                )
            )
            await session.commit()
        
        await ws_manager.broadcast_to_task(str(task_id), {
            "type": "training_update",
            "task_id": task_id,
            "data": progress_data
        })

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

    def _parse_progress_from_log(self, line: str, total_epochs: int, start_time: float, history: dict = None) -> dict | None:
        # 模式1: Epoch 1/10 Loss=0.1234 Val Loss=0.1567
        # 模式2: Epoch 1/10 Loss=0.1234
        pattern = r"Epoch\s+(\d+)/(\d+)\s+Loss=([\d\.]+)(?:\s+Val Loss=([\d\.]+))?"
        match = re.search(pattern, line)
        if match:
            current_ep = int(match.group(1))
            loss = float(match.group(3))
            val_loss = float(match.group(4)) if match.group(4) else None
            progress = (current_ep / total_epochs) * 100
            
            # 更新历史记录
            if history is not None:
                # 检查是否是同一 epoch 的重复更新（只保留最后一次或仅在增加时追加）
                # 这里我们假设脚本每 epoch 输出一次
                if len(history["train"]) < current_ep:
                    history["train"].append(loss)
                    if val_loss is not None:
                        history["val"].append(val_loss)
                    else:
                        # 兜底：如果没输出 val_loss，用 None 或上一个值占位
                        history["val"].append(None)

            # 计算简单的 ETA
            elapsed = time.time() - start_time
            if current_ep > 0:
                total_est = elapsed / current_ep * total_epochs
                remaining = max(0, total_est - elapsed)
                m, s = divmod(int(remaining), 60)
                h, m = divmod(m, 60)
                eta = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
            else:
                eta = "--:--"
                
            return {
                "progress": round(progress, 2),
                "current_epoch": current_ep,
                "total_epochs": total_epochs,
                "current_loss": round(loss, 4),
                "val_loss": round(val_loss, 4) if val_loss is not None else None,
                "eta": eta,
                "loss_history": history
            }
        return None
