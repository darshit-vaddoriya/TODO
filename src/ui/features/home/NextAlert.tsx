/**
 * "Next alert": what will ring next, a live countdown to the second, and the
 * exact clock time. Task alerts and repeating reminders are both considered, with
 * quiet hours and Do Not Disturb applied — the same plan the Android app hands to
 * the phone's alarm system, so what you see here is when it rings.
 */
import { useEffect, useState } from 'preact/hooks';
import { formatCountdown } from '@/domain/dates';
import { nextUp } from '@/domain/native-schedule';
import type { Reminder, Task } from '@/domain/types';
import { alertSettings, getPrefs } from '@/data/prefs';
import { Icon } from '@/ui/components';

const clockWithSeconds = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** A re-render every second, for this component only. */
function useSecond(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function NextAlert({ tasks, reminders }: { tasks: Task[]; reminders: Reminder[] }) {
  const now = useSecond();
  const prefs = getPrefs();
  const paused = prefs.pausedUntil > now;
  const next = nextUp(tasks, reminders, now, alertSettings(prefs), prefs.pausedUntil);

  if (!next) {
    return (
      <div class="hero-panel mt-3.5 flex items-center gap-3">
        <Icon name="bell-off" size={20} />
        <p class="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug">
          No alerts scheduled. Add a reminder to a task with a date, or a repeating reminder.
        </p>
      </div>
    );
  }

  const left = next.at - now;
  const sameDay = new Date(next.at).toDateString() === new Date(now).toDateString();
  const when = `${sameDay ? '' : `${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(next.at))} `}${(left < 3_600_000 ? clockWithSeconds : clock).format(new Date(next.at))}`;

  return (
    <div class="hero-panel mt-3.5 flex items-center gap-3" aria-label={`Next alert: ${next.title} at ${when}`}>
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-xl" aria-hidden="true">
        {next.emoji}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[0.6875rem] font-bold uppercase tracking-wide opacity-90">{paused ? 'Next alert · after pause' : 'Next alert'}</span>
        <span class="block truncate font-extrabold leading-tight">{next.title}</span>
        <span class="block text-[0.75rem] font-semibold opacity-90">rings at {when}</span>
      </span>
      <span role="timer" class="tnum shrink-0 text-[1.5rem] font-extrabold leading-none tracking-[-0.02em]">
        {formatCountdown(left)}
      </span>
    </div>
  );
}
