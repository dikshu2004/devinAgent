import { describe, it, expect, beforeEach } from "bun:test";
import { TodoService } from "./todo-service";
import { executeTodoTool, todoTools } from "./agent-tools";

describe("TodoService", () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService({ persist: false });
  });

  it("should create a new todo with defaults", () => {
    const todo = service.create({ title: "Write tests" });
    expect(todo.id).toBeDefined();
    expect(todo.title).toBe("Write tests");
    expect(todo.status).toBe("pending");
    expect(todo.priority).toBe("medium");
    expect(todo.createdAt).toBeDefined();
  });

  it("should throw error if title is empty", () => {
    expect(() => service.create({ title: "" })).toThrow();
    expect(() => service.create({ title: "   " })).toThrow();
  });

  it("should filter todos by status and search query", () => {
    service.create({ title: "Buy groceries", category: "personal" });
    const t2 = service.create({ title: "Fix agent bug", priority: "high" });
    service.complete(t2.id);

    const pending = service.getAll({ status: "pending" });
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe("Buy groceries");

    const completed = service.getAll({ status: "completed" });
    expect(completed.length).toBe(1);
    expect(completed[0].title).toBe("Fix agent bug");

    const searchResults = service.getAll({ search: "groceries" });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].title).toBe("Buy groceries");
  });

  it("should update an existing todo", () => {
    const todo = service.create({ title: "Initial" });
    const updated = service.update(todo.id, {
      title: "Updated Title",
      priority: "urgent",
      description: "Added description",
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.priority).toBe("urgent");
    expect(updated.description).toBe("Added description");
  });

  it("should delete a todo", () => {
    const todo = service.create({ title: "To Delete" });
    const success = service.delete(todo.id);
    expect(success).toBe(true);
    expect(service.getById(todo.id)).toBeNull();
  });

  it("should compute correct statistics", () => {
    service.create({ title: "Task 1", priority: "low" });
    const t2 = service.create({ title: "Task 2", priority: "urgent" });
    service.complete(t2.id);

    const stats = service.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.highPriority).toBe(1);
  });
});

describe("Claude Agent Tools (executeTodoTool)", () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService({ persist: false });
  });

  it("should list valid tool definitions", () => {
    expect(todoTools.length).toBeGreaterThan(5);
    const names = todoTools.map((t) => t.name);
    expect(names).toContain("create_todo");
    expect(names).toContain("list_todos");
    expect(names).toContain("complete_todo");
  });

  it("should execute create_todo tool", async () => {
    const res = await executeTodoTool(
      "create_todo",
      { title: "Agent created this", priority: "high" },
      service
    );
    expect(res.success).toBe(true);
    expect((res.data as any).todo.title).toBe("Agent created this");
  });

  it("should execute list_todos tool", async () => {
    service.create({ title: "Task A" });
    const res = await executeTodoTool("list_todos", {}, service);
    expect(res.success).toBe(true);
    expect((res.data as any).count).toBe(1);
  });

  it("should execute complete_todo tool", async () => {
    const todo = service.create({ title: "Incomplete" });
    const res = await executeTodoTool("complete_todo", { id: todo.id }, service);
    expect(res.success).toBe(true);
    expect((res.data as any).todo.status).toBe("completed");
  });

  it("should gracefully handle errors for invalid tool calls", async () => {
    const res = await executeTodoTool("create_todo", { title: "" }, service);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});

