/**
 * The reminder list lives here in memory and is mirrored to IndexedDB on every
 * change. Components subscribe and re-render. There is no lock or encryption:
 * reminders aren't sensitive — they simply never leave the device.
 */
import { deleteReminder, getAllReminders, putReminder, putReminders, putTasks } from './db';
import { localDate } from './format';
import { bump } from './stats';
import { importProjects, projectsSnapshot } from './projects';
import { normalizeTask } from './task-model';
import { reloadTasks, tasksSnapshot } from './tasks';
import type { Preset, Project, Reminder, Task, Weekday } from './types';

let reminders: Reminder[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function changed() {
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Sorted for display: enabled first, then by title. */
export function snapshot(): Reminder[] {
  return reminders;
}

export function getReminder(id: string): Reminder | undefined {
  return reminders.find((r) => r.id === id);
}

/** Read everything from disk into memory. Called once at startup. */
export async function loadAll(): Promise<void> {
  if (loaded) return;
  reminders = (await getAllReminders()).sort((a, b) => a.createdAt - b.createdAt);
  loaded = true;
  changed();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** A blank reminder with sensible defaults, ready for the edit form. */
export function blankReminder(): Reminder {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    emoji: '⏰',
    intervalMin: 60,
    enabled: true,
    startTime: '09:00',
    endTime: '21:00',
    days: [],
    vibrate: true,
    lastFiredAt: now,
    snoozedUntil: null,
    firedToday: 0,
    firedTodayDate: localDate(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Build a reminder from a research preset (enabled, firing from now). */
export function fromPreset(preset: Preset): Reminder {
  return {
    ...blankReminder(),
    title: preset.title,
    emoji: preset.emoji,
    intervalMin: preset.intervalMin,
    startTime: preset.startTime,
    endTime: preset.endTime,
  };
}

async function commit(next: Reminder[]): Promise<void> {
  reminders = next;
  changed();
}

/** Insert or update one reminder (used by the edit form and preset add). */
export async function save(reminder: Reminder): Promise<void> {
  const stamped = { ...reminder, updatedAt: Date.now() };
  await putReminder(stamped);
  const exists = reminders.some((r) => r.id === stamped.id);
  await commit(exists ? reminders.map((r) => (r.id === stamped.id ? stamped : r)) : [...reminders, stamped]);
}

/** Patch a few fields of one reminder and persist. */
export async function patch(id: string, fields: Partial<Reminder>): Promise<void> {
  const current = getReminder(id);
  if (!current) return;
  await save({ ...current, ...fields });
}

export async function toggle(id: string, enabled: boolean): Promise<void> {
  // Re-anchor from now when turning on, so the first ping lands one full interval later.
  await patch(id, enabled ? { enabled, lastFiredAt: Date.now(), snoozedUntil: null } : { enabled });
}

/** "I did it now": restart the interval from now and count today's completion. */
export async function markDone(id: string): Promise<void> {
  const r = getReminder(id);
  if (!r) return;
  const today = localDate();
  const firedToday = (r.firedTodayDate === today ? r.firedToday : 0) + 1;
  await patch(id, { lastFiredAt: Date.now(), snoozedUntil: null, firedToday, firedTodayDate: today });
  void bump('reminders');
}

/** Snooze a single reminder for `minutes` from now. */
export async function snooze(id: string, minutes: number): Promise<void> {
  await patch(id, { snoozedUntil: Date.now() + minutes * 60000 });
}

/** Re-read from disk into memory. Used after a service worker (snooze action) changes a record. */
export async function reload(): Promise<void> {
  reminders = (await getAllReminders()).sort((a, b) => a.createdAt - b.createdAt);
  changed();
}

export async function remove(id: string): Promise<void> {
  await deleteReminder(id);
  await commit(reminders.filter((r) => r.id !== id));
}

/** Persist several at once (the scheduler updates fired counts in a batch). */
export async function saveMany(items: Reminder[]): Promise<void> {
  if (items.length === 0) return;
  await putReminders(items);
  const byId = new Map(items.map((r) => [r.id, r]));
  await commit(reminders.map((r) => byId.get(r.id) ?? r));
}

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

// ---------------------------------------------------------------------------
// Backup & restore
// ---------------------------------------------------------------------------

export interface Backup {
  app: 'yaad';
  /** 3 added task fields; 4 added projects (lists). Older files still import. */
  version: number;
  exportedAt: number;
  reminders: Reminder[];
  tasks: Task[];
  projects?: Project[];
}

/** A JSON-serialisable snapshot of every reminder, task and list, for "Export backup". */
export function exportBackup(): Backup {
  return { app: 'yaad', version: 4, exportedAt: Date.now(), reminders: snapshot(), tasks: tasksSnapshot(), projects: projectsSnapshot() };
}

function isReminder(x: unknown): x is Reminder {
  const r = x as Reminder;
  return !!r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.intervalMin === 'number';
}

/**
 * Restore reminders from a parsed backup. Merges by id (incoming wins) and
 * re-anchors each imported reminder so it doesn't fire a backlog immediately.
 * Returns how many were imported, or throws on an unrecognised file.
 */
export async function importBackup(data: unknown): Promise<number> {
  const backup = data as Partial<Backup>;
  if (!backup || backup.app !== 'yaad' || !Array.isArray(backup.reminders)) {
    throw new Error('Not a Yaad backup file.');
  }
  const now = Date.now();
  const validReminders = backup.reminders.filter(isReminder).map((r) => ({ ...r, lastFiredAt: now, snoozedUntil: null }));
  if (validReminders.length > 0) {
    await putReminders(validReminders);
    await reload();
  }
  // Tasks were added in backup v2; older backups simply won't have them.
  const validTasks = Array.isArray(backup.tasks)
    ? backup.tasks.filter((t) => !!t && typeof (t as Task).id === 'string' && typeof (t as Task).title === 'string').map((t) => normalizeTask(t))
    : [];
  if (validTasks.length > 0) {
    await putTasks(validTasks);
    await reloadTasks();
  }
  // Projects (lists) were added in backup v4; older backups simply won't have them.
  const validProjects: Project[] = Array.isArray(backup.projects)
    ? backup.projects
        .filter((p) => !!p && typeof (p as Project).id === 'string' && typeof (p as Project).name === 'string')
        .map((p, i) => ({ id: p.id, name: p.name, order: typeof p.order === 'number' ? p.order : i, createdAt: typeof p.createdAt === 'number' ? p.createdAt : now }))
    : [];
  await importProjects(validProjects);
  return validReminders.length + validTasks.length + validProjects.length;
}
