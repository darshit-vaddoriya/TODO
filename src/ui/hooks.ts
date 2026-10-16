/** Data hooks: re-render a component whenever the store it reads changes. */
import { useEffect, useState } from 'preact/hooks';
import type { Category, Reminder, Task } from '@/domain/types';
import { categoriesSnapshot, subscribeCategories } from '@/data/categories';
import { snapshot, subscribe } from '@/data/reminders';
import { subscribeTasks, tasksSnapshot } from '@/data/tasks';

/** Re-render whenever the reminder list changes. */
export function useReminders(): Reminder[] {
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

/** Re-render whenever the list of categories changes. */
export function useCategories(): Category[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeCategories(() => setTick((n) => n + 1)), []);
  return categoriesSnapshot();
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
