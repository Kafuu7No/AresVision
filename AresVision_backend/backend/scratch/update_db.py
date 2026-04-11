import sqlite3
import os
from pathlib import Path

# 获取数据库路径
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "aresvision.db"

def update_db():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return

    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    columns_to_add = [
        ("progress", "FLOAT DEFAULT 0.0"),
        ("current_epoch", "INTEGER DEFAULT 0"),
        ("total_epochs", "INTEGER DEFAULT 0"),
        ("current_loss", "FLOAT"),
        ("eta", "VARCHAR(50)")
    ]

    for col_name, col_type in columns_to_add:
        try:
            print(f"Adding column '{col_name}' to table 'model_training_tasks'...")
            cursor.execute(f"ALTER TABLE model_training_tasks ADD COLUMN {col_name} {col_type}")
            print(f"Column '{col_name}' added successfully.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column '{col_name}' already exists.")
            else:
                print(f"Error adding column '{col_name}': {e}")

    conn.commit()
    conn.close()
    print("Database update complete.")

if __name__ == "__main__":
    update_db()
