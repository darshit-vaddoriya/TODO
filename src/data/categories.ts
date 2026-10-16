/**
 * Lists (categories) that tasks can be grouped into. Like tasks, they live in
 * memory and mirror to IndexedDB. Deleting a list moves its tasks back to the
 * Inbox rather than deleting them.
 */
import { newTaskId } from '@/domain/task-model';
import type { Category } from '@/domain/types';
import { deleteCategory, getAllCategories, putCategory, putCategories } from '@/data/db';
import { clearCategoryFromTasks } from '@/data/tasks';

let categories: Category[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function subscribeCategories(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function categoriesSnapshot(): Category[] {
  return categories;
}

const byOrder = (a: Category, b: Category) => a.order - b.order;

export async function loadCategories(): Promise<void> {
  if (loaded) return;
  categories = (await getAllCategories()).sort(byOrder);
  loaded = true;
  changed();
}

/** Re-read from disk (after a backup import). */
export async function reloadCategories(): Promise<void> {
  categories = (await getAllCategories()).sort(byOrder);
  loaded = true;
  changed();
}

export async function addCategory(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const now = Date.now();
  const order = categories.reduce((m, p) => Math.max(m, p.order), 0) + 1;
  const category: Category = { id: newTaskId(), name: trimmed, order, createdAt: now };
  await putCategory(category);
  categories = [...categories, category].sort(byOrder);
  changed();
  return category.id;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const current = categories.find((p) => p.id === id);
  if (!current || !trimmed) return;
  const next = { ...current, name: trimmed };
  await putCategory(next);
  categories = categories.map((p) => (p.id === id ? next : p));
  changed();
}

export async function removeCategory(id: string): Promise<void> {
  await clearCategoryFromTasks(id);
  await deleteCategory(id);
  categories = categories.filter((p) => p.id !== id);
  changed();
}

/** Merge imported categories by id (used by backup restore). */
export async function importCategories(incoming: Category[]): Promise<void> {
  if (incoming.length === 0) return;
  await putCategories(incoming);
  await reloadCategories();
}
