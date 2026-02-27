/* ═══════════════════════════════════════════════════════════
   KanbanAI — app.js
   Handles: Auth guard, WebSocket, Columns, Tasks, Drag & Drop
   Integrates: toast popups, confirm dialog, overdue detection
═══════════════════════════════════════════════════════════ */

const API = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws";

let tasks = [];
let columns = [];
let draggedTaskId = null;
let draggedColId = null;
let ws = null;

/* ── Column dot colors (cycles) ───────────────────────── */
const COL_DOTS = ['dot-blue', 'dot-violet', 'dot-green', 'dot-amber', 'dot-rose', 'dot-cyan', 'dot-gray'];

/* ═══════════════════════════════════════════════════════════
   PAGE BOOTSTRAP
═══════════════════════════════════════════════════════════ */
(function bootstrap() {
    const isBoard = location.pathname.includes("board");
    const isLogin = location.pathname.includes("login");
    const token = localStorage.getItem("kanban_token");

    if (isBoard) {
        if (!token) {
            location.href = "/static/login.html";
        } else {
            initBoard();
        }
    }

    if (isLogin && token) {
        location.href = "/static/board.html";
    }
})();

/* ── Auth header helper ───────────────────────────────── */
function getAuthHeaders() {
    const token = localStorage.getItem("kanban_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

/* ── Logout ───────────────────────────────────────────── */
function logout() {
    if (ws) { try { ws.close(); } catch (e) { } }
    localStorage.removeItem("kanban_token");
    localStorage.removeItem("kanban_user_name");
    location.href = "/static/login.html";
}

/* ─────────── Safe fallbacks if toast not yet defined ─── */
function _toast(type, title, msg, dur) {
    if (typeof window.showToast === 'function') {
        window.showToast(type, title, msg, dur);
    } else {
        console.warn(`[${type}] ${title}: ${msg}`);
    }
}

function _confirm(icon, title, msg, cb) {
    if (typeof window.showConfirm === 'function') {
        window.showConfirm(icon, title, msg, cb);
    } else if (window.confirm(msg)) {
        cb();
    }
}

/* ═══════════════════════════════════════════════════════════
   BOARD INIT
═══════════════════════════════════════════════════════════ */
async function initBoard() {
    // Set user name + avatar
    const storedName = localStorage.getItem("kanban_user_name") || "User";
    const nameEl = document.getElementById("user-name-display");
    if (nameEl) nameEl.textContent = storedName;

    // Set avatar initials
    if (typeof setAvatarInitials === 'function') setAvatarInitials(storedName);

    // Verify token is still valid with backend
    try {
        const meRes = await fetch(`${API}/auth/me`, {
            headers: getAuthHeaders()
        });
        if (meRes.status === 401) {
            logout();
            return;
        }
        if (meRes.ok) {
            const me = await meRes.json();
            const newName = me.full_name || me.email || storedName;
            localStorage.setItem("kanban_user_name", newName);
            if (nameEl) nameEl.textContent = newName;
            if (typeof setAvatarInitials === 'function') setAvatarInitials(newName);
        }
    } catch (e) {
        // Server might be down — continue with cached data
        _toast('info', 'Offline Mode', 'Could not verify session. Some features may be limited.', 5000);
    }

    await loadColumns();
    connectWS();
}

/* ═══════════════════════════════════════════════════════════
   WEBSOCKET — real-time sync
═══════════════════════════════════════════════════════════ */
function connectWS() {
    try {
        ws = new WebSocket(WS_URL);
    } catch (e) {
        setBadge(false);
        return;
    }

    ws.onopen = () => setBadge(true);

    ws.onmessage = (evt) => {
        try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "columns_changed") {
                loadColumns();
            } else if (msg.type === "tasks_changed") {
                loadTasks();
            }
        } catch (e) {
            console.warn("WS parse error:", e);
        }
    };

    ws.onerror = () => { };
    ws.onclose = () => {
        setBadge(false);
        setTimeout(connectWS, 3000);
    };
}

function setBadge(online) {
    const badge = document.getElementById("ws-status");
    if (!badge) return;
    if (online) {
        badge.className = "ws-badge online";
        badge.textContent = "Live";
    } else {
        badge.className = "ws-badge offline";
        badge.textContent = "Offline";
    }
}

