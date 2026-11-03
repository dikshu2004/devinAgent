export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: string; // ISO date string (e.g. 2026-11-05T00:00:00Z)
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  completedAt?: string; // ISO date string
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: string;
}

export interface TodoFilter {
  status?: TodoStatus | 'all';
  priority?: TodoPriority;
  category?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface TodoStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  highPriority: number;
  overdue: number;
}

