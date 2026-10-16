/**
 * What to hand the phone's alarm system so reminders arrive while Yaad is closed:
 * the task alerts and repeating-reminder pings that fall in the next while, with
 * quiet hours, snoozes and Do Not Disturb applied. Pure — the Android app turns
 * each entry into a scheduled local notification and re-plans whenever the data
 * changes, so this list is always "the next N things that should ring".
 */
import { alertMoment, alertKey, effectiveMoment, inQuietHours, quietEndAfter, snoozeKey, type AlertSettings } from '@/domain/alerts';
import { nextDueAt } from '@/domain/interval-schedule';
import type { Reminder, Task } from '@/domain/types';

export type ScheduledKind = 'task' | 'snooze' | 'habit';

export interface ScheduledNotice {
  /** Stable identity (the alert key, or reminder id + moment), so unchanged entries aren't rescheduled. */
  key: string;
  kind: ScheduledKind;
  /** When it should ring, epoch ms. */
  at: number;
  taskId: string | null;
  reminderId: string | null;
  /** Minutes before the due moment (tasks only). */
  offsetMin: number;
}

export const TASK_HORIZON_MS = 14 * 86_400_000;
export const HABIT_HORIZON_MS = 2 * 86_400_000;
/** Android allows ~500 pending alarms per app; stay well under it. Frequent reminders only cover the next stretch while closed. */
export const MAX_PER_HABIT = 48;
export const MAX_SCHEDULED = 200;

/** The first moment at or after `at` that is past Do Not Disturb and outside quiet hours. */
function audible(at: number, pausedUntil: number, s: AlertSettings): number {
  let t = Math.max(at, pausedUntil);
  if (inQuietHours(t, s)) t = quietEndAfter(t, s);
  return t;
}

export function planScheduled(tasks: Task[], reminders: Reminder[], now: number, s: AlertSettings, pausedUntil = 0): ScheduledNotice[] {
  const out: ScheduledNotice[] = [];

  for (const task of tasks) {
    if (task.done) continue;
    if (task.snoozedUntil !== null) {
      if (task.snoozedUntil > now) {
        const at = audible(effectiveMoment(task.snoozedUntil, now, s), pausedUntil, s);
        out.push({ key: snoozeKey(task.id, task.snoozedUntil), kind: 'snooze', at, taskId: task.id, reminderId: null, offsetMin: 0 });
      }
      continue; // a snooze replaces the task's normal alerts until it ends
    }
    for (const reminder of task.reminders) {
      const moment = alertMoment(task, reminder, s.defaultReminderTime);
      if (moment === null) continue;
      const key = alertKey(task.id, reminder.id, moment);
      if (task.firedAlerts.includes(key)) continue;
      const eff = effectiveMoment(moment, now, s);
      if (eff <= now || eff > now + TASK_HORIZON_MS) continue;
      out.push({ key, kind: 'task', at: audible(eff, pausedUntil, s), taskId: task.id, reminderId: reminder.id, offsetMin: reminder.offsetMin });
    }
  }

  for (const r of reminders) {
    let cursor: Reminder = r;
    let from = now;
    for (let i = 0; i < MAX_PER_HABIT; i++) {
      const due = nextDueAt(cursor, from);
      if (due === null || due > now + HABIT_HORIZON_MS) break;
      const at = audible(due, pausedUntil, s);
      if (at > now + HABIT_HORIZON_MS) break;
      out.push({ key: `habit:${r.id}:${at}`, kind: 'habit', at, taskId: null, reminderId: r.id, offsetMin: 0 });
      cursor = { ...r, lastFiredAt: at, snoozedUntil: undefined };
      from = at;
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}
