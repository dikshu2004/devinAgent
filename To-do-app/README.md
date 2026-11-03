# Todo App (Agent-Ready)

A TypeScript & Bun Todo application designed for direct integration with AI agents (such as Claude Agents), featuring Anthropic tool schemas, a REST API, an interactive web dashboard, and a CLI.

---

## 🚀 Quick Start

### 1. Run the REST API & Web Dashboard
```bash
cd To-do-app
bun start
# or with auto-reload:
bun dev
```
Open **http://localhost:3001** in your browser to view the interactive dashboard.

### 2. Run the CLI
```bash
# Add a task
bun run cli.ts add "Test Claude agent integration" --priority=high

# List tasks
bun run cli.ts list

# View stats
bun run cli.ts stats

# Mark done
bun run cli.ts done <todo-id>
```

### 3. Run Tests
```bash
bun test
```

---

## 🤖 Using with Claude Agent

You can directly import pre-configured tool definitions and the tool executor into your agent:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { todoTools, executeTodoTool, defaultTodoService } from "./To-do-app";

const anthropic = new Anthropic();

// 1. Send tools to Claude
const response = await anthropic.messages.create({
  model: "claude-3-7-sonnet-20250219",
  max_tokens: 1024,
  tools: todoTools, // <-- Ready-to-use Anthropic tool schemas
  messages: [
    {
      role: "user",
      content: "Add a high priority task to prepare the release notes, and list my pending tasks."
    }
  ]
});

// 2. Execute any tool calls returned by Claude
for (const content of response.content) {
  if (content.type === "tool_use") {
    const result = await executeTodoTool(content.name, content.input, defaultTodoService);
    console.log("Tool execution result:", result);
  }
}
```

### Available Agent Tools
| Tool Name | Description |
| :--- | :--- |
| `list_todos` | List tasks with filters (status, priority, search, tags, limit) |
| `get_todo` | Get a specific todo by ID |
| `create_todo` | Create a new task (title, description, priority, category, tags, dueDate) |
| `update_todo` | Update an existing task |
| `complete_todo` | Mark a task as completed |
| `delete_todo` | Delete a task |
| `get_todo_stats` | Retrieve summary statistics (total, pending, completed, overdue) |
| `clear_completed_todos` | Remove all completed tasks |

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/todos` | List todos (query params: `status`, `priority`, `search`, etc.) |
| `POST` | `/api/todos` | Create a todo (`{ "title": "...", "priority": "high" }`) |
| `GET` | `/api/todos/:id` | Get todo by ID |
| `PUT / PATCH` | `/api/todos/:id` | Update todo |
| `PATCH` | `/api/todos/:id/complete`| Mark as complete |
| `DELETE` | `/api/todos/:id` | Delete todo |
| `GET` | `/api/todos/stats` | Get stats |
| `POST` | `/api/todos/clear-completed` | Clear all completed |
| `GET` | `/api/agent/tools` | Export Claude agent tool JSON schema |
| `POST` | `/api/agent/tool` | Execute agent tool via HTTP (`{ "tool": "create_todo", "args": {...} }`) |

---

## 📁 File Structure

- `types.ts` - TypeScript interfaces & data models (`Todo`, `TodoStatus`, `TodoPriority`, etc.)
- `todo-service.ts` - Core business logic with JSON persistence & in-memory caching
- `agent-tools.ts` - Claude / Anthropic tool definitions & execution dispatcher
- `server.ts` - Native Bun HTTP server with REST endpoints & Web UI
- `cli.ts` - Command-line interface
- `index.ts` - Public module exports
- `todo-service.test.ts` - Bun test suite

