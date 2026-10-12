/** Home: the list of reminders, each with its next ping, today's count, and an on/off switch. */
import { useEffect, useState } from 'preact/hooks';
import { everyPhrase, formatClock, formatDays, formatTimeOfDay, untilPhrase } from '../../lib/format';
import { permission, requestPermission } from '../../lib/notify';
import { getPrefs, isPaused, pauseFor, resume, setPrefs } from '../../lib/prefs';
import { dismissInstallBanner, promptInstall, shouldShowInstallBanner } from '../../lib/pwa';
import { nextDueAt, pingsPerDay } from '../../lib/schedule';
import { markDone, snooze, toggle } from '../../lib/store';
import { toast } from '../../lib/toast';
import type { Reminder } from '../../lib/types';
import { go, useData, useNow } from '../router';
import { Empty, Header, Icon, Meter, Nudge, Page, Section, Switch } from '../ui';

function ReminderTile({ reminder, now, paused }: { reminder: Reminder; now: number; paused: boolean }) {
  const due = nextDueAt(reminder, now);
  const snoozed = !!reminder.snoozedUntil && reminder.snoozedUntil > now;
  const target = pingsPerDay(reminder);
  const ratio = target > 0 ? Math.min(1, reminder.firedToday / target) : 0;
  return (
    <div class="card">
      <div class="flex items-center gap-3">
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => go(`/edit/${reminder.id}`)}>
          <span class="grid size-11 shrink-0 place-items-center rounded-[14px] bg-field text-2xl" aria-hidden="true">
            {reminder.emoji}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-extrabold tracking-[-0.01em]">{reminder.title}</span>
            <span class="block truncate text-[0.8125rem] text-muted">
              {everyPhrase(reminder.intervalMin)} · {formatDays(reminder.days)} · {formatClock(reminder.startTime)}–{formatClock(reminder.endTime)}
            </span>
            <span class="mt-0.5 block text-[0.8125rem] font-semibold">
              {!reminder.enabled ? (
                <span class="text-muted">Off</span>
              ) : paused ? (
                <span class="text-haldi">Paused</span>
              ) : snoozed ? (
                <span class="text-haldi">Snoozed · back {untilPhrase(reminder.snoozedUntil! - now)}</span>
              ) : due === null ? (
                <span class="text-muted">No ping in the next week</span>
              ) : (
                <span class="text-teal">
                  Next {untilPhrase(due - now)}
                  <span class="text-muted"> · {formatTimeOfDay(new Date(due))}</span>
                </span>
              )}
            </span>
          </span>
        </button>
        <Switch checked={reminder.enabled} onChange={(on) => void toggle(reminder.id, on)} label={`Turn ${reminder.title} ${reminder.enabled ? 'off' : 'on'}`} />
      </div>
      {reminder.enabled && (
        <div class="mt-2.5 flex items-center gap-3 border-t border-rule pt-2.5">
          <div class="min-w-0 flex-1">
            <Meter ratio={ratio} label={`${reminder.firedToday} of ${target} done today`} />
            <span class="mt-1 block text-[0.75rem] text-muted">{reminder.firedToday}{target > 0 ? ` / ${target}` : ''} today</span>
          </div>
          <button type="button" class="min-h-9 shrink-0 rounded-full bg-field px-3 text-[0.8125rem] font-bold text-muted" onClick={() => void snooze(reminder.id, 10)}>
            Snooze
          </button>
          <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-3.5 text-[0.8125rem] font-bold text-on-teal inline-flex items-center gap-1" onClick={() => void markDone(reminder.id)}>
            <Icon name="check" size={16} /> Did it
          </button>
        </div>
      )}
    </div>
  );
}

