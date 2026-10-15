/**
 * The to-do list. Tasks live in memory and mirror to IndexedDB. Completing a
 * repeating task advances it to its next occurrence (see task-model.ts); a
 * one-off becomes done. Completions are logged on the task for the history and
 * counted for the Report screen.
 */
import { newlyPastKeys } from './alerts';
import { deleteTask, getAllTasks, putTask, putTasks } from './db';
import { localDate } from './format';
import { getPrefs } from './prefs';
import { bump } from './stats';
import { completeTask, newTaskId, normalizeTask, reopenTask } from './task-model';
import type { Priority, RepeatRule, Task } from './types';

let tasks: Task[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function subscribeTasks(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function tasksSnapshot(): Task[] {
  return tasks;
}

export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

const byOrder = (a: Task, b: Task) => a.order - b.order;

/** Read every task from disk, normalize old shapes (persisting any that changed), and cache in memory. */
async function hydrate(): Promise<void> {
  const stored = await getAllTasks();
  const normalized = stored.map((t) => normalizeTask(t));
  const migrated = normalized.filter((t, i) => JSON.stringify(t) !== JSON.stringify(stored[i]));
  if (migrated.length > 0) await putTasks(migrated);
  tasks = normalized.sort(byOrder);
  loaded = true;
  changed();
}

export async function loadTasks(): Promise<void> {
  if (loaded) return;
  await hydrate();
}

/** Re-read all tasks from disk into memory (used after a backup import). */
export async function reloadTasks(): Promise<void> {
  await hydrate();
}

/**
 * Reminders added or moved by an edit whose moment is already past are recorded
 * as delivered, so they don't pop up as "missed" the instant they're saved.
 */
function skipPastAlerts(task: Task, prev: Task | undefined): Task {
  const skip = newlyPastKeys(task, prev, Date.now(), getPrefs().defaultReminderTime);
  return skip.length > 0 ? { ...task, firedAlerts: [...task.firedAlerts, ...skip] } : task;
}

/** Replace one task in memory, persist it, and notify. */
async function commit(next: Task): Promise<Task> {
  await putTask(next);
  tasks = tasks.some((t) => t.id === next.id) ? tasks.map((t) => (t.id === next.id ? next : t)) : [...tasks, next].sort(byOrder);
  changed();
  return next;
}

/** Merge `fields` into a task, re-normalize, persist, and notify. Undefined if the id is unknown. */
async function updateTask(id: string, fields: Partial<Task>): Promise<Task | undefined> {
  const current = getTask(id);
  if (!current) return undefined;
  return commit(skipPastAlerts(normalizeTask({ ...current, ...fields, updatedAt: Date.now() }), current));
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: Priority;
  tags?: string[];
  repeat?: RepeatRule;
  projectId?: string | null;
  /** Reminder offsets in minutes before the due moment (0 = at the time). */
  reminderOffsets?: number[];
}

export async function addTask(input: NewTaskInput): Promise<Task | undefined> {
  const title = input.title.trim();
  if (!title) return undefined;
  const now = Date.now();
  const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order), 0);
  const task = normalizeTask(
    {
      id: newTaskId(),
      title,
      notes: input.notes?.trim() ?? '',
      dueDate: input.dueDate ?? null,
      dueTime: input.dueDate ? (input.dueTime ?? null) : null,
      priority: input.priority ?? 'none',
      tags: input.tags ?? [],
      projectId: input.projectId ?? null,
      repeat: input.repeat ?? { kind: 'none' },
      reminders: (input.reminderOffsets ?? []).map((offsetMin) => ({ id: newTaskId(), offsetMin })),
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    },
    now,
  );
  return commit(skipPastAlerts(task, undefined));
}

/**
 * Save a full task from the editor. A new date or time invalidates the old
 * snooze and overdue marker, so alerts are recalculated against the new moment
 * (alert keys include the moment, so previously fired ones don't suppress it).
 */
export async function saveTask(task: Task): Promise<Task> {
  const current = getTask(task.id);
  const moved = !current || current.dueDate !== task.dueDate || current.dueTime !== task.dueTime;
  const next = normalizeTask({
    ...task,
    title: task.title.trim(),
    dueTime: task.dueDate ? task.dueTime : null,
    snoozedUntil: moved ? null : task.snoozedUntil,
    dueNotifiedDate: moved ? null : task.dueNotifiedDate,
    updatedAt: Date.now(),
  });
  return commit(skipPastAlerts(next, current));
}

/**
 * Complete a task (a repeating one advances to its next occurrence). Resolves to
 * the task as it was before, so the caller can offer Undo; undefined if unknown.
 */
export async function completeTaskById(id: string): Promise<Task | undefined> {
  const before = getTask(id);
  if (!before || before.done) return undefined;
  // The next occurrence's reminders are all new; any already in the past are skipped.
  await commit(skipPastAlerts(completeTask(before, localDate(), Date.now()), undefined));
  void bump('tasks');
  return before;
}

/** Re-open a completed one-off task. */
export async function reopenTaskById(id: string): Promise<void> {
  const current = getTask(id);
  if (!current || !current.done) return;
  await commit(reopenTask(current, Date.now()));
}

