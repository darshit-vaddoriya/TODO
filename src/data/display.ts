/**
 * Date and time labels that follow the user's display settings (12/24-hour clock,
 * date style). Thin wrappers over the pure helpers in domain/dates.
 */
import { formatClockWith, formatDateWith, friendlyDateWith, localDate } from '@/domain/dates';
import type { ClockTime } from '@/domain/types';
import { getPrefs } from './prefs';

const pad = (n: number) => String(n).padStart(2, '0');

/** "8:00 AM" / "08:00" for a "HH:MM" value, following the 12/24-hour setting. */
export function formatClock(time: ClockTime): string {
  return formatClockWith(time, getPrefs().time24);
}

/** The clock label for a Date (the next-due time), following the 12/24-hour setting. */
export function formatTimeOfDay(d: Date): string {
  return formatClockWith(`${pad(d.getHours())}:${pad(d.getMinutes())}`, getPrefs().time24);
}

export function formatDate(dateStr: string): string {
  return formatDateWith(dateStr, getPrefs().dateFormat);
}

export function friendlyDate(dateStr: string, today = localDate()): string {
  return friendlyDateWith(dateStr, today, getPrefs().dateFormat);
}

/** "Today, 5:30 PM" / "Tomorrow" / "06/20/2026 · 09:00" — a task's due label. */
export function dueLabelFor(dueDate: string, dueTime: ClockTime | null, today = localDate()): string {
  const day = friendlyDate(dueDate, today);
  return dueTime ? `${day}, ${formatClock(dueTime)}` : day;
}
