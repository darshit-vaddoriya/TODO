/**
 * Reminder settings: notification permission status and test, the honest
 * limits of closed-app notifications, default reminder time, snooze length,
 * quiet hours, the daily summary, overdue nudges, sound and Do Not Disturb.
 */
import { useState } from 'preact/hooks';
import { tomorrowAt, formatTimeOfDay, untilPhrase } from '../../lib/format';
import { notificationsSupported, permission, requestPermission, sendTestNotification } from '../../lib/notify';
import { getPrefs, isPaused, pauseFor, pauseUntil, resume, setPrefs, SNOOZE_CHOICES } from '../../lib/prefs';
import { toast } from '../../lib/toast';
import { useNow } from '../router';
import { Header, Icon, Page, Section, Segmented, SettingRow, Switch } from '../ui';

/** A labelled time-of-day input row. */
function TimeRow({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div class="flex min-h-14 items-center gap-3 py-2">
      <span class="min-w-0 flex-1">
        <span class="block font-semibold">{label}</span>
        {hint && <span class="block text-[0.8125rem] leading-snug text-muted">{hint}</span>}
      </span>
      <input type="time" class="field !min-h-11 !w-auto !py-1.5" value={value} onInput={(e) => e.currentTarget.value && onChange(e.currentTarget.value)} aria-label={label} />
    </div>
  );
}

