#!/usr/bin/env bun
import { defaultTodoService } from "./todo-service";
import type { TodoPriority, TodoStatus } from "./types";

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

function printHelp() {
  console.log(`
📋 Todo App CLI
Usage: bun run cli.ts <command> [options]

Commands:
  list [--status=all|pending|completed] [--search=keyword]   List todos
  add <title> [--priority=low|medium|high|urgent] [--desc=...] Add a new todo
  done <id>                                                  Mark a todo as completed
  rm <id>                                                    Delete a todo
  stats                                                      Show summary statistics
  clear                                                      Clear all completed todos
  help                                                       Show this help message

Examples:
  bun run cli.ts add "Implement Claude Agent tools" --priority=high
  bun run cli.ts list --status=pending
  bun run cli.ts done todo_1a2b3c4d
  bun run cli.ts stats
`);
}

function parseFlags(rawArgs: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of rawArgs) {
    if (arg.startsWith("--")) {
      const [key, ...vals] = arg.slice(2).split("=");
      if (key) {
        flags[key] = vals.join("=") || "true";
      }
    }
  }
  return flags;
}

switch (command) {
  case "list":
  case "ls": {
    const flags = parseFlags(args.slice(1));
    const status = flags.status as TodoStatus | "all" | undefined;
    const search = flags.search;
    const todos = defaultTodoService.getAll({ status, search });

    if (todos.length === 0) {
      console.log("No todos found.");
    } else {
      console.log(`\n📋 Todos (${todos.length}):\n`);
      for (const t of todos) {
        const check = t.status === "completed" ? "✅" : "⏳";
        const priorityPill = `[${t.priority.toUpperCase()}]`;
        console.log(`${check} ${t.id} ${priorityPill.padEnd(9)} - ${t.title}`);
        if (t.description) console.log(`   Description: ${t.description}`);
        if (t.dueDate) console.log(`   Due: ${t.dueDate}`);
      }
      console.log();
    }
    break;
  }

  case "add": {
    const nonFlags = args.slice(1).filter((a) => !a.startsWith("--"));
    const flags = parseFlags(args.slice(1));
    const title = nonFlags.join(" ") || flags.title;

    if (!title) {
      console.error("Error: Please provide a title for the todo.");
      process.exit(1);
    }

    const priority = (flags.priority as TodoPriority) || "medium";
    const description = flags.desc || flags.description;
    const category = flags.category;
    const dueDate = flags.due || flags.dueDate;

    try {
      const created = defaultTodoService.create({
        title,
        priority,
        description,
        category,
        dueDate,
      });
      console.log(`✨ Created todo: [${created.id}] ${created.title} (${created.priority})`);
    } catch (err: any) {
      console.error("Failed to create todo:", err.message);
    }
    break;
  }

  case "done":
  case "complete": {
    const id = args[1];
    if (!id) {
      console.error("Error: Please provide the todo ID.");
      process.exit(1);
    }
    try {
      const updated = defaultTodoService.complete(id);
      console.log(`✅ Marked as completed: [${updated.id}] ${updated.title}`);
    } catch (err: any) {
      console.error("Error:", err.message);
    }
    break;
  }

  case "rm":
  case "delete": {
    const id = args[1];
    if (!id) {
      console.error("Error: Please provide the todo ID.");
      process.exit(1);
    }
    const ok = defaultTodoService.delete(id);
    if (ok) {
      console.log(`🗑️ Deleted todo: ${id}`);
    } else {
      console.error(`Error: Todo with ID '${id}' not found.`);
    }
    break;
  }

  case "stats": {
    const s = defaultTodoService.getStats();
    console.log(`
📊 Todo Statistics:
  Total:         ${s.total}
  Pending:       ${s.pending}
  In Progress:   ${s.inProgress}
  Completed:     ${s.completed}
  High/Urgent:   ${s.highPriority}
  Overdue:       ${s.overdue}
`);
    break;
  }

  case "clear": {
    const count = defaultTodoService.clearCompleted();
    console.log(`🧹 Cleared ${count} completed todos.`);
    break;
  }

  case "help":
  default:
    printHelp();
    break;
}

