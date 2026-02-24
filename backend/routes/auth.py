from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/auth", tags=["Auth"])

USERS = {
    "admin@test.com": "admin123"
}

@router.post("/login")
def login(data: dict):
    if USERS.get(data["email"]) == data["password"]:
        return {"token": "mock-token", "user": {"name": "Admin"}}
    raise HTTPException(status_code=401, detail="Invalid credentials")