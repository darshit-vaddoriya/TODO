/**
 * Home — a "today" dashboard. At a glance: a greeting and date, counts for
 * what's due / overdue / done, the tasks that need attention today (with
 * inline check-off), and the reminders with their next ping. Pulls tasks and
 * reminders together so the first screen is the one that answers "what now?".
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { everyPhrase, formatClock, formatDays, formatTimeOfDay, localDate, untilPhrase } from '../../lib/format';
import { permission, requestPermission } from '../../lib/notify';
import { getPrefs, isPaused, pauseFor, resume, setPrefs } from '../../lib/prefs';
import { dismissInstallBanner, promptInstall, shouldShowInstallBanner } from '../../lib/pwa';
import { nextDueAt, pingsPerDay } from '../../lib/schedule';
import { markDone, snooze, toggle } from '../../lib/store';
import { dueBucket } from '../../lib/task-view';
import { toggleTask } from '../../lib/tasks';
import { toast } from '../../lib/toast';
import type { Priority, Reminder, Task } from '../../lib/types';
import { go, useData, useNow, useTasks } from '../router';
import { Empty, Header, Icon, Meter, Nudge, Page, Section, Switch } from '../ui';

const PRIORITY_DOT: Record<Priority, string> = { none: '', low: 'bg-teal', medium: 'bg-haldi', high: 'bg-accent' };

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(now: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(now));
}

/** A compact at-a-glance count tile; tappable when `href` is given. */
function Stat({ value, label, tone, href }: { value: number; label: string; tone: string; href?: string }) {
  const inner = (
    <>
      <span class={`display text-[1.75rem] leading-none tnum ${value > 0 ? tone : 'text-muted'}`}>{value}</span>
      <span class="mt-1 block text-[0.75rem] font-semibold leading-tight text-muted">{label}</span>
    </>
  );
  const cls = 'card flex-1 min-w-0 px-3 py-3 text-center';
  return href ? (
    <a href={href} class={cls}>
      {inner}
    </a>
  ) : (
    <div class={cls}>{inner}</div>
  );
}

/** A task line on the dashboard: check it off here, or tap through to the Tasks screen. */
function TaskLine({ task, today }: { task: Task; today: string }) {
  const overdue = !!task.dueDate && task.dueDate < today;
  return (
    <div class="card flex items-center gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`Complete ${task.title}`}
        class="grid size-7 shrink-0 place-items-center rounded-full border-2 border-rule text-transparent transition-colors active:border-teal"
        onClick={() => void toggleTask(task.id, true)}
      >
        <Icon name="check" size={16} />
      </button>
      <a href="#/tasks" class="flex min-w-0 flex-1 items-center gap-2">
        {task.priority !== 'none' && <span class={`size-2.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden="true" />}
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{task.title}</span>
          <span class={`block text-[0.75rem] font-semibold ${overdue ? 'text-accent' : 'text-teal'}`}>{overdue ? 'Overdue' : 'Due today'}</span>
        </span>
      </a>
    </div>
  );
}

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

const SECTION_LINK = 'flex items-center gap-1 text-[0.8125rem] font-bold text-teal';

export function Home() {
  const reminders = useData();
  const tasks = useTasks();
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

  const today = localDate(new Date(now));
  const active = reminders.filter((r) => r.enabled);
  const off = reminders.filter((r) => !r.enabled);
  const needsPermission = perm !== 'granted' && reminders.length > 0 && !getPrefs().notifyAsked;

  const dnd = isPaused(now);
  const pausedUntil = getPrefs().pausedUntil;

  // Task counts and the "focus" list (overdue first, then due today).
  const openTasks = tasks.filter((t) => !t.done);
  const overdue = openTasks.filter((t) => dueBucket(t, today) === 'overdue');
  const dueToday = openTasks.filter((t) => dueBucket(t, today) === 'today');
  const focus = [...overdue, ...dueToday].slice(0, 6);
  const doneToday = tasks.filter((t) => t.done && t.doneDate === today).length;

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

  const sectionTitle = (title: string, link?: ComponentChildren) => (link ? { title, action: link } : { title });

  return (
    <>
      <Header
        title="Yaad"
        sub={`${greeting(now)} · ${longDate(now)}`}
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

        {/* At-a-glance counts */}
        {(tasks.length > 0 || reminders.length > 0) && (
          <Section>
            <div class="flex gap-2.5">
              <Stat value={dueToday.length} label="Due today" tone="text-teal" href="#/tasks" />
              <Stat value={overdue.length} label="Overdue" tone="text-accent" href="#/tasks" />
              <Stat value={doneToday} label="Done today" tone="text-teal" />
              <Stat value={dnd ? 0 : active.length} label="Reminders on" tone="text-ink" />
            </div>
          </Section>
        )}

        {/* Today's focus tasks */}
        {focus.length > 0 && (
          <Section
            {...sectionTitle(
              'Needs attention',
              <a href="#/tasks" class={SECTION_LINK}>
                All tasks <Icon name="back" size={14} class="rotate-180" />
              </a>,
            )}
          >
            <div class="space-y-2.5">
              {focus.map((t) => (
                <TaskLine key={t.id} task={t} today={today} />
              ))}
            </div>
          </Section>
        )}
        {tasks.length > 0 && focus.length === 0 && (
          <Section {...sectionTitle('Tasks', <a href="#/tasks" class={SECTION_LINK}>All tasks <Icon name="back" size={14} class="rotate-180" /></a>)}>
            <div class="card flex items-center gap-3 py-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-field text-teal">
                <Icon name="check" size={19} />
              </span>
              <p class="text-[0.9375rem] font-semibold">Nothing due today — you're all caught up. 🎉</p>
            </div>
          </Section>
        )}

        {/* Reminders */}
        {reminders.length === 0 && tasks.length === 0 ? (
          <Section>
            <Empty title="Nothing here yet" body="Add a gentle wellness reminder, or jump to Tasks to plan your day.">
              <a href="#/presets" class="btn btn-primary">
                <Icon name="sparkles" size={18} /> Wellness presets
              </a>
              <a href="#/tasks" class="btn btn-quiet">
                Add a task
              </a>
            </Empty>
          </Section>
        ) : (
          reminders.length > 0 && (
            <>
              <Section
                {...sectionTitle(
                  'Reminders',
                  !dnd && upcoming ? (
                    <span class="flex items-center gap-1 text-[0.8125rem] font-semibold text-muted">
                      <Icon name="clock" size={14} class="text-teal" /> next {untilPhrase(upcoming.at - now)}
                    </span>
                  ) : undefined,
                )}
              >
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
          )
        )}
      </Page>
    </>
  );
}
