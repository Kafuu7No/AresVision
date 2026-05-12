"""
Database bootstrap:
1. create tables if missing
2. patch legacy SQLite schema for model_training_tasks
3. create default admin if users table is empty
"""

import logging

from sqlalchemy import select, text

from config import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from database.engine import Base, engine, async_session_maker
from database.models import (
    User,
    Notification,
    Feedback,
    ModelTrainingTask,
    DatasetLineageEvent,
    DatasetQualitySnapshot,
)  # noqa: F401

logger = logging.getLogger("aresvision.db")


async def _patch_training_table_columns(conn) -> None:
    """Add missing columns for legacy SQLite databases."""
    result = await conn.execute(text("PRAGMA table_info(model_training_tasks)"))
    existing_columns = {row[1] for row in result.fetchall()}

    columns_to_add = [
        ("pid", "INTEGER"),
        ("custom_model_name", "VARCHAR(255)"),
        ("progress", "FLOAT DEFAULT 0.0"),
        ("current_epoch", "INTEGER DEFAULT 0"),
        ("total_epochs", "INTEGER DEFAULT 0"),
        ("current_loss", "FLOAT"),
        ("eta", "VARCHAR(50)"),
        ("loss_history", "TEXT"),
    ]

    for col_name, col_def in columns_to_add:
        if col_name not in existing_columns:
            logger.info("Adding missing column model_training_tasks.%s", col_name)
            await conn.execute(
                text(f"ALTER TABLE model_training_tasks ADD COLUMN {col_name} {col_def}")
            )


async def init_database() -> None:
    from auth.security import hash_password

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                await _patch_training_table_columns(conn)
            except Exception as exc:
                logger.warning("Could not auto-patch model_training_tasks schema: %s", exc)

        logger.info("Database schema initialization complete")

        async with async_session_maker() as session:
            result = await session.execute(select(User).limit(1))
            if result.scalar_one_or_none() is None:
                admin = User(
                    email=DEFAULT_ADMIN_EMAIL,
                    username="Admin",
                    password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
                    role="admin",
                )
                session.add(admin)
                await session.commit()
                logger.info("Default admin created: %s", DEFAULT_ADMIN_EMAIL)
            else:
                logger.info("Users already exist; skip default admin creation")

    except Exception as exc:
        logger.warning("Database initialization failed (startup continues): %s", exc)
