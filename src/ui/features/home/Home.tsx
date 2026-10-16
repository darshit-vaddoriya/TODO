/**
 * Home — a "today" dashboard. At a glance: a greeting and date, counts for
 * what's due / overdue / done, the tasks that need attention today (with
 * inline check-off), and the reminders with their next ping. Pulls tasks and
 * reminders together so the first screen is the one that answers "what now?".
 */
import { useEffect, useState } from 'preact/hooks';
import { everyPhrase, formatDays, localDate, untilPhrase } from '@/domain/dates';
import { nextDueAt, pingsPerDay } from '@/domain/interval-schedule';
import { dueBucket, sortTasks, tabTasks } from '@/domain/task-view';
import type { Reminder, Task } from '@/domain/types';
import { dueLabelFor, formatClock, formatTimeOfDay } from '@/data/display';
import { getPrefs, isPaused, pauseFor, resume, setPrefs } from '@/data/prefs';
import { markDone, snooze, toggle } from '@/data/reminders';
import { permission, requestPermission } from '@/services/notify';
import { dismissInstallBanner, promptInstall, shouldShowInstallBanner } from '@/services/pwa';
import { toast } from '@/services/toast';
import { Checkbox, Empty, Header, Icon, Meter, Nudge, Page, Section, Switch } from '@/ui/components';
import { PRIORITY_COLOR } from '@/ui/shared/priority';
import { useTaskComplete } from '@/ui/shared/useTaskComplete';
import { MissedAlerts } from './MissedAlerts';
import { TodayWidget } from './TodayWidget';
import { useReminders, useNow, useTasks } from '@/ui/hooks';
import { go } from '@/ui/router';

function greeting(now: number, name: string): string {
  const h = new Date(now).getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

function longDate(now: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(now));
}

/** A task on the dashboard: check it off here, or tap through to edit it. */
function TaskLine({ task, today }: { task: Task; today: string }) {
  const { leaving, toggle } = useTaskComplete(task);
  const overdue = !!task.dueDate && task.dueDate < today;
  const when = task.dueDate ? dueLabelFor(task.dueDate, task.dueTime, today) : '';
  return (
    <div class="task-row card flex items-center gap-3 !py-2" data-leaving={leaving}>
      <Checkbox checked={leaving} popping={leaving} label={`Complete ${task.title}`} onChange={toggle} />
      <a href={`#/task/${task.id}`} class="min-w-0 flex-1 py-1">
        <span class="flex items-center gap-1.5">
          <span class="truncate font-semibold">{task.title}</span>
          {task.priority !== 'none' && <Icon name="flag" size={14} class={PRIORITY_COLOR[task.priority]} />}
        </span>
        <span class={`flex items-center gap-1 text-[0.75rem] font-semibold ${overdue ? 'text-accent' : task.dueDate === today ? 'text-brand' : 'text-muted'}`}>
          <Icon name="calendar" size={12} />
          {overdue ? `Overdue · ${when}` : when}
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
                <span class="text-brand">
                  Next {untilPhrase(due - now)}
                  <span class="text-muted"> · {formatTimeOfDay(new Date(due))}</span>
                </span>
              )}
            </span>
          </span>
        </button>
        <Switch
          checked={reminder.enabled}
          onChange={(on) => void toggle(reminder.id, on)}
          label={`Turn ${reminder.title} ${reminder.enabled ? 'off' : 'on'}`}
        />
      </div>
      {reminder.enabled && (
        <div class="mt-2.5 flex items-center gap-3 border-t border-rule pt-2.5">
          <div class="min-w-0 flex-1">
            <Meter ratio={ratio} label={`${reminder.firedToday} of ${target} done today`} />
            <span class="mt-1 block text-[0.75rem] text-muted">
              {reminder.firedToday}
              {target > 0 ? ` / ${target}` : ''} today
            </span>
          </div>
          <button
            type="button"
            class="min-h-9 shrink-0 rounded-full bg-field px-3 text-[0.8125rem] font-bold text-muted"
            onClick={() => void snooze(reminder.id, 10)}
          >
            Snooze
          </button>
          <button
            type="button"
            class="min-h-9 shrink-0 rounded-full bg-brand px-3.5 text-[0.8125rem] font-bold text-on-brand inline-flex items-center gap-1"
            onClick={() => void markDone(reminder.id)}
          >
            <Icon name="check" size={16} /> Did it
          </button>
        </div>
      )}
    </div>
  );
}

