/**
 * Pure alert logic for tasks: which reminders are due to fire right now, which
 * were missed while the app was closed, quiet-hours holding, snooze, the daily
 * overdue nudge and the morning summary. The single scheduler calls this each
 * tick; nothing here touches the DOM, IndexedDB or the clock (time is passed in)
 * so every rule can be unit-tested.
 *
 * How a reminder is identified: key = taskId:reminderId:moment. The moment is
 * part of the key, so editing a task's date or time makes a fresh key and the
 * reminder is recalculated, while an alert already delivered is never repeated.
 */
import { clockToMinutes, localDate } from './format';
import type { Task, TaskReminder } from './types';

/** An alert later than this after its moment counts as "missed" (the app wasn't running), not "fire now". */
export const FRESH_MS = 5 * 60_000;

/** A morning summary opened this long after its time is skipped rather than sent hours late. */
const SUMMARY_GRACE_MS = 6 * 3_600_000;

export interface AlertSettings {
  defaultReminderTime: string;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  overdueReminders: boolean;
  dailySummary: boolean;
  summaryTime: string;
  /** The local date the summary last went out ("" = never). */
  summaryDate: string;
}

export type AlertKind = 'reminder' | 'snoozed';

export interface TaskAlert {
  key: string;
  taskId: string;
  kind: AlertKind;
  /** The reminder that produced it (null for a snooze wake-up). */
  reminderId: string | null;
  /** Minutes before the due moment this reminder was set for (0 for a snooze). */
  offsetMin: number;
  /** When it was meant to fire, epoch ms. */
  moment: number;
}

export interface AlertPlan {
  /** Alerts to deliver now. */
  fire: TaskAlert[];
  /** Alerts that came due while nothing was running (shown in-app, not as notifications). */
  missed: TaskAlert[];
  /** Open tasks whose due date has passed and haven't had today's overdue nudge. */
  overdue: Task[];
  /** Tasks whose stored fired keys no longer match any live alert, with the keys to keep. */
  stale: { taskId: string; live: Set<string> }[];
}

// --- Time helpers ----------------------------------------------------------------

/** Epoch ms for a local "YYYY-MM-DD" date at a "HH:MM" time. */
export function localMoment(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const mins = clockToMinutes(time);
  return new Date(y, (m || 1) - 1, d || 1, Math.floor(mins / 60), mins % 60, 0, 0).getTime();
}

/** The moment a task is due: its date at its time, or at the default reminder time when it has none. */
export function dueMoment(task: Pick<Task, 'dueDate' | 'dueTime'>, defaultTime: string): number | null {
  return task.dueDate ? localMoment(task.dueDate, task.dueTime ?? defaultTime) : null;
}

export function alertMoment(task: Pick<Task, 'dueDate' | 'dueTime'>, reminder: Pick<TaskReminder, 'offsetMin'>, defaultTime: string): number | null {
  const due = dueMoment(task, defaultTime);
  return due === null ? null : due - reminder.offsetMin * 60_000;
}

export function alertKey(taskId: string, reminderId: string, moment: number): string {
  return `${taskId}:${reminderId}:${moment}`;
}

const snoozeKey = (taskId: string, until: number) => `snooze:${taskId}:${until}`;

/** Is the clock inside quiet hours? Handles windows that wrap midnight (22:00–07:00). */
export function inQuietHours(at: number, s: Pick<AlertSettings, 'quietEnabled' | 'quietStart' | 'quietEnd'>): boolean {
  if (!s.quietEnabled) return false;
  const d = new Date(at);
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = clockToMinutes(s.quietStart);
  const end = clockToMinutes(s.quietEnd);
  if (start === end) return false;
  return start < end ? mins >= start && mins < end : mins >= start || mins < end;
}

/** The first moment at or after `at` when quiet hours end. */
export function quietEndAfter(at: number, s: Pick<AlertSettings, 'quietEnd'>): number {
  const d = new Date(at);
  const mins = clockToMinutes(s.quietEnd);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
  if (end.getTime() <= at) end.setDate(end.getDate() + 1);
  return end.getTime();
}

/**
 * When an alert meant for `moment` can actually be delivered, given quiet hours.
 * One that fell inside quiet hours waits for them to end. One that came due only
 * moments before they began isn't pinged at night either; once the morning
 * arrives it is older than FRESH_MS, so it surfaces in the app as missed.
 */
export function effectiveMoment(moment: number, now: number, s: AlertSettings): number {
  if (inQuietHours(moment, s)) return quietEndAfter(moment, s);
  if (inQuietHours(now, s) && now - moment <= FRESH_MS) return quietEndAfter(now, s);
  return moment;
}

// --- The plan -------------------------------------------------------------------

