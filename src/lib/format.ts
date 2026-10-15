/** Time, interval and local-date helpers. */
import { getPrefs, type DateFormat } from './prefs';
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

/** A "HH:MM" clock label in 12-hour ("8:00 AM") or 24-hour ("08:00") style. Pure. */
export function formatClockWith(time: ClockTime, time24: boolean): string {
  const [h, m] = time.split(':').map(Number);
  const hh = h || 0;
  const mm = pad(m || 0);
  if (time24) return `${pad(hh)}:${mm}`;
  return `${hh % 12 || 12}:${mm} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** "8:00 AM" / "08:00" for a "HH:MM" value, following the 12/24-hour setting. */
export function formatClock(time: ClockTime): string {
  return formatClockWith(time, getPrefs().time24);
}

/** The clock label for a Date (the next-due time), following the 12/24-hour setting. */
export function formatTimeOfDay(d: Date): string {
  return formatClockWith(`${pad(d.getHours())}:${pad(d.getMinutes())}`, getPrefs().time24);
}

/** A "YYYY-MM-DD" date written in the chosen style. Pure. */
export function formatDateWith(dateStr: string, fmt: DateFormat): string {
  const [y, m, d] = dateStr.split('-');
  if (fmt === 'dmy') return `${d}/${m}/${y}`;
  if (fmt === 'ymd') return `${y}-${m}-${d}`;
  return `${m}/${d}/${y}`;
}

export function formatDate(dateStr: string): string {
  return formatDateWith(dateStr, getPrefs().dateFormat);
}

/** Whole days from one "YYYY-MM-DD" to another (b - a); DST-safe. */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** "Today", "Tomorrow", "Yesterday", else the date in the chosen style. Pure. */
export function friendlyDateWith(dateStr: string, today: string, fmt: DateFormat): string {
  const diff = dayDiff(today, dateStr);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDateWith(dateStr, fmt);
}

export function friendlyDate(dateStr: string, today = localDate()): string {
  return friendlyDateWith(dateStr, today, getPrefs().dateFormat);
}

/** "Today, 5:30 PM" / "Tomorrow" / "06/20/2026 · 09:00" — a task's due label. */
export function dueLabelFor(dueDate: string, dueTime: ClockTime | null, today = localDate()): string {
  const day = friendlyDate(dueDate, today);
  return dueTime ? `${day}, ${formatClock(dueTime)}` : day;
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
