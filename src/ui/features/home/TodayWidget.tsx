/**
 * The summary at the top of Home: a gradient hero with the greeting, concentric
 * rings for tasks done and habits (repeating reminders) acknowledged, a plain
 * headline, and what's next. Everything comes from the stores, so it updates as
 * things are ticked off. With nothing set up yet it turns into a welcome card.
 */
import { habitProgress } from '@/domain/interval-schedule';
import { dayProgress, tabTasks } from '@/domain/task-view';
import type { Reminder, Task } from '@/domain/types';
import { formatClock } from '@/data/display';
import { ConcentricRings, Icon } from '@/ui/components';
import { NextAlert } from './NextAlert';

const AMBER = '#ffd479';
const RING_TRACK = 'rgb(255 255 255 / 0.22)';

export interface HeroProps {
  tasks: Task[];
  reminders: Reminder[];
  today: string;
  greeting: string;
  dateLine: string;
  paused: boolean;
}

function Welcome({ greeting, dateLine }: Pick<HeroProps, 'greeting' | 'dateLine'>) {
  return (
    <section class="hero" aria-label="Welcome">
      <p class="text-[0.8125rem] font-semibold opacity-90">{dateLine}</p>
      <h2 class="text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em]">{greeting}</h2>
      <p class="mt-2 max-w-[22rem] text-[0.9375rem] leading-snug opacity-95">
        Plan your day, and let gentle reminders do the remembering — water, eyes, posture and your own tasks.
      </p>
      <div class="mt-4 flex flex-wrap gap-2.5">
        <a href="#/task/new" class="hero-btn">
          <Icon name="plus" size={18} /> Add a task
        </a>
        <a href="#/presets" class="hero-btn hero-btn-quiet">
          <Icon name="sparkles" size={18} /> Presets
        </a>
      </div>
    </section>
  );
}

export function TodayWidget({ tasks, reminders, today, greeting, dateLine, paused }: HeroProps) {
  if (tasks.length === 0 && reminders.length === 0) return <Welcome greeting={greeting} dateLine={dateLine} />;

  const progress = dayProgress(tasks, today);
  const habits = habitProgress(reminders, today);
  const overdue = tabTasks(tasks, 'overdue', today).length;
  const left = progress.total - progress.done;
  const next = [...tabTasks(tasks, 'overdue', today), ...tabTasks(tasks, 'today', today)].sort(
    (a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.dueTime ?? '24:00').localeCompare(b.dueTime ?? '24:00') || a.order - b.order,
  )[0];

  const headline = progress.total === 0 ? 'Nothing planned today' : left <= 0 ? 'All done for today 🎉' : `${left} ${left === 1 ? 'task' : 'tasks'} to go`;
  const rings = [
    { done: progress.done, total: progress.total, color: '#ffffff' },
    ...(habits.target > 0 ? [{ done: habits.done, total: habits.target, color: AMBER }] : []),
  ];
  const summary = `${progress.done} of ${progress.total} tasks done${habits.target > 0 ? `, ${habits.done} of ${habits.target} habits` : ''}`;

  return (
    <section class="hero" aria-label="Today">
      <p class="text-[0.8125rem] font-semibold opacity-90">{dateLine}</p>
      <h2 class="truncate text-[1.375rem] font-extrabold leading-tight tracking-[-0.02em]">{greeting}</h2>

      <div class="mt-3.5 flex items-center gap-4">
        <ConcentricRings rings={rings} size={104} label={summary} track={RING_TRACK}>
          <span>
            <span class="display tnum block text-[1.5rem] font-extrabold leading-none">
              {progress.done}
              <span class="text-[0.875rem] font-bold opacity-80">/{progress.total}</span>
            </span>
            <span class="mt-0.5 block text-[0.625rem] font-bold uppercase tracking-wide opacity-80">tasks</span>
          </span>
        </ConcentricRings>

        <div class="min-w-0 flex-1">
          <p class="text-[1.1875rem] font-extrabold leading-snug tracking-[-0.01em]">{headline}</p>
          {next ? (
            <a href={`#/task/${next.id}`} class="mt-1 flex items-center gap-1.5 text-[0.875rem] font-semibold opacity-95">
              <Icon name="clock" size={15} />
              <span class="min-w-0 truncate">
                {next.dueTime ? `${formatClock(next.dueTime)} · ` : ''}
                {next.title}
              </span>
            </a>
          ) : (
            <p class="mt-1 text-[0.875rem] font-semibold opacity-90">{progress.total === 0 ? 'Add a task to get started.' : 'Enjoy the free time.'}</p>
          )}
        </div>
      </div>

      <NextAlert tasks={tasks} reminders={reminders} />

      <div class="mt-3 flex flex-wrap gap-2">
        {overdue > 0 && (
          <a href="#/tasks/overdue" class="hero-chip">
            <Icon name="alert" size={14} /> {overdue} overdue
          </a>
        )}
        {habits.target > 0 && (
          <span class="hero-chip">
            <span class="size-2 rounded-full bg-[#ffd479]" aria-hidden="true" /> Habits {habits.done}/{habits.target}
          </span>
        )}
        {paused && (
          <span class="hero-chip">
            <Icon name="pause" size={14} /> Reminders paused
          </span>
        )}
      </div>
    </section>
  );
}
