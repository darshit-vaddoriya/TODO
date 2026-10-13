/**
 * The to-do list. Tasks live in memory and mirror to IndexedDB. A "daily" task
 * resets to not-done at local midnight so it comes back each morning; a one-off
 * task stays as it is. Completing a task is logged for the Report screen.
 */
import { deleteTask, getAllTasks, putTask, putTasks } from './db';
import { localDate } from './format';
import { bump } from './stats';
import type { Task } from './types';

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

function newId(): string {
  return crypto.randomUUID();
}

/** A daily task whose done-state is from an earlier day is shown fresh (unchecked) today. */
function freshen(list: Task[], today: string): { list: Task[]; changed: Task[] } {
  const toReset: Task[] = [];
  const next = list.map((t) => {
    if (t.daily && t.done && t.doneDate !== today) {
      const reset = { ...t, done: false, doneDate: today };
      toReset.push(reset);
      return reset;
    }
    return t;
  });
  return { list: next, changed: toReset };
}

export async function loadTasks(): Promise<void> {
  if (loaded) return;
  const stored = (await getAllTasks()).sort((a, b) => a.createdAt - b.createdAt);
  const { list, changed: reset } = freshen(stored, localDate());
  if (reset.length > 0) await putTasks(reset);
  tasks = list;
  loaded = true;
  changed();
}

/** Re-read all tasks from disk into memory (used after a backup import). */
export async function reloadTasks(): Promise<void> {
  const stored = (await getAllTasks()).sort((a, b) => a.createdAt - b.createdAt);
  const { list, changed: reset } = freshen(stored, localDate());
  if (reset.length > 0) await putTasks(reset);
  tasks = list;
  loaded = true;
  changed();
}

/** Re-check the daily reset (called on a date rollover / when the tab refocuses). */
export async function refreshDailyTasks(): Promise<void> {
  const { list, changed: reset } = freshen(tasks, localDate());
  if (reset.length === 0) return;
  await putTasks(reset);
  tasks = list;
  changed();
}

export async function addTask(title: string, daily: boolean): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const now = Date.now();
  const task: Task = { id: newId(), title: trimmed, done: false, daily, doneDate: localDate(), createdAt: now, updatedAt: now };
  await putTask(task);
  tasks = [...tasks, task];
  changed();
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  const current = tasks.find((t) => t.id === id);
  if (!current) return;
  const next = { ...current, done, doneDate: localDate(), updatedAt: Date.now() };
  await putTask(next);
  tasks = tasks.map((t) => (t.id === id ? next : t));
  changed();
  if (done) void bump('tasks');
}

export async function setTaskDaily(id: string, daily: boolean): Promise<void> {
  const current = tasks.find((t) => t.id === id);
  if (!current) return;
  const next = { ...current, daily, updatedAt: Date.now() };
  await putTask(next);
  tasks = tasks.map((t) => (t.id === id ? next : t));
  changed();
}

export async function removeTask(id: string): Promise<void> {
  await deleteTask(id);
  tasks = tasks.filter((t) => t.id !== id);
  changed();
}

/** Clear completed one-off tasks (daily tasks are kept). */
export async function clearDoneTasks(): Promise<void> {
  const remove = tasks.filter((t) => t.done && !t.daily);
  for (const t of remove) await deleteTask(t.id);
  if (remove.length === 0) return;
  tasks = tasks.filter((t) => !(t.done && !t.daily));
  changed();
}
