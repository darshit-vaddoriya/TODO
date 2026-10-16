/**
 * Pure presentation logic for the Tasks screen: filtering (search / tag /
 * priority), sorting, and grouping active tasks into due-date "smart views"
 * (Overdue · Today · Upcoming · No date). Kept free of Preact and IndexedDB so
 * it can be unit-tested on its own.
 */
import { localDate } from '@/domain/dates';
import type { Priority, Task } from '@/domain/types';

export type SortKey = 'manual' | 'due' | 'priority' | 'created' | 'alpha';

export interface TaskFilter {
  /** Free-text query matched against title, notes, tags and subtask titles. */
  search: string;
  /** Only this tag, or null for all tags. */
  tag: string | null;
  /** Only this priority, or null for all. */
  priority: Priority | null;
  /** 'all' lists, 'none' for the Inbox (no category), or a category id. */
  category: 'all' | 'none' | string;
}

export const EMPTY_FILTER: TaskFilter = { search: '', tag: null, priority: null, category: 'all' };

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
  if (filter.category === 'none' && task.categoryId !== null) return false;
  if (filter.category !== 'all' && filter.category !== 'none' && task.categoryId !== filter.category) return false;
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
        if (a.dueDate && b.dueDate)
          return a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '24:00').localeCompare(b.dueTime ?? '24:00') || a.order - b.order;
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

export interface DayProgress {
  /** Tasks completed today (from the completion history, so repeating tasks count too). */
  done: number;
  /** Everything planned for today: completed today + still-open tasks due today or overdue. */
  total: number;
}

/** Daily task progress for the dashboard and report. */
export function dayProgress(tasks: Task[], today: string): DayProgress {
  const done = tasks.filter((t) => t.completedDates.includes(today)).length;
  const open = tasks.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= today).length;
  return { done, total: done + open };
}

// --- Tab views: Today · Upcoming · All · Overdue · Completed ----------------------

export type TaskTab = 'today' | 'upcoming' | 'all' | 'overdue' | 'done';
export const TASK_TABS: { id: TaskTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Completed' },
];

export function isTaskTab(v: string | undefined): v is TaskTab {
  return TASK_TABS.some((t) => t.id === v);
}

/** The open tasks that belong on a tab (before search / filter / sort). `done` is handled by completedHistory. */
export function tabTasks(tasks: Task[], tab: TaskTab, today: string): Task[] {
  const open = tasks.filter((t) => !t.done);
  switch (tab) {
    case 'today':
      return open.filter((t) => t.dueDate === today);
    case 'upcoming':
      return open.filter((t) => t.dueDate !== null && t.dueDate > today);
    case 'overdue':
      return open.filter((t) => t.dueDate !== null && t.dueDate < today);
    case 'all':
      return open;
    case 'done':
      return [];
  }
}

/** Badge counts for the tabs. */
export function tabCounts(tasks: Task[], today: string): Record<Exclude<TaskTab, 'done'>, number> {
  return {
    today: tabTasks(tasks, 'today', today).length,
    upcoming: tabTasks(tasks, 'upcoming', today).length,
    all: tabTasks(tasks, 'all', today).length,
    overdue: tabTasks(tasks, 'overdue', today).length,
  };
}

/** Sort by due date then time (undated last), then manual order. */
function byDueMoment(a: Task, b: Task): number {
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.dueTime ?? '').localeCompare(b.dueTime ?? '') || a.order - b.order;
}

/** Group tasks under their due date, in date order — the Upcoming view. */
export function groupByDate(tasks: Task[]): { date: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const t of [...tasks].sort(byDueMoment)) {
    const key = t.dueDate ?? '';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups].map(([date, list]) => ({ date, tasks: list }));
}

export interface HistoryEntry {
  date: string;
  task: Task;
}

/**
 * Completed-task history: one entry per recorded completion, newest first. A
 * repeating task appears once per day it was completed.
 */
export function completedHistory(tasks: Task[]): HistoryEntry[] {
  return tasks
    .flatMap((task) => task.completedDates.map((date) => ({ date, task })))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.task.completedAt ?? 0) - (a.task.completedAt ?? 0) || a.task.title.localeCompare(b.task.title));
}

/** Overdue and due-today-with-high-priority tasks are visually urgent. */
export function isUrgent(task: Task, today: string): boolean {
  if (task.done) return false;
  return (task.dueDate !== null && task.dueDate < today) || (task.priority === 'high' && task.dueDate !== null && task.dueDate <= today);
}

// --- Filter bar helpers ---------------------------------------------------------------

/** How many narrowing filters (category, priority, tag) are on — the badge on the filter button. Search and view are not counted. */
export function activeFilterCount(filter: TaskFilter): number {
  return (filter.category !== 'all' ? 1 : 0) + (filter.priority ? 1 : 0) + (filter.tag ? 1 : 0);
}

const PRIORITY_WORDS: Record<Priority, string> = { none: 'No priority', low: 'Low priority', medium: 'Medium priority', high: 'High priority' };

/** The active filters as plain words, e.g. ["Work", "High priority", "#errands"] — shown as text, not chips. */
export function filterSummary(filter: TaskFilter, categoryName: (id: string) => string | undefined): string[] {
  const parts: string[] = [];
  if (filter.category === 'none') parts.push('Inbox');
  else if (filter.category !== 'all') parts.push(categoryName(filter.category) ?? 'Category');
  if (filter.priority) parts.push(PRIORITY_WORDS[filter.priority]);
  if (filter.tag) parts.push(`#${filter.tag}`);
  return parts;
}
