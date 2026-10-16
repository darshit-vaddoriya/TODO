/** Small non-record preferences kept in localStorage. No reminder data here. */
import type { Priority } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type DateFormat = 'mdy' | 'dmy' | 'ymd';
export type Density = 'comfortable' | 'compact';
export const SNOOZE_CHOICES = [5, 10, 15, 30, 60] as const;

export interface Prefs {
  theme: Theme;
  /** The user's first name, shown in the Home greeting. Empty = no name set. */
  name: string;
  /** Whether the user has turned on OS notifications at least once (so we don't re-nudge). */
  notifyAsked: boolean;
  installPromptSeen: boolean;
  /** Play a short sound with each ping (in addition to the notification). */
  sound: boolean;
  /** Do Not Disturb: epoch ms until which ALL reminders are muted. 0 = not paused. */
  pausedUntil: number;
  /** How dates are written: 12/31/2026, 31/12/2026 or 2026-12-31. */
  dateFormat: DateFormat;
  /** 24-hour clock instead of 12-hour AM/PM. */
  time24: boolean;
  /** First day of the week in the calendar: 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Priority a new task starts with. */
  defaultPriority: Priority;
  /** "HH:MM" a reminder uses when its task has a date but no time. */
  defaultReminderTime: string;
  /** Minutes a task alert is snoozed for. */
  snoozeMin: number;
  /** Hold task alerts (not drop them) between these times. */
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  /** A once-a-day "here's your day" notification at summaryTime. */
  dailySummary: boolean;
  summaryTime: string;
  /** The local date the summary last went out, so it sends once a day. */
  summaryDate: string;
  /** A once-a-day nudge for tasks whose due date has passed. */
  overdueReminders: boolean;
  /** Tighter spacing for a denser list. */
  density: Density;
}

const KEY = 'yaad:prefs';
const DEFAULTS: Prefs = {
  theme: 'system',
  name: '',
  notifyAsked: false,
  installPromptSeen: false,
  sound: true,
  pausedUntil: 0,
  dateFormat: 'mdy',
  time24: false,
  weekStart: 1,
  defaultPriority: 'none',
  defaultReminderTime: '09:00',
  snoozeMin: 10,
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  dailySummary: false,
  summaryTime: '08:00',
  summaryDate: '',
  overdueReminders: true,
  density: 'comfortable',
};

let cache: Prefs | null = null;

export function getPrefs(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  cache = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked (private mode): keep the in-memory value for this session.
  }
  return cache;
}

export function clearPrefs(): void {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Do Not Disturb is on when a pause time is set and still in the future. */
export function isPaused(now = Date.now()): boolean {
  return getPrefs().pausedUntil > now;
}

/** Mute all reminders for `minutes` from now. */
export function pauseFor(minutes: number): void {
  setPrefs({ pausedUntil: Date.now() + minutes * 60000 });
}

/** Mute until a given epoch ms (used for "until tomorrow morning"). */
export function pauseUntil(epochMs: number): void {
  setPrefs({ pausedUntil: epochMs });
}

export function resume(): void {
  setPrefs({ pausedUntil: 0 });
}

/** Apply the theme to <html>. "system" removes the override so the CSS media query decides. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Two theme-color metas (light / dark) serve the system setting before any script runs. A forced
  // theme sets both to that theme's paper colour; "system" puts each back to its own default.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.dataset.default ??= meta.content;
    meta.content = theme === 'system' ? meta.dataset.default : paper;
  }
}

/** Apply the layout density to <html>; CSS reads `data-density`. */
export function applyDensity(density: Density): void {
  document.documentElement.dataset.density = density;
}