/* ═══════════════════════════════════════════════════════════
   COLUMNS
═══════════════════════════════════════════════════════════ */
async function loadColumns() {
    try {
        const res = await fetch(`${API}/columns/`, { headers: getAuthHeaders() });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        columns = await res.json();
        await loadTasks();
    } catch (err) {
        console.error("Failed to load columns:", err);
        _toast('error', 'Load Error', 'Could not load columns. Please refresh.', 6000);
        // Hide loading spinner
        const loading = document.getElementById('board-loading');
        if (loading) loading.remove();
    }
}

async function createColumn() {
    const nameInput = document.getElementById("col-name");
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
        _toast('error', 'Validation Error', 'Column name cannot be empty.');
        nameInput && nameInput.focus();
        return;
    }

    if (name.length > 40) {
        _toast('error', 'Validation Error', 'Column name must be 40 characters or less.');
        return;
    }

    // Duplicate check
    if (columns.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        _toast('error', 'Duplicate Column', `A column named "${name}" already exists.`);
        return;
    }

    const btn = document.querySelector('#col-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating…'; }

    try {
        const res = await fetch(`${API}/columns/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.detail || `HTTP ${res.status}`);
        }
        const newCol = await res.json();
        columns.push(newCol);
        closeColModal();
        renderBoard();
        _toast('success', 'Column Created', `"${name}" column is ready.`);
    } catch (err) {
        _toast('error', 'Create Failed', err.message || 'Could not create column.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'Create Column'; }
    }
}

async function deleteColumn(colId) {
    const col = columns.find(c => c.id === colId);
    const colName = col ? col.name : 'this column';
    const taskCount = tasks.filter(t => t.status === colId).length;
    const extra = taskCount > 0
        ? `${taskCount} task(s) will move to the first remaining column.`
        : 'This action cannot be undone.';

    _confirm('🗑️', `Delete "${colName}"?`, extra, async () => {
        try {
            const res = await fetch(`${API}/columns/${colId}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            if (res.status === 401) { logout(); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            columns = columns.filter(c => c.id !== colId);
            await loadTasks();
            renderBoard();
            _toast('success', 'Column Deleted', `"${colName}" has been removed.`);
        } catch (err) {
            _toast('error', 'Delete Failed', 'Could not delete column. Please try again.');
        }
    });
}

async function reorderColumns(orderedIds) {
    try {
        const res = await fetch(`${API}/columns/reorder`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ ordered_ids: orderedIds })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        _toast('error', 'Reorder Failed', 'Could not save column order.');
        // Reload to restore correct order
        await loadColumns();
    }
}

