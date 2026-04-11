import sqlite3
import os
import shutil
from pathlib import Path

# 获取基准路径
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "aresvision.db"
LOGS_DIR = BASE_DIR / "logs" / "training"
OUTPUT_MODELS_DIR = BASE_DIR / "models" / "训练结果"

def clear_all_training_data():
    print("--- 正在启动后台训练数据清理程序 ---")
    
    # 1. 清理数据库
    if DB_PATH.exists():
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            print(f"正在清空数据库表 'model_training_tasks'...")
            cursor.execute("DELETE FROM model_training_tasks")
            conn.commit()
            print(f"数据库记录已清空，共删除 {cursor.rowcount} 条数据。")
            conn.close()
        except Exception as e:
            print(f"清理数据库时出错: {e}")
    else:
        print(f"未找到数据库文件: {DB_PATH}")

    # 2. 清理日志文件
    if LOGS_DIR.exists():
        print(f"正在清理日志目录: {LOGS_DIR}")
        for file in LOGS_DIR.glob("*"):
            if file.is_file():
                try:
                    file.unlink()
                    print(f"已删除日志: {file.name}")
                except Exception as e:
                    print(f"无法删除文件 {file}: {e}")
    
    # 3. 清理训练结果模型文件
    if OUTPUT_MODELS_DIR.exists():
        print(f"正在清理模型结果目录: {OUTPUT_MODELS_DIR}")
        for file in OUTPUT_MODELS_DIR.glob("*.pth"):
            if file.is_file():
                try:
                    file.unlink()
                    print(f"已删除模型: {file.name}")
                except Exception as e:
                    print(f"无法删除文件 {file}: {e}")
                    
    print("\n--- 后台清理任务完成 ---")

if __name__ == "__main__":
    clear_all_training_data()
