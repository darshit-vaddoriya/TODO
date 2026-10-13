/**
 * Hash routing inside one page. The app stays a single document so the in-memory
 * scheduler and store survive navigation — a full page load would restart both.
 */
import { useEffect, useState } from 'preact/hooks';
import { projectsSnapshot, subscribeProjects } from '../lib/projects';
import { snapshot, subscribe } from '../lib/store';
import { subscribeTasks, tasksSnapshot } from '../lib/tasks';
import type { Project, Reminder, Task } from '../lib/types';

function parse(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => {
      setHash(location.hash);
      scrollTo({ top: 0 });
    };
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return parse(hash);
}

/** How many in-app screens we've pushed, so "back" never leaves the app. */
let depth = 0;

export function go(path: string): void {
  if (path === '/' || path === '') depth = 0;
  else depth++;
  location.hash = path;
}

export function back(): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    location.replace('#/');
  }
}

/** Re-render whenever the reminder list changes. */
export function useData(): Reminder[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
  return snapshot();
}

/** Re-render whenever the task list changes. */
export function useTasks(): Task[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeTasks(() => setTick((n) => n + 1)), []);
  return tasksSnapshot();
}

/** Re-render whenever the list of projects changes. */
export function useProjects(): Project[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeProjects(() => setTick((n) => n + 1)), []);
  return projectsSnapshot();
}

/** A ticking clock so "next in …" labels count down without a manual refresh. */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
