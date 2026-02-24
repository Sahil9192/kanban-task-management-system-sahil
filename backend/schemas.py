from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Task schemas ──────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title:       str
    description: Optional[str] = ""
    status:      str
    priority:    str
    assignee:    Optional[str] = ""

class TaskCreate(TaskBase):
    pass

class TaskUpdate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id:         str
    created_at: datetime

    class Config:
        from_attributes = True   # Pydantic v2 (was orm_mode in v1)


# ── Column schemas ────────────────────────────────────────────────────────────

class ColumnCreate(BaseModel):
    name: str

class ColumnResponse(BaseModel):
    id:    str
    name:  str
    order: int

    class Config:
        from_attributes = True

class ReorderRequest(BaseModel):
    ordered_ids: List[str]   # column IDs in the desired new order