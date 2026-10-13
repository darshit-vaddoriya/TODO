/**
 * Pure presentation logic for the Tasks screen: filtering (search / tag /
 * priority), sorting, and grouping active tasks into due-date "smart views"
 * (Overdue · Today · Upcoming · No date). Kept free of Preact and IndexedDB so
 * it can be unit-tested on its own.
 */
import { localDate } from './format';
import type { Priority, Task } from './types';

export type SortKey = 'manual' | 'due' | 'priority' | 'created' | 'alpha';

export interface TaskFilter {
  /** Free-text query matched against title, notes, tags and subtask titles. */
  search: string;
  /** Only this tag, or null for all tags. */
  tag: string | null;
  /** Only this priority, or null for all. */
  priority: Priority | null;
}

export const EMPTY_FILTER: TaskFilter = { search: '', tag: null, priority: null };

/** Lower sorts first; used so "high" floats to the top. */
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

export const SORT_LABELS: Record<SortKey, string> = {
  manual: 'Manual',
  due: 'Due',
  priority: 'Priority',
  created: 'Newest',
  alpha: 'A–Z',
};

/** Every distinct tag across the tasks, alphabetically. */
export function allTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) for (const tag of t.tags) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.priority && task.priority !== filter.priority) return false;
  if (filter.tag && !task.tags.includes(filter.tag)) return false;
  const q = filter.search.trim().toLowerCase();
  if (q) {
    const hay = [task.title, task.notes, ...task.tags, ...task.subtasks.map((s) => s.title)].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const arr = [...tasks];
  switch (key) {
    case 'manual':
      return arr.sort((a, b) => a.order - b.order);
    case 'created':
      return arr.sort((a, b) => b.createdAt - a.createdAt); // newest first
    case 'alpha':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'priority':
      return arr.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order);
    case 'due':
      return arr.sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.order - b.order;
        if (a.dueDate) return -1; // dated tasks before undated
        if (b.dueDate) return 1;
        return a.order - b.order;
      });
  }
}

export type DueBucket = 'overdue' | 'today' | 'upcoming' | 'none';

export function dueBucket(task: Pick<Task, 'dueDate'>, today: string): DueBucket {
  if (!task.dueDate) return 'none';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return 'upcoming';
}

export interface TaskGroup {
  key: DueBucket;
  title: string;
  tasks: Task[];
}

const GROUP_ORDER: { key: DueBucket; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Today' },
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'none', title: 'No date' },
];

export interface TaskView {
  /** Non-empty active-task groups, in Overdue → Today → Upcoming → No date order. */
  groups: TaskGroup[];
  /** Completed tasks that pass the filter, most recently completed first. */
  done: Task[];
  /** How many tasks exist in total (before filtering). */
  total: number;
  /** How many passed the filter (active + done). */
  matched: number;
}

/** Build the filtered, sorted, grouped task list the Tasks screen renders. */
export function buildView(tasks: Task[], filter: TaskFilter, sort: SortKey, today: string = localDate()): TaskView {
  const matched = tasks.filter((t) => matchesFilter(t, filter));
  const active = sortTasks(
    matched.filter((t) => !t.done),
    sort,
  );
  const done = matched.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const groups = GROUP_ORDER.map(({ key, title }) => ({
    key,
    title,
    tasks: active.filter((t) => dueBucket(t, today) === key),
  })).filter((g) => g.tasks.length > 0);

  return { groups, done, total: tasks.length, matched: matched.length };
}