/* ═══════════════════════════════════════════════════════════
   TASKS
═══════════════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await fetch(`${API}/tasks/`, { headers: getAuthHeaders() });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        tasks = await res.json();
        renderBoard();
    } catch (err) {
        console.error("Failed to load tasks:", err);
        _toast('error', 'Load Error', 'Could not load tasks. Please refresh.', 6000);
    }
}

async function createTask() {
    const titleVal = document.getElementById("task-title")?.value.trim();
    const descVal = document.getElementById("task-desc")?.value.trim();
    const priorityVal = document.getElementById("task-priority")?.value;
    const assigneeVal = document.getElementById("task-assignee")?.value.trim();
    const dueVal = document.getElementById("task-date")?.value;
    const statusVal = document.getElementById("task-column-select")?.value;

    if (!titleVal) {
        _toast('error', 'Validation Error', 'Task title is required.');
        document.getElementById("task-title")?.focus();
        return;
    }

    if (titleVal.length > 120) {
        _toast('error', 'Validation Error', 'Title must be 120 characters or less.');
        return;
    }

    if (!statusVal) {
        _toast('error', 'Validation Error', 'Please select a column for this task.');
        return;
    }

    const btn = document.querySelector('#task-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating…'; }

    try {
        const res = await fetch(`${API}/tasks/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                title: titleVal,
                description: descVal || null,
                priority: priorityVal || "Medium",
                assignee: assigneeVal || null,
                status: statusVal,
                due_date: dueVal ? new Date(dueVal).toISOString() : null
            })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.detail || `HTTP ${res.status}`);
        }
        const newTask = await res.json();
        tasks.push(newTask);
        closeTaskModal();
        renderBoard();
        _toast('success', 'Task Created', `"${titleVal}" added to ${columns.find(c => c.id === statusVal)?.name || 'board'}.`);
    } catch (err) {
        _toast('error', 'Create Failed', err.message || 'Could not create task.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'Create Task'; }
    }
}

async function updateTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const prev = task.status;
    task.status = newStatus;
    renderBoard(); // optimistic update

    try {
        const res = await fetch(`${API}/tasks/${taskId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...task })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        // Rollback
        task.status = prev;
        renderBoard();
        _toast('error', 'Move Failed', 'Could not move task. Please try again.');
    }
}

async function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    const taskName = task ? task.title : 'this task';

    _confirm('🗑️', `Delete task?`, `"${taskName}" will be permanently removed.`, async () => {
        try {
            const res = await fetch(`${API}/tasks/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            if (res.status === 401) { logout(); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            tasks = tasks.filter(t => t.id !== id);
            renderBoard();
            _toast('success', 'Task Deleted', `"${taskName}" has been removed.`);
        } catch (err) {
            _toast('error', 'Delete Failed', 'Could not delete task. Please try again.');
        }
    });
}

/* ═══════════════════════════════════════════════════════════
   BOARD RENDER
═══════════════════════════════════════════════════════════ */
function renderBoard() {
    const board = document.getElementById("board");
    if (!board) return;

    // Remove loading spinner
    const loading = document.getElementById('board-loading');
    if (loading) loading.remove();

    board.innerHTML = "";

    const search = (document.getElementById("search")?.value || "").toLowerCase().trim();

    // Update task count in toolbar
    const countEl = document.getElementById("task-count-display");
    if (countEl) {
        const visible = search
            ? tasks.filter(t => t.title.toLowerCase().includes(search)).length
            : tasks.length;
        countEl.textContent = `${visible} task${visible !== 1 ? 's' : ''}`;
    }

    if (columns.length === 0) {
        board.innerHTML = `<div class="board-empty">
            <div class="empty-icon">📋</div>
            <p>No columns yet. Click <strong>Add Column</strong> to get started.</p>
        </div>`;
        return;
    }

    columns.forEach((col, idx) => {
        const filtered = tasks.filter(t =>
            t.status === col.id &&
            (!search || t.title.toLowerCase().includes(search) ||
                (t.assignee || '').toLowerCase().includes(search) ||
                (t.description || '').toLowerCase().includes(search))
        );

        const dotClass = COL_DOTS[idx % COL_DOTS.length];

        const colEl = document.createElement("div");
        colEl.className = "column";
        colEl.dataset.colId = col.id;
        colEl.draggable = true;

        colEl.addEventListener("dragstart", onColDragStart);
        colEl.addEventListener("dragover", onColDragOver);
        colEl.addEventListener("drop", onColDrop);
        colEl.addEventListener("dragend", onColDragEnd);

        const header = document.createElement("div");
        header.className = "column-header";
        header.innerHTML = `
            <div class="col-title-wrap">
                <div class="col-dot ${dotClass}"></div>
                <span class="col-title">${escHtml(col.name)}</span>
                <span class="col-count">${filtered.length}</span>
            </div>
            <div class="col-actions">
                <button class="col-delete-btn" onclick="deleteColumn('${col.id}')" title="Delete column">✕</button>
            </div>
        `;
        colEl.appendChild(header);

        const taskList = document.createElement("div");
        taskList.className = "task-list";
        taskList.id = `col-${col.id}`;
        taskList.dataset.status = col.id;

        taskList.addEventListener("dragover", onTaskDragOver);
        taskList.addEventListener("dragleave", onTaskDragLeave);
        taskList.addEventListener("drop", onTaskDrop);

        filtered.forEach(task => {
            taskList.appendChild(buildTaskEl(task));
        });

        // Empty column placeholder
        if (filtered.length === 0 && !search) {
            const ph = document.createElement("div");
            ph.style.cssText = "padding:20px 10px;text-align:center;color:var(--text-muted);font-size:0.78rem;";
            ph.textContent = "Drop tasks here";
            taskList.appendChild(ph);
        }

        colEl.appendChild(taskList);
        board.appendChild(colEl);
    });

    // Populate column selector in modal
    const sel = document.getElementById("task-column-select");
    if (sel) {
        sel.innerHTML = columns.map(c =>
            `<option value="${c.id}">${escHtml(c.name)}</option>`
        ).join("");
    }
}