export function Home() {
  const reminders = useData();
  const now = useNow();
  const [perm, setPerm] = useState(permission());
  const [showInstall, setShowInstall] = useState(false);
  const [, setTick] = useState(0); // force a re-render after a prefs-only change (pause/resume)

  useEffect(() => {
    setShowInstall(shouldShowInstallBanner());
  }, []);

  const enableNotifications = async () => {
    const result = await requestPermission();
    setPerm(result);
    setPrefs({ notifyAsked: true });
    if (result === 'granted') toast('Notifications on. Yaad will ping you while it’s open.');
    else if (result === 'denied') toast('Notifications are blocked in your browser settings.', { tone: 'warn' });
  };

  const active = reminders.filter((r) => r.enabled);
  const off = reminders.filter((r) => !r.enabled);
  const needsPermission = perm !== 'granted' && reminders.length > 0 && !getPrefs().notifyAsked;

  const dnd = isPaused(now);
  const pausedUntil = getPrefs().pausedUntil;
  // Soonest upcoming ping across all active reminders, for the "Next up" line.
  const upcoming = dnd
    ? null
    : active
        .map((r) => ({ r, at: nextDueAt(r, now) }))
        .filter((x): x is { r: Reminder; at: number } => x.at !== null)
        .sort((a, b) => a.at - b.at)[0];

  const doPause = (fn: () => void) => {
    fn();
    setTick((n) => n + 1);
  };

  return (
    <>
      <Header
        title="Yaad"
        actions={
          <>
            <button
              type="button"
              class={`grid size-11 place-items-center rounded-full active:bg-field ${dnd ? 'text-haldi' : ''}`}
              aria-label={dnd ? 'Resume reminders' : 'Pause all reminders'}
              aria-pressed={dnd}
              onClick={() => (dnd ? doPause(resume) : doPause(() => pauseFor(60)))}
            >
              <Icon name={dnd ? 'play' : 'pause'} size={21} />
            </button>
            <a href="#/settings" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Settings">
              <Icon name="settings" size={22} />
            </a>
          </>
        }
      />
      <Page>
        {dnd && (
          <div class="card mb-4 flex items-center gap-3 border border-haldi/40">
            <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-field text-haldi">
              <Icon name="pause" size={19} />
            </span>
            <p class="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug">
              All reminders paused
              <span class="block text-[0.8125rem] font-normal text-muted">Resumes {formatTimeOfDay(new Date(pausedUntil))}</span>
            </p>
            <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-3.5 text-[0.8125rem] font-bold text-on-teal" onClick={() => doPause(resume)}>
              Resume
            </button>
          </div>
        )}
        {!dnd && upcoming && (
          <div class="mb-4 flex items-center gap-2 px-1 text-[0.875rem] font-semibold text-muted">
            <Icon name="clock" size={17} class="text-teal" />
            <span class="truncate">
              Next up: {upcoming.r.emoji} {upcoming.r.title} <span class="text-teal">{untilPhrase(upcoming.at - now)}</span>
            </span>
          </div>
        )}
        {showInstall && (
          <Nudge
            icon="phone"
            text="Install Yaad so reminders keep running in the background."
            action="Install"
            onAction={() => {
              void promptInstall();
              setShowInstall(false);
            }}
            onClose={() => {
              dismissInstallBanner();
              setShowInstall(false);
            }}
          />
        )}
        {needsPermission && (
          <Nudge
            icon="bell"
            text="Turn on notifications so reminders can ping you."
            action="Turn on"
            onAction={() => void enableNotifications()}
            onClose={() => {
              setPrefs({ notifyAsked: true });
              setPerm(permission());
            }}
          />
        )}

        {reminders.length === 0 ? (
          <Section>
            <Empty title="No reminders yet" body="Add a gentle, research-backed wellness reminder, or create your own.">
              <a href="#/presets" class="btn btn-primary">
                <Icon name="sparkles" size={18} /> Wellness presets
              </a>
              <a href="#/edit" class="btn btn-quiet">
                New reminder
              </a>
            </Empty>
          </Section>
        ) : (
          <>
            <Section>
              <div class="space-y-2.5">
                {active.map((r) => (
                  <ReminderTile key={r.id} reminder={r} now={now} paused={dnd} />
                ))}
              </div>
              {active.length === 0 && <Empty title="Everything is off" body="Flip a switch below to start a reminder again." />}
            </Section>
            {off.length > 0 && (
              <Section title="Off">
                <div class="space-y-2.5">
                  {off.map((r) => (
                    <ReminderTile key={r.id} reminder={r} now={now} paused={dnd} />
                  ))}
                </div>
              </Section>
            )}
            <Section>
              <a href="#/presets" class="flex items-center justify-center gap-2 text-[0.9375rem] font-bold text-teal">
                <Icon name="sparkles" size={18} /> Browse wellness presets
              </a>
            </Section>
          </>
        )}
      </Page>
    </>
  );
}
