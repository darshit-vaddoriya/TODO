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
import { localDate } from './format';
import { ping } from './notify';
import { getPrefs } from './prefs';
import { isDue } from './schedule';
import { bump } from './stats';
import { reload, saveMany, snapshot } from './store';
import type { Reminder } from './types';

const TICK_MS = 20_000;
let timer: ReturnType<typeof setInterval> | null = null;

/** Reset the per-day fired counter when the local date rolls over. */
function rolledOver(r: Reminder, today: string): Reminder {
  return r.firedTodayDate === today ? r : { ...r, firedToday: 0, firedTodayDate: today };
}

export async function tick(now = Date.now()): Promise<void> {
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
  if ((event.data as { type?: string })?.type === 'reminder-changed') void reload();
}

export function stopScheduler(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  document.removeEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.removeEventListener('message', onSwMessage);
}