/** Check or uncheck a task. Resolves to the previous state when completing (for Undo). */
export async function toggleTask(id: string, done: boolean): Promise<Task | undefined> {
  if (done) return completeTaskById(id);
  await reopenTaskById(id);
  return undefined;
}

export const setTaskTitle = (id: string, title: string) => updateTask(id, { title: title.trim() });
export const setTaskNotes = (id: string, notes: string) => updateTask(id, { notes });
export const setTaskPriority = (id: string, priority: Priority) => updateTask(id, { priority });
export const setTaskTags = (id: string, tags: string[]) => updateTask(id, { tags });
export const setTaskRepeat = (id: string, repeat: RepeatRule) => updateTask(id, { repeat });
export const setTaskProject = (id: string, projectId: string | null) => updateTask(id, { projectId });
// Moving the due date clears the overdue marker and snooze so the new date can alert again.
export const setTaskDueDate = (id: string, dueDate: string | null) =>
  updateTask(id, { dueDate, dueTime: dueDate ? (getTask(id)?.dueTime ?? null) : null, dueNotifiedDate: null, snoozedUntil: null });

/** Snooze a task's alerts for `minutes` from now. */
export const snoozeTask = (id: string, minutes: number) => updateTask(id, { snoozedUntil: Date.now() + minutes * 60000 });

/** Scheduler bookkeeping: record delivered alert keys / the overdue-nudge date / clear an elapsed snooze. */
export async function recordAlerts(id: string, patch: { fired?: string[]; overdueDate?: string; clearSnooze?: boolean }): Promise<void> {
  const current = getTask(id);
  if (!current) return;
  const fired = patch.fired ? [...new Set([...current.firedAlerts, ...patch.fired])].slice(-60) : current.firedAlerts;
  await commit({
    ...current,
    firedAlerts: fired,
    dueNotifiedDate: patch.overdueDate ?? current.dueNotifiedDate,
    snoozedUntil: patch.clearSnooze ? null : current.snoozedUntil,
  });
}

/** Drop alert keys that no longer correspond to a live alert (after a date/time change). */
export async function pruneFiredAlerts(id: string, liveKeys: Set<string>): Promise<void> {
  const current = getTask(id);
  if (!current || current.firedAlerts.every((k) => liveKeys.has(k))) return;
  await commit({ ...current, firedAlerts: current.firedAlerts.filter((k) => liveKeys.has(k)) });
}

// --- Subtasks ---
export async function addSubtask(id: string, title: string): Promise<void> {
  const current = getTask(id);
  const trimmed = title.trim();
  if (!current || !trimmed) return;
  await updateTask(id, { subtasks: [...current.subtasks, { id: newTaskId(), title: trimmed, done: false }] });
}

export async function toggleSubtask(id: string, subId: string, done: boolean): Promise<void> {
  const current = getTask(id);
  if (!current) return;
  await updateTask(id, { subtasks: current.subtasks.map((s) => (s.id === subId ? { ...s, done } : s)) });
}

export async function removeSubtask(id: string, subId: string): Promise<void> {
  const current = getTask(id);
  if (!current) return;
  await updateTask(id, { subtasks: current.subtasks.filter((s) => s.id !== subId) });
}

/** Persist a new manual ordering given the task ids top-to-bottom. Unlisted tasks keep their place. */
export async function reorderTasks(idsInOrder: string[]): Promise<void> {
  const pos = new Map(idsInOrder.map((id, i) => [id, i]));
  const updated = tasks.filter((t) => pos.has(t.id)).map((t) => ({ ...t, order: pos.get(t.id)!, updatedAt: Date.now() }));
  if (updated.length === 0) return;
  await putTasks(updated);
  const byId = new Map(updated.map((t) => [t.id, t]));
  tasks = tasks.map((t) => byId.get(t.id) ?? t).sort(byOrder);
  changed();
}

export async function removeTask(id: string): Promise<void> {
  await deleteTask(id);
  tasks = tasks.filter((t) => t.id !== id);
  changed();
}

/** Re-insert a previously removed (or previously completed) task exactly as it was — for Undo. */
export async function restoreTask(task: Task): Promise<void> {
  await commit(task);
}

/** Clear completed one-off tasks (repeating tasks are never "done", so they stay). */
export async function clearDoneTasks(): Promise<void> {
  const remove = tasks.filter((t) => t.done);
  if (remove.length === 0) return;
  for (const t of remove) await deleteTask(t.id);
  tasks = tasks.filter((t) => !t.done);
  changed();
}

/** Move every task in a category back to the Inbox (used when a category is deleted). */
export async function clearProjectFromTasks(projectId: string): Promise<void> {
  const affected = tasks.filter((t) => t.projectId === projectId).map((t) => ({ ...t, projectId: null, updatedAt: Date.now() }));
  if (affected.length === 0) return;
  await putTasks(affected);
  const byId = new Map(affected.map((t) => [t.id, t]));
  tasks = tasks.map((t) => byId.get(t.id) ?? t);
  changed();
}
