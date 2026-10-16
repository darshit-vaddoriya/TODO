/**
 * Backup and restore: one JSON file holding every reminder, task and category.
 * Importing merges by id (incoming wins), migrates older shapes, and re-anchors
 * imported interval reminders so they don't fire a backlog.
 */
import { normalizeTask } from '@/domain/task-model';
import type { Category, Reminder, Task } from '@/domain/types';
import { categoriesSnapshot, importCategories } from '@/data/categories';
import { putReminders, putTasks } from '@/data/db';
import { reload, snapshot } from '@/data/reminders';
import { reloadTasks, tasksSnapshot } from '@/data/tasks';

export interface Backup {
  app: 'yaad';
  /** 3 added task fields; 4 added categories (then called "projects"); 5 added task times, reminders, repeat rules and history; 6 renamed projects → categories. Older files still import. */
  version: number;
  exportedAt: number;
  reminders: Reminder[];
  tasks: Task[];
  categories?: Category[];
  /** The pre-6 name for `categories`; still read on import. */
  projects?: Category[];
}

/** A JSON-serialisable snapshot of every reminder, task and category, for "Export backup". */
export function exportBackup(): Backup {
  return { app: 'yaad', version: 6, exportedAt: Date.now(), reminders: snapshot(), tasks: tasksSnapshot(), categories: categoriesSnapshot() };
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
  // Categories arrived in backup v4 (as "projects"); older backups simply won't have them.
  const rawCategories = Array.isArray(backup.categories) ? backup.categories : Array.isArray(backup.projects) ? backup.projects : [];
  const validCategories: Category[] = rawCategories
    .filter((c) => !!c && typeof (c as Category).id === 'string' && typeof (c as Category).name === 'string')
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      order: typeof c.order === 'number' ? c.order : i,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
    }));
  await importCategories(validCategories);
  return validReminders.length + validTasks.length + validCategories.length;
}
