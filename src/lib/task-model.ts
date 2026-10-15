/**
 * The task domain model: defaults, normalization of stored or imported records
 * (migrating older shapes forward), and the pure date logic for repeating tasks
 * — when the next occurrence is, what completing a task does, and which dates a
 * repeating task lands on. Free of IndexedDB and UI imports so the DB layer, the
 * store, the scheduler and the calendar can all share it.
 *
 * Repeating tasks advance on completion: completing one logs the date in
 * `completedDates`, moves `dueDate` to the next occurrence and clears its
 * reminders so they fire again for that occurrence.
 */
import { localDate } from './format';
import type { Priority, RepeatRule, RepeatUnit, Subtask, Task, TaskReminder, Weekday } from './types';

export const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];

/** Completion history kept per task (most recent). */
const MAX_HISTORY = 120;

export function newTaskId(): string {
  return crypto.randomUUID();
}

// --- Local-date arithmetic ("YYYY-MM-DD" strings) ---------------------------

const pad = (n: number) => String(n).padStart(2, '0');

function parts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number);
  return [y, m || 1, d || 1];
}

/** Whole days from date `a` to date `b`; DST-safe via UTC. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** `dateStr` shifted by `n` days (may be negative). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = parts(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based here
}

/** Move to `months` months later, landing on `day` clamped to that month's length. */
function addMonths(dateStr: string, months: number, day: number): string {
  const [y, m] = parts(dateStr);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

/** Day of week (0 = Sun) for a "YYYY-MM-DD" date. */
export function weekdayOf(dateStr: string): Weekday {
  const [y, m, d] = parts(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

export function dayOfMonth(dateStr: string): number {
  return parts(dateStr)[2];
}

// --- Repeat rules ------------------------------------------------------------

/** The first date on or after `from` the rule lands on (the date itself for most rules). */
export function firstOccurrenceOnOrAfter(rule: RepeatRule, from: string): string {
  if (rule.kind === 'weekly' && rule.days.length > 0) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      if (rule.days.includes(weekdayOf(d))) return d;
    }
  }
  if (rule.kind === 'monthly') {
    const [y, m] = parts(from);
    const thisMonth = `${y}-${pad(m)}-${pad(Math.min(rule.day, daysInMonth(y, m)))}`;
    return thisMonth >= from ? thisMonth : addMonths(from, 1, rule.day);
  }
  return from;
}

/**
 * The next occurrence strictly after `from`, or null for a one-off. Weekly with
 * no days selected counts as daily.
 */
export function nextOccurrence(rule: RepeatRule, from: string): string | null {
  switch (rule.kind) {
    case 'none':
      return null;
    case 'daily':
      return addDays(from, 1);
    case 'weekly': {
      if (rule.days.length === 0) return addDays(from, 1);
      for (let i = 1; i <= 7; i++) {
        const d = addDays(from, i);
        if (rule.days.includes(weekdayOf(d))) return d;
      }
      return addDays(from, 7);
    }
    case 'monthly':
      return addMonths(from, 1, rule.day);
    case 'custom': {
      const n = Math.max(1, Math.floor(rule.every));
      if (rule.unit === 'weeks') return addDays(from, 7 * n);
      if (rule.unit === 'months') return addMonths(from, n, dayOfMonth(from));
      return addDays(from, n);
    }
  }
}

/**
 * Dates a task lands on within [start, end], for the calendar: its current due
 * date and (if it repeats) the projected occurrences after it. Capped so a
 * daily rule over a long range stays cheap.
 */
export function occurrencesBetween(task: Pick<Task, 'dueDate' | 'repeat'>, start: string, end: string, cap = 400): string[] {
  if (!task.dueDate) return [];
  const out: string[] = [];
  let d: string | null = task.dueDate;
  let guard = 0;
  while (d && d <= end && guard++ < cap) {
    if (d >= start) out.push(d);
    d = nextOccurrence(task.repeat, d);
  }
  return out;
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
    case 'monthly':
      return 'Monthly';
    case 'custom': {
      const unit = r.unit === 'days' ? 'day' : r.unit === 'weeks' ? 'week' : 'month';
      return r.every === 1 ? `Every ${unit}` : `Every ${r.every} ${unit}s`;
    }
  }
}

// --- Completing and un-completing ---------------------------------------------

function withHistory(task: Task, date: string): string[] {
  const set = task.completedDates.includes(date) ? task.completedDates : [...task.completedDates, date];
  return set.slice(-MAX_HISTORY);
}

/**
 * Complete a task. A one-off becomes done. A repeating task logs the
 * completion, resets its subtasks and moves to its next occurrence (counted
 * from today or its due date, whichever is later, so an overdue task doesn't
 * leave a backlog and an early completion skips the occurrence just done).
 */
export function completeTask(task: Task, today: string, now: number): Task {
  const base = { ...task, completedDates: withHistory(task, today), completedAt: now, doneDate: today, snoozedUntil: null, firedAlerts: [], dueNotifiedDate: null, updatedAt: now };
  if (task.repeat.kind === 'none') return { ...base, done: true };
  const from = task.dueDate && task.dueDate > today ? task.dueDate : today;
  return {
    ...base,
    done: false,
    dueDate: nextOccurrence(task.repeat, from),
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
  };
}

