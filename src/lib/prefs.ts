/** Small non-record preferences kept in localStorage. No reminder data here. */
export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: Theme;
  /** Whether the user has turned on OS notifications at least once (so we don't re-nudge). */
  notifyAsked: boolean;
  installPromptSeen: boolean;
  /** Play a short sound with each ping (in addition to the notification). */
  sound: boolean;
  /** Do Not Disturb: epoch ms until which ALL reminders are muted. 0 = not paused. */
  pausedUntil: number;
}

const KEY = 'yaad:prefs';
const DEFAULTS: Prefs = {
  theme: 'system',
  notifyAsked: false,
  installPromptSeen: false,
  sound: true,
  pausedUntil: 0,
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
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}
