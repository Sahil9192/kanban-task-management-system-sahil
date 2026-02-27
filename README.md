# kanban-task-management-system-sahil
# ⚡ KanbanAI — Modern Task Management System

A production-style Kanban board built with **FastAPI, WebSockets, SQLAlchemy, and a modern dark UI**.

Designed and developed as a full-stack project showcasing:
- Backend API design
- Real-time updates
- Authentication
- Drag-and-drop workflows
- Clean UI/UX engineering

---

## 🌟 Features

### 🔐 Authentication
- JWT-based login system
- Secure password hashing
- Session validation
- Auth-protected routes

### 📋 Dynamic Kanban Board
- Create custom columns
- Delete columns (auto task fallback)
- Drag & reorder columns
- Drag & move tasks across columns
- Real-time UI updates

### 📝 Task Management
- Create / Update / Delete tasks
- Priority levels (High / Medium / Low)
- Due date tracking with overdue detection
- Assignee support
- Search filter
- Task counter

### ⚡ Real-Time Sync
- WebSocket integration
- Auto-refresh on column or task changes
- Live connection status badge

### 🎨 Modern UI
- Glassmorphism design
- Dark SaaS-style theme
- Responsive layout
- Toast notifications
- Confirm modals
- Smooth animations

---

## 🛠 Tech Stack

### Backend
- **FastAPI**
- **SQLAlchemy ORM**
- **SQLite**
- **JWT Authentication**
- **WebSockets**
- **Pydantic**

### Frontend
- HTML5
- CSS3 (Design Tokens + Modern Layout)
- Vanilla JavaScript (No frameworks)
- Drag & Drop API

---

## 📂 Project Structure

```
backend/
│
├── main.py
├── database.py
├── models.py
├── schemas.py
├── crud.py
├── auth_utils.py
└── routes/
    ├── auth.py
    ├── tasks.py
    └── columns.py

static/
├── login.html
├── board.html
└── app.js
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/kanban-ai.git
cd kanban-ai
```

---

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate   # Windows
```

---

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

---

### 4️⃣ Run Server

```bash
uvicorn main:app --reload
```

Open:

```
http://127.0.0.1:8000/static/login.html
```

---

## 🔑 Demo Login

For demonstration purposes:

```
Email    : admin@kanban.ai
Password : admin123
```

> Authentication is implemented using JWT and password hashing.

---

## 📡 API Documentation

FastAPI auto docs available at:

```
http://127.0.0.1:8000/docs
```

---

## 🧠 System Architecture

- Columns and tasks stored relationally
- Column ordering persisted via `order` field
- Tasks reference columns using `status`
- WebSocket triggers frontend refresh events
- Optimistic UI updates for smoother UX

---

## 🎯 Key Engineering Highlights

- Clean separation of concerns (CRUD, Routes, Models)
- No frontend frameworks — custom UI logic
- Real-time bidirectional communication
- Column drag-reordering with persistent storage
- Task fallback logic when deleting columns
- Defensive validation and error handling
- Production-style modular structure

---



## 🚀 Future Enhancements

- Role-based access control
- Multi-user boards
- Task comments
- Activity logs
- Docker deployment
- MySQL/PostgreSQL migration
- Analytics dashboard

---

## 👨‍💻 Author

**Sahil Pawar**  
B.Tech — Artificial Intelligence & Data Science  

---

## 📜 License

This project is for educational and portfolio demonstration purposes.