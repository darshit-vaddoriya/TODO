/**
 * Decides when a task's once-a-day "due" notification should fire. Pure and
 * time-injectable so it can be unit-tested; the scheduler calls it each tick.
 * A task pings if it's due today (or overdue), not done, hasn't pinged yet
 * today, and it's past the morning floor (so nothing fires in the small hours).
 */
import { localDate } from './format';
import type { Task } from './types';

/** No due-task notifications before this local hour. */
export const TASK_REMIND_FROM_HOUR = 7;

export function taskDueNow(task: Task, now: Date): boolean {
  if (task.done || !task.dueDate) return false;
  const today = localDate(now);
  if (task.dueDate > today) return false; // not due yet
  if (task.dueNotifiedDate === today) return false; // already pinged today
  return now.getHours() >= TASK_REMIND_FROM_HOUR;
}
