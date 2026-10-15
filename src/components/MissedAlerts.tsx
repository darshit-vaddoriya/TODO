/**
 * "Missed reminders" — alerts that came due while Yaad wasn't running (or while
 * Do Not Disturb / quiet hours were on). Shown in the app on reopening instead
 * of a flood of late notifications. Dismissing records the alert as delivered so
 * it never returns; completing the task clears it too.
 */
import { planAlerts, type TaskAlert } from '../lib/alerts';
import { dueLabelFor } from '../lib/format';
import { alertSettings } from '../lib/scheduler';
import { completeTaskById, recordAlerts } from '../lib/tasks';
import type { Task } from '../lib/types';
import { go, useTasks } from './router';
import { Icon } from './ui';

interface Missed {
  task: Task;
  alerts: TaskAlert[];
}

/** Dismiss every missed alert of a task (and clear an elapsed snooze). */
function dismiss(m: Missed): Promise<void> {
  return recordAlerts(m.task.id, { fired: m.alerts.map((a) => a.key), clearSnooze: m.alerts.some((a) => a.kind === 'snoozed') });
}

export function MissedAlerts({ now }: { now: number }) {
  const tasks = useTasks();
  const plan = planAlerts(tasks, now, alertSettings());

  // One row per task, however many of its reminders were missed.
  const byTask = new Map<string, Missed>();
  for (const alert of plan.missed) {
    const task = tasks.find((t) => t.id === alert.taskId);
    if (!task) continue;
    const row = byTask.get(task.id) ?? { task, alerts: [] };
    row.alerts.push(alert);
    byTask.set(task.id, row);
  }
  const rows = [...byTask.values()];
  if (rows.length === 0) return null;

  return (
    <section class="card mb-4 border border-haldi/40" aria-label="Missed reminders">
      <div class="flex items-center gap-2">
        <Icon name="bell-off" size={19} class="text-haldi" />
        <h2 class="min-w-0 flex-1 font-extrabold tracking-[-0.01em]">
          Missed {rows.length === 1 ? 'reminder' : `reminders (${rows.length})`}
        </h2>
        {rows.length > 1 && (
          <button type="button" class="text-[0.8125rem] font-bold text-muted" onClick={() => void Promise.all(rows.map(dismiss))}>
            Dismiss all
          </button>
        )}
      </div>
      <p class="mt-0.5 text-[0.8125rem] text-muted">These came due while Yaad wasn’t running.</p>
      <ul class="mt-2 divide-y divide-[var(--rule)]">
        {rows.map((m) => (
          <li key={m.task.id} class="flex items-center gap-2 py-2.5">
            <button type="button" class="min-w-0 flex-1 text-left" onClick={() => go(`/task/${m.task.id}`)}>
              <span class="block truncate font-semibold">{m.task.title}</span>
              <span class="block text-[0.75rem] font-semibold text-haldi">{m.task.dueDate ? `Due ${dueLabelFor(m.task.dueDate, m.task.dueTime)}` : 'Reminder'}</span>
            </button>
            <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-3.5 text-[0.8125rem] font-bold text-on-teal" onClick={() => void completeTaskById(m.task.id)}>
              Done
            </button>
            <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Dismiss ${m.task.title}`} onClick={() => void dismiss(m)}>
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
