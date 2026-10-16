/**
 * Notifications inside the Android (Capacitor) app. A WebView has no web
 * Notification, so reminders are handed to native code: the app plans the next
 * alerts (domain/native-schedule.ts), sends them to the `YaadWidget` plugin, and the
 * phone rings them with an alarm-clock alarm — which Android does not delay in Doze
 * or battery saver — even while Yaad is closed. Tapping a notification, Snooze or
 * Done opens the app on `yaad://...` (see services/widget.ts). In a browser every
 * function here is a no-op and `nativeAvailable()` is false.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dueInPhrase } from '@/domain/alerts';
import { localDate } from '@/domain/dates';
import { planScheduled, type ScheduledNotice } from '@/domain/native-schedule';
import { formatClock, friendlyDate } from '@/data/display';
import { alertSettings, getPrefs, setPrefs } from '@/data/prefs';
import { snapshot as remindersSnapshot, subscribe as subscribeReminders } from '@/data/reminders';
import { getTask, subscribeTasks, tasksSnapshot } from '@/data/tasks';
import { Native } from '@/services/widget';

export function nativeAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** The last thing that went wrong talking to the phone, shown in Settings so a silent failure can be seen. */
let lastError = '';
function remember(step: string, err: unknown): void {
  lastError = `${step}: ${err instanceof Error ? err.message : String(err)}`;
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
  } catch (err) {
    remember('permission', err);
  }
  return cachedPermission;
}

export interface NativeStatus {
  permission: Permission;
  /** Android lets Yaad run in the background (battery use "Unrestricted"). */
  batteryUnrestricted: boolean;
  /** How many alerts the phone has stored, and when the first one rings. */
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
  } catch (err) {
    remember('permission', err);
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
    const state = await Native.alarmStatus();
    pending = state.count;
    nextAt = state.nextAt > Date.now() ? state.nextAt : null;
  } catch (err) {
    remember('status', err);
  }
  return { permission: perm, batteryUnrestricted, pending, nextAt, error: lastError };
}

/**
 * A test notification: right now (`seconds` = 0), to check it can show at all, or `seconds`
 * from now, to prove an alarm rings with the app closed. Resolves to an error message, or ''.
 */
export async function scheduleTest(seconds = 60): Promise<string> {
  if (cachedPermission === 'denied') return 'Notifications are blocked. Turn them on in phone settings.';
  try {
    await Native.scheduleTest({ seconds });
    return '';
  } catch (err) {
    remember('test', err);
    return err instanceof Error ? err.message : String(err);
  }
}

export const openNotificationSettings = () => Native.openNotificationSettings().catch(() => undefined);
export const openBatterySettings = () => Native.openBatterySettings().catch(() => undefined);

/** A positive 31-bit id from a string key (the phone needs an integer id per notification). */
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

const snoozeLabel = () => `Snooze ${getPrefs().snoozeMin} min`;

/** Show a notification right now (overdue nudges, the morning summary). */
export async function nativeShow(notice: NativeNotice): Promise<void> {
  try {
    await Native.showNow({
      id: idFor(notice.tag),
      title: notice.title,
      body: notice.body,
      taskId: notice.taskId,
      actions: !!notice.actions && notice.taskId !== null,
      snoozeLabel: snoozeLabel(),
    });
  } catch (err) {
    remember('show', err); // the in-app alert still showed
  }
}

/** What a planned entry says when it rings. */
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
let again = false;

/**
 * Re-plan the upcoming alerts and replace what the phone has stored. Cheap to call
 * often: it does nothing when the plan hasn't changed. A call that arrives while one is
 * running is not lost — it runs once more afterwards, with the newest data.
 */
export async function syncScheduled(): Promise<void> {
  if (!nativeAvailable()) return;
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  try {
    const prefs = getPrefs();
    const plan = planScheduled(tasksSnapshot(), remindersSnapshot(), Date.now(), alertSettings(prefs), prefs.pausedUntil);
    const items = [];
    for (const entry of plan) {
      const notice = noticeFor(entry);
      if (notice) {
        items.push({
          id: idFor(entry.key),
          at: entry.at,
          title: notice.title,
          body: notice.body,
          taskId: notice.taskId,
          actions: !!notice.actions,
          snoozeLabel: snoozeLabel(),
        });
      }
    }
    const signature = JSON.stringify(items);
    if (signature !== lastPlan) {
      await Native.schedulePlan({ items });
      lastPlan = signature;
    }
    lastError = '';
  } catch (err) {
    remember('schedule', err);
    lastPlan = ''; // try again on the next change
  } finally {
    syncing = false;
    if (again) {
      again = false;
      void syncScheduled();
    }
  }
}

/** Permission state, the first-run permission prompt, and keeping the phone's plan current. */
export async function startNativeNotifications(): Promise<void> {
  if (!nativeAvailable()) return;
  try {
    cachedPermission = fromPlugin((await LocalNotifications.checkPermissions()).display);
    // First run on Android 13+: nothing can show until this is allowed, so ask once, up front.
    if (cachedPermission === 'default' && !getPrefs().notifyAsked) {
      setPrefs({ notifyAsked: true });
      await nativeRequestPermission();
    }
  } catch (err) {
    remember('permission', err);
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
