/**
 * Pure calendar logic: the month grid (honouring the week-start setting) and
 * which tasks land on which day, including the projected future occurrences of
 * repeating tasks. No DOM, no clock — the screen passes everything in.
 */
import { addDays, occurrencesBetween, weekdayOf } from '@/domain/task-model';
import type { Task } from '@/domain/types';

const pad = (n: number) => String(n).padStart(2, '0');

export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;

/** 6 weeks × 7 days of "YYYY-MM-DD" covering `month` (1-based), starting on `weekStart` (0 = Sun, 1 = Mon). */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): string[] {
  const first = `${year}-${pad(month)}-01`;
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Move a { year, month } by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** Weekday indices in display order for the header row. */
export function weekdayOrder(weekStart: 0 | 1): number[] {
  return weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

export interface CalendarItem {
  task: Task;
  /** The date this item is on. */
  date: string;
  /** A future occurrence of a repeating task (not yet the task's current due date). */
  projected: boolean;
  /** A completed one-off shown on the day it was due. */
  done: boolean;
}

/**
 * Items per day within [start, end]. An open task shows on its current due
 * date, and a repeating one on every projected occurrence after it; a done
 * one-off shows (as done) on its due date.
 */
export function itemsByDay(tasks: Task[], start: string, end: string): Map<string, CalendarItem[]> {
  const byDay = new Map<string, CalendarItem[]>();
  const push = (item: CalendarItem) => byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  for (const task of tasks) {
    if (!task.dueDate) continue;
    if (task.done) {
      if (task.dueDate >= start && task.dueDate <= end) push({ task, date: task.dueDate, projected: false, done: true });
      continue;
    }
    for (const date of occurrencesBetween(task, start, end)) {
      push({ task, date, projected: date !== task.dueDate, done: false });
    }
  }
  for (const [date, list] of byDay) {
    byDay.set(
      date,
      list.sort(
        (a, b) => Number(a.done) - Number(b.done) || (a.task.dueTime ?? '24:00').localeCompare(b.task.dueTime ?? '24:00') || a.task.order - b.task.order,
      ),
    );
  }
  return byDay;
}
