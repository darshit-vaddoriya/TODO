/** Home: the list of reminders, each with its next ping, today's count, and an on/off switch. */
import { useEffect, useState } from 'preact/hooks';
import { everyPhrase, formatClock, formatDays, formatTimeOfDay, untilPhrase } from '../../lib/format';
import { permission, requestPermission } from '../../lib/notify';
import { getPrefs, setPrefs } from '../../lib/prefs';
import { dismissInstallBanner, promptInstall, shouldShowInstallBanner } from '../../lib/pwa';
import { nextDueAt } from '../../lib/schedule';
import { toggle } from '../../lib/store';
import { toast } from '../../lib/toast';
import type { Reminder } from '../../lib/types';
import { go, useData, useNow } from '../router';
import { Empty, Header, Icon, Nudge, Page, Section, Switch } from '../ui';

function ReminderTile({ reminder, now }: { reminder: Reminder; now: number }) {
  const due = nextDueAt(reminder, now);
  return (
    <div class="card flex items-center gap-3">
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
            {reminder.enabled ? (
              due === null ? (
                <span class="text-muted">No ping in the next week</span>
              ) : (
                <span class="text-teal">
                  Next {untilPhrase(due - now)}
                  <span class="text-muted"> · {formatTimeOfDay(new Date(due))}</span>
                </span>
              )
            ) : (
              <span class="text-muted">Off</span>
            )}
            {reminder.firedToday > 0 && <span class="text-muted"> · {reminder.firedToday} today</span>}
          </span>
        </span>
      </button>
      <Switch checked={reminder.enabled} onChange={(on) => void toggle(reminder.id, on)} label={`Turn ${reminder.title} ${reminder.enabled ? 'off' : 'on'}`} />
    </div>
  );
}

export function Home() {
  const reminders = useData();
  const now = useNow();
  const [perm, setPerm] = useState(permission());
  const [showInstall, setShowInstall] = useState(false);

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
  const paused = reminders.filter((r) => !r.enabled);
  const needsPermission = perm !== 'granted' && reminders.length > 0 && !getPrefs().notifyAsked;

  return (
    <>
      <Header
        title="Yaad"
        actions={
          <a href="#/settings" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Settings">
            <Icon name="settings" size={22} />
          </a>
        }
      />
      <Page>
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
                  <ReminderTile key={r.id} reminder={r} now={now} />
                ))}
              </div>
              {active.length === 0 && <Empty title="Everything is paused" body="Flip a switch below to start a reminder again." />}
            </Section>
            {paused.length > 0 && (
              <Section title="Paused">
                <div class="space-y-2.5">
                  {paused.map((r) => (
                    <ReminderTile key={r.id} reminder={r} now={now} />
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
