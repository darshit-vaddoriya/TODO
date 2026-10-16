/**
 * What the Android home-screen widget shows, as plain data: today's task and
 * habit progress and the next few open tasks. The native widget cannot run the
 * app's logic, so the app computes this and hands it over whenever things change.
 */
import { habitProgress } from '@/domain/interval-schedule';
import { dayProgress, tabTasks } from '@/domain/task-view';
import type { Reminder, Task } from '@/domain/types';

export interface WidgetNextTask {
  title: string;
  /** "HH:MM" 24-hour, or null for an all-day task. */
  time: string | null;
  overdue: boolean;
}

export interface WidgetSummary {
  /** The local date this was computed for (YYYY-MM-DD); the widget ignores stale days. */
  date: string;
  tasksDone: number;
  tasksTotal: number;
  habitsDone: number;
  habitsTarget: number;
  overdue: number;
  next: WidgetNextTask[];
}

export const WIDGET_NEXT_COUNT = 3;

/** Overdue and due-today open tasks, soonest first, capped for the widget's few rows. */
export function widgetSummary(tasks: Task[], reminders: Reminder[], today: string): WidgetSummary {
  const progress = dayProgress(tasks, today);
  const habits = habitProgress(reminders, today);
  const overdue = tabTasks(tasks, 'overdue', today);
  const due = tabTasks(tasks, 'today', today);
  const ordered = [...overdue, ...due].sort(
    (a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.dueTime ?? '').localeCompare(b.dueTime ?? '') || a.order - b.order,
  );
  return {
    date: today,
    tasksDone: progress.done,
    tasksTotal: progress.total,
    habitsDone: habits.done,
    habitsTarget: habits.target,
    overdue: overdue.length,
    next: ordered.slice(0, WIDGET_NEXT_COUNT).map((t) => ({ title: t.title, time: t.dueTime, overdue: t.dueDate !== null && t.dueDate < today })),
  };
}
