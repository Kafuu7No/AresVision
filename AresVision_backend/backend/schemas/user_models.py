from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserModelValidationReport(BaseModel):
    ok: bool = False
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    output_shape: Optional[List[int]] = None


class UserModelPackageResponse(BaseModel):
    id: str
    user_id: int
    display_name: str
    version: int
    original_filename: str
    content_hash: str
    param_schema: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None
    validation_status: str
    validation_report: UserModelValidationReport
    created_at: Any
    updated_at: Any


class UserModelListResponse(BaseModel):
    items: List[UserModelPackageResponse]
