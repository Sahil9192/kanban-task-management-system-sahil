const API = "http://127.0.0.1:8000";
const WS = "ws://127.0.0.1:8000/ws";

let tasks = [];
let columns = [];
let draggedTaskId = null;
let draggedColId = null;   // for column drag-and-drop
let ws = null;

/* ═══════════════════════════════════════════════════════════
   HARDCODED AUTH
═══════════════════════════════════════════════════════════ */
const VALID_USERS = {
    "admin@kanban.com": "admin123",
    "user@kanban.com": "user123"
};

/* ── Page bootstrap ─────────────────────────────────────── */
if (location.pathname.includes("board")) {
    if (!localStorage.getItem("kanban_token")) {
        location.href = "/static/login.html";
    } else {
        initBoard();
    }
}

if (location.pathname.includes("login")) {
    if (localStorage.getItem("kanban_token")) {
        location.href = "/static/board.html";
    }
}

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("error");

    if (!email || !password) {
        errorEl.innerText = "Please enter email and password.";
        return;
    }
    if (VALID_USERS[email] && VALID_USERS[email] === password) {
        localStorage.setItem("kanban_token", btoa(email));
        localStorage.setItem("kanban_user", email);
        location.href = "/static/board.html";
    } else {
        errorEl.innerText = "Invalid email or password.";
    }
}

function logout() {
    if (ws) ws.close();
    localStorage.removeItem("kanban_token");
    localStorage.removeItem("kanban_user");
    location.href = "/static/login.html";
}

/* ═══════════════════════════════════════════════════════════
   WEBSOCKET  — real-time sync
═══════════════════════════════════════════════════════════ */
function connectWS() {
    ws = new WebSocket(WS);

    ws.onopen = () => {
        const badge = document.getElementById("ws-status");
        if (badge) { badge.classList.replace("offline", "online"); }
    };

    ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === "columns_changed") {
            loadColumns();          // re-fetch columns + tasks
        } else if (msg.type === "tasks_changed") {
            loadTasks();            // only re-fetch tasks
        }
    };

    ws.onclose = () => {
        const badge = document.getElementById("ws-status");
        if (badge) { badge.classList.replace("online", "offline"); }
        // Auto-reconnect after 3 s
        setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();
}

/* ═══════════════════════════════════════════════════════════
   BOARD INIT
═══════════════════════════════════════════════════════════ */
async function initBoard() {
    await loadColumns();   // also calls loadTasks() once columns are ready
    connectWS();
}

/* ═══════════════════════════════════════════════════════════
   COLUMNS
═══════════════════════════════════════════════════════════ */
async function loadColumns() {
    try {
        const res = await fetch(`${API}/columns/`);
        columns = await res.json();
        await loadTasks();      // tasks depend on columns being known
    } catch (err) {
        console.error("Failed to load columns:", err);
    }
}

function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    const search = (document.getElementById("search")?.value || "").toLowerCase();

    columns.forEach(col => {
        /* ── column wrapper ── */
        const colEl = document.createElement("div");
        colEl.className = "column";
        colEl.dataset.colId = col.id;
        colEl.draggable = true;

        /* column-level drag events */
        colEl.addEventListener("dragstart", onColDragStart);
        colEl.addEventListener("dragover", onColDragOver);
        colEl.addEventListener("drop", onColDrop);

        /* ── column header ── */
        const header = document.createElement("div");
        header.className = "column-header";
        header.innerHTML = `
      <span class="col-title">${col.name}</span>
      <button class="col-delete-btn" onclick="deleteColumn('${col.id}')" title="Delete column">✕</button>
    `;
        colEl.appendChild(header);

        /* ── task list ── */
        const taskList = document.createElement("div");
        taskList.className = "task-list";
        taskList.id = `col-${col.id}`;
        taskList.dataset.status = col.id;

        /* task drop zone */
        taskList.addEventListener("dragover", onTaskDragOver);
        taskList.addEventListener("drop", onTaskDrop);

        const filtered = tasks.filter(t =>
            t.status === col.id && t.title.toLowerCase().includes(search)
        );

        filtered.forEach(task => {
            const taskEl = buildTaskEl(task);
            taskList.appendChild(taskEl);
        });

        colEl.appendChild(taskList);
        board.appendChild(colEl);
    });

    /* populate column selector in Add Task modal */
    const sel = document.getElementById("task-column-select");
    if (sel) {
        sel.innerHTML = columns.map(c =>
            `<option value="${c.id}">${c.name}</option>`
        ).join("");
    }
}

function buildTaskEl(task) {
    const el = document.createElement("div");
    el.className = "task";
    el.draggable = true;
    el.dataset.id = task.id;

    el.addEventListener("dragstart", (e) => {
        draggedTaskId = task.id;
        e.stopPropagation();   // prevent column drag from firing
    });

    const priorityClass = task.priority?.toLowerCase() || "medium";
    el.innerHTML = `
    <div class="task-priority ${priorityClass}">${task.priority}</div>
    <h4>${task.title}</h4>
    <p class="task-assignee">${task.assignee || "Unassigned"}</p>
    <button class="task-delete-btn" onclick="deleteTask('${task.id}')">✕</button>
  `;
    return el;
}

