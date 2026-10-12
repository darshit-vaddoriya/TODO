/** Time, interval and local-date helpers. */
import type { ClockTime } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as "YYYY-MM-DD". Used to reset the per-day fired count at midnight. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Minutes since local midnight for a "HH:MM" clock time. */
export function clockToMinutes(time: ClockTime): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since local midnight for a Date. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** "90" minutes → "1h 30m"; "15" → "15m"; "120" → "2h". */
export function formatInterval(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "every 2h", "every 15m" — the phrase shown on a reminder tile. */
export function everyPhrase(min: number): string {
  return `every ${formatInterval(min)}`;
}

/** A short, human gap from now: "in 12 min", "in 1h 5m", "now". Negative = overdue → "now". */
export function untilPhrase(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60000);
  if (totalMin <= 0) return 'now';
  if (totalMin < 60) return `in ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

/** "8:00 AM" style clock label for a "HH:MM" value. */
export function formatClock(time: ClockTime): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** "8:00 AM" for a Date (the next-due time). */
export function formatTimeOfDay(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** Epoch ms at the next day's given hour (default 8am) — for "pause until tomorrow morning". */
export function tomorrowAt(hour = 8): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function formatDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'Every day';
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join(', ');
}
