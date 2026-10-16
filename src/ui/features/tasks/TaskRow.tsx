import type { ComponentChildren } from 'preact';
import { repeatLabel } from '@/domain/task-model';
import { isUrgent } from '@/domain/task-view';
import type { Category, Task } from '@/domain/types';
import { formatClock, friendlyDate } from '@/data/display';
import { Checkbox, Icon, SwipeRow } from '@/ui/components';
import { go } from '@/ui/router';
import { PRIORITY_COLOR, PRIORITY_LABEL } from '@/ui/shared/priority';
import { completeWithUndo, deleteWithUndo } from '@/ui/shared/taskActions';
import { useTaskComplete } from '@/ui/shared/useTaskComplete';

/** "Today, 5:30 PM" / "Tomorrow" / "06/20/2026, 09:00" for a due date and optional time. */
function dueText(task: Task, today: string): string {
  const day = friendlyDate(task.dueDate as string, today);
  return task.dueTime ? `${day}, ${formatClock(task.dueTime)}` : day;
}

/** One task: check it off, tap to edit, swipe to complete or delete (or drag when a handle is given). */
export function TaskRow({ task, today, categories, handle }: { task: Task; today: string; categories: Category[]; handle?: ComponentChildren }) {
  const { leaving, toggle } = useTaskComplete(task);
  const overdue = !!task.dueDate && task.dueDate < today;
  const urgent = isUrgent(task, today);
  const subDone = task.subtasks.filter((s) => s.done).length;
  const category = task.categoryId ? categories.find((p) => p.id === task.categoryId)?.name : undefined;
  const repeat = repeatLabel(task.repeat);
  const dueClass = overdue ? 'text-accent' : task.dueDate === today ? 'text-brand' : 'text-muted';

  const body = (
    <div class="relative flex items-center gap-3 bg-surface py-2 pl-4 pr-3">
      {urgent && <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />}
      {handle}
      <Checkbox checked={task.done || leaving} popping={leaving} label={`${task.done ? 'Uncheck' : 'Complete'} ${task.title}`} onChange={toggle} />
      <button type="button" class="min-w-0 flex-1 py-1 text-left" onClick={() => go(`/task/${task.id}`)}>
        <span class="flex items-center gap-1.5">
          <span class={`truncate font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</span>
          {task.priority !== 'none' && (
            <>
              <Icon name="flag" size={14} class={PRIORITY_COLOR[task.priority]} />
              <span class="sr-only">{PRIORITY_LABEL[task.priority]}</span>
            </>
          )}
        </span>
        <span class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.75rem] font-semibold leading-tight text-muted">
          {task.dueDate && (
            <span class={`flex items-center gap-1 ${dueClass}`}>
              <Icon name="calendar" size={12} />
              {overdue ? 'Overdue · ' : ''}
              {dueText(task, today)}
            </span>
          )}
          {task.reminders.length > 0 && (
            <span class="flex items-center">
              <Icon name="bell" size={12} />
              <span class="sr-only">Has a reminder</span>
            </span>
          )}
          {repeat && (
            <span class="flex items-center gap-1 text-brand">
              <Icon name="repeat" size={12} /> {repeat}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span class="flex items-center gap-1">
              <Icon name="check" size={12} /> {subDone}/{task.subtasks.length}
            </span>
          )}
          {category && (
            <span class="flex items-center gap-1">
              <Icon name="tag" size={12} /> {category}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </span>
      </button>
    </div>
  );

  return (
    <div class="task-row overflow-hidden rounded-[16px] bg-surface shadow-[var(--lift)]" data-leaving={leaving}>
      {handle || task.done ? (
        body
      ) : (
        <SwipeRow onSwipeRight={() => void completeWithUndo(task)} onSwipeLeft={() => deleteWithUndo(task)}>
          {body}
        </SwipeRow>
      )}
    </div>
  );
}

export function TaskList({ tasks, today, categories }: { tasks: Task[]; today: string; categories: Category[] }) {
  return (
    <div class="space-y-2.5">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} categories={categories} />
      ))}
    </div>
  );
}
