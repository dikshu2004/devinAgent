import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  CreateTodoInput,
  Todo,
  TodoFilter,
  TodoPriority,
  TodoStats,
  TodoStatus,
  UpdateTodoInput,
} from "./types";

export interface TodoServiceOptions {
  storageFile?: string;
  persist?: boolean;
}

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export class TodoService {
  private todos: Map<string, Todo> = new Map();
  private storageFile: string | null = null;
  private persist: boolean;

  constructor(options: TodoServiceOptions = {}) {
    this.persist = options.persist ?? true;
    if (this.persist) {
      this.storageFile =
        options.storageFile ?? resolve(import.meta.dir ?? process.cwd(), "todos.json");
      this.loadFromFile();
    }
  }

  private loadFromFile(): void {
    if (!this.storageFile) return;

    try {
      if (existsSync(this.storageFile)) {
        const raw = readFileSync(this.storageFile, "utf-8");
        const parsed: Todo[] = JSON.parse(raw);
        this.todos.clear();
        for (const item of parsed) {
          if (item && item.id) {
            this.todos.set(item.id, item);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load todos from file, starting with empty store:", err);
      this.todos.clear();
    }
  }

  private saveToFile(): void {
    if (!this.persist || !this.storageFile) return;

    try {
      const dir = dirname(this.storageFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.todos.values()), null, 2);
      writeFileSync(this.storageFile, data, "utf-8");
    } catch (err) {
      console.error("Failed to save todos to file:", err);
    }
  }

  private generateId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `todo_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  public getAll(filter: TodoFilter = {}): Todo[] {
    let result = Array.from(this.todos.values());

    if (filter.status && filter.status !== "all") {
      result = result.filter((t) => t.status === filter.status);
    }

    if (filter.priority) {
      result = result.filter((t) => t.priority === filter.priority);
    }

    if (filter.category) {
      const catLower = filter.category.toLowerCase();
      result = result.filter(
        (t) => t.category && t.category.toLowerCase() === catLower
      );
    }

    if (filter.tag) {
      const tagLower = filter.tag.toLowerCase();
      result = result.filter(
        (t) => t.tags && t.tags.some((tag) => tag.toLowerCase() === tagLower)
      );
    }

    if (filter.search && filter.search.trim().length > 0) {
      const query = filter.search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          (t.category && t.category.toLowerCase().includes(query)) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    // Sorting
    const sortBy = filter.sortBy ?? "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";
    const multiplier = sortOrder === "asc" ? 1 : -1;

    result.sort((a, b) => {
      if (sortBy === "priority") {
        return (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) * multiplier;
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title) * multiplier;
      }
      if (sortBy === "dueDate") {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return (timeA - timeB) * multiplier;
      }
      // default: createdAt
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return (timeA - timeB) * multiplier;
    });

    if (typeof filter.offset === "number" && filter.offset > 0) {
      result = result.slice(filter.offset);
    }

    if (typeof filter.limit === "number" && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  public getById(id: string): Todo | null {
    return this.todos.get(id) ?? null;
  }

  public create(input: CreateTodoInput): Todo {
    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle) {
      throw new Error("Todo title cannot be empty");
    }

    const validPriorities: TodoPriority[] = ["low", "medium", "high", "urgent"];
    const priority = input.priority && validPriorities.includes(input.priority)
      ? input.priority
      : "medium";

    if (input.dueDate && isNaN(Date.parse(input.dueDate))) {
      throw new Error("Invalid dueDate format. Please provide a valid ISO date string.");
    }

    const now = new Date().toISOString();
    const todo: Todo = {
      id: this.generateId(),
      title: trimmedTitle,
      description: input.description?.trim() || undefined,
      status: "pending",
      priority,
      category: input.category?.trim() || undefined,
      tags: input.tags && input.tags.length > 0
        ? Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean)))
        : undefined,
      dueDate: input.dueDate || undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.todos.set(todo.id, todo);
    this.saveToFile();
    return todo;
  }

  public update(id: string, input: UpdateTodoInput): Todo {
    const existing = this.todos.get(id);
    if (!existing) {
      throw new Error(`Todo with ID '${id}' not found`);
    }

    const now = new Date().toISOString();
    const updated: Todo = { ...existing, updatedAt: now };

    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (!trimmed) {
        throw new Error("Todo title cannot be empty");
      }
      updated.title = trimmed;
    }

    if (input.description !== undefined) {
      updated.description = input.description.trim() || undefined;
    }

    if (input.status !== undefined) {
      const validStatuses: TodoStatus[] = ["pending", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(input.status)) {
        throw new Error(`Invalid status '${input.status}'. Allowed: ${validStatuses.join(", ")}`);
      }
      updated.status = input.status;
      if (input.status === "completed" && !existing.completedAt) {
        updated.completedAt = now;
      } else if (input.status !== "completed") {
        updated.completedAt = undefined;
      }
    }

    if (input.priority !== undefined) {
      const validPriorities: TodoPriority[] = ["low", "medium", "high", "urgent"];
      if (!validPriorities.includes(input.priority)) {
        throw new Error(`Invalid priority '${input.priority}'. Allowed: ${validPriorities.join(", ")}`);
      }
      updated.priority = input.priority;
    }

    if (input.category !== undefined) {
      updated.category = input.category.trim() || undefined;
    }

    if (input.tags !== undefined) {
      updated.tags = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean)));
    }

    if (input.dueDate !== undefined) {
      if (input.dueDate && isNaN(Date.parse(input.dueDate))) {
        throw new Error("Invalid dueDate format. Please provide a valid ISO date string.");
      }
      updated.dueDate = input.dueDate || undefined;
    }

    this.todos.set(id, updated);
    this.saveToFile();
    return updated;
  }

  public complete(id: string): Todo {
    return this.update(id, { status: "completed" });
  }

  public markInProgress(id: string): Todo {
    return this.update(id, { status: "in_progress" });
  }

  public delete(id: string): boolean {
    const existed = this.todos.delete(id);
    if (existed) {
      this.saveToFile();
    }
    return existed;
  }

  public clearCompleted(): number {
    let count = 0;
    for (const [id, todo] of this.todos.entries()) {
      if (todo.status === "completed") {
        this.todos.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.saveToFile();
    }
    return count;
  }

  public getStats(): TodoStats {
    const todos = Array.from(this.todos.values());
    const now = Date.now();

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let highPriority = 0;
    let overdue = 0;

    for (const t of todos) {
      if (t.status === "pending") pending++;
      else if (t.status === "in_progress") inProgress++;
      else if (t.status === "completed") completed++;
      else if (t.status === "cancelled") cancelled++;

      if (t.priority === "high" || t.priority === "urgent") {
        highPriority++;
      }

      if (
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < now
      ) {
        overdue++;
      }
    }

    return {
      total: todos.length,
      pending,
      inProgress,
      completed,
      cancelled,
      highPriority,
      overdue,
    };
  }

  public reset(): void {
    this.todos.clear();
    this.saveToFile();
  }
}

export const defaultTodoService = new TodoService();

