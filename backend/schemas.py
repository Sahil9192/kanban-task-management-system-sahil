from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# ── Auth schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = ""

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# ── Task schemas ──────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title:       str
    description: Optional[str] = ""
    status:      str
    priority:    str
    assignee:    Optional[str] = ""
    due_date:    Optional[datetime] = None

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


class ColumnBase(BaseModel):
    name: str

class ColumnCreate(ColumnBase):
    pass

class ColumnResponse(ColumnBase):
    id: str
    order: int

    class Config:
        orm_mode = True

class ColumnReorder(BaseModel):
    ordered_ids: List[str]