/* ═══════════════════════════════════════════════════════════
   COLUMN DRAG & DROP
═══════════════════════════════════════════════════════════ */
function onColDragStart(e) {
    // Only fire if dragging the column itself (not a task inside it)
    if (draggedTaskId) return;
    draggedColId = e.currentTarget.dataset.colId;
    e.currentTarget.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
}

function onColDragOver(e) {
    if (!draggedColId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
}

async function onColDrop(e) {
    e.preventDefault();
    const targetColId = e.currentTarget.dataset.colId;

    if (!draggedColId || draggedColId === targetColId) {
        draggedColId = null;
        return;
    }

    /* Reorder locally */
    const fromIdx = columns.findIndex(c => c.id === draggedColId);
    const toIdx = columns.findIndex(c => c.id === targetColId);
    const [moved] = columns.splice(fromIdx, 1);
    columns.splice(toIdx, 0, moved);

    renderBoard();   // immediate local update

    /* Persist to backend */
    try {
        await fetch(`${API}/columns/reorder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordered_ids: columns.map(c => c.id) })
        });
    } catch (err) {
        console.error("Failed to save column order:", err);
    }

    draggedColId = null;
    document.querySelectorAll(".column.dragging").forEach(el =>
        el.classList.remove("dragging")
    );
}

/* ═══════════════════════════════════════════════════════════
   TASK DRAG & DROP (between columns)
═══════════════════════════════════════════════════════════ */
function onTaskDragOver(e) {
    if (draggedColId) return;   // column drag takes priority
    e.preventDefault();
    e.stopPropagation();
}

async function onTaskDrop(e) {
    if (draggedColId) return;
    e.preventDefault();
    e.stopPropagation();

    const newStatus = e.currentTarget.dataset.status;
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task || task.status === newStatus) { draggedTaskId = null; return; }

    task.status = newStatus;
    renderBoard();   // optimistic UI

    try {
        await fetch(`${API}/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(task)
        });
    } catch (err) {
        console.error("Failed to move task:", err);
    }
    draggedTaskId = null;
}

/* ═══════════════════════════════════════════════════════════
   TASKS
═══════════════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await fetch(`${API}/tasks/`);
        tasks = await res.json();
        renderBoard();
    } catch (err) {
        console.error("Failed to load tasks:", err);
    }
}

async function createTask() {
    const titleVal = document.getElementById("task-title").value.trim();
    const priorityVal = document.getElementById("task-priority").value;
    const assigneeVal = document.getElementById("task-assignee").value.trim();
    const statusVal = document.getElementById("task-column-select").value;

    if (!titleVal) { alert("Title is required."); return; }

    try {
        const res = await fetch(`${API}/tasks/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: titleVal,
                priority: priorityVal,
                assignee: assigneeVal,
                status: statusVal,
                description: ""
            })
        });
        const newTask = await res.json();
        tasks.push(newTask);
        closeTaskModal();
        renderBoard();
    } catch (err) {
        console.error("Failed to create task:", err);
    }
}

async function deleteTask(id) {
    try {
        await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
        tasks = tasks.filter(t => t.id !== id);
        renderBoard();
    } catch (err) {
        console.error("Failed to delete task:", err);
    }
}

/* ═══════════════════════════════════════════════════════════
   CUSTOM COLUMNS
═══════════════════════════════════════════════════════════ */
async function createColumn() {
    const name = document.getElementById("col-name").value.trim();
    if (!name) { alert("Column name is required."); return; }

    try {
        const res = await fetch(`${API}/columns/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const newCol = await res.json();
        columns.push(newCol);
        closeColModal();
        renderBoard();
    } catch (err) {
        console.error("Failed to create column:", err);
    }
}

async function deleteColumn(colId) {
    if (!confirm("Delete this column? Tasks inside will move to the first column.")) return;

    try {
        await fetch(`${API}/columns/${colId}`, { method: "DELETE" });
        columns = columns.filter(c => c.id !== colId);
        await loadTasks();   // tasks may have been moved server-side
        renderBoard();
    } catch (err) {
        console.error("Failed to delete column:", err);
    }
}

/* ═══════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════ */
function showAddTask() {
    document.getElementById("task-modal").classList.remove("hidden");
}
function closeTaskModal() {
    document.getElementById("task-modal").classList.add("hidden");
    document.getElementById("task-title").value = "";
    document.getElementById("task-assignee").value = "";
}

function showAddColumn() {
    document.getElementById("col-modal").classList.remove("hidden");
}
function closeColModal() {
    document.getElementById("col-modal").classList.add("hidden");
    document.getElementById("col-name").value = "";
}