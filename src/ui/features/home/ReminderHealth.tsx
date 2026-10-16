/**
 * Android app only: tells you on Home when reminders cannot ring — notifications are
 * off, or the phone's battery saving may hold alarms back — with a button that fixes
 * it. Without this the only sign was silence. Nothing shows when all is well.
 */
import { useEffect, useState } from 'preact/hooks';
import {
  nativeAvailable,
  nativeRequestPermission,
  nativeStatus,
  openBatterySettings,
  openNotificationSettings,
  type NativeStatus,
} from '@/services/native-notify';
import { Icon } from '@/ui/components';

const BATTERY_DISMISSED = 'yaad:battery-nudge-dismissed';

function batteryDismissed(): boolean {
  try {
    return localStorage.getItem(BATTERY_DISMISSED) === '1';
  } catch {
    return false;
  }
}

export function ReminderHealth() {
  const native = nativeAvailable();
  const [s, setS] = useState<NativeStatus | null>(null);
  const [hideBattery, setHideBattery] = useState(batteryDismissed);

  useEffect(() => {
    if (!native) return;
    const refresh = () => void nativeStatus().then(setS);
    refresh();
    // Back from a system settings screen: look again.
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [native]);

  if (!native || !s) return null;

  if (s.permission !== 'granted') {
    const blocked = s.permission === 'denied';
    return (
      <div class="card mb-4 flex items-start gap-3 border border-accent/60" role="alert">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Icon name="bell-off" size={19} />
        </span>
        <p class="min-w-0 flex-1 text-[0.9375rem] leading-snug">
          <b>Reminders can’t ring: notifications are off.</b>
          <span class="mt-0.5 block text-[0.8125rem] text-muted">
            {blocked ? 'They are blocked for Yaad. Turn them on in the phone’s settings.' : 'Allow notifications so Yaad can alert you.'}
          </span>
          <button
            type="button"
            class="mt-2 min-h-9 rounded-full bg-brand px-4 text-[0.875rem] font-bold text-on-brand"
            onClick={() => void (blocked ? openNotificationSettings() : nativeRequestPermission().then(() => nativeStatus().then(setS)))}
          >
            {blocked ? 'Open settings' : 'Allow notifications'}
          </button>
        </p>
      </div>
    );
  }

  if (!s.batteryUnrestricted && !hideBattery) {
    return (
      <div class="card mb-4 flex items-start gap-3 border border-haldi/60">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-haldi/15 text-haldi">
          <Icon name="alert" size={19} />
        </span>
        <p class="min-w-0 flex-1 text-[0.9375rem] leading-snug">
          <b>Your phone may delay reminders.</b>
          <span class="mt-0.5 block text-[0.8125rem] text-muted">Battery saving can hold alarms back. Set Yaad’s battery use to “Unrestricted”.</span>
          <span class="mt-2 flex gap-2">
            <button type="button" class="min-h-9 rounded-full bg-brand px-4 text-[0.875rem] font-bold text-on-brand" onClick={() => void openBatterySettings()}>
              Change
            </button>
            <button
              type="button"
              class="min-h-9 rounded-full bg-field px-4 text-[0.875rem] font-bold text-muted"
              onClick={() => {
                try {
                  localStorage.setItem(BATTERY_DISMISSED, '1');
                } catch {
                  // Not saved; it will show again next time.
                }
                setHideBattery(true);
              }}
            >
              Not now
            </button>
          </span>
        </p>
      </div>
    );
  }
  return null;
}
