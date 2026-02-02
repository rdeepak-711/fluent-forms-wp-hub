from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class SubmissionCreate(BaseModel):
    site_id: int
    fluent_form_id: int
    form_id: int
    status: str = "pending"
    data: Dict[str, Any] = {}
    is_read: bool = False

class SubmissionResponse(SubmissionCreate):
    id: int
    submitted_at: datetime
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None
    locked_by: Optional[int] = None
    locked_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SubmissionUpdate(BaseModel):
    status: Optional[str] = None
    is_read: Optional[bool] = None
    locked_by: Optional[int] = None
    locked_at: Optional[datetime] = None