/** Re-open a completed one-off task and drop the history entry it created. */
export function reopenTask(task: Task, now: number): Task {
  const dates = task.completedDates.filter((d, i) => !(i === task.completedDates.length - 1 && d === task.doneDate));
  return { ...task, done: false, completedAt: null, completedDates: dates, updatedAt: now };
}

// --- Normalization -------------------------------------------------------------

function normalizePriority(v: unknown): Priority {
  return PRIORITIES.includes(v as Priority) ? (v as Priority) : 'none';
}

const UNITS: RepeatUnit[] = ['days', 'weeks', 'months'];

function normalizeRepeat(raw: unknown, legacyDaily: unknown, fallbackDay: number): RepeatRule {
  if (raw && typeof raw === 'object' && typeof (raw as { kind?: unknown }).kind === 'string') {
    const r = raw as { kind: string; days?: unknown; n?: unknown; day?: unknown; every?: unknown; unit?: unknown };
    switch (r.kind) {
      case 'daily':
        return { kind: 'daily' };
      case 'weekly':
        return { kind: 'weekly', days: Array.isArray(r.days) ? (r.days.filter((d) => typeof d === 'number' && d >= 0 && d <= 6) as Weekday[]) : [] };
      case 'monthly': {
        const day = Math.floor(Number(r.day));
        return { kind: 'monthly', day: day >= 1 && day <= 31 ? day : fallbackDay };
      }
      case 'custom':
        return { kind: 'custom', every: Math.max(1, Math.floor(Number(r.every) || 1)), unit: UNITS.includes(r.unit as RepeatUnit) ? (r.unit as RepeatUnit) : 'days' };
      case 'everyNDays': // the pre-1.4 shape
        return { kind: 'custom', every: Math.max(1, Math.floor(Number(r.n) || 1)), unit: 'days' };
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

function normalizeReminders(raw: unknown): TaskReminder[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: TaskReminder[] = [];
  for (const x of raw) {
    const off = Math.floor(Number((x as { offsetMin?: unknown })?.offsetMin));
    if (!Number.isFinite(off) || off < 0 || seen.has(off)) continue; // one reminder per offset
    seen.add(off);
    out.push({ id: typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : newTaskId(), offsetMin: off });
  }
  return out.sort((a, b) => b.offsetMin - a.offsetMin);
}

const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Fill a stored or imported record out to the current `Task` shape, carrying
 * old fields forward (the legacy boolean `daily` → a repeat rule, `everyNDays`
 * → `custom`, a done repeating task → completed and moved to its next
 * occurrence). Idempotent on an already-current task.
 */
export function normalizeTask(raw: unknown, now = Date.now()): Task {
  const r = (raw ?? {}) as Record<string, unknown>;
  const createdAt = typeof r.createdAt === 'number' ? r.createdAt : now;
  const today = localDate(new Date(now));
  const done = !!r.done;
  const dueDate = isDate(r.dueDate) ? r.dueDate : null;
  const repeat = normalizeRepeat(r.repeat, r.daily, dayOfMonth(dueDate ?? today));
  const doneDate = isDate(r.doneDate) ? r.doneDate : today;
  const history = Array.isArray(r.completedDates) ? (r.completedDates.filter(isDate) as string[]) : [];
  const completedAt = typeof r.completedAt === 'number' ? r.completedAt : done ? createdAt : null;

  const task: Task = {
    id: typeof r.id === 'string' ? r.id : newTaskId(),
    title: typeof r.title === 'string' ? r.title : '',
    notes: typeof r.notes === 'string' ? r.notes : '',
    done,
    doneDate,
    completedAt,
    dueDate,
    dueTime: isTime(r.dueTime) ? r.dueTime : null,
    dueNotifiedDate: isDate(r.dueNotifiedDate) ? r.dueNotifiedDate : null,
    reminders: normalizeReminders(r.reminders),
    firedAlerts: Array.isArray(r.firedAlerts) ? (r.firedAlerts.filter((k) => typeof k === 'string') as string[]) : [],
    snoozedUntil: typeof r.snoozedUntil === 'number' ? r.snoozedUntil : null,
    completedDates: history.length === 0 && done ? [doneDate] : history,
    projectId: typeof r.projectId === 'string' ? r.projectId : null,
    priority: normalizePriority(r.priority),
    tags: Array.isArray(r.tags) ? (r.tags.filter((t) => typeof t === 'string') as string[]) : [],
    subtasks: normalizeSubtasks(r.subtasks),
    order: typeof r.order === 'number' ? r.order : createdAt,
    repeat,
    createdAt,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : createdAt,
  };

  if (repeat.kind !== 'none') {
    // A repeating task is never "done": a legacy done one is settled onto its next occurrence.
    if (done) {
      const next = nextOccurrence(repeat, doneDate);
      return { ...task, done: false, dueDate: next, subtasks: task.subtasks.map((s) => ({ ...s, done: false })) };
    }
    // And it always has a due date to repeat from.
    if (!dueDate) return { ...task, dueDate: firstOccurrenceOnOrAfter(repeat, today) };
  }
  return task;
}
