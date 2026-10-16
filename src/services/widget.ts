/**
 * Bridge to the Android home-screen widget. Only active inside the Capacitor app
 * (the Android build); in a browser every call is a no-op. The app computes a
 * small summary (domain/widget.ts) and hands it to the native `YaadWidget`
 * plugin, which stores it and redraws the widget.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { snapshot as remindersSnapshot, subscribe as subscribeReminders } from '@/data/reminders';
import { subscribeTasks, tasksSnapshot } from '@/data/tasks';
import { localDate } from '@/domain/dates';
import { widgetSummary, type WidgetSummary } from '@/domain/widget';

/** The app's own native plugin: widget updates plus a few system-settings shortcuts. */
interface YaadNativePlugin {
  update(summary: WidgetSummary): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  batteryStatus(): Promise<{ unrestricted: boolean }>;
  /** Replace the alerts the phone will ring (even with the app closed) and arm the next alarm. */
  schedulePlan(plan: { items: PlannedAlert[] }): Promise<{ count: number; nextAt: number }>;
  showNow(item: Omit<PlannedAlert, 'at'>): Promise<void>;
  scheduleTest(options: { seconds: number }): Promise<{ count: number; nextAt: number }>;
  alarmStatus(): Promise<{ count: number; nextAt: number }>;
}

export interface PlannedAlert {
  id: number;
  /** When it rings, epoch ms. */
  at: number;
  title: string;
  body: string;
  taskId: string | null;
  /** Show Snooze / Done buttons. */
  actions: boolean;
  snoozeLabel: string;
}

export const Native = registerPlugin<YaadNativePlugin>('YaadWidget');

export function widgetSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

let last = '';

/** Send the current summary to the widget (skipped when nothing changed). */
export async function refreshWidget(): Promise<void> {
  if (!widgetSupported()) return;
  const summary = widgetSummary(tasksSnapshot(), remindersSnapshot(), localDate());
  const key = JSON.stringify(summary);
  if (key === last) return;
  last = key;
  try {
    await Native.update(summary);
  } catch {
    last = ''; // try again on the next change
  }
}

/** Keep the widget in step with the data, and open the screen a widget tap asks for (`yaad://task/new`). */
export function startWidget(): void {
  if (!widgetSupported()) return;
  void refreshWidget();
  subscribeTasks(() => void refreshWidget());
  subscribeReminders(() => void refreshWidget());
  void App.addListener('appStateChange', ({ isActive }) => isActive && void refreshWidget());
  void App.addListener('appUrlOpen', ({ url }) => {
    const path = url.replace(/^yaad:\/\//, '');
    location.hash = `#/${path}`;
  });
}
