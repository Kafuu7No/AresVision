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
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", foreign_keys="Notification.user_id", back_populates="user"
    )
    lineage_events: Mapped[list["DatasetLineageEvent"]] = relationship(
        "DatasetLineageEvent", foreign_keys="DatasetLineageEvent.actor_user_id", back_populates="actor"
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
    lineage_events: Mapped[list["DatasetLineageEvent"]] = relationship(
        "DatasetLineageEvent",
        foreign_keys="DatasetLineageEvent.upload_id",
        back_populates="upload_record",
        cascade="all, delete-orphan",
    )
    quality_snapshots: Mapped[list["DatasetQualitySnapshot"]] = relationship(
        "DatasetQualitySnapshot",
        foreign_keys="DatasetQualitySnapshot.upload_id",
        back_populates="upload_record",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<UploadRecord id={self.id} file={self.filename} status={self.status}>"


class DatasetLineageEvent(Base):
    __tablename__ = "dataset_lineage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(Integer, ForeignKey("upload_records.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    event_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now, index=True)

    upload_record: Mapped["UploadRecord"] = relationship(
        "UploadRecord", foreign_keys=[upload_id], back_populates="lineage_events"
    )
    actor: Mapped["User | None"] = relationship(
        "User", foreign_keys=[actor_user_id], back_populates="lineage_events"
    )

    def __repr__(self) -> str:
        return f"<DatasetLineageEvent id={self.id} upload_id={self.upload_id} type={self.event_type}>"


class DatasetQualitySnapshot(Base):
    __tablename__ = "dataset_quality_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(Integer, ForeignKey("upload_records.id"), nullable=False, index=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    file_mtime_ns: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    grade: Mapped[str] = mapped_column(String(2), nullable=False, default="D")
    missing_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    valid_value_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    variable_completeness: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    time_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    grid_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    metrics_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    scores_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    issues_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now, index=True)

    upload_record: Mapped["UploadRecord"] = relationship(
        "UploadRecord", foreign_keys=[upload_id], back_populates="quality_snapshots"
    )

    def __repr__(self) -> str:
        return f"<DatasetQualitySnapshot id={self.id} upload_id={self.upload_id} overall={self.overall_score}>"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # "approved" | "rejected" | "revoked"
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    related_upload_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)

    # 关系
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="notifications"
    )

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.type} read={self.is_read}>"


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)   # "bug" | "suggestion" | "other"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    screenshot_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # "pending" | "resolved"
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<Feedback id={self.id} type={self.type} status={self.status}>"


class ModelTrainingTask(Base):
    __tablename__ = "model_training_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    model_script: Mapped[str] = mapped_column(String(255), nullable=False)
    hyperparameters: Mapped[str] = mapped_column(Text, nullable=False)  # JSON stored as string
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    log_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    output_model_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    custom_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metrics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON stored as string
    
    # 实时进度追踪字段
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    total_epochs: Mapped[int] = mapped_column(Integer, default=0)
    current_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    eta: Mapped[str | None] = mapped_column(String(50), nullable=True)
    loss_history: Mapped[str | None] = mapped_column(Text, nullable=True) # JSON: {"train": [], "val": []}

    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<ModelTrainingTask id={self.id} script={self.model_script} status={self.status}>"


class PersonalSourceBuildState(Base):
    __tablename__ = "personal_source_build_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    signature_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="idle")  # idle | building | ready | failed
    stage: Mapped[str] = mapped_column(String(40), nullable=False, default="idle")  # idle | queued | building_cache | warming_analysis | warming_predict | ready | failed
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stage_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    built_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_now)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<PersonalSourceBuildState user_id={self.user_id} status={self.status} "
            f"signature={self.signature_hash[:8]}>"
        )
