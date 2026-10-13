/**
 * Lists (projects) that tasks can be grouped into. Like tasks, they live in
 * memory and mirror to IndexedDB. Deleting a list moves its tasks back to the
 * Inbox rather than deleting them.
 */
import { deleteProject, getAllProjects, putProject, putProjects } from './db';
import { newTaskId } from './task-model';
import { clearProjectFromTasks } from './tasks';
import type { Project } from './types';

let projects: Project[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function subscribeProjects(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function projectsSnapshot(): Project[] {
  return projects;
}

const byOrder = (a: Project, b: Project) => a.order - b.order;

export async function loadProjects(): Promise<void> {
  if (loaded) return;
  projects = (await getAllProjects()).sort(byOrder);
  loaded = true;
  changed();
}

/** Re-read from disk (after a backup import). */
export async function reloadProjects(): Promise<void> {
  projects = (await getAllProjects()).sort(byOrder);
  loaded = true;
  changed();
}

export async function addProject(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const now = Date.now();
  const order = projects.reduce((m, p) => Math.max(m, p.order), 0) + 1;
  const project: Project = { id: newTaskId(), name: trimmed, order, createdAt: now };
  await putProject(project);
  projects = [...projects, project].sort(byOrder);
  changed();
  return project.id;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const current = projects.find((p) => p.id === id);
  if (!current || !trimmed) return;
  const next = { ...current, name: trimmed };
  await putProject(next);
  projects = projects.map((p) => (p.id === id ? next : p));
  changed();
}

export async function removeProject(id: string): Promise<void> {
  await clearProjectFromTasks(id);
  await deleteProject(id);
  projects = projects.filter((p) => p.id !== id);
  changed();
}

/** Merge imported projects by id (used by backup restore). */
export async function importProjects(incoming: Project[]): Promise<void> {
  if (incoming.length === 0) return;
  await putProjects(incoming);
  await reloadProjects();
}
