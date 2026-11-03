import { defaultTodoService, TodoService } from "./todo-service";
import type {
  CreateTodoInput,
  TodoFilter,
  TodoPriority,
  TodoStatus,
  UpdateTodoInput,
} from "./types";

/**
 * Anthropic / Claude tool definitions for interacting with the Todo app.
 * Can be passed directly to `anthropic.messages.create({ tools: todoTools, ... })`.
 */
export const todoTools = [
  {
    name: "list_todos",
    description:
      "Retrieve a list of todos. Supports filtering by status (pending, in_progress, completed, cancelled), priority (low, medium, high, urgent), category, tag, and keyword search.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled", "all"],
          description: "Filter by status. Defaults to 'all'.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Filter by priority level.",
        },
        category: {
          type: "string",
          description: "Filter by category name (e.g., 'work', 'personal', 'groceries').",
        },
        tag: {
          type: "string",
          description: "Filter by a specific tag.",
        },
        search: {
          type: "string",
          description: "Search keyword matching in title, description, category, or tags.",
        },
        sortBy: {
          type: "string",
          enum: ["createdAt", "dueDate", "priority", "title"],
          description: "Field to sort results by. Defaults to 'createdAt'.",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort direction. Defaults to 'desc'.",
        },
        limit: {
          type: "number",
          description: "Maximum number of items to return.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_todo",
    description: "Get detailed information about a specific todo item by its unique ID.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the todo item.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_todo",
    description: "Create a new todo item in the list.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title or summary of the task (required).",
        },
        description: {
          type: "string",
          description: "Detailed description of the task.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Priority of the task. Defaults to 'medium'.",
        },
        category: {
          type: "string",
          description: "Category/folder (e.g. 'work', 'health', 'chores').",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "List of labels or tags.",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO format (e.g. '2026-11-05T18:00:00Z').",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_todo",
    description: "Update fields of an existing todo item.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the todo item to update.",
        },
        title: {
          type: "string",
          description: "Updated title.",
        },
        description: {
          type: "string",
          description: "Updated description.",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled"],
          description: "Updated status.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Updated priority.",
        },
        category: {
          type: "string",
          description: "Updated category.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of tags.",
        },
        dueDate: {
          type: "string",
          description: "Updated due date in ISO format.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "complete_todo",
    description: "Mark a specific todo item as completed.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the todo item to mark as completed.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_todo",
    description: "Delete a todo item permanently by its ID.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the todo item to delete.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_todo_stats",
    description: "Get summary statistics about todos (counts by status, priority, and overdue count).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "clear_completed_todos",
    description: "Delete all todos currently marked as 'completed'.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
] as const;

export type TodoToolName = (typeof todoTools)[number]["name"];

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  data?: unknown;
  error?: string;
}

/**
 * Executes a tool called by an AI agent (Claude, etc.) against the TodoService.
 * Returns a standardized JSON-serializable output that can be passed back in tool_result.
 */
export async function executeTodoTool(
  toolName: string,
  args: Record<string, any> = {},
  service: TodoService = defaultTodoService
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case "list_todos": {
        const filter: TodoFilter = {
          status: args.status as TodoStatus | "all" | undefined,
          priority: args.priority as TodoPriority | undefined,
          category: args.category as string | undefined,
          tag: args.tag as string | undefined,
          search: args.search as string | undefined,
          sortBy: args.sortBy,
          sortOrder: args.sortOrder,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        };
        const todos = service.getAll(filter);
        return {
          success: true,
          tool: toolName,
          data: {
            count: todos.length,
            todos,
          },
        };
      }

      case "get_todo": {
        if (!args.id) throw new Error("Missing required parameter 'id'");
        const todo = service.getById(String(args.id));
        if (!todo) {
          return {
            success: false,
            tool: toolName,
            error: `Todo with id '${args.id}' was not found.`,
          };
        }
        return { success: true, tool: toolName, data: todo };
      }

      case "create_todo": {
        if (!args.title) throw new Error("Missing required parameter 'title'");
        const input: CreateTodoInput = {
          title: String(args.title),
          description: args.description ? String(args.description) : undefined,
          priority: args.priority as TodoPriority | undefined,
          category: args.category ? String(args.category) : undefined,
          tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
          dueDate: args.dueDate ? String(args.dueDate) : undefined,
        };
        const created = service.create(input);
        return {
          success: true,
          tool: toolName,
          data: {
            message: `Created todo '${created.title}' (ID: ${created.id})`,
            todo: created,
          },
        };
      }

      case "update_todo": {
        if (!args.id) throw new Error("Missing required parameter 'id'");
        const { id, ...rest } = args;
        const input: UpdateTodoInput = {
          title: rest.title !== undefined ? String(rest.title) : undefined,
          description: rest.description !== undefined ? String(rest.description) : undefined,
          status: rest.status as TodoStatus | undefined,
          priority: rest.priority as TodoPriority | undefined,
          category: rest.category !== undefined ? String(rest.category) : undefined,
          tags: Array.isArray(rest.tags) ? rest.tags.map(String) : undefined,
          dueDate: rest.dueDate !== undefined ? String(rest.dueDate) : undefined,
        };
        const updated = service.update(String(id), input);
        return {
          success: true,
          tool: toolName,
          data: {
            message: `Updated todo '${updated.id}'`,
            todo: updated,
          },
        };
      }

      case "complete_todo": {
        if (!args.id) throw new Error("Missing required parameter 'id'");
        const completed = service.complete(String(args.id));
        return {
          success: true,
          tool: toolName,
          data: {
            message: `Marked todo '${completed.title}' as completed`,
            todo: completed,
          },
        };
      }

      case "delete_todo": {
        if (!args.id) throw new Error("Missing required parameter 'id'");
        const deleted = service.delete(String(args.id));
        if (!deleted) {
          return {
            success: false,
            tool: toolName,
            error: `Todo with id '${args.id}' not found. Nothing deleted.`,
          };
        }
        return {
          success: true,
          tool: toolName,
          data: {
            message: `Successfully deleted todo '${args.id}'`,
            id: args.id,
          },
        };
      }

      case "get_todo_stats": {
        const stats = service.getStats();
        return { success: true, tool: toolName, data: stats };
      }

      case "clear_completed_todos": {
        const count = service.clearCompleted();
        return {
          success: true,
          tool: toolName,
          data: {
            message: `Cleared ${count} completed todos.`,
            clearedCount: count,
          },
        };
      }

      default:
        return {
          success: false,
          tool: toolName,
          error: `Unknown tool '${toolName}'. Available tools: ${todoTools.map((t) => t.name).join(", ")}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      tool: toolName,
      error: error?.message || "Internal error executing tool",
    };
  }
}

