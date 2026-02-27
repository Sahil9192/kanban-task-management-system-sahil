from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import crud, schemas
from routes.ws import manager
from auth_utils import get_current_user
from models import User

router = APIRouter(prefix="/columns", tags=["Columns"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[schemas.ColumnResponse])
def list_columns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_columns(db)


@router.post("/", response_model=schemas.ColumnResponse)
async def add_column(col: schemas.ColumnCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_col = crud.create_column(db, col)
    count = len(crud.get_columns(db))
    if count > 20:
        crud.delete_column(db, new_col.id)
        raise HTTPException(status_code=400, detail=f"Column limit reached (max 20). Delete some columns first.")
    await manager.broadcast({"type": "columns_changed"})
    return new_col


@router.delete("/{col_id}")
async def remove_column(col_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deleted = crud.delete_column(db, col_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Column not found")
    await manager.broadcast({"type": "columns_changed"})
    return {"success": True}


@router.put("/reorder")
async def reorder(req: schemas.ReorderRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    updated = crud.reorder_columns(db, req.ordered_ids)
    await manager.broadcast({"type": "columns_changed"})
    return updated
