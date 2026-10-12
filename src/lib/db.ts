/**
 * IndexedDB wrapper. Reminders aren't secret, so they are stored in the clear
 * (no PIN, no encryption) — the point of the app is that the data simply never
 * leaves the device. The `meta` store holds small non-record values if needed.
 */
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Reminder } from './types';

export const DB_NAME = 'yaad';

interface YaadDB extends DBSchema {
  reminders: { key: string; value: Reminder };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<YaadDB>> | null = null;

function db() {
  dbPromise ??= openDB<YaadDB>(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('reminders')) database.createObjectStore('reminders', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
    },
  });
  return dbPromise;
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
