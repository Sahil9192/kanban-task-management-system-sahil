from sqlalchemy import Column, String, DateTime, Integer
from datetime import datetime
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id          = Column(String, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(String, default="")
    status      = Column(String, nullable=False)   # matches KanbanColumn.id
    priority    = Column(String, nullable=False)
    assignee    = Column(String, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)


class KanbanColumn(Base):
    __tablename__ = "columns"

    id    = Column(String, primary_key=True, index=True)
    name  = Column(String, nullable=False)
    order = Column(Integer, nullable=False, default=0)