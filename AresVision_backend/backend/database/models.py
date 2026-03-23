"""
ORM 数据表模型
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.engine import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # 关系
    uploads: Mapped[list["UploadRecord"]] = relationship(
        "UploadRecord", foreign_keys="UploadRecord.user_id", back_populates="uploader"
    )
    reviewed_uploads: Mapped[list["UploadRecord"]] = relationship(
        "UploadRecord", foreign_keys="UploadRecord.reviewed_by", back_populates="reviewer"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"


class UploadRecord(Base):
    __tablename__ = "upload_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mars_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ls_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    ls_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="validating")
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    validation_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # 关系
    uploader: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="uploads"
    )
    reviewer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewed_by], back_populates="reviewed_uploads"
    )

    def __repr__(self) -> str:
        return f"<UploadRecord id={self.id} file={self.filename} status={self.status}>"
