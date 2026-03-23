"""
数据库初始化：建表 + 创建默认管理员账号
"""

import logging

from sqlalchemy import select

from config import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from database.engine import Base, engine, async_session_maker
from database.models import User, Notification  # noqa: F401 — 确保模型注册到 Base

logger = logging.getLogger("aresvision.db")


async def init_database() -> None:
    """
    在应用启动时调用：
    1. 创建所有表（若不存在）
    2. 如果 User 表为空，创建默认管理员账号
    """
    # 延迟导入避免循环依赖
    from auth.security import hash_password

    try:
        # 建表
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("数据库表初始化完成")

        # 创建默认管理员（仅当 users 表为空时）
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
                logger.info(f"默认管理员账号已创建: {DEFAULT_ADMIN_EMAIL}")
            else:
                logger.info("数据库已有用户数据，跳过默认账号创建")

    except Exception as exc:
        logger.warning(f"数据库初始化失败（服务仍将继续启动）: {exc}")