export function ReminderSettings() {
  const now = useNow();
  const [prefs, setLocal] = useState(getPrefs());
  const [perm, setPerm] = useState(permission());

  const update = (patch: Partial<typeof prefs>) => {
    setPrefs(patch);
    setLocal(getPrefs());
  };

  const supported = notificationsSupported();
  const dnd = isPaused(now);

  const enable = async () => {
    const result = await requestPermission();
    setPerm(result);
    setPrefs({ notifyAsked: true });
    if (result === 'granted') toast('Notifications are on.');
    else if (result === 'denied') toast('Blocked. Allow notifications in your browser or phone settings.', { tone: 'warn' });
  };

  const test = async () => {
    const result = await sendTestNotification();
    setPerm(permission());
    if (result === 'ok') toast('Test sent — check your notifications.');
    else if (result === 'denied') toast('Blocked. Allow notifications in your browser or phone settings.', { tone: 'warn' });
    else toast('This browser can’t show notifications.', { tone: 'warn' });
  };

  return (
    <>
      <Header title="Reminder settings" showBack />
      <Page>
        <Section title="Notifications">
          <div class="card">
            {!supported ? (
              <div class="flex gap-3">
                <Icon name="bell-off" size={20} class="mt-0.5 text-haldi" />
                <p class="text-[0.9375rem] leading-snug">
                  <b>This browser can’t show notifications.</b>
                  <span class="block text-muted">Reminders will still appear inside the app while it’s open.</span>
                </p>
              </div>
            ) : perm === 'granted' ? (
              <>
                <div class="flex items-center gap-3">
                  <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-field text-teal">
                    <Icon name="bell" size={19} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold">Notifications are on</span>
                    <span class="block text-[0.8125rem] text-muted">Allowed by this browser.</span>
                  </span>
                  <button type="button" class="chip shrink-0" onClick={() => void test()}>
                    Send test
                  </button>
                </div>
              </>
            ) : perm === 'denied' ? (
              <div class="flex gap-3">
                <Icon name="bell-off" size={20} class="mt-0.5 shrink-0 text-accent" />
                <p class="text-[0.9375rem] leading-snug">
                  <b>Notifications are blocked.</b>
                  <span class="block text-muted">
                    Reminders will only show inside the app while it’s open. To get system notifications, allow them for this site in your browser or phone
                    settings, then come back.
                  </span>
                </p>
              </div>
            ) : (
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-field text-muted">
                  <Icon name="bell-off" size={19} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">Notifications are off</span>
                  <span class="block text-[0.8125rem] text-muted">Allow them so reminders can reach you.</span>
                </span>
                <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-4 text-[0.875rem] font-bold text-on-teal" onClick={() => void enable()}>
                  Turn on
                </button>
              </div>
            )}
            <div class="mt-3 border-t border-rule pt-1">
              <SettingRow icon="volume" label="Sound" hint="A soft chime with each alert.">
                <Switch checked={prefs.sound} onChange={(on) => update({ sound: on })} label="Alert sound" />
              </SettingRow>
            </div>
          </div>
          <div class="card mt-2.5 space-y-2 text-[0.8125rem] leading-snug text-muted">
            <p class="flex gap-2.5">
              <Icon name="clock" size={17} class="mt-0.5 shrink-0 text-teal" />
              <span>
                <b class="text-ink">While Yaad is open</b> (including an installed app kept running), reminders fire on time, as a notification and in the app.
              </span>
            </p>
            <p class="flex gap-2.5">
              <Icon name="info" size={17} class="mt-0.5 shrink-0 text-haldi" />
              <span>
                <b class="text-ink">When it’s closed or suspended</b>, a web app can’t reliably wake itself at an exact minute — that depends on your browser and
                phone. Anything missed is shown the next time you open Yaad. If exact alarms after closing are essential, use your phone’s clock or
                calendar alarms as well.
              </span>
            </p>
          </div>
        </Section>

        <Section title="Task reminders">
          <div class="card">
            <TimeRow label="Default reminder time" hint="Used when a task has a date but no time." value={prefs.defaultReminderTime} onChange={(v) => update({ defaultReminderTime: v })} />
            <div class="border-t border-rule py-3">
              <span class="section-label mb-1.5 block">Snooze for</span>
              <Segmented
                label="Snooze duration"
                value={prefs.snoozeMin}
                onChange={(v) => update({ snoozeMin: v })}
                options={SNOOZE_CHOICES.map((m) => ({ value: m as number, label: m === 60 ? '1 h' : `${m} m` }))}
              />
            </div>
            <div class="border-t border-rule">
              <SettingRow icon="clock" label="Overdue reminders" hint="Once a day, nudge about tasks whose date has passed.">
                <Switch checked={prefs.overdueReminders} onChange={(on) => update({ overdueReminders: on })} label="Overdue reminders" />
              </SettingRow>
            </div>
          </div>
        </Section>

        <Section title="Quiet hours">
          <div class="card">
            <SettingRow icon="moon" label="Hold alerts at night" hint="Task alerts wait until quiet hours end — they aren’t lost.">
              <Switch checked={prefs.quietEnabled} onChange={(on) => update({ quietEnabled: on })} label="Quiet hours" />
            </SettingRow>
            {prefs.quietEnabled && (
              <div class="border-t border-rule">
                <TimeRow label="From" value={prefs.quietStart} onChange={(v) => update({ quietStart: v })} />
                <TimeRow label="Until" value={prefs.quietEnd} onChange={(v) => update({ quietEnd: v })} />
              </div>
            )}
          </div>
        </Section>

        <Section title="Daily summary">
          <div class="card">
            <SettingRow icon="list" label="Morning summary" hint="One notification with what’s due today and what’s overdue.">
              <Switch checked={prefs.dailySummary} onChange={(on) => update({ dailySummary: on })} label="Daily summary" />
            </SettingRow>
            {prefs.dailySummary && (
              <div class="border-t border-rule">
                <TimeRow label="Send at" value={prefs.summaryTime} onChange={(v) => update({ summaryTime: v })} />
              </div>
            )}
          </div>
        </Section>

        <Section title="Do Not Disturb">
          <div class="card">
            {dnd ? (
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-field text-haldi">
                  <Icon name="pause" size={19} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">All reminders paused</span>
                  <span class="block text-[0.8125rem] text-muted">
                    Resumes {formatTimeOfDay(new Date(prefs.pausedUntil))} · {untilPhrase(prefs.pausedUntil - now)}
                  </span>
                </span>
                <button
                  type="button"
                  class="min-h-9 shrink-0 rounded-full bg-teal px-4 text-[0.875rem] font-bold text-on-teal"
                  onClick={() => {
                    resume();
                    update({});
                  }}
                >
                  Resume
                </button>
              </div>
            ) : (
              <>
                <p class="section-label mb-2">Mute every reminder and alert for a while.</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="chip" onClick={() => { pauseFor(60); update({}); }}>
                    1 hour
                  </button>
                  <button type="button" class="chip" onClick={() => { pauseFor(180); update({}); }}>
                    3 hours
                  </button>
                  <button type="button" class="chip" onClick={() => { pauseUntil(tomorrowAt(8)); update({}); }}>
                    Until tomorrow
                  </button>
                </div>
              </>
            )}
          </div>
        </Section>
      </Page>
    </>
  );
}
