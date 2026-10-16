/**
 * Android only: the four things that decide whether a reminder rings while Yaad
 * is closed — notification permission, exact alarms, battery use, and what is
 * actually scheduled — each with a fix button, plus a one-minute test.
 */
import { useEffect, useState } from 'preact/hooks';
import { formatTimeOfDay } from '@/data/display';
import {
  nativeRequestPermission,
  nativeStatus,
  openBatterySettings,
  openExactAlarmSettings,
  openNotificationSettings,
  scheduleTest,
  type NativeStatus,
} from '@/services/native-notify';
import { toast } from '@/services/toast';
import { Icon } from '@/ui/components';

function Row({ ok, title, detail, action }: { ok: boolean; title: string; detail: string; action?: { label: string; run: () => void } }) {
  return (
    <div class="flex items-center gap-3 py-2.5">
      <span class={`grid size-8 shrink-0 place-items-center rounded-full ${ok ? 'bg-positive/15 text-positive' : 'bg-accent/15 text-accent'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={17} />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block font-semibold">{title}</span>
        <span class="block text-[0.8125rem] leading-snug text-muted">{detail}</span>
      </span>
      {action && (
        <button type="button" class="min-h-9 shrink-0 rounded-full bg-brand px-3.5 text-[0.8125rem] font-bold text-on-brand" onClick={action.run}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ClosedAppCheck() {
  const [s, setS] = useState<NativeStatus | null>(null);

  useEffect(() => {
    const refresh = () => void nativeStatus().then(setS);
    refresh();
    // Coming back from a system settings screen: look again.
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  if (!s) return null;
  const refresh = () => void nativeStatus().then(setS);
  const allGood = s.permission === 'granted' && s.exact && s.batteryUnrestricted;

  const test = async () => {
    if (await scheduleTest(60)) {
      toast('Test set for 1 minute from now', { detail: 'Close Yaad now (swipe it away) and wait.', duration: 8000 });
      refresh();
    } else toast('Allow notifications first.', { tone: 'warn' });
  };

  return (
    <div class="card mt-2.5">
      <h3 class="font-extrabold tracking-[-0.01em]">Ringing while Yaad is closed</h3>
      <p class="text-[0.8125rem] leading-snug text-muted">{allGood ? 'Everything needed is on.' : 'Fix the red items so reminders arrive on time.'}</p>
      <div class="mt-1 divide-y divide-rule">
        <Row
          ok={s.permission === 'granted'}
          title="Notifications"
          detail={s.permission === 'granted' ? 'Allowed' : s.permission === 'denied' ? 'Blocked — turn them on in phone settings' : 'Not allowed yet'}
          action={
            s.permission === 'granted'
              ? undefined
              : s.permission === 'denied'
                ? { label: 'Open settings', run: () => void openNotificationSettings() }
                : { label: 'Allow', run: () => void nativeRequestPermission().then(refresh) }
          }
        />
        <Row
          ok={s.exact}
          title="Exact alarms"
          detail={s.exact ? 'On — rings at the exact minute' : 'Off — Android may delay reminders by minutes'}
          action={s.exact ? undefined : { label: 'Allow', run: () => void openExactAlarmSettings() }}
        />
        <Row
          ok={s.batteryUnrestricted}
          title="Battery use"
          detail={s.batteryUnrestricted ? 'Unrestricted' : 'Optimised — some phones stop alarms to save power. Choose “Unrestricted” or “Don’t optimise”.'}
          action={s.batteryUnrestricted ? undefined : { label: 'Change', run: () => void openBatterySettings() }}
        />
        <Row
          ok={s.pending > 0}
          title="Scheduled"
          detail={
            s.pending > 0
              ? `${s.pending} upcoming${s.nextAt ? ` · next at ${formatTimeOfDay(new Date(s.nextAt))}` : ''}`
              : 'Nothing yet — add a reminder to a task with a date, or a repeating reminder.'
          }
        />
      </div>
      <button type="button" class="btn btn-quiet mt-2 w-full" onClick={() => void test()}>
        <Icon name="bell" size={18} /> Test: ring in 1 minute
      </button>
    </div>
  );
}
