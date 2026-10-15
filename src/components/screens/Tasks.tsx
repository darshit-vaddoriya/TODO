/**
 * Tasks: Today · Upcoming · All · Overdue · Completed. A quick-add box that
 * understands plain language, search, sort and filters (category, tag,
 * priority), swipe to complete or delete (with Undo), drag to reorder in the
 * manual All view, and a completed-task history. Tap a task to edit it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { parseQuickAdd } from '../../lib/quick-parse';
import { formatClock, friendlyDate, localDate } from '../../lib/format';
import { clearDoneTasks, addTask, reorderTasks } from '../../lib/tasks';
import { repeatLabel } from '../../lib/task-model';
import {
  allTags,
  buildView,
  completedHistory,
  dayProgress,
  EMPTY_FILTER,
  groupByDate,
  isUrgent,
  matchesFilter,
  SORT_LABELS,
  sortTasks,
  tabCounts,
  tabTasks,
  TASK_TABS,
  type SortKey,
  type TaskFilter,
  type TaskTab,
} from '../../lib/task-view';
import { getPrefs } from '../../lib/prefs';
import type { Priority, Project, Task } from '../../lib/types';
import { completeWithUndo, deleteWithUndo, setDoneWithUndo } from '../taskActions';
import { go, useProjects, useTasks } from '../router';
import { Empty, Header, Icon, Meter, Page, ReorderList, Section, Segmented, SwipeRow } from '../ui';

const PRIORITY_DOT: Record<Priority, string> = { none: '', low: 'bg-teal', medium: 'bg-haldi', high: 'bg-accent' };
const PRIORITY_LABEL: Record<Priority, string> = { none: 'No priority', low: 'Low priority', medium: 'Medium priority', high: 'High priority' };
const PRIORITY_CHIPS: { value: Priority | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const SORT_OPTS = (Object.keys(SORT_LABELS) as SortKey[]).map((value) => ({ value, label: SORT_LABELS[value] }));

/** "Today, 5:30 PM" / "Tomorrow" / "06/20/2026, 09:00" for a due date and optional time. */
function dueText(task: Task, today: string): string {
  const day = friendlyDate(task.dueDate as string, today);
  return task.dueTime ? `${day}, ${formatClock(task.dueTime)}` : day;
}

// --- One task row -----------------------------------------------------------------

function TaskRow({ task, today, projects, handle }: { task: Task; today: string; projects: Project[]; handle?: ComponentChildren }) {
  const overdue = !!task.dueDate && task.dueDate < today;
  const urgent = isUrgent(task, today);
  const subDone = task.subtasks.filter((s) => s.done).length;
  const category = task.projectId ? projects.find((p) => p.id === task.projectId)?.name : undefined;
  const repeat = repeatLabel(task.repeat);

  const body = (
    <div class="relative flex items-center gap-3 bg-surface px-4 py-3.5">
      {urgent && <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />}
      {handle}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.done ? 'Uncheck' : 'Complete'} ${task.title}`}
        class={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${task.done ? 'border-teal bg-teal text-on-teal' : 'border-rule text-transparent'}`}
        onClick={() => void setDoneWithUndo(task, !task.done)}
      >
        <Icon name="check" size={16} />
      </button>
      <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => go(`/task/${task.id}`)}>
        {task.priority !== 'none' && <span class={`size-2.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} role="img" aria-label={PRIORITY_LABEL[task.priority]} />}
        <span class="min-w-0 flex-1">
          <span class={`block truncate font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</span>
          <span class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.75rem] font-semibold leading-tight">
            {task.dueDate && (
              <span class={overdue ? 'text-accent' : 'text-muted'}>
                {overdue ? 'Overdue · ' : ''}
                {dueText(task, today)}
              </span>
            )}
            {task.reminders.length > 0 && <Icon name="bell" size={12} class="text-muted" />}
            {repeat && (
              <span class="flex items-center gap-1 text-teal">
                <Icon name="repeat" size={12} /> {repeat}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span class="text-muted">
                {subDone}/{task.subtasks.length}
              </span>
            )}
            {category && <span class="text-muted">{category}</span>}
            {task.tags.map((t) => (
              <span key={t} class="text-muted">
                #{t}
              </span>
            ))}
          </span>
        </span>
      </button>
    </div>
  );

  return (
    <div class="overflow-hidden rounded-[16px] bg-surface">
      {handle || task.done ? body : <SwipeRow onSwipeRight={() => void completeWithUndo(task)} onSwipeLeft={() => deleteWithUndo(task)}>{body}</SwipeRow>}
    </div>
  );
}

