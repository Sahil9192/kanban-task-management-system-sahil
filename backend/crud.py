from sqlalchemy.orm import Session
from models import Task, KanbanColumn
from schemas import TaskCreate, TaskUpdate, ColumnCreate
from uuid import uuid4


# ── Task CRUD ─────────────────────────────────────────────────────────────────

def get_tasks(db: Session):
    return db.query(Task).all()

def create_task(db: Session, task: TaskCreate):
    db_task = Task(id=str(uuid4()), **task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: str, updated: TaskUpdate):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return None
    for key, value in updated.dict().items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, task_id: str):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return task


# ── Column CRUD ───────────────────────────────────────────────────────────────

def get_columns(db: Session):
    return db.query(KanbanColumn).order_by(KanbanColumn.order).all()

def create_column(db: Session, col: ColumnCreate):
    # order = next integer after the current max
    max_order = db.query(KanbanColumn).count()
    db_col = KanbanColumn(id=str(uuid4()), name=col.name, order=max_order)
    db.add(db_col)
    db.commit()
    db.refresh(db_col)
    return db_col

def delete_column(db: Session, col_id: str):
    col = db.query(KanbanColumn).filter(KanbanColumn.id == col_id).first()
    if col:
        # Move orphaned tasks to the first remaining column
        remaining = (
            db.query(KanbanColumn)
            .filter(KanbanColumn.id != col_id)
            .order_by(KanbanColumn.order)
            .first()
        )
        fallback_id = remaining.id if remaining else "todo"
        db.query(Task).filter(Task.status == col_id).update({"status": fallback_id})
        db.delete(col)
        db.commit()
    return col

def reorder_columns(db: Session, ordered_ids: list[str]):
    for idx, col_id in enumerate(ordered_ids):
        db.query(KanbanColumn).filter(KanbanColumn.id == col_id).update({"order": idx})
    db.commit()
    return get_columns(db)

def seed_default_columns(db: Session):
    """Insert the 4 classic columns if the table is empty."""
    if db.query(KanbanColumn).count() > 0:
        return
    defaults = [
        ("todo",       "To Do",       0),
        ("inprogress", "In Progress", 1),
        ("review",     "In Review",   2),
        ("done",       "Done",        3),
    ]
    for col_id, name, order in defaults:
        db.add(KanbanColumn(id=col_id, name=name, order=order))
    db.commit()