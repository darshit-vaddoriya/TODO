/**
 * Pure scheduling logic: given a reminder and "now", decide whether it is due
 * and when it will next be due. No timers, no DOM — so it is easy to test.
 *
 * A reminder only fires inside its active window (startTime–endTime) on an
 * active weekday. `lastFiredAt` is the anchor: the next ping is one interval
 * after the last one. A brand-new reminder has lastFiredAt set to its creation
 * time, so the first ping lands one interval later, not immediately.
 */
import { clockToMinutes, minutesOfDay } from '@/domain/dates';
import type { Reminder } from '@/domain/types';

const DAY_MS = 86_400_000;

function activeDays(r: Reminder): Set<number> {
  return r.days.length === 0 ? new Set([0, 1, 2, 3, 4, 5, 6]) : new Set(r.days);
}

/** Is `date` inside the reminder's active weekday + time-of-day window? */
export function withinWindow(r: Reminder, date: Date): boolean {
  if (!activeDays(r).has(date.getDay())) return false;
  const start = clockToMinutes(r.startTime);
  const end = clockToMinutes(r.endTime);
  const mins = minutesOfDay(date);
  // A normal window (start <= end). Overnight windows aren't offered in the UI.
  return mins >= start && mins <= end;
}

/** The earliest ms >= `from` that falls inside the window, scanning up to 8 days ahead. */
function nextWindowOpen(r: Reminder, from: number): number | null {
  const days = activeDays(r);
  const startMin = clockToMinutes(r.startTime);
  const endMin = clockToMinutes(r.endTime);
  for (let i = 0; i < 8; i++) {
    const day = new Date(from + i * DAY_MS);
    day.setHours(0, 0, 0, 0);
    if (!days.has(day.getDay())) continue;
    const windowStart = day.getTime() + startMin * 60000;
    const windowEnd = day.getTime() + endMin * 60000;
    // If we're already inside today's window, the window is "open" right at `from`.
    if (from <= windowEnd && from >= windowStart) return from;
    if (windowStart >= from) return windowStart;
  }
  return null;
}

/**
 * When will this reminder next ping, as epoch ms? null if it is disabled or has
 * no active day in the next week. Overdue reminders inside the window return `now`.
 */
export function nextDueAt(r: Reminder, now: number): number | null {
  if (!r.enabled) return null;
  const anchor = r.lastFiredAt ?? now;
  let candidate = anchor + r.intervalMin * 60000;
  // A snooze pushes the next ping no earlier than when the snooze ends.
  if (r.snoozedUntil && r.snoozedUntil > candidate) candidate = r.snoozedUntil;
  if (candidate < now) candidate = now; // overdue: due as soon as the window allows
  return nextWindowOpen(r, candidate);
}

/** Should this reminder fire right now? True when it is enabled, due, inside the window, and not snoozed. */
export function isDue(r: Reminder, now: number): boolean {
  if (!r.enabled) return false;
  if (r.snoozedUntil && now < r.snoozedUntil) return false;
  if (!withinWindow(r, new Date(now))) return false;
  const anchor = r.lastFiredAt ?? now;
  return now - anchor >= r.intervalMin * 60000;
}

/** How many pings fit in the active window in one day — the "x/day" target on a tile. */
export function pingsPerDay(r: Reminder): number {
  const span = clockToMinutes(r.endTime) - clockToMinutes(r.startTime);
  if (span <= 0) return 0;
  return Math.floor(span / r.intervalMin) + 1;
}