function TaskList({ tasks, today, projects }: { tasks: Task[]; today: string; projects: Project[] }) {
  return (
    <div class="space-y-2.5">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} projects={projects} />
      ))}
    </div>
  );
}

// --- Quick add --------------------------------------------------------------------

/** A line of plain language → a task; shows what it understood as you type. */
function QuickAdd({ tab, categoryId }: { tab: TaskTab; categoryId: string | null }) {
  const [text, setText] = useState('');
  const today = localDate();
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const dueDate = parsed.dueDate ?? (tab === 'today' ? today : null);
  const priority = parsed.priority !== 'none' ? parsed.priority : getPrefs().defaultPriority;
  const repeat = repeatLabel(parsed.repeat);

  const add = async () => {
    if (!parsed.title) return;
    await addTask({
      title: parsed.title,
      dueDate,
      dueTime: parsed.dueTime,
      priority,
      tags: parsed.tags,
      repeat: parsed.repeat,
      projectId: categoryId,
      // A time you typed is a time you want to be told about.
      reminderOffsets: parsed.dueTime ? [0] : [],
    });
    setText('');
  };

  const chips = [
    dueDate && `${friendlyDate(dueDate, today)}${parsed.dueTime ? `, ${formatClock(parsed.dueTime)}` : ''}`,
    repeat,
    parsed.priority !== 'none' && `${parsed.priority} priority`,
    ...parsed.tags.map((t) => `#${t}`),
  ].filter(Boolean) as string[];

  return (
    <div class="card">
      <div class="flex items-center gap-2">
        <input
          id="quick-add"
          class="field flex-1"
          placeholder="Add a task… e.g. Call mom 6pm"
          aria-label="Quick add task"
          value={text}
          maxLength={160}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button type="button" class="btn btn-primary shrink-0 px-4" onClick={() => void add()} disabled={!parsed.title} aria-label="Add task">
          <Icon name="plus" size={20} />
        </button>
      </div>
      {text.trim() && chips.length > 0 && (
        <p class="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
          {chips.map((c) => (
            <span key={c} class="rounded-full bg-field px-2.5 py-1 text-[0.75rem] font-semibold text-teal">
              {c}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// --- Dates for headings ---------------------------------------------------------------

function dayHeading(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(y, m - 1, d));
  const rel = friendlyDate(date, today);
  return rel === 'Today' || rel === 'Tomorrow' || rel === 'Yesterday' ? `${rel} · ${weekday}` : `${weekday} · ${rel}`;
}

/** `#/tasks/all?cat=<id|none>` → the category filter it names (undefined if it names none that exists). */
function categoryFromLink(cat: string | undefined, projects: Project[]): TaskFilter['project'] | undefined {
  if (cat === 'none') return 'none';
  return cat && projects.some((p) => p.id === cat) ? cat : undefined;
}

// --- The screen ---------------------------------------------------------------------

export function Tasks({ view, cat }: { view: TaskTab; cat?: string }) {
  const tasks = useTasks();
  const projects = useProjects();
  const today = localDate();
  const [sortOverride, setSortOverride] = useState<SortKey | null>(null);
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_FILTER, project: categoryFromLink(cat, projects) ?? 'all' });
  const [showFilters, setShowFilters] = useState(false);

  // Follow a category link (#/tasks/all?cat=…) when it changes while the screen is open.
  useEffect(() => {
    setFilter((f) => ({ ...f, project: categoryFromLink(cat, projects) ?? f.project }));
  }, [cat]);

  const sort: SortKey = sortOverride ?? (view === 'all' ? 'manual' : 'due');
  const tags = useMemo(() => allTags(tasks), [tasks]);
  const counts = useMemo(() => tabCounts(tasks, today), [tasks, today]);
  const progress = dayProgress(tasks, today);
  const currentCategory = filter.project !== 'all' && filter.project !== 'none' ? filter.project : null;
  const filtering = filter.search.trim() !== '' || filter.tag !== null || filter.priority !== null || filter.project !== 'all';

  // Open tasks for this tab, filtered then sorted.
  const open = useMemo(() => sortTasks(tabTasks(tasks, view, today).filter((t) => matchesFilter(t, filter)), sort), [tasks, view, today, filter, sort]);
  const history = useMemo(() => (view === 'done' ? completedHistory(tasks.filter((t) => matchesFilter(t, filter))) : []), [tasks, view, filter]);
  const allView = useMemo(() => (view === 'all' ? buildView(tasks, filter, sort, today) : null), [tasks, view, filter, sort, today]);
  const reorderable = view === 'all' && sort === 'manual' && !filtering && open.length > 1;

  // Keyboard shortcuts (desktop): "n" to add, "/" to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const focus = (id: string) => {
        const node = document.getElementById(id);
        if (node) {
          e.preventDefault();
          node.focus();
        }
      };
      if (e.key === '/') focus('task-search');
      else if (e.key.toLowerCase() === 'n') focus('quick-add');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const emptyCopy: Record<TaskTab, { title: string; body: string }> = {
    today: { title: 'Nothing due today', body: 'Add a task above, or enjoy the free day.' },
    upcoming: { title: 'Nothing coming up', body: 'Tasks with a future date show here.' },
    all: { title: 'No tasks yet', body: 'Type a task above — try “Pay rent tomorrow 6pm !high #home”.' },
    overdue: { title: 'Nothing overdue 🎉', body: 'You’re all caught up.' },
    done: { title: 'No completed tasks yet', body: 'Tasks you complete show up here as a history.' },
  };
  const empty = filtering ? { title: 'No matches', body: 'Try a different search or filter.' } : emptyCopy[view];

  const taskContent = () => {
    if (view === 'done') {
      if (history.length === 0) return <Empty {...empty} />;
      const byDate = new Map<string, typeof history>();
      for (const e of history) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
      return [...byDate].map(([date, entries]) => (
        <Section key={date} title={dayHeading(date, today)}>
          <div class="space-y-2">
            {entries.map((e) => (
              <div key={`${e.task.id}:${date}`} class="card flex items-center gap-3 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={e.task.done}
                  aria-label={e.task.done ? `Re-open ${e.task.title}` : `${e.task.title} completed`}
                  disabled={!e.task.done}
                  class="grid size-6 shrink-0 place-items-center rounded-full border-2 border-teal bg-teal text-on-teal"
                  onClick={() => void setDoneWithUndo(e.task, false)}
                >
                  <Icon name="check" size={14} />
                </button>
                <button type="button" class="min-w-0 flex-1 text-left" onClick={() => go(`/task/${e.task.id}`)}>
                  <span class="block truncate font-semibold text-muted line-through">{e.task.title}</span>
                  {repeatLabel(e.task.repeat) && (
                    <span class="flex items-center gap-1 text-[0.75rem] font-semibold text-teal">
                      <Icon name="repeat" size={12} /> {repeatLabel(e.task.repeat)}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </Section>
      ));
    }
    if (view === 'upcoming') {
      if (open.length === 0) return <Empty {...empty} />;
      return groupByDate(open).map((g) => (
        <Section key={g.date} title={dayHeading(g.date, today)}>
          <TaskList tasks={g.tasks} today={today} projects={projects} />
        </Section>
      ));
    }
    if (view === 'all' && allView) {
      if (open.length === 0) return <Empty {...empty} />;
      if (reorderable) {
        return (
          <Section title={`Open (${open.length})`} action={<span class="text-[0.8125rem] font-semibold text-muted">Drag to reorder</span>}>
            <ReorderList
              items={open}
              onReorder={(ids) => void reorderTasks(ids)}
              render={(t, handle) => (
                <TaskRow
                  task={t}
                  today={today}
                  projects={projects}
                  handle={
                    <button type="button" class="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted active:bg-field" {...handle}>
                      <Icon name="grip" size={18} />
                    </button>
                  }
                />
              )}
            />
          </Section>
        );
      }
      return allView.groups.map((g) => (
        <Section key={g.key} title={`${g.title} (${g.tasks.length})`}>
          <TaskList tasks={g.tasks} today={today} projects={projects} />
        </Section>
      ));
    }
    if (open.length === 0) return <Empty {...empty} />;
    return <TaskList tasks={open} today={today} projects={projects} />;
  };

  return (
    <>
      <Header
        title="Tasks"
        sub={progress.total > 0 ? `${progress.done} of ${progress.total} done today` : undefined}
        actions={
          <a href="#/settings" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Settings">
            <Icon name="settings" size={22} />
          </a>
        }
      />
      <Page>
        <Section>
          <QuickAdd tab={view} categoryId={currentCategory} />
        </Section>

        <div class="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Task views">
          {TASK_TABS.map((t) => {
            const count = t.id === 'done' ? 0 : counts[t.id];
            return (
              <a key={t.id} href={`#/tasks/${t.id}`} role="tab" aria-selected={view === t.id} class="chip shrink-0 !min-h-10 !px-3.5 text-[0.9375rem]" aria-pressed={view === t.id}>
                {t.label}
                {count > 0 && (
                  <span class={`rounded-full px-1.5 text-[0.75rem] tnum ${t.id === 'overdue' && view !== t.id ? 'bg-accent text-on-accent' : 'bg-black/10'}`}>{count}</span>
                )}
              </a>
            );
          })}
        </div>

        {view === 'today' && progress.total > 0 && (
          <div class="card mb-3">
            <div class="mb-1.5 flex items-baseline justify-between text-[0.875rem] font-semibold">
              <span>Today’s progress</span>
              <span class="tnum text-muted">
                {progress.done} / {progress.total}
              </span>
            </div>
            <Meter ratio={progress.total > 0 ? progress.done / progress.total : 0} label={`${progress.done} of ${progress.total} tasks done today`} />
          </div>
        )}
        {view === 'today' && counts.overdue > 0 && (
          <a href="#/tasks/overdue" class="card mb-3 flex items-center gap-3 border border-accent/40 py-3">
            <Icon name="clock" size={19} class="text-accent" />
            <span class="min-w-0 flex-1 text-[0.9375rem] font-semibold">
              {counts.overdue} overdue {counts.overdue === 1 ? 'task' : 'tasks'}
            </span>
            <Icon name="back" size={16} class="rotate-180 text-muted" />
          </a>
        )}

        {/* Search + filters */}
        <div class="card mb-4 space-y-3">
          <div class="flex items-center gap-2">
            <Icon name="search" size={18} class="text-muted" />
            <input
              id="task-search"
              class="min-h-10 w-full bg-transparent font-semibold outline-none"
              placeholder="Search tasks…"
              aria-label="Search tasks"
              value={filter.search}
              onInput={(e) => setFilter((f) => ({ ...f, search: e.currentTarget.value }))}
            />
            {filter.search && (
              <button type="button" class="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label="Clear search" onClick={() => setFilter((f) => ({ ...f, search: '' }))}>
                <Icon name="close" size={16} />
              </button>
            )}
            <button
              type="button"
              class={`relative grid size-9 shrink-0 place-items-center rounded-full ${showFilters ? 'bg-teal text-on-teal' : 'bg-field text-muted'}`}
              aria-label="Filters and sort"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Icon name="settings" size={17} />
              {filtering && !showFilters && <span class="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          </div>

          {(projects.length > 0 || filter.project !== 'all') && (
            <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Category">
              <button type="button" class="chip" aria-pressed={filter.project === 'all'} onClick={() => setFilter((f) => ({ ...f, project: 'all' }))}>
                All
              </button>
              <button type="button" class="chip" aria-pressed={filter.project === 'none'} onClick={() => setFilter((f) => ({ ...f, project: 'none' }))}>
                Inbox
              </button>
              {projects.map((p) => (
                <button key={p.id} type="button" class="chip" aria-pressed={filter.project === p.id} onClick={() => setFilter((f) => ({ ...f, project: p.id }))}>
                  {p.name}
                </button>
              ))}
              <a href="#/categories" class="chip text-teal">
                Manage
              </a>
            </div>
          )}

          {showFilters && (
            <div class="space-y-3 border-t border-rule pt-3">
              <div>
                <span class="section-label mb-1.5 block">Sort by</span>
                <Segmented label="Sort tasks" options={SORT_OPTS} value={sort} onChange={(v) => setSortOverride(v)} />
              </div>
              <div>
                <span class="section-label mb-1.5 block">Priority</span>
                <div class="flex flex-wrap gap-2" role="group" aria-label="Priority filter">
                  {PRIORITY_CHIPS.map((p) => (
                    <button key={p.label} type="button" class="chip !min-h-9" aria-pressed={filter.priority === p.value} onClick={() => setFilter((f) => ({ ...f, priority: p.value }))}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {tags.length > 0 && (
                <div>
                  <span class="section-label mb-1.5 block">Tag</span>
                  <div class="flex flex-wrap gap-2" role="group" aria-label="Tag filter">
                    <button type="button" class="chip !min-h-9" aria-pressed={filter.tag === null} onClick={() => setFilter((f) => ({ ...f, tag: null }))}>
                      All
                    </button>
                    {tags.map((t) => (
                      <button key={t} type="button" class="chip !min-h-9" aria-pressed={filter.tag === t} onClick={() => setFilter((f) => ({ ...f, tag: f.tag === t ? null : t }))}>
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filtering && (
                <button type="button" class="text-[0.875rem] font-bold text-accent" onClick={() => setFilter(EMPTY_FILTER)}>
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {view === 'done' && history.length > 0 && tasks.some((t) => t.done) && (
          <div class="mb-3 flex justify-end">
            <button type="button" class="text-[0.875rem] font-bold text-muted" onClick={() => void clearDoneTasks()}>
              Clear completed tasks
            </button>
          </div>
        )}

        {taskContent()}
      </Page>
    </>
  );
}
