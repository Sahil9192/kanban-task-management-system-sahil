from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import crud, schemas
from routes.ws import manager
from auth_utils import get_current_user
from models import User

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[schemas.TaskResponse])
def read_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_tasks(db)


@router.post("/", response_model=schemas.TaskResponse)
async def create(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_task = crud.create_task(db, task)
    await manager.broadcast({"type": "tasks_changed"})
    return new_task


@router.put("/{task_id}", response_model=schemas.TaskResponse)
async def update(task_id: str, task: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    updated = crud.update_task(db, task_id, task)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    await manager.broadcast({"type": "tasks_changed"})
    return updated


@router.delete("/{task_id}")
async def delete(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deleted = crud.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    await manager.broadcast({"type": "tasks_changed"})
    return {"success": True}