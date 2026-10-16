/**
 * The count on the installed app's icon (Badging API): open tasks due today or
 * overdue. Only installed apps on browsers that support it show a badge; elsewhere
 * every call is a no-op. Turned off with the "Badge on app icon" setting.
 */
import { getPrefs } from '@/data/prefs';
import { subscribeTasks, tasksSnapshot } from '@/data/tasks';
import { localDate } from '@/domain/dates';
import { badgeCount } from '@/domain/task-view';

/** Whether this browser can set an app badge at all (so Settings only offers the switch where it works). */
export function badgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/** Recompute the count and show it, or clear the badge when it is zero or switched off. */
export async function refreshBadge(): Promise<void> {
  if (!badgeSupported()) return;
  const count = getPrefs().badge ? badgeCount(tasksSnapshot(), localDate()) : 0;
  try {
    if (count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch {
    // Not installed, or the browser declined — nothing to do.
  }
}

/** Keep the badge in step with the tasks (and re-check when the app is shown again, e.g. a new day). */
export function startBadge(): void {
  if (!badgeSupported()) return;
  void refreshBadge();
  subscribeTasks(() => void refreshBadge());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void refreshBadge());
}
