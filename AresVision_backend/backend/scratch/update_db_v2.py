import sqlite3
import os

# 获取数据库路径 (在 backend/data/aresvision.db)
db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "aresvision.db")

def update_db():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 检查是否已经存在 loss_history 列
        cursor.execute("PRAGMA table_info(model_training_tasks)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "loss_history" not in columns:
            print("Adding 'loss_history' column to 'model_training_tasks' table...")
            cursor.execute("ALTER TABLE model_training_tasks ADD COLUMN loss_history TEXT")
            print("Column added successfully.")
        else:
            print("Column 'loss_history' already exists.")

        conn.commit()
    except Exception as e:
        print(f"Error updating database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    update_db()
