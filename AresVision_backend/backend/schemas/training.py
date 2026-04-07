from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime

class TrainingStartRequest(BaseModel):
    model_script: str = Field(..., description="The script filename to execute")
    hyperparameters: Dict[str, Any] = Field(default_factory=dict, description="Custom hyperparameters")
    model_name: Optional[str] = Field(None, description="Optional custom name for the resulting model file")

class TrainingTaskResponse(BaseModel):
    id: int
    model_script: str
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    hyperparameters: str
    log_file_path: Optional[str]
    output_model_path: Optional[str]
    custom_model_name: Optional[str]
    metrics: Optional[str]

    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    lines: list[str]
