from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from database import engine, Base, SessionLocal
from routes import tasks, auth, columns
from routes.ws import router as ws_router
import crud, os

# Create all DB tables (including the new columns table)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kanban Task Management API")

# CORS — allow the browser to call from /static HTML pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed default columns on first run
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        crud.seed_default_columns(db)
    finally:
        db.close()

# Routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(columns.router)
app.include_router(ws_router)   # WebSocket at /ws

# Serve frontend static files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/login.html")