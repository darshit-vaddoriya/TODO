/**
 * Tasks: Today · Upcoming · All · Overdue · Completed. A quick-add box that
 * understands plain language, search, sort and filters (category, tag,
 * priority), swipe to complete or delete (with Undo), drag to reorder in the
 * manual All view, and a completed-task history. Tap a task to edit it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { localDate } from '@/domain/dates';
import { parseQuickAdd } from '@/domain/quick-parse';
import { repeatLabel } from '@/domain/task-model';
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
} from '@/domain/task-view';
import type { Priority, Category, Task } from '@/domain/types';
import { formatClock, friendlyDate } from '@/data/display';
import { getPrefs } from '@/data/prefs';
import { clearDoneTasks, addTask, reorderTasks } from '@/data/tasks';
import { Checkbox, Empty, Header, Icon, Meter, Page, ReorderList, Section, Segmented, SwipeRow } from '@/ui/components';
import { completeWithUndo, deleteWithUndo, setDoneWithUndo } from '@/ui/shared/taskActions';
import { useTaskComplete } from '@/ui/shared/useTaskComplete';
import { useCategories, useTasks } from '@/ui/hooks';
import { go } from '@/ui/router';

const PRIORITY_COLOR: Record<Priority, string> = { none: '', low: 'text-info', medium: 'text-haldi', high: 'text-accent' };
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

function TaskRow({ task, today, categories, handle }: { task: Task; today: string; categories: Category[]; handle?: ComponentChildren }) {
  const { leaving, toggle } = useTaskComplete(task);
  const overdue = !!task.dueDate && task.dueDate < today;
  const urgent = isUrgent(task, today);
  const subDone = task.subtasks.filter((s) => s.done).length;
  const category = task.categoryId ? categories.find((p) => p.id === task.categoryId)?.name : undefined;
  const repeat = repeatLabel(task.repeat);
  const dueClass = overdue ? 'text-accent' : task.dueDate === today ? 'text-teal' : 'text-muted';

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
            <span class="flex items-center gap-1 text-teal">
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

function TaskList({ tasks, today, categories }: { tasks: Task[]; today: string; categories: Category[] }) {
  return (
    <div class="space-y-2.5">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} categories={categories} />
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
      categoryId: categoryId,
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
    <div>
      <div class="flex items-center gap-2">
        <input
          id="quick-add"
          class="field flex-1 !bg-surface shadow-[var(--lift)]"
          placeholder="Add a task… e.g. Call mom 6pm"
          aria-label="Quick add task"
          value={text}
          maxLength={160}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button type="button" class="btn btn-primary !min-h-[52px] shrink-0 px-4" onClick={() => void add()} disabled={!parsed.title} aria-label="Add task">
          <Icon name="plus" size={22} />
        </button>
      </div>
      {text.trim() && chips.length > 0 && (
        <p class="mt-2 flex flex-wrap gap-1.5 px-1" aria-live="polite">
          {chips.map((c) => (
            <span key={c} class="rounded-full bg-surface px-2.5 py-1 text-[0.75rem] font-semibold text-teal shadow-[var(--lift)]">
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
function categoryFromLink(cat: string | undefined, categories: Category[]): TaskFilter['category'] | undefined {
  if (cat === 'none') return 'none';
  return cat && categories.some((p) => p.id === cat) ? cat : undefined;
}

// --- The screen ---------------------------------------------------------------------

export function Tasks({ view, cat }: { view: TaskTab; cat?: string }) {
  const tasks = useTasks();
  const categories = useCategories();
  const today = localDate();
  const [sortOverride, setSortOverride] = useState<SortKey | null>(null);
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_FILTER, category: categoryFromLink(cat, categories) ?? 'all' });
  const [showFilters, setShowFilters] = useState(false);

  // Follow a category link (#/tasks/all?cat=…) when it changes while the screen is open.
  useEffect(() => {
    setFilter((f) => ({ ...f, category: categoryFromLink(cat, categories) ?? f.category }));
  }, [cat]);

  const sort: SortKey = sortOverride ?? (view === 'all' ? 'manual' : 'due');
  const tags = useMemo(() => allTags(tasks), [tasks]);
  const counts = useMemo(() => tabCounts(tasks, today), [tasks, today]);
  const progress = dayProgress(tasks, today);
  const currentCategory = filter.category !== 'all' && filter.category !== 'none' ? filter.category : null;
  const filtering = filter.search.trim() !== '' || filter.tag !== null || filter.priority !== null || filter.category !== 'all';

  // Open tasks for this tab, filtered then sorted.
  const open = useMemo(
    () =>
      sortTasks(
        tabTasks(tasks, view, today).filter((t) => matchesFilter(t, filter)),
        sort,
      ),
    [tasks, view, today, filter, sort],
  );
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

  const focusAdd = () => document.getElementById('quick-add')?.focus();
  const emptyCopy: Record<TaskTab, { title: string; body: string; icon: string; cta?: boolean }> = {
    today: { title: 'Nothing due today', body: 'A clear day. Add something, or enjoy it.', icon: 'check', cta: true },
    upcoming: { title: 'Nothing coming up', body: 'Tasks with a future date show up here.', icon: 'calendar' },
    all: { title: 'No tasks yet', body: 'Type one above — try “Pay rent tomorrow 6pm !high #home”.', icon: 'list', cta: true },
    overdue: { title: 'Nothing overdue', body: 'You’re all caught up. 🎉', icon: 'check' },
    done: { title: 'Nothing completed yet', body: 'Finished tasks collect here as a history.', icon: 'check' },
  };
  const empty = filtering ? { title: 'No matches', body: 'Try a different search or clear the filters.', icon: 'search', cta: false } : emptyCopy[view];
  const emptyState = (
    <Empty title={empty.title} body={empty.body} icon={empty.icon}>
      {empty.cta && (
        <button type="button" class="btn btn-primary" onClick={focusAdd}>
          <Icon name="plus" size={18} /> Add a task
        </button>
      )}
      {filtering && (
        <button type="button" class="btn btn-quiet" onClick={() => setFilter(EMPTY_FILTER)}>
          Clear filters
        </button>
      )}
    </Empty>
  );

  const taskContent = () => {
    if (view === 'done') {
      if (history.length === 0) return emptyState;
      const byDate = new Map<string, typeof history>();
      for (const e of history) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
      return [...byDate].map(([date, entries]) => (
        <Section key={date} title={dayHeading(date, today)}>
          <div class="space-y-2">
            {entries.map((e) => (
              <div key={`${e.task.id}:${date}`} class="card flex items-center gap-3 !py-2">
                {e.task.done ? (
                  <Checkbox checked small label={`Re-open ${e.task.title}`} onChange={() => void setDoneWithUndo(e.task, false)} />
                ) : (
                  <span class="grid size-[22px] shrink-0 place-items-center rounded-full bg-teal text-on-teal" role="img" aria-label="Completed">
                    <Icon name="check" size={13} />
                  </span>
                )}
                <button type="button" class="min-w-0 flex-1 py-1 text-left" onClick={() => go(`/task/${e.task.id}`)}>
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
      if (open.length === 0) return emptyState;
      return groupByDate(open).map((g) => (
        <Section key={g.date} title={dayHeading(g.date, today)}>
          <TaskList tasks={g.tasks} today={today} categories={categories} />
        </Section>
      ));
    }
    if (view === 'all' && allView) {
      if (open.length === 0) return emptyState;
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
                  categories={categories}
                  handle={
                    <button
                      type="button"
                      class="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted active:bg-field"
                      {...handle}
                    >
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
          <TaskList tasks={g.tasks} today={today} categories={categories} />
        </Section>
      ));
    }
    if (open.length === 0) return emptyState;
    return <TaskList tasks={open} today={today} categories={categories} />;
  };

  return (
    <>
      <Header
        title="Tasks"
        sub={view !== 'today' && progress.total > 0 ? `${progress.done} of ${progress.total} done today` : undefined}
        actions={
          <a href="#/settings" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Settings">
            <Icon name="settings" size={22} />
          </a>
        }
      />
      <Page>
        <div class="mb-3">
          <QuickAdd tab={view} categoryId={currentCategory} />
        </div>

        {/* Views: the number on each tab is how many tasks are in it. */}
        <div role="tablist" aria-label="Task views" class="mb-3 flex gap-0.5 rounded-2xl bg-surface p-1 shadow-[var(--lift)]">
          {TASK_TABS.map((t) => {
            const active = view === t.id;
            const count = t.id === 'done' ? progress.done : counts[t.id];
            const alarming = t.id === 'overdue' && count > 0;
            return (
              <a
                key={t.id}
                href={`#/tasks/${t.id}`}
                role="tab"
                aria-selected={active}
                aria-label={`${t.id === 'done' ? 'Completed' : t.label}, ${count}`}
                class={`flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-0.5 transition-colors ${active ? 'bg-teal text-on-teal' : 'text-muted'}`}
              >
                <span class={`tnum text-[1.125rem] font-extrabold leading-tight ${alarming && !active ? 'text-accent' : ''}`}>{count}</span>
                <span class="max-w-full truncate text-[0.6875rem] font-bold leading-tight">{t.id === 'done' ? 'Done' : t.label}</span>
              </a>
            );
          })}
        </div>

        {view === 'today' && (progress.total > 0 || counts.overdue > 0) && (
          <div class="mb-3 px-1">
            <div class="mb-1.5 flex items-center justify-between text-[0.8125rem] font-semibold">
              <span class="text-muted">{progress.total > 0 ? `${progress.done} of ${progress.total} done today` : 'Nothing planned for today'}</span>
              {counts.overdue > 0 && (
                <a href="#/tasks/overdue" class="flex items-center gap-0.5 font-bold text-accent">
                  {counts.overdue} overdue <Icon name="back" size={14} class="rotate-180" />
                </a>
              )}
            </div>
            {progress.total > 0 && <Meter ratio={progress.done / progress.total} label={`${progress.done} of ${progress.total} tasks done today`} />}
          </div>
        )}

        {/* Search + filters */}
        <div class="mb-3 flex items-center gap-2">
          <label class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-surface px-3 shadow-[var(--lift)]">
            <Icon name="search" size={18} class="text-muted" />
            <input
              id="task-search"
              class="min-h-10 w-full min-w-0 bg-transparent font-semibold outline-none"
              placeholder="Search tasks…"
              aria-label="Search tasks"
              value={filter.search}
              onInput={(e) => setFilter((f) => ({ ...f, search: e.currentTarget.value }))}
            />
            {filter.search && (
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-field"
                aria-label="Clear search"
                onClick={() => setFilter((f) => ({ ...f, search: '' }))}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            class={`relative grid size-11 shrink-0 place-items-center rounded-2xl shadow-[var(--lift)] ${showFilters ? 'bg-teal text-on-teal' : 'bg-surface text-muted'}`}
            aria-label="Filters and sort"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Icon name="settings" size={18} />
            {filtering && !showFilters && <span class="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />}
          </button>
        </div>

        {(categories.length > 0 || filter.category !== 'all') && (
          <div class="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Category">
            <button
              type="button"
              class="chip !min-h-9 !px-3.5"
              aria-pressed={filter.category === 'all'}
              onClick={() => setFilter((f) => ({ ...f, category: 'all' }))}
            >
              All
            </button>
            <button
              type="button"
              class="chip !min-h-9 !px-3.5"
              aria-pressed={filter.category === 'none'}
              onClick={() => setFilter((f) => ({ ...f, category: 'none' }))}
            >
              Inbox
            </button>
            {categories.map((p) => (
              <button
                key={p.id}
                type="button"
                class="chip !min-h-9 !px-3.5"
                aria-pressed={filter.category === p.id}
                onClick={() => setFilter((f) => ({ ...f, category: p.id }))}
              >
                {p.name}
              </button>
            ))}
            <a href="#/categories" class="chip !min-h-9 !px-3.5 text-teal">
              Manage
            </a>
          </div>
        )}

        {showFilters && (
          <div class="card mb-3 space-y-3">
            <div>
              <span class="section-label mb-1.5 block">Sort by</span>
              <Segmented label="Sort tasks" options={SORT_OPTS} value={sort} onChange={(v) => setSortOverride(v)} />
            </div>
            <div>
              <span class="section-label mb-1.5 block">Priority</span>
              <div class="flex flex-wrap gap-2" role="group" aria-label="Priority filter">
                {PRIORITY_CHIPS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    class="chip !min-h-9"
                    aria-pressed={filter.priority === p.value}
                    onClick={() => setFilter((f) => ({ ...f, priority: p.value }))}
                  >
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
                    <button
                      key={t}
                      type="button"
                      class="chip !min-h-9"
                      aria-pressed={filter.tag === t}
                      onClick={() => setFilter((f) => ({ ...f, tag: f.tag === t ? null : t }))}
                    >
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
