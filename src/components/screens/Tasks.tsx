/**
 * Tasks: a full to-do list. Add tasks with a priority, due date and repeat
 * rule; search, filter by tag, and sort; tasks group into Overdue / Today /
 * Upcoming / No date smart views. Each task expands to edit its details,
 * notes, tags and subtasks.
 */
import { useMemo, useState } from 'preact/hooks';
import { daysBetween, repeatLabel } from '../../lib/task-model';
import {
  addSubtask,
  addTask,
  clearDoneTasks,
  removeSubtask,
  removeTask,
  setTaskDueDate,
  setTaskNotes,
  setTaskPriority,
  setTaskRepeat,
  setTaskTags,
  toggleSubtask,
  toggleTask,
} from '../../lib/tasks';
import { localDate } from '../../lib/format';
import { allTags, buildView, EMPTY_FILTER, SORT_LABELS, type SortKey, type TaskFilter } from '../../lib/task-view';
import type { Priority, RepeatRule, Task, Weekday } from '../../lib/types';
import { useTasks } from '../router';
import { Empty, Header, Icon, Page, Section, Segmented } from '../ui';

// --- Priority presentation -------------------------------------------------

const PRIORITY_META: Record<Priority, { label: string; dot: string; text: string }> = {
  none: { label: 'None', dot: 'bg-rule', text: 'text-muted' },
  low: { label: 'Low', dot: 'bg-teal', text: 'text-teal' },
  medium: { label: 'Medium', dot: 'bg-haldi', text: 'text-haldi' },
  high: { label: 'High', dot: 'bg-accent', text: 'text-accent' },
};
const PRIORITY_OPTS: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

// --- Repeat presentation ---------------------------------------------------

type RepeatChoice = 'none' | 'daily' | 'weekly';
const REPEAT_OPTS: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];
const repeatChoice = (r: RepeatRule): RepeatChoice => (r.kind === 'daily' ? 'daily' : r.kind === 'weekly' ? 'weekly' : 'none');
function buildRepeat(choice: RepeatChoice, dueDate: string | null): RepeatRule {
  if (choice === 'daily') return { kind: 'daily' };
  if (choice === 'weekly') {
    const [y, m, d] = (dueDate ?? localDate()).split('-').map(Number);
    const weekday = new Date(y, (m || 1) - 1, d || 1).getDay() as Weekday;
    return { kind: 'weekly', days: [weekday] };
  }
  return { kind: 'none' };
}

// --- Due-date labels -------------------------------------------------------

function dueLabel(dueDate: string, today: string): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const [y, m, d] = dueDate.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const opts: Intl.DateTimeFormatOptions = y === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

// --- A single task ---------------------------------------------------------