const SECTION_LINK = 'flex items-center gap-1 text-[0.8125rem] font-bold text-brand';

export function Home() {
  const reminders = useReminders();
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
  const focus = [...overdue, ...dueToday].slice(0, 5);
  const comingUp = sortTasks(tabTasks(tasks, 'upcoming', today), 'due').slice(0, 3);

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
        title={greeting(now, getPrefs().name)}
        sub={longDate(now)}
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
          <div class="card mb-4 flex items-center gap-3 border border-haldi/50">
            <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-field text-haldi">
              <Icon name="pause" size={19} />
            </span>
            <p class="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug">
              All reminders paused
              <span class="block text-[0.8125rem] font-normal text-muted">Resumes {formatTimeOfDay(new Date(pausedUntil))}</span>
            </p>
            <button
              type="button"
              class="min-h-9 shrink-0 rounded-full bg-brand px-3.5 text-[0.8125rem] font-bold text-on-brand"
              onClick={() => doPause(resume)}
            >
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

        <MissedAlerts now={now} />

        {/* Today widget */}
        {(tasks.length > 0 || reminders.length > 0) && (
          <Section>
            <TodayWidget tasks={tasks} reminders={reminders} today={today} />
          </Section>
        )}

        {focus.length > 0 && (
          <Section
            title="Needs attention"
            action={
              <a href="#/tasks/today" class={SECTION_LINK}>
                All tasks <Icon name="back" size={14} class="rotate-180" />
              </a>
            }
          >
            <div class="space-y-2">
              {focus.map((t) => (
                <TaskLine key={t.id} task={t} today={today} />
              ))}
            </div>
          </Section>
        )}

        {comingUp.length > 0 && (
          <Section
            title="Coming up"
            action={
              <a href="#/tasks/upcoming" class={SECTION_LINK}>
                See all <Icon name="back" size={14} class="rotate-180" />
              </a>
            }
          >
            <div class="space-y-2">
              {comingUp.map((t) => (
                <TaskLine key={t.id} task={t} today={today} />
              ))}
            </div>
          </Section>
        )}

        {/* Repeating (interval) reminders */}
        {reminders.length === 0 && tasks.length === 0 ? (
          <Section>
            <Empty icon="sparkles" title="Nothing here yet" body="Add your first task, or set a gentle repeating reminder — water, eyes, posture.">
              <a href="#/task/new" class="btn btn-primary">
                <Icon name="plus" size={18} /> Add a task
              </a>
              <a href="#/presets" class="btn btn-quiet">
                <Icon name="sparkles" size={18} /> Wellness presets
              </a>
            </Empty>
          </Section>
        ) : (
          <>
            <Section
              title="Reminders"
              action={
                <span class="flex items-center gap-3">
                  {!dnd && upcoming && (
                    <span class="flex items-center gap-1 text-[0.8125rem] font-semibold text-muted">
                      <Icon name="clock" size={14} class="text-brand" /> next {untilPhrase(upcoming.at - now)}
                    </span>
                  )}
                  <a href="#/edit" class={SECTION_LINK}>
                    <Icon name="plus" size={15} /> New
                  </a>
                </span>
              }
            >
              {reminders.length === 0 ? (
                <div class="card text-[0.9375rem] text-muted">
                  Repeating pings for habits like water and eye breaks.{' '}
                  <a href="#/presets" class="font-bold text-brand">
                    Browse presets
                  </a>
                </div>
              ) : (
                <div class="space-y-2.5">
                  {active.map((r) => (
                    <ReminderTile key={r.id} reminder={r} now={now} paused={dnd} />
                  ))}
                </div>
              )}
              {reminders.length > 0 && active.length === 0 && <Empty title="Everything is off" body="Flip a switch below to start a reminder again." />}
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
            {reminders.length > 0 && (
              <Section>
                <a href="#/presets" class="flex items-center justify-center gap-2 text-[0.9375rem] font-bold text-brand">
                  <Icon name="sparkles" size={18} /> Browse wellness presets
                </a>
              </Section>
            )}
          </>
        )}
      </Page>
    </>
  );
}
