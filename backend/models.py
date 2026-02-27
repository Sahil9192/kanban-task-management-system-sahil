from sqlalchemy import Column, String, DateTime, Integer, Boolean
from datetime import datetime
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name       = Column(String, default="")
    created_at      = Column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"

    id          = Column(String, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(String, default="")
    status      = Column(String, nullable=False)   # matches KanbanColumn.id
    priority    = Column(String, nullable=False)
    assignee    = Column(String, default="")
    due_date    = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

class KanbanColumn(Base):
    __tablename__ = "columns"

    id    = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name  = Column(String, nullable=False)
    order = Column(Integer, nullable=False, default=0)