/**
 * Work out what to do right now. Completed tasks never alert. A snoozed task is
 * silent until its snooze ends, then gets one wake-up alert. Alerts that fell
 * inside quiet hours are held until quiet hours end (see effectiveMoment).
 * Anything later than FRESH_MS is reported as missed instead of fired, so
 * reopening the app after hours doesn't flood notifications.
 */
export function planAlerts(tasks: Task[], now: number, s: AlertSettings): AlertPlan {
  const fire: TaskAlert[] = [];
  const missed: TaskAlert[] = [];
  const overdue: Task[] = [];
  const stale: AlertPlan['stale'] = [];
  const quietNow = inQuietHours(now, s);
  const today = localDate(new Date(now));
  const overdueFrom = localMoment(today, s.defaultReminderTime);

  for (const task of tasks) {
    if (task.done) continue;

    // Keys that correspond to a live alert right now (to prune stale fired keys).
    const live = new Set<string>();
    const mine: TaskAlert[] = [];
    for (const reminder of task.reminders) {
      const moment = alertMoment(task, reminder, s.defaultReminderTime);
      if (moment === null) continue;
      const key = alertKey(task.id, reminder.id, moment);
      live.add(key);
      mine.push({ key, taskId: task.id, kind: 'reminder', reminderId: reminder.id, offsetMin: reminder.offsetMin, moment });
    }
    if (task.firedAlerts.some((k) => !live.has(k) && !k.startsWith('snooze:'))) stale.push({ taskId: task.id, live });

    // Snoozed: silent until the snooze ends.
    if (task.snoozedUntil !== null && task.snoozedUntil > now) continue;
    if (task.snoozedUntil !== null) {
      const alert: TaskAlert = { key: snoozeKey(task.id, task.snoozedUntil), taskId: task.id, kind: 'snoozed', reminderId: null, offsetMin: 0, moment: task.snoozedUntil };
      const effective = effectiveMoment(alert.moment, now, s);
      if (effective <= now) (now - effective <= FRESH_MS ? fire : missed).push(alert);
      continue; // one wake-up at a time; the normal reminders are evaluated after it clears
    }

    for (const alert of mine) {
      if (task.firedAlerts.includes(alert.key)) continue;
      const effective = effectiveMoment(alert.moment, now, s);
      if (effective > now) continue; // not due yet, or held until quiet hours end
      (now - effective <= FRESH_MS ? fire : missed).push(alert);
    }

    // The once-a-day overdue nudge, for tasks whose date has passed.
    if (s.overdueReminders && !quietNow && task.dueDate && task.dueDate < today && task.dueNotifiedDate !== today && now >= overdueFrom) {
      overdue.push(task);
    }
  }
  return { fire, missed, overdue, stale };
}

// --- Daily summary -----------------------------------------------------------------

export interface SummaryPlan {
  /** Mark today's summary as handled (sent, or skipped because nothing was due / it's too late). */
  mark: boolean;
  /** The notification to send, or null. */
  text: { title: string; body: string } | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Should the morning summary go out now, and what does it say? */
export function planSummary(tasks: Task[], now: number, s: AlertSettings): SummaryPlan {
  const none: SummaryPlan = { mark: false, text: null };
  if (!s.dailySummary) return none;
  const today = localDate(new Date(now));
  if (s.summaryDate === today) return none;
  const at = localMoment(today, s.summaryTime);
  if (now < at || inQuietHours(now, s)) return none;
  if (now - at > SUMMARY_GRACE_MS) return { mark: true, text: null }; // too late to be a morning summary

  const open = tasks.filter((t) => !t.done && t.dueDate !== null);
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const late = open.filter((t) => (t.dueDate as string) < today).length;
  if (dueToday === 0 && late === 0) return { mark: true, text: null };

  const bits = [];
  if (dueToday > 0) bits.push(`${plural(dueToday, 'task')} due today`);
  if (late > 0) bits.push(`${late} overdue`);
  return { mark: true, text: { title: 'Your day', body: bits.join(' · ') } };
}

// --- Wording -------------------------------------------------------------------------

/** "At time", "10 minutes before", "1 hour before", "1 day before" — also used by the editor. */
export function offsetLabel(offsetMin: number): string {
  if (offsetMin === 0) return 'At time';
  if (offsetMin % 1440 === 0) return `${plural(offsetMin / 1440, 'day')} before`;
  if (offsetMin % 60 === 0) return `${plural(offsetMin / 60, 'hour')} before`;
  return `${plural(offsetMin, 'minute')} before`;
}

/** "now", "in 10 minutes", "in 1 hour", "in 1 day" — the body of a reminder notification. */
export function dueInPhrase(offsetMin: number): string {
  if (offsetMin === 0) return 'now';
  return `in ${offsetLabel(offsetMin).replace(' before', '')}`;
}
