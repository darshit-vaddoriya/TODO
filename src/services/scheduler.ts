/**
 * The running scheduler. While Yaad is open (including an installed PWA kept in
 * the background), a ticker checks every reminder about every 20 seconds and
 * fires the ones that are due. Because the web can't reliably wake a fully
 * closed page at a set minute (the Notification Triggers API was dropped), this
 * is the honest, dependable path: reminders fire whenever the app is running.
 *
 * On visibility change (tab refocused) we tick immediately so a reminder that
 * came due while the tab was hidden pings as soon as you look.
 */
import { dueInPhrase, planAlerts, planSummary, type AlertSettings, type TaskAlert } from '@/domain/alerts';
import { localDate } from '@/domain/dates';
import { isDue } from '@/domain/interval-schedule';
import type { Reminder, Task } from '@/domain/types';
import { setMeta } from '@/data/db';
import { friendlyDate, formatClock } from '@/data/display';
import { getPrefs, setPrefs, type Prefs } from '@/data/prefs';
import { reload, saveMany, snapshot } from '@/data/reminders';
import { bump } from '@/data/stats';
import { getTask, pruneFiredAlerts, recordAlerts, snoozeTask, tasksSnapshot } from '@/data/tasks';
import { deliverTaskNotice, ping } from '@/services/notify';

const TICK_MS = 20_000;
let timer: ReturnType<typeof setInterval> | null = null;

/** Reset the per-day fired counter when the local date rolls over. */
function rolledOver(r: Reminder, today: string): Reminder {
  return r.firedTodayDate === today ? r : { ...r, firedToday: 0, firedTodayDate: today };
}

/** The slice of preferences the pure alert planner needs. */
export function alertSettings(p: Prefs = getPrefs()): AlertSettings {
  return {
    defaultReminderTime: p.defaultReminderTime,
    quietEnabled: p.quietEnabled,
    quietStart: p.quietStart,
    quietEnd: p.quietEnd,
    overdueReminders: p.overdueReminders,
    dailySummary: p.dailySummary,
    summaryTime: p.summaryTime,
    summaryDate: p.summaryDate,
  };
}

/** Overdue nudges beyond this many tasks collapse into one notification. */
const MAX_INDIVIDUAL_OVERDUE = 3;

function dueSuffix(task: Task): string {
  return task.dueTime ? ` · ${formatClock(task.dueTime)}` : '';
}

function reminderNotice(task: Task, alert: TaskAlert) {
  const body = alert.kind === 'snoozed' ? `Snoozed reminder${dueSuffix(task)}` : `Due ${dueInPhrase(alert.offsetMin)}${dueSuffix(task)}`;
  return { title: `⏰ ${task.title}`, body, tag: `yaad-task-${task.id}`, taskId: task.id, onSnooze: () => void snoozeTask(task.id, getPrefs().snoozeMin) };
}

/** Deliver whatever is due for tasks: reminders, snooze wake-ups, overdue nudges and the morning summary. */
async function tickTasks(now: number): Promise<void> {
  const prefs = getPrefs();
  const settings = alertSettings(prefs);
  const plan = planAlerts(tasksSnapshot(), now, settings);

  // Recalculate: forget delivered-alert keys that no longer match a live alert (the date or time changed).
  for (const st of plan.stale) await pruneFiredAlerts(st.taskId, st.live);

  // Do Not Disturb holds everything; what came due meanwhile shows up as "missed".
  if (prefs.pausedUntil > now) return;
  const today = localDate(new Date(now));

  for (const alert of plan.fire) {
    const task = getTask(alert.taskId);
    if (!task || task.done) continue;
    // Record first, so an alert can never be delivered twice even if delivery throws.
    await recordAlerts(task.id, { fired: [alert.key], clearSnooze: alert.kind === 'snoozed' });
    void deliverTaskNotice(reminderNotice(task, alert));
  }

  if (plan.overdue.length > MAX_INDIVIDUAL_OVERDUE) {
    for (const task of plan.overdue) await recordAlerts(task.id, { overdueDate: today });
    void deliverTaskNotice({ title: '📋 Overdue tasks', body: `${plan.overdue.length} tasks are overdue`, tag: 'yaad-overdue', taskId: null });
  } else {
    for (const task of plan.overdue) {
      await recordAlerts(task.id, { overdueDate: today });
      void deliverTaskNotice({
        title: `📋 ${task.title}`,
        body: `Overdue since ${friendlyDate(task.dueDate as string, today)}`,
        tag: `yaad-task-${task.id}`,
        taskId: task.id,
        onSnooze: () => void snoozeTask(task.id, getPrefs().snoozeMin),
      });
    }
  }

  const summary = planSummary(tasksSnapshot(), now, settings);
  if (summary.mark) {
    setPrefs({ summaryDate: today });
    if (summary.text) void deliverTaskNotice({ ...summary.text, tag: 'yaad-summary', taskId: null });
  }
}

/**
 * The single scheduler tick. Serialized (a tick that is still running is not
 * re-entered) and, where the browser has Web Locks, exclusive across open tabs
 * so two tabs can't both deliver the same alert.
 */
let busy = false;
export async function tick(now = Date.now()): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    if (navigator.locks) await navigator.locks.request('yaad-scheduler', { ifAvailable: true }, async (lock) => lock && (await runTick(now)));
    else await runTick(now);
  } finally {
    busy = false;
  }
}

async function runTick(now: number): Promise<void> {
  await tickReminders(now);
  await tickTasks(now);
}

async function tickReminders(now: number): Promise<void> {
  // Do Not Disturb: everything is muted, but let the date-roll reset below still run.
  const paused = getPrefs().pausedUntil > now;
  const today = localDate(new Date(now));
  const updates: Reminder[] = [];
  for (const current of snapshot()) {
    const r = rolledOver(current, today);
    if (!paused && isDue(r, now)) {
      void ping(r);
      void bump('reminders');
      updates.push({ ...r, lastFiredAt: now, firedToday: r.firedToday + 1, firedTodayDate: today });
    } else if (r !== current) {
      // Only the date rolled over; persist the reset count.
      updates.push(r);
    }
  }
  if (updates.length > 0) await saveMany(updates);
}

export function startScheduler(): void {
  if (timer !== null) return;
  mirrorAlertPrefs();
  // A first tick shortly after load catches anything already overdue.
  setTimeout(() => void tick(), 1500);
  timer = setInterval(() => void tick(), TICK_MS);
  document.addEventListener('visibilitychange', onVisible);
  // The service worker posts this after a "Snooze" notification action writes to IndexedDB.
  navigator.serviceWorker?.addEventListener('message', onSwMessage);
}

function onVisible() {
  // Pull in any change a background notification action made, then re-check.
  if (document.visibilityState === 'visible') void reload().then(() => tick());
}

function onSwMessage(event: MessageEvent) {
  const data = event.data as { type?: string; path?: string } | undefined;
  if (data?.type === 'reminder-changed') void reload();
  // A notification button asked an open window to go somewhere (see public/sw-reminders.js).
  else if (data?.type === 'navigate' && typeof data.path === 'string') location.hash = data.path.replace(/^\/#/, '#');
}

/**
 * Mirror the one setting the service worker needs for its closed-app catch-up
 * (the default reminder time) into IndexedDB, since the worker can't read localStorage.
 */
export function mirrorAlertPrefs(): void {
  void setMeta('alertPrefs', { defaultReminderTime: getPrefs().defaultReminderTime });
}

export function stopScheduler(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  document.removeEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.removeEventListener('message', onSwMessage);
}