/* ── Build Task Element ───────────────────────────────── */
function buildTaskEl(task) {
    const el = document.createElement("div");
    el.className = "task";
    el.draggable = true;
    el.dataset.id = task.id;

    el.addEventListener("dragstart", (e) => {
        draggedTaskId = task.id;
        draggedColId = null;
        el.classList.add("dragging");
        e.stopPropagation();
    });

    el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        draggedTaskId = null;
    });

    const priorityClass = (task.priority || "Medium").toLowerCase();

    // Date + overdue logic
    let dateHtml = "";
    if (task.due_date) {
        const d = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = d < today && task.status !== 'done';
        const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateHtml = `<span class="task-date${isOverdue ? ' overdue' : ''}">
            ${isOverdue ? '⚠️' : '📅'} ${formatted}
        </span>`;
    }

    const descHtml = task.description
        ? `<p class="task-desc">${escHtml(task.description)}</p>`
        : "";

    // Assignee avatar
    let assigneeHtml = "";
    if (task.assignee) {
        const initials = task.assignee.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
        assigneeHtml = `
            <div class="task-assignee">
                <div class="assignee-avatar">${initials}</div>
                <span>${escHtml(task.assignee)}</span>
            </div>`;
    } else {
        assigneeHtml = `<div class="task-assignee" style="color:var(--text-muted);font-size:0.72rem;">Unassigned</div>`;
    }

    el.innerHTML = `
        <button class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete task">✕</button>
        <h4>${escHtml(task.title)}</h4>
        ${descHtml}
        <div class="task-meta">
            <span class="task-priority ${priorityClass}">${task.priority || 'Medium'}</span>
            ${dateHtml}
        </div>
        <div class="task-footer">${assigneeHtml}</div>
    `;
    return el;
}

/* ── HTML escape helper ───────────────────────────────── */
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════════
   COLUMN DRAG & DROP
═══════════════════════════════════════════════════════════ */
function onColDragStart(e) {
    if (draggedTaskId) return;
    draggedColId = e.currentTarget.dataset.colId;
    requestAnimationFrame(() => e.currentTarget.classList.add("dragging"));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedColId);
}

function onColDragOver(e) {
    if (!draggedColId || draggedTaskId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-target");
}

function onColDragEnd(e) {
    e.currentTarget.classList.remove("dragging", "drag-target");
    document.querySelectorAll(".column").forEach(c => c.classList.remove("drag-target"));
    draggedColId = null;
}

async function onColDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(".column").forEach(c => c.classList.remove("drag-target", "dragging"));

    const targetId = e.currentTarget.dataset.colId;
    if (!draggedColId || draggedColId === targetId) { draggedColId = null; return; }

    const fromIdx = columns.findIndex(c => c.id === draggedColId);
    const toIdx = columns.findIndex(c => c.id === targetId);
    const [moved] = columns.splice(fromIdx, 1);
    columns.splice(toIdx, 0, moved);

    draggedColId = null;
    renderBoard();
    await reorderColumns(columns.map(c => c.id));
}

/* ═══════════════════════════════════════════════════════════
   TASK DRAG & DROP (between columns)
═══════════════════════════════════════════════════════════ */
function onTaskDragOver(e) {
    if (draggedColId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-over");
}

function onTaskDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
}

async function onTaskDrop(e) {
    if (draggedColId) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("drag-over");

    const newStatus = e.currentTarget.dataset.status;
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    draggedTaskId = null;

    if (!task || task.status === newStatus) return;

    await updateTaskStatus(task.id, newStatus);
}

/* ═══════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════ */
function showAddTask() {
    // Populate column select before showing
    const sel = document.getElementById("task-column-select");
    if (sel) {
        sel.innerHTML = columns.map(c =>
            `<option value="${c.id}">${escHtml(c.name)}</option>`
        ).join("");
    }
    if (columns.length === 0) {
        _toast('info', 'No Columns', 'Please create a column first before adding tasks.');
        return;
    }
    document.getElementById("task-modal")?.classList.remove("hidden");
    setTimeout(() => document.getElementById("task-title")?.focus(), 100);
}

function closeTaskModal() {
    document.getElementById("task-modal")?.classList.add("hidden");
    // Reset form
    ["task-title", "task-desc", "task-assignee", "task-date"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const pri = document.getElementById("task-priority");
    if (pri) pri.value = "Medium";
}

function showAddColumn() {
    document.getElementById("col-modal")?.classList.remove("hidden");
    setTimeout(() => document.getElementById("col-name")?.focus(), 100);
}

function closeColModal() {
    document.getElementById("col-modal")?.classList.add("hidden");
    const el = document.getElementById("col-name");
    if (el) el.value = "";
}