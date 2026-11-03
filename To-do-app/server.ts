import { defaultTodoService } from "./todo-service";
import { executeTodoTool, todoTools } from "./agent-tools";
import type { TodoFilter, TodoPriority, TodoStatus } from "./types";

const PORT = Number(process.env.PORT) || 3001;

function json(data: any, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...headers,
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Todo App • Agent Ready</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --purple: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 760px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }
    .title-group h1 { font-size: 1.8rem; font-weight: 700; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: rgba(139, 92, 246, 0.2);
      color: #c4b5fd;
      border: 1px solid rgba(139, 92, 246, 0.4);
      margin-top: 0.25rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      text-align: center;
    }
    .stat-val { font-size: 1.5rem; font-weight: bold; }
    .stat-lbl { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    form.add-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .input-row {
      display: flex;
      gap: 0.5rem;
    }
    input[type="text"], select {
      flex: 1;
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.65rem 0.9rem;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      outline: none;
    }
    input[type="text"]:focus, select:focus {
      border-color: var(--primary);
    }
    button {
      cursor: pointer;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      padding: 0.65rem 1.25rem;
      font-size: 0.95rem;
      transition: background 0.15s ease;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.35rem 0.65rem; font-size: 0.8rem; }
    .btn-danger:hover { background: var(--danger); color: white; }
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .tabs { display: flex; gap: 0.25rem; background: #0f172a; padding: 0.25rem; border-radius: 0.5rem; }
    .tab-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
      border-radius: 0.35rem;
    }
    .tab-btn.active { background: var(--card-bg); color: var(--text); }
    .todo-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-top: 1rem;
    }
    .todo-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1rem;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      gap: 0.75rem;
    }
    .todo-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex: 1;
    }
    .todo-check {
      width: 1.2rem;
      height: 1.2rem;
      cursor: pointer;
      accent-color: var(--success);
    }
    .todo-content { display: flex; flex-direction: column; gap: 0.2rem; }
    .todo-title { font-size: 0.95rem; font-weight: 500; }
    .todo-item.completed .todo-title {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .todo-meta {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      align-items: center;
    }
    .pill {
      padding: 0.1rem 0.4rem;
      border-radius: 0.25rem;
      text-transform: uppercase;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .pill-urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .pill-high { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .pill-medium { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .pill-low { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
    .empty-state { text-align: center; color: var(--text-muted); padding: 2rem; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-group">
        <h1>Task Manager</h1>
        <div class="badge">🤖 Claude Agent Ready &bull; REST API Enabled</div>
      </div>
      <div>
        <button class="btn-danger" onclick="clearCompleted()">Clear Completed</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val" id="stat-total">0</div>
        <div class="stat-lbl">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="stat-pending" style="color: #60a5fa;">0</div>
        <div class="stat-lbl">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="stat-completed" style="color: #34d399;">0</div>
        <div class="stat-lbl">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="stat-urgent" style="color: #f87171;">0</div>
        <div class="stat-lbl">High/Urgent</div>
      </div>
    </div>

    <div class="card">
      <form class="add-form" onsubmit="addTodo(event)">
        <div class="input-row">
          <input type="text" id="new-title" placeholder="Add a new task (e.g., 'Integrate Claude Agent API')..." required />
          <select id="new-priority" style="max-width: 140px;">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" class="btn-primary">Add Task</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="tabs">
          <button class="tab-btn active" onclick="setFilter('all', this)">All</button>
          <button class="tab-btn" onclick="setFilter('pending', this)">Pending</button>
          <button class="tab-btn" onclick="setFilter('completed', this)">Completed</button>
        </div>
        <input type="text" id="search-box" placeholder="Search tasks..." oninput="handleSearch(this.value)" style="max-width: 200px; padding: 0.4rem 0.75rem;" />
      </div>

      <div class="todo-list" id="todo-list">
        <div class="empty-state">Loading tasks...</div>
      </div>
    </div>
  </div>

  <script>
    let currentFilter = 'all';
    let currentSearch = '';

    async function loadStats() {
      try {
        const res = await fetch('/api/todos/stats');
        const s = await res.json();
        document.getElementById('stat-total').textContent = s.total;
        document.getElementById('stat-pending').textContent = s.pending;
        document.getElementById('stat-completed').textContent = s.completed;
        document.getElementById('stat-urgent').textContent = s.highPriority;
      } catch (e) {
        console.error(e);
      }
    }

    async function loadTodos() {
      try {
        const params = new URLSearchParams();
        if (currentFilter !== 'all') params.set('status', currentFilter);
        if (currentSearch) params.set('search', currentSearch);

        const res = await fetch('/api/todos?' + params.toString());
        const todos = await res.json();
        renderTodos(todos);
        loadStats();
      } catch (e) {
        console.error(e);
      }
    }

    function renderTodos(todos) {
      const el = document.getElementById('todo-list');
      if (!todos.length) {
        el.innerHTML = '<div class="empty-state">No tasks found.</div>';
        return;
      }
      el.innerHTML = todos.map(t => \`
        <div class="todo-item \${t.status === 'completed' ? 'completed' : ''}">
          <div class="todo-left">
            <input type="checkbox" class="todo-check" \${t.status === 'completed' ? 'checked' : ''} onchange="toggleComplete('\${t.id}', this.checked)" />
            <div class="todo-content">
              <span class="todo-title">\${escapeHtml(t.title)}</span>
              <div class="todo-meta">
                <span class="pill pill-\${t.priority}">\${t.priority}</span>
                <span>ID: \${t.id}</span>
                \${t.category ? '<span>📁 ' + escapeHtml(t.category) + '</span>' : ''}
              </div>
            </div>
          </div>
          <button class="btn-danger" onclick="deleteTodo('\${t.id}')">Delete</button>
        </div>
      \`).join('');
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function addTodo(e) {
      e.preventDefault();
      const input = document.getElementById('new-title');
      const priority = document.getElementById('new-priority').value;
      const title = input.value.trim();
      if (!title) return;

      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority })
      });
      input.value = '';
      loadTodos();
    }

    async function toggleComplete(id, completed) {
      await fetch('/api/todos/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: completed ? 'completed' : 'pending' })
      });
      loadTodos();
    }

    async function deleteTodo(id) {
      await fetch('/api/todos/' + id, { method: 'DELETE' });
      loadTodos();
    }

    async function clearCompleted() {
      await fetch('/api/todos/clear-completed', { method: 'POST' });
      loadTodos();
    }

    function setFilter(status, btn) {
      currentFilter = status;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTodos();
    }

    let searchDebounce;
    function handleSearch(val) {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        currentSearch = val;
        loadTodos();
      }, 250);
    }

    loadTodos();
  </script>
</body>
</html>`;

export function handleRequest(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Web UI Dashboard
  if (method === "GET" && (path === "/" || path === "/index.html")) {
    return html(UI_HTML);
  }

  // Claude Agent Tool Definitions
  if (method === "GET" && path === "/api/agent/tools") {
    return json({ tools: todoTools });
  }

  // Claude Agent Remote Tool Executor Endpoint
  if (method === "POST" && path === "/api/agent/tool") {
    return (async () => {
      try {
        const body = await req.json();
        const { tool, args } = body;
        if (!tool) {
          return json({ success: false, error: "Missing 'tool' property in request body." }, 400);
        }
        const result = await executeTodoTool(tool, args || {}, defaultTodoService);
        return json(result, result.success ? 200 : 400);
      } catch (err: any) {
        return json({ success: false, error: err.message }, 400);
      }
    })();
  }

  // REST API: Todo Stats
  if (method === "GET" && path === "/api/todos/stats") {
    return json(defaultTodoService.getStats());
  }

  // REST API: Clear Completed
  if (method === "POST" && path === "/api/todos/clear-completed") {
    const cleared = defaultTodoService.clearCompleted();
    return json({ success: true, cleared });
  }

  // REST API: List Todos
  if (method === "GET" && path === "/api/todos") {
    const filter: TodoFilter = {
      status: (url.searchParams.get("status") as TodoStatus) || undefined,
      priority: (url.searchParams.get("priority") as TodoPriority) || undefined,
      category: url.searchParams.get("category") || undefined,
      tag: url.searchParams.get("tag") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: (url.searchParams.get("sortBy") as any) || undefined,
      sortOrder: (url.searchParams.get("sortOrder") as any) || undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      offset: url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined,
    };
    return json(defaultTodoService.getAll(filter));
  }

  // REST API: Create Todo
  if (method === "POST" && path === "/api/todos") {
    return (async () => {
      try {
        const body = await req.json();
        const created = defaultTodoService.create(body);
        return json(created, 201);
      } catch (err: any) {
        return json({ error: err.message }, 400);
      }
    })();
  }

  // REST API: Single Todo Operations (/api/todos/:id)
  const todoMatch = path.match(/^\/api\/todos\/([^/]+)(\/(complete))?$/);
  if (todoMatch) {
    const id = todoMatch[1];
    const subAction = todoMatch[3];

    if (method === "GET") {
      const todo = defaultTodoService.getById(id);
      if (!todo) return json({ error: "Todo not found" }, 404);
      return json(todo);
    }

    if (method === "DELETE") {
      const ok = defaultTodoService.delete(id);
      if (!ok) return json({ error: "Todo not found" }, 404);
      return json({ success: true, id });
    }

    if (method === "PATCH" && subAction === "complete") {
      try {
        const completed = defaultTodoService.complete(id);
        return json(completed);
      } catch (err: any) {
        return json({ error: err.message }, 400);
      }
    }

    if (method === "PUT" || method === "PATCH") {
      return (async () => {
        try {
          const body = await req.json();
          const updated = defaultTodoService.update(id, body);
          return json(updated);
        } catch (err: any) {
          return json({ error: err.message }, 400);
        }
      })();
    }
  }

  return json({ error: "Not Found", path }, 404);
}

// Start Bun server if run directly
if (typeof Bun !== "undefined") {
  Bun.serve({
    port: PORT,
    fetch: handleRequest,
  });
  console.log(`\n🚀 Todo App server is running at http://localhost:${PORT}`);
  console.log(`📡 REST API: http://localhost:${PORT}/api/todos`);
  console.log(`🤖 Claude Agent Tools: http://localhost:${PORT}/api/agent/tools`);
}

