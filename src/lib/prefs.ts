/** Small non-record preferences kept in localStorage. No reminder data here. */
export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: Theme;
  /** Whether the user has turned on OS notifications at least once (so we don't re-nudge). */
  notifyAsked: boolean;
  installPromptSeen: boolean;
  /** Play a short sound with each ping (in addition to the notification). */
  sound: boolean;
}

const KEY = 'yaad:prefs';
const DEFAULTS: Prefs = {
  theme: 'system',
  notifyAsked: false,
  installPromptSeen: false,
  sound: true,
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

/** Apply the theme to <html>. "system" removes the override so the CSS media query decides. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}
