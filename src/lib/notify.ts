/** Permission handling and the actual ping: a system notification, plus optional sound and vibration. */
import { getPrefs } from './prefs';
import { toast } from './toast';
import type { Reminder } from './types';

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function permission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') {
    if (Notification.permission === 'granted') void registerCatchUp();
    return Notification.permission;
  }
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') void registerCatchUp();
    return result;
  } catch {
    return Notification.permission;
  }
}

/**
 * Best-effort background catch-up on installed Chrome/Android. The browser
 * decides how often (roughly hours), and most platforms don't run it at all —
 * the in-page scheduler is the reliable path. Safe to call repeatedly.
 */
export async function registerCatchUp(): Promise<void> {
  try {
    const reg = (await navigator.serviceWorker?.ready) as (ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    }) | undefined;
    await reg?.periodicSync?.register('yaad-catchup', { minInterval: 3 * 60 * 60 * 1000 });
  } catch {
    // Not installed, or the browser declined periodic sync. In-page reminders still work.
  }
}

/** Short soft two-tone chime built with the Web Audio API — no audio file to ship. */
function playChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    }
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Autoplay blocked or Web Audio unavailable: the notification itself still shows.
  }
}

/**
 * Fire one reminder. Prefers a service-worker notification (survives better when
 * the tab is backgrounded), falls back to a page Notification, and always adds
 * sound/vibration where allowed.
 */
export async function ping(reminder: Reminder): Promise<void> {
  const body = `It’s time — ${reminder.title.toLowerCase()}.`;
  const title = `${reminder.emoji} ${reminder.title}`;
  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: `yaad-${reminder.id}`,
    // renotify so repeated pings with the same tag still alert; actions need a service worker.
    ...({ renotify: true, actions: [{ action: 'snooze', title: 'Snooze 10 min' }, { action: 'done', title: 'Done' }] } as NotificationOptions),
  };

  if (permission() === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) await reg.showNotification(title, options);
      else new Notification(title, options);
    } catch {
      try {
        new Notification(title, options);
      } catch {
        // Notification failed entirely; the in-app toast (raised by the caller) still shows.
      }
    }
  }

  if ((reminder.vibrate ?? true) && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      // Not supported.
    }
  }
  if (getPrefs().sound) playChime();
}

/** What to show for a task alert, a nudge or the daily summary. */
export interface TaskNotice {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other, so a task never stacks duplicates. */
  tag: string;
  /** The task it is about, if any — enables the Snooze / Done actions and opens it on tap. */
  taskId: string | null;
  /** Show the in-app alert (toast) as well as the system notification. Default true. */
  inApp?: boolean;
  /** Called from the in-app toast's Snooze button. */
  onSnooze?: () => void;
}

/**
 * Deliver a task notice: an in-app alert (always, so it works with notifications
 * off or blocked), plus a system notification where permitted, with sound and
 * vibration. A task notice carries Snooze / Done actions that the service
 * worker routes back into the app.
 */
export async function deliverTaskNotice(notice: TaskNotice): Promise<void> {
  const prefs = getPrefs();
  if (notice.inApp !== false) {
    toast(`${notice.title} — ${notice.body}`, notice.onSnooze ? { duration: 9000, action: { label: `Snooze ${prefs.snoozeMin}m`, run: notice.onSnooze } } : { duration: 6000 });
  }
  if (permission() === 'granted') {
    const options: NotificationOptions = {
      body: notice.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: notice.tag,
      data: { taskId: notice.taskId },
      // renotify so a repeat with the same tag still alerts; actions need a service worker.
      ...({
        renotify: true,
        actions: notice.taskId ? [{ action: 'snooze', title: `Snooze ${prefs.snoozeMin} min` }, { action: 'done', title: 'Done' }] : [],
      } as NotificationOptions),
    };
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) await reg.showNotification(notice.title, options);
      else new Notification(notice.title, options);
    } catch {
      try {
        new Notification(notice.title, options);
      } catch {
        // The system notification failed entirely; the in-app alert above still showed.
      }
    }
  }
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      // Not supported.
    }
  }
  if (prefs.sound) playChime();
}

/**
 * A one-off test notification (Settings → "Send a test notification"), so the
 * user can confirm pings actually reach the system. Returns what happened.
 */
export async function sendTestNotification(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  const perm = await requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'unsupported';
  const options: NotificationOptions = {
    body: 'If you can see this, reminders will reach you while Yaad is open.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'yaad-test',
    ...({ renotify: true } as NotificationOptions),
  };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification('🔔 Test notification', options);
    else new Notification('🔔 Test notification', options);
  } catch {
    try {
      new Notification('🔔 Test notification', options);
    } catch {
      return 'unsupported';
    }
  }
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(120);
    } catch {
      // Not supported.
    }
  }
  if (getPrefs().sound) playChime();
  return 'ok';
}
