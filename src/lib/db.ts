/**
 * IndexedDB wrapper. Reminders aren't secret, so they are stored in the clear
 * (no PIN, no encryption) — the point of the app is that the data simply never
 * leaves the device. The `meta` store holds small non-record values if needed.
 */
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { normalizeTask } from './task-model';
import type { Project, Reminder, Task } from './types';

export const DB_NAME = 'yaad';

interface YaadDB extends DBSchema {
  reminders: { key: string; value: Reminder };
  tasks: { key: string; value: Task };
  projects: { key: string; value: Project };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<YaadDB>> | null = null;

function db() {
  dbPromise ??= openDB<YaadDB>(DB_NAME, 4, {
    // v1 → v2 adds the `tasks` store. v2 → v3 migrates each task record to the
    // richer shape (notes, due date, priority, tags, subtasks, repeat rule).
    // v3 → v4 adds the `projects` store (lists). Fresh installs get everything;
    // task records fill out their newer fields when read (normalizeTask).
    async upgrade(database, oldVersion, _newVersion, tx) {
      if (!database.objectStoreNames.contains('reminders')) database.createObjectStore('reminders', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('tasks')) database.createObjectStore('tasks', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
      if (oldVersion >= 1 && oldVersion < 3) {
        const store = tx.objectStore('tasks');
        let cursor = await store.openCursor();
        while (cursor) {
          await cursor.update(normalizeTask(cursor.value));
          cursor = await cursor.continue();
        }
      }
    },
  });
  return dbPromise;
}

// --- Projects ---
export async function getAllProjects(): Promise<Project[]> {
  return (await db()).getAll('projects');
}

export async function putProject(project: Project): Promise<void> {
  await (await db()).put('projects', project);
}

export async function putProjects(projects: Project[]): Promise<void> {
  const tx = (await db()).transaction('projects', 'readwrite');
  await Promise.all([...projects.map((p) => tx.store.put(p)), tx.done]);
}

export async function deleteProject(id: string): Promise<void> {
  await (await db()).delete('projects', id);
}

// --- Generic meta (used for the stats log) ---
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await (await db()).put('meta', value, key);
}

// --- Tasks ---
export async function getAllTasks(): Promise<Task[]> {
  return (await db()).getAll('tasks');
}

export async function putTask(task: Task): Promise<void> {
  await (await db()).put('tasks', task);
}

export async function putTasks(tasks: Task[]): Promise<void> {
  const tx = (await db()).transaction('tasks', 'readwrite');
  await Promise.all([...tasks.map((t) => tx.store.put(t)), tx.done]);
}

export async function deleteTask(id: string): Promise<void> {
  await (await db()).delete('tasks', id);
}

export async function getAllReminders(): Promise<Reminder[]> {
  return (await db()).getAll('reminders');
}

export async function putReminder(reminder: Reminder): Promise<void> {
  await (await db()).put('reminders', reminder);
}

export async function putReminders(reminders: Reminder[]): Promise<void> {
  const tx = (await db()).transaction('reminders', 'readwrite');
  await Promise.all([...reminders.map((r) => tx.store.put(r)), tx.done]);
}

export async function deleteReminder(id: string): Promise<void> {
  await (await db()).delete('reminders', id);
}

/** Wipe the whole database. Used by "Delete everything". */
export async function destroyDatabase(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await deleteDB(DB_NAME);
}