function TaskRow({ task, today }: { task: Task; today: string }) {
  const [open, setOpen] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const pr = PRIORITY_META[task.priority];
  const overdue = task.dueDate && task.dueDate < today && !task.done;
  const subDone = task.subtasks.filter((s) => s.done).length;

  const addSub = async () => {
    await addSubtask(task.id, subTitle);
    setSubTitle('');
  };

  return (
    <div class="card">
      <div class="flex items-center gap-3">
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

        <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {task.priority !== 'none' && <span class={`size-2.5 shrink-0 rounded-full ${pr.dot}`} aria-label={`${pr.label} priority`} />}
          <span class="min-w-0 flex-1">
            <span class={`block truncate font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.75rem] font-semibold leading-tight">
              {task.dueDate && <span class={overdue ? 'text-accent' : 'text-muted'}>{overdue ? 'Overdue · ' : ''}{dueLabel(task.dueDate, today)}</span>}
              {repeatLabel(task.repeat) && <span class="text-teal">{repeatLabel(task.repeat)}</span>}
              {task.subtasks.length > 0 && (
                <span class="text-muted">
                  {subDone}/{task.subtasks.length}
                </span>
              )}
              {task.tags.map((t) => (
                <span key={t} class="text-muted">#{t}</span>
              ))}
              {task.notes && <Icon name="list" size={13} class="text-muted" />}
            </span>
          </span>
        </button>

        <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`${open ? 'Collapse' : 'Edit'} ${task.title}`} onClick={() => setOpen((v) => !v)}>
          <Icon name="chevron-down" size={18} class={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open && (
        <div class="mt-3 space-y-3 border-t border-rule pt-3">
          <div>
            <span class="section-label mb-1.5 block">Priority</span>
            <Segmented label="Priority" options={PRIORITY_OPTS} value={task.priority} onChange={(v) => void setTaskPriority(task.id, v)} />
          </div>

          <div class="flex items-center gap-2">
            <span class="section-label flex-1">Due date</span>
            <input type="date" class="field !min-h-11 !w-auto !py-1.5" value={task.dueDate ?? ''} onInput={(e) => void setTaskDueDate(task.id, e.currentTarget.value || null)} aria-label="Due date" />
            {task.dueDate && (
              <button type="button" class="grid size-9 place-items-center rounded-full text-muted active:bg-field" aria-label="Clear due date" onClick={() => void setTaskDueDate(task.id, null)}>
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          <div>
            <span class="section-label mb-1.5 block">Repeat</span>
            <Segmented label="Repeat" options={REPEAT_OPTS} value={repeatChoice(task.repeat)} onChange={(v) => void setTaskRepeat(task.id, buildRepeat(v, task.dueDate))} />
          </div>

          <label class="block">
            <span class="section-label mb-1.5 block">Notes</span>
            <textarea class="field !min-h-16 resize-y" placeholder="Add details…" value={task.notes} maxLength={500} onInput={(e) => void setTaskNotes(task.id, e.currentTarget.value)} />
          </label>

          <label class="block">
            <span class="section-label mb-1.5 block">Tags</span>
            <input class="field !min-h-11" placeholder="comma, separated" value={task.tags.join(', ')} onInput={(e) => void setTaskTags(task.id, e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean))} aria-label="Tags" />
          </label>

          <div>
            <span class="section-label mb-1.5 block">Subtasks</span>
            <div class="space-y-1.5">
              {task.subtasks.map((s) => (
                <div key={s.id} class="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={`${s.done ? 'Uncheck' : 'Check'} ${s.title}`}
                    class={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${s.done ? 'border-teal bg-teal text-on-teal' : 'border-rule text-transparent'}`}
                    onClick={() => void toggleSubtask(task.id, s.id, !s.done)}
                  >
                    <Icon name="check" size={12} />
                  </button>
                  <span class={`min-w-0 flex-1 truncate text-[0.9375rem] ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                  <button type="button" class="grid size-7 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Delete ${s.title}`} onClick={() => void removeSubtask(task.id, s.id)}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div class="mt-2 flex items-center gap-2">
              <input class="field !min-h-10 flex-1 !py-1.5" placeholder="Add a subtask…" value={subTitle} maxLength={80} onInput={(e) => setSubTitle(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && void addSub()} aria-label="New subtask" />
              <button type="button" class="grid size-10 shrink-0 place-items-center rounded-full bg-field text-teal" onClick={() => void addSub()} disabled={!subTitle.trim()} aria-label="Add subtask">
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>

          <button type="button" class="flex items-center gap-2 text-[0.875rem] font-bold text-accent" onClick={() => void removeTask(task.id)}>
            <Icon name="trash" size={16} /> Delete task
          </button>
        </div>
      )}
    </div>
  );
}

// --- The add form ----------------------------------------------------------

