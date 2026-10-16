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
import { alertSettings, getPrefs, setPrefs } from '@/data/prefs';
import { Native } from '@/services/widget';
import { snapshot as remindersSnapshot, subscribe as subscribeReminders } from '@/data/reminders';
import { getTask, subscribeTasks, tasksSnapshot } from '@/data/tasks';

const CHANNEL = 'reminders';
const TEST_KEY = 'yaad-closed-test';
const ACTIONS = 'task-actions';

export function nativeAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** The last thing that went wrong talking to the phone, shown in Settings so a silent failure can be seen. */
let lastError = '';
function remember(step: string, err: unknown): void {
  lastError = `${step}: ${err instanceof Error ? err.message : String(err)}`;
}
export const nativeLastError = (): string => lastError;

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

export interface NativeStatus {
  permission: Permission;
  /** Alarms may ring at the exact minute. */
  exact: boolean;
  /** Android lets Yaad run in the background (battery use "Unrestricted"). */
  batteryUnrestricted: boolean;
  /** How many alerts the phone currently has scheduled, and when the first one rings. */
  pending: number;
  nextAt: number | null;
  /** The last failure while scheduling or showing, if any. */
  error: string;
}

/** Everything that decides whether a reminder rings while Yaad is closed, for the Settings check. */
export async function nativeStatus(): Promise<NativeStatus> {
  let perm: Permission = cachedPermission;
  try {
    perm = fromPlugin((await LocalNotifications.checkPermissions()).display);
    cachedPermission = perm;
  } catch {
    // keep the cached value
  }
  let batteryUnrestricted = true;
  try {
    batteryUnrestricted = (await Native.batteryStatus()).unrestricted;
  } catch {
    // older build without the method
  }
  let pending = 0;
  let nextAt: number | null = null;
  try {
    const list = (await LocalNotifications.getPending()).notifications;
    pending = list.length;
    const times = list.map((n) => n.schedule?.at && new Date(n.schedule.at).getTime()).filter((t): t is number => typeof t === 'number' && t > Date.now());
    nextAt = times.length ? Math.min(...times) : null;
  } catch {
    // leave zero
  }
  return { permission: perm, exact: await exactAlarmsAllowed(), batteryUnrestricted, pending, nextAt, error: lastError };
}

/**
 * Post a test notification: right now (`seconds` = 0) to check it can show at all, or
 * `seconds` from now to prove an alarm rings with the app closed. Resolves to an error
 * message, or '' on success.
 */
export async function scheduleTest(seconds = 60): Promise<string> {
  if (cachedPermission !== 'granted') return 'Notifications are not allowed yet.';
  try {
    const notice = {
      title: '🔔 Yaad test',
      body: seconds > 0 ? 'This rang while Yaad was closed. Reminders will reach you.' : 'Notifications work.',
      tag: TEST_KEY,
      taskId: null,
    };
    await LocalNotifications.schedule({ notifications: [build(idFor(TEST_KEY), notice, seconds > 0 ? Date.now() + seconds * 1000 : undefined)] });
    return '';
  } catch (err) {
    remember('test', err);
    return err instanceof Error ? err.message : String(err);
  }
}

export const openNotificationSettings = () => Native.openNotificationSettings().catch(() => undefined);
export const openBatterySettings = () => Native.openBatterySettings().catch(() => undefined);

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
  } catch (err) {
    remember('show', err); // the in-app alert still showed
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
    const mine = pending.notifications.filter((n) => n.id !== idFor(TEST_KEY)); // leave a running test alone
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    lastPlan = signature;
    lastError = '';
  } catch (err) {
    remember('schedule', err);
    lastPlan = ''; // try again on the next change
  } finally {
    syncing = false;
  }
}

/** Channel, action buttons, tap routing, permission state, and keeping the schedule current. */
export async function startNativeNotifications(): Promise<void> {
  if (!nativeAvailable()) return;
  // Each step stands alone: one failing (say, the action buttons) must not stop alarms from being scheduled.
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      remember(name, err);
    }
  };
  const prefs = getPrefs();

  await step('channel', () =>
    LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'Reminders',
      description: 'Task and habit reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
    }),
  );
  await step('actions', () =>
    LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTIONS,
          actions: [
            { id: 'snooze', title: `Snooze ${prefs.snoozeMin} min` },
            { id: 'done', title: 'Done' },
          ],
        },
      ],
    }),
  );
  await step('tap', () =>
    LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const taskId = (notification.extra as { taskId?: string | null } | undefined)?.taskId;
      if (!taskId) return;
      location.hash = actionId === 'snooze' || actionId === 'done' ? `#/act/${actionId}/${taskId}` : `#/task/${taskId}`;
    }),
  );
  await step('permission', async () => {
    cachedPermission = fromPlugin((await LocalNotifications.checkPermissions()).display);
    // First run on Android 13+: nothing can ring until this is allowed, so ask once, up front.
    if (cachedPermission === 'default' && !prefs.notifyAsked) {
      setPrefs({ notifyAsked: true });
      await nativeRequestPermission();
    }
  });

  void syncScheduled();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    lastPlan = '';
    void syncScheduled();
  });
  subscribeTasks(() => void syncScheduled());
  subscribeReminders(() => void syncScheduled());
}
