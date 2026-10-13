/** Daily to-do list: add tasks (one-off or repeating daily), check them off. */
import { useState } from 'preact/hooks';
import { addTask, clearDoneTasks, removeTask, toggleTask } from '../../lib/tasks';
import type { Task } from '../../lib/types';
import { useTasks } from '../router';
import { Empty, Header, Icon, Page, Section } from '../ui';

function TaskRow({ task }: { task: Task }) {
  return (
    <div class="card flex items-center gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.done ? 'Uncheck' : 'Check'} ${task.title}`}
        class={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${task.done ? 'border-teal bg-teal text-on-teal' : 'border-rule text-transparent'}`}
        onClick={() => void toggleTask(task.id, !task.done)}
      >
        <Icon name="check" size={16} />
      </button>
      <span class="min-w-0 flex-1">
        <span class={`block truncate font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</span>
        {task.daily && <span class="block text-[0.75rem] font-semibold text-teal">Every day</span>}
      </span>
      <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Delete ${task.title}`} onClick={() => void removeTask(task.id)}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  );
}

export function Tasks() {
  const tasks = useTasks();
  const [title, setTitle] = useState('');
  const [daily, setDaily] = useState(false);

  const add = async () => {
    await addTask(title, daily);
    setTitle('');
  };

  const todo = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const doneCount = done.length;

  return (
    <>
      <Header title="Tasks" sub={tasks.length > 0 ? `${doneCount} of ${tasks.length} done` : undefined} />
      <Page>
        <Section>
          <div class="card">
            <div class="flex items-center gap-2">
              <input
                class="field flex-1"
                placeholder="Add a task…"
                value={title}
                maxLength={80}
                onInput={(e) => setTitle(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && void add()}
              />
              <button type="button" class="btn btn-primary shrink-0 px-4" onClick={() => void add()} disabled={!title.trim()} aria-label="Add task">
                <Icon name="plus" size={20} />
              </button>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={daily}
              class="mt-2.5 flex items-center gap-2 text-[0.8125rem] font-semibold text-muted"
              onClick={() => setDaily((v) => !v)}
            >
              <span class={`grid size-5 place-items-center rounded-md border-2 ${daily ? 'border-teal bg-teal text-on-teal' : 'border-rule text-transparent'}`}>
                <Icon name="check" size={13} />
              </span>
              Repeat every day
            </button>
          </div>
        </Section>

        {tasks.length === 0 ? (
          <Section>
            <Empty title="No tasks yet" body="Add something to do today. Turn on “Repeat every day” for habits that come back each morning." />
          </Section>
        ) : (
          <>
            <Section title={`To do (${todo.length})`}>
              {todo.length === 0 ? (
                <Empty title="All done for now 🎉" body="Everything on your list is checked off." />
              ) : (
                <div class="space-y-2.5">
                  {todo.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              )}
            </Section>
            {done.length > 0 && (
              <Section title={`Done (${done.length})`} action={<button type="button" class="text-[0.875rem] font-bold text-muted" onClick={() => void clearDoneTasks()}>Clear</button>}>
                <div class="space-y-2.5">
                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Page>
    </>
  );
}
