/**
 * The to-do list. Tasks live in memory and mirror to IndexedDB. A repeating
 * task resets to not-done at local midnight on the days it next comes due, so
 * it reappears; a one-off task stays as it is. Completing a task is logged for
 * the Report screen.
 */
import { deleteTask, getAllTasks, putTask, putTasks } from './db';
import { localDate } from './format';
import { bump } from './stats';
import { isDueOn, newTaskId, normalizeTask } from './task-model';
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

const byOrder = (a: Task, b: Task) => a.order - b.order;

/** A repeating task whose done-state is from an earlier day is shown fresh (unchecked) on a day it's next due. */
function freshen(list: Task[], today: string): { list: Task[]; changed: Task[] } {
  const toReset: Task[] = [];
  const next = list.map((t) => {
    if (t.repeat.kind !== 'none' && t.done && t.doneDate !== today && isDueOn(t, today)) {
      const reset = { ...t, done: false, completedAt: null, doneDate: today, updatedAt: Date.now() };
      toReset.push(reset);
      return reset;
    }
    return t;
  });
  return { list: next, changed: toReset };
}

/** Read every task from disk, normalize legacy records, apply the daily reset, and cache in memory. */
async function hydrate(): Promise<void> {
  const stored = (await getAllTasks()).map((t) => normalizeTask(t)).sort(byOrder);
  const { list, changed: reset } = freshen(stored, localDate());
  if (reset.length > 0) await putTasks(reset);
  tasks = list;
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

/** Re-check the daily reset (called on a date rollover / when the tab refocuses). */
export async function refreshDailyTasks(): Promise<void> {
  const { list, changed: reset } = freshen(tasks, localDate());
  if (reset.length === 0) return;
  await putTasks(reset);
  tasks = list;
  changed();
}

/** Merge `fields` into a task, persist, and notify. Returns the updated task, or undefined if the id is unknown. */
async function updateTask(id: string, fields: Partial<Task>): Promise<Task | undefined> {
  const current = tasks.find((t) => t.id === id);
  if (!current) return undefined;
  const next = { ...current, ...fields, updatedAt: Date.now() };
  await putTask(next);
  tasks = tasks.map((t) => (t.id === id ? next : t));
  changed();
  return next;
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: Priority;
  tags?: string[];
  repeat?: RepeatRule;
}

export async function addTask(input: NewTaskInput): Promise<void> {
  const title = input.title.trim();
  if (!title) return;
  const now = Date.now();
  const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order), 0);
  const task: Task = {
    id: newTaskId(),
    title,
    notes: input.notes?.trim() ?? '',
    done: false,
    doneDate: localDate(),
    completedAt: null,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'none',
    tags: input.tags ?? [],
    subtasks: [],
    order: maxOrder + 1,
    repeat: input.repeat ?? { kind: 'none' },
    createdAt: now,
    updatedAt: now,
  };
  await putTask(task);
  tasks = [...tasks, task];
  changed();
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  const next = await updateTask(id, { done, completedAt: done ? Date.now() : null, doneDate: localDate() });
  if (next && done) void bump('tasks');
}

export const setTaskTitle = (id: string, title: string) => updateTask(id, { title: title.trim() });
export const setTaskNotes = (id: string, notes: string) => updateTask(id, { notes });
export const setTaskPriority = (id: string, priority: Priority) => updateTask(id, { priority });
export const setTaskDueDate = (id: string, dueDate: string | null) => updateTask(id, { dueDate });
export const setTaskTags = (id: string, tags: string[]) => updateTask(id, { tags });
export const setTaskRepeat = (id: string, repeat: RepeatRule) => updateTask(id, { repeat });

// --- Subtasks ---
export async function addSubtask(id: string, title: string): Promise<void> {
  const current = tasks.find((t) => t.id === id);
  const trimmed = title.trim();
  if (!current || !trimmed) return;
  await updateTask(id, { subtasks: [...current.subtasks, { id: newTaskId(), title: trimmed, done: false }] });
}

export async function toggleSubtask(id: string, subId: string, done: boolean): Promise<void> {
  const current = tasks.find((t) => t.id === id);
  if (!current) return;
  await updateTask(id, { subtasks: current.subtasks.map((s) => (s.id === subId ? { ...s, done } : s)) });
}

export async function removeSubtask(id: string, subId: string): Promise<void> {
  const current = tasks.find((t) => t.id === id);
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

/** Clear completed one-off tasks (repeating tasks are kept). */
export async function clearDoneTasks(): Promise<void> {
  const remove = tasks.filter((t) => t.done && t.repeat.kind === 'none');
  if (remove.length === 0) return;
  for (const t of remove) await deleteTask(t.id);
  tasks = tasks.filter((t) => !(t.done && t.repeat.kind === 'none'));
  changed();
}
