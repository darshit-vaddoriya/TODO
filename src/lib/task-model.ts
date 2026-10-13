/**
 * The task domain model: the current-shape defaults, normalization of stored
 * or imported records (migrating older shapes forward), and the pure repeat
 * logic that decides when a repeating task comes due again. Kept free of any
 * IndexedDB or UI imports so both the DB layer and the store can share it.
 */
import { localDate } from './format';
import type { Priority, RepeatRule, Subtask, Task, Weekday } from './types';

export const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];

export function newTaskId(): string {
  return crypto.randomUUID();
}

/** Whole days from date `a` to date `b` (both "YYYY-MM-DD"); DST-safe via UTC. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const au = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const bu = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((bu - au) / 86400000);
}

/** Day of week (0 = Sun) for a "YYYY-MM-DD" local date. */
function weekdayOf(dateStr: string): Weekday {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay() as Weekday;
}

/**
 * Does a repeating task come due (reappear unchecked) on the given local date?
 * A one-off (`none`) never does. Weekly with no days selected counts as daily.
 */
export function isDueOn(task: Pick<Task, 'repeat' | 'createdAt'>, dateStr: string): boolean {
  const r = task.repeat;
  switch (r.kind) {
    case 'none':
      return false;
    case 'daily':
      return true;
    case 'weekly':
      return r.days.length === 0 || r.days.includes(weekdayOf(dateStr));
    case 'everyNDays': {
      const n = Math.max(1, Math.floor(r.n));
      const anchor = localDate(new Date(task.createdAt));
      return daysBetween(anchor, dateStr) % n === 0;
    }
  }
}

/** A short human label for a repeat rule, or null for a one-off. */
export function repeatLabel(r: RepeatRule): string | null {
  switch (r.kind) {
    case 'none':
      return null;
    case 'daily':
      return 'Every day';
    case 'weekly':
      return r.days.length === 0 ? 'Every day' : 'Weekly';
    case 'everyNDays':
      return r.n === 1 ? 'Every day' : `Every ${r.n} days`;
  }
}

function normalizePriority(v: unknown): Priority {
  return PRIORITIES.includes(v as Priority) ? (v as Priority) : 'none';
}

function normalizeRepeat(raw: unknown, legacyDaily: unknown): RepeatRule {
  if (raw && typeof raw === 'object' && typeof (raw as { kind?: unknown }).kind === 'string') {
    const r = raw as { kind: string; days?: unknown; n?: unknown };
    switch (r.kind) {
      case 'daily':
        return { kind: 'daily' };
      case 'weekly':
        return { kind: 'weekly', days: Array.isArray(r.days) ? (r.days.filter((d) => typeof d === 'number' && d >= 0 && d <= 6) as Weekday[]) : [] };
      case 'everyNDays':
        return { kind: 'everyNDays', n: Math.max(1, Math.floor(Number(r.n) || 1)) };
      default:
        return { kind: 'none' };
    }
  }
  // Legacy records only had a boolean `daily`.
  return legacyDaily ? { kind: 'daily' } : { kind: 'none' };
}

function normalizeSubtasks(raw: unknown): Subtask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { id?: unknown; title: string; done?: unknown } => !!s && typeof (s as { title?: unknown }).title === 'string')
    .map((s) => ({ id: typeof s.id === 'string' ? s.id : newTaskId(), title: s.title, done: !!s.done }));
}

/**
 * Fill a stored or imported record out to the current `Task` shape, carrying
 * old fields forward (notably the legacy boolean `daily` → a repeat rule).
 * Safe to call on an already-current task — it's idempotent.
 */
export function normalizeTask(raw: unknown, now = Date.now()): Task {
  const r = (raw ?? {}) as Record<string, unknown>;
  const createdAt = typeof r.createdAt === 'number' ? r.createdAt : now;
  const today = localDate(new Date(now));
  const done = !!r.done;
  return {
    id: typeof r.id === 'string' ? r.id : newTaskId(),
    title: typeof r.title === 'string' ? r.title : '',
    notes: typeof r.notes === 'string' ? r.notes : '',
    done,
    doneDate: typeof r.doneDate === 'string' ? r.doneDate : today,
    completedAt: typeof r.completedAt === 'number' ? r.completedAt : done ? createdAt : null,
    dueDate: typeof r.dueDate === 'string' ? r.dueDate : null,
    priority: normalizePriority(r.priority),
    tags: Array.isArray(r.tags) ? (r.tags.filter((t) => typeof t === 'string') as string[]) : [],
    subtasks: normalizeSubtasks(r.subtasks),
    order: typeof r.order === 'number' ? r.order : createdAt,
    repeat: normalizeRepeat(r.repeat, r.daily),
    createdAt,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : createdAt,
  };
}
