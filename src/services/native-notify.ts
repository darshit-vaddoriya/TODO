/**
 * Notifications inside the Android (Capacitor) app. A WebView has no web
 * Notification, so this uses the phone's own: system notifications with Snooze /
 * Done buttons, and — the important part — alerts scheduled with the alarm
 * system ahead of time, so reminders ring while Yaad is closed. In a browser
 * every function here is a no-op and `nativeAvailable()` is false.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { dueInPhrase } from '@/domain/alerts';
import { planScheduled, type ScheduledNotice } from '@/domain/native-schedule';
import { localDate } from '@/domain/dates';
import { formatClock, friendlyDate } from '@/data/display';
import { alertSettings, getPrefs } from '@/data/prefs';
import { snapshot as remindersSnapshot, subscribe as subscribeReminders } from '@/data/reminders';
import { getTask, subscribeTasks, tasksSnapshot } from '@/data/tasks';

const CHANNEL = 'reminders';
const ACTIONS = 'task-actions';

export function nativeAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

type Permission = 'granted' | 'denied' | 'default';
let cachedPermission: Permission = 'default';

/** Last known permission (kept in memory so the rest of the app can read it synchronously). */
export function nativePermission(): Permission {
  return cachedPermission;
}

function fromPlugin(state: string): Permission {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'default';
}

export async function nativeRequestPermission(): Promise<Permission> {
  try {
    const current = await LocalNotifications.checkPermissions();
    cachedPermission = fromPlugin(current.display);
    if (cachedPermission === 'default') cachedPermission = fromPlugin((await LocalNotifications.requestPermissions()).display);
  } catch {
    // Leave the cached value.
  }
  if (cachedPermission === 'granted') void syncScheduled();
  return cachedPermission;
}

/**
 * Whether Android lets Yaad ring at the exact minute. Without it, alarms are
 * "inexact" and can arrive minutes late (or much later while the phone is idle).
 * True where the question doesn't apply (older Android, or not the Android app).
 */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (!nativeAvailable()) return true;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm !== 'denied';
  } catch {
    return true;
  }
}

/** Open Android's "Alarms & reminders" screen for Yaad; re-schedules once it is allowed. */
export async function openExactAlarmSettings(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    // The user can still find it under system settings.
  }
  lastPlan = ''; // re-schedule so pending alarms are re-registered as exact
  void syncScheduled();
}

/** A positive 31-bit id from a string key (the plugin needs integer ids). */
function idFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return h & 0x7fffffff || 1;
}

export interface NativeNotice {
  title: string;
  body: string;
  tag: string;
  taskId: string | null;
  /** Show Snooze / Done buttons. */
  actions?: boolean;
}

/** Show a notification right now (overdue nudges, the morning summary, tests). */
export async function nativeShow(notice: NativeNotice): Promise<void> {
  if (cachedPermission !== 'granted') return;
  try {
    await LocalNotifications.schedule({ notifications: [build(idFor(notice.tag), notice)] });
  } catch {
    // The in-app alert still showed.
  }
}

function build(id: number, notice: NativeNotice, at?: number): LocalNotificationSchema {
  return {
    id,
    title: notice.title,
    body: notice.body,
    channelId: CHANNEL,
    smallIcon: 'ic_stat_yaad',
    group: 'yaad',
    extra: { taskId: notice.taskId },
    ...(notice.actions && notice.taskId ? { actionTypeId: ACTIONS } : {}),
    ...(at ? { schedule: { at: new Date(at), allowWhileIdle: true } } : {}),
  };
}

/** What a scheduled entry says when it rings. */
function noticeFor(item: ScheduledNotice): NativeNotice | null {
  const today = localDate();
  if (item.kind === 'habit') {
    const r = remindersSnapshot().find((x) => x.id === item.reminderId);
    return r ? { title: `${r.emoji} ${r.title}`, body: `It’s time — ${r.title.toLowerCase()}.`, tag: item.key, taskId: null } : null;
  }
  const task = item.taskId ? getTask(item.taskId) : undefined;
  if (!task) return null;
  const suffix = task.dueTime ? ` · ${formatClock(task.dueTime)}` : '';
  const when = task.dueDate ? ` · ${friendlyDate(task.dueDate, today)}` : '';
  const body = item.kind === 'snooze' ? `Snoozed reminder${suffix}` : `Due ${dueInPhrase(item.offsetMin)}${suffix || when}`;
  return { title: `⏰ ${task.title}`, body, tag: item.key, taskId: task.id, actions: true };
}

let lastPlan = '';
let syncing = false;

/**
 * Re-plan the upcoming alerts and replace what the phone has scheduled. Cheap to
 * call often: it does nothing when the plan hasn't changed.
 */
export async function syncScheduled(): Promise<void> {
  if (!nativeAvailable() || cachedPermission !== 'granted' || syncing) return;
  syncing = true;
  try {
    const prefs = getPrefs();
    const plan = planScheduled(tasksSnapshot(), remindersSnapshot(), Date.now(), alertSettings(prefs), prefs.pausedUntil);
    const notifications: LocalNotificationSchema[] = [];
    for (const item of plan) {
      const notice = noticeFor(item);
      if (notice) notifications.push(build(idFor(item.key), notice, item.at));
    }
    const signature = JSON.stringify(notifications.map((n) => [n.id, n.title, n.body, n.schedule?.at?.getTime()]));
    if (signature === lastPlan) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    lastPlan = signature;
  } catch {
    lastPlan = ''; // try again on the next change
  } finally {
    syncing = false;
  }
}

/** Channel, action buttons, tap routing, permission state, and keeping the schedule current. */
export async function startNativeNotifications(): Promise<void> {
  if (!nativeAvailable()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'Reminders',
      description: 'Task and habit reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    const prefs = getPrefs();
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTIONS,
          actions: [
            { id: 'snooze', title: `Snooze ${prefs.snoozeMin} min` },
            { id: 'done', title: 'Done' },
          ],
        },
      ],
    });
    await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const taskId = (notification.extra as { taskId?: string | null } | undefined)?.taskId;
      if (!taskId) return;
      location.hash = actionId === 'snooze' || actionId === 'done' ? `#/act/${actionId}/${taskId}` : `#/task/${taskId}`;
    });
    cachedPermission = fromPlugin((await LocalNotifications.checkPermissions()).display);
  } catch {
    return;
  }
  void syncScheduled();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    lastPlan = '';
    void syncScheduled();
  });
  subscribeTasks(() => void syncScheduled());
  subscribeReminders(() => void syncScheduled());
}