function AddTask() {
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>('none');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState<RepeatChoice>('none');

  const add = async () => {
    if (!title.trim()) return;
    await addTask({ title, priority, dueDate: due || null, repeat: buildRepeat(repeat, due || null) });
    setTitle('');
    setPriority('none');
    setDue('');
    setRepeat('none');
    setOpen(false);
  };

  return (
    <div class="card">
      <div class="flex items-center gap-2">
        <input
          class="field flex-1"
          placeholder="Add a task…"
          value={title}
          maxLength={120}
          onInput={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button type="button" class={`grid size-11 shrink-0 place-items-center rounded-full ${open ? 'bg-teal text-on-teal' : 'bg-field text-muted'}`} aria-label="Task options" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="settings" size={19} />
        </button>
        <button type="button" class="btn btn-primary shrink-0 px-4" onClick={() => void add()} disabled={!title.trim()} aria-label="Add task">
          <Icon name="plus" size={20} />
        </button>
      </div>

      {open && (
        <div class="mt-3 space-y-3 border-t border-rule pt-3">
          <div>
            <span class="section-label mb-1.5 block">Priority</span>
            <Segmented label="Priority" options={PRIORITY_OPTS} value={priority} onChange={setPriority} />
          </div>
          <div class="flex items-center gap-2">
            <span class="section-label flex-1">Due date</span>
            <input type="date" class="field !min-h-11 !w-auto !py-1.5" value={due} onInput={(e) => setDue(e.currentTarget.value)} aria-label="Due date" />
          </div>
          <div>
            <span class="section-label mb-1.5 block">Repeat</span>
            <Segmented label="Repeat" options={REPEAT_OPTS} value={repeat} onChange={setRepeat} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- The screen ------------------------------------------------------------

const SORT_OPTS = (Object.keys(SORT_LABELS) as SortKey[]).map((value) => ({ value, label: SORT_LABELS[value] }));

export function Tasks() {
  const tasks = useTasks();
  const today = localDate();
  const [sort, setSort] = useState<SortKey>('manual');
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);

  const tags = useMemo(() => allTags(tasks), [tasks]);
  const view = useMemo(() => buildView(tasks, filter, sort, today), [tasks, filter, sort, today]);

  const activeCount = view.groups.reduce((n, g) => n + g.tasks.length, 0);
  const sub = tasks.length > 0 ? `${view.done.length} of ${tasks.length} done` : undefined;
  const filtering = filter.search.trim() !== '' || filter.tag !== null || filter.priority !== null;

  return (
    <>
      <Header title="Tasks" sub={sub} />
      <Page>
        <Section>
          <AddTask />
        </Section>

        {tasks.length === 0 ? (
          <Section>
            <Empty title="No tasks yet" body="Add something to do. Open the options to set a priority, due date, or make it repeat." />
          </Section>
        ) : (
          <>
            <Section>
              <div class="card space-y-3">
                <div class="flex items-center gap-2">
                  <Icon name="search" size={18} class="text-muted" />
                  <input class="min-h-10 w-full bg-transparent font-semibold outline-none" placeholder="Search tasks…" value={filter.search} onInput={(e) => setFilter((f) => ({ ...f, search: e.currentTarget.value }))} aria-label="Search tasks" />
                  {filter.search && (
                    <button type="button" class="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label="Clear search" onClick={() => setFilter((f) => ({ ...f, search: '' }))}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
                <Segmented label="Sort tasks" options={SORT_OPTS} value={sort} onChange={setSort} />
                {tags.length > 0 && (
                  <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
                    <button type="button" class="chip" aria-pressed={filter.tag === null} onClick={() => setFilter((f) => ({ ...f, tag: null }))}>
                      All
                    </button>
                    {tags.map((t) => (
                      <button key={t} type="button" class="chip" aria-pressed={filter.tag === t} onClick={() => setFilter((f) => ({ ...f, tag: f.tag === t ? null : t }))}>
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {activeCount === 0 && (
              <Section>
                <Empty title={filtering ? 'No matches' : 'All done for now 🎉'} body={filtering ? 'Try a different search or filter.' : 'Everything on your list is checked off.'} />
              </Section>
            )}

            {view.groups.map((g) => (
              <Section key={g.key} title={`${g.title} (${g.tasks.length})`}>
                <div class="space-y-2.5">
                  {g.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </div>
              </Section>
            ))}

            {view.done.length > 0 && (
              <Section
                title={`Done (${view.done.length})`}
                action={
                  <button type="button" class="text-[0.875rem] font-bold text-muted" onClick={() => void clearDoneTasks()}>
                    Clear
                  </button>
                }
              >
                <div class="space-y-2.5">
                  {view.done.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
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
