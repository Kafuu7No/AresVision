from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime

class TrainingStartRequest(BaseModel):
    model_script: str = Field(..., description="The script filename to execute")
    hyperparameters: Dict[str, Any] = Field(default_factory=dict, description="Custom hyperparameters")
    model_name: str = Field(..., min_length=1, description="Required unique name for the resulting model")
    data_source: str = Field(default="default", description="default | personal")
    model_source: str = Field(default="official", description="official | uploaded")
    uploaded_model_id: Optional[str] = Field(default=None, description="Validated uploaded model package id")

class TrainingTaskResponse(BaseModel):
    id: int
    model_script: str
    model_source: str = "official"
    uploaded_model_id: Optional[str] = None
    uploaded_model_version: Optional[int] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    hyperparameters: str
    log_file_path: Optional[str]
    output_model_path: Optional[str]
    custom_model_name: Optional[str]
    metrics: Optional[str]
    progress: float
    current_epoch: int
    total_epochs: int
    current_loss: Optional[float]
    eta: Optional[str]
    loss_history: Optional[str]

    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    lines: list[str]


class TrainingWeightFileResponse(BaseModel):
    id: str
    user_id: int
    original_filename: str
    content_hash: str
    file_size: int
    status: str
    validation_report: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrainingWeightFileListResponse(BaseModel):
    items: list[TrainingWeightFileResponse]
