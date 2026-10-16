/**
 * The "Today" widget at the top of Home: concentric rings for tasks done and
 * habits (repeating reminders) acknowledged, with the numbers beside them and a
 * way into the overdue list. Everything it shows comes from the stores, so it
 * updates as you tick things off.
 */
import { habitProgress } from '@/domain/interval-schedule';
import { dayProgress, tabTasks } from '@/domain/task-view';
import type { Reminder, Task } from '@/domain/types';
import { ConcentricRings, Icon } from '@/ui/components';

export function TodayWidget({ tasks, reminders, today }: { tasks: Task[]; reminders: Reminder[]; today: string }) {
  const progress = dayProgress(tasks, today);
  const habits = habitProgress(reminders, today);
  const overdue = tabTasks(tasks, 'overdue', today).length;
  const left = progress.total - progress.done;

  const headline = progress.total === 0 ? 'Nothing planned' : left <= 0 ? 'All done 🎉' : `${left} ${left === 1 ? 'task' : 'tasks'} to go`;
  const rings = [
    { done: progress.done, total: progress.total, color: 'var(--teal)' },
    ...(habits.target > 0 ? [{ done: habits.done, total: habits.target, color: 'var(--info)' }] : []),
  ];
  const summary = `${progress.done} of ${progress.total} tasks done${habits.target > 0 ? `, ${habits.done} of ${habits.target} habits` : ''}`;

  return (
    <section class="card" aria-label="Today">
      <div class="flex items-center gap-4">
        <ConcentricRings rings={rings} label={summary}>
          <span>
            <span class="display tnum block text-[1.5rem] leading-none">
              {progress.done}
              <span class="text-[0.875rem] font-bold text-muted">/{progress.total}</span>
            </span>
            <span class="mt-0.5 block text-[0.625rem] font-bold uppercase tracking-wide text-muted">tasks</span>
          </span>
        </ConcentricRings>

        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[0.75rem] font-bold uppercase tracking-wide text-muted">Today</p>
            <a href="#/tasks/today" class="flex items-center gap-0.5 text-[0.8125rem] font-bold text-teal">
              Open <Icon name="back" size={14} class="rotate-180" />
            </a>
          </div>
          <p class="text-[1.125rem] font-extrabold leading-snug tracking-[-0.01em]">{headline}</p>

          <ul class="mt-2 space-y-1 text-[0.875rem] font-semibold">
            <li class="flex items-center gap-2">
              <span class="size-2.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              Tasks
              <span class="tnum ml-auto text-muted">
                {progress.done} of {progress.total}
              </span>
            </li>
            {habits.target > 0 && (
              <li class="flex items-center gap-2">
                <span class="size-2.5 shrink-0 rounded-full bg-info" aria-hidden="true" />
                Habits
                <span class="tnum ml-auto text-muted">
                  {habits.done} of {habits.target}
                </span>
              </li>
            )}
            {overdue > 0 && (
              <li>
                <a href="#/tasks/overdue" class="flex items-center gap-2 font-bold text-accent">
                  <Icon name="alert" size={14} />
                  {overdue} overdue
                  <Icon name="back" size={14} class="ml-auto rotate-180" />
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
