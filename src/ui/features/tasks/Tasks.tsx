/**
 * The Tasks screen. The view (Today · Upcoming · All · Overdue · Completed) comes
 * from the route; a search box and two icons — filter and sort — sit above the
 * list and open sheets, so there are no tab or chip rows pushing the tasks down.
 * Swipe to complete or delete (with Undo), drag to reorder in the manual All
 * view, and a dated history under Completed. Tap a task to edit it.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { localDate } from '@/domain/dates';
import { repeatLabel } from '@/domain/task-model';
import {
  activeFilterCount,
  allTags,
  buildView,
  completedHistory,
  dayProgress,
  EMPTY_FILTER,
  filterSummary,
  groupByDate,
  matchesFilter,
  sortTasks,
  tabCounts,
  tabTasks,
  TASK_TABS,
  type SortKey,
  type TaskFilter,
  type TaskTab,
} from '@/domain/task-view';
import type { Category } from '@/domain/types';
import { friendlyDate } from '@/data/display';
import { clearDoneTasks, reorderTasks } from '@/data/tasks';
import { Checkbox, Empty, Header, Icon, Meter, Page, ReorderList, Section } from '@/ui/components';
import { useCategories, useTasks } from '@/ui/hooks';
import { go } from '@/ui/router';
import { setDoneWithUndo } from '@/ui/shared/taskActions';
import { FilterSheet, SortSheet } from './FilterSheet';
import { QuickAdd } from './QuickAdd';
import { TaskList, TaskRow } from './TaskRow';

/** "Friday · Today", "Monday · 10/19/2026" — a day heading. */
function dayHeading(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(y, m - 1, d));
  const rel = friendlyDate(date, today);
  return rel === 'Today' || rel === 'Tomorrow' || rel === 'Yesterday' ? `${rel} · ${weekday}` : `${weekday} · ${rel}`;
}

/** `#/tasks/all?cat=<id|none>` → the category filter it names (undefined if it names none that exists). */
function categoryFromLink(cat: string | undefined, categories: Category[]): TaskFilter['category'] | undefined {
  if (cat === 'none') return 'none';
  return cat && categories.some((c) => c.id === cat) ? cat : undefined;
}

/** A square icon button for the toolbar, with an optional count badge or a "changed" dot. */
function ToolbarButton({ icon, label, badge, dot, onClick }: { icon: string; label: string; badge?: number; dot?: boolean; onClick: () => void }) {
  const active = !!badge;
  return (
    <button
      type="button"
      aria-label={badge ? `${label}, ${badge} active` : label}
      aria-haspopup="dialog"
      class={`relative grid size-11 shrink-0 place-items-center rounded-2xl shadow-[var(--lift)] ${active ? 'bg-teal text-on-teal' : 'bg-surface text-ink'}`}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      {badge ? (
        <span class="tnum absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.6875rem] font-extrabold leading-none text-on-accent">
          {badge}
        </span>
      ) : null}
      {dot && !badge && <span class="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />}
    </button>
  );
}

export function Tasks({ view, cat }: { view: TaskTab; cat?: string }) {
  const tasks = useTasks();
  const categories = useCategories();
  const today = localDate();
  const [sortOverride, setSortOverride] = useState<SortKey | null>(null);
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_FILTER, category: categoryFromLink(cat, categories) ?? 'all' });
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null);

  // Follow a category link (#/tasks/all?cat=…) when it changes while the screen is open.
  useEffect(() => {
    setFilter((f) => ({ ...f, category: categoryFromLink(cat, categories) ?? f.category }));
  }, [cat]);

  const defaultSort: SortKey = view === 'all' ? 'manual' : 'due';
  const sort: SortKey = sortOverride ?? defaultSort;
  const tags = useMemo(() => allTags(tasks), [tasks]);
  const counts = useMemo(() => tabCounts(tasks, today), [tasks, today]);
  const progress = dayProgress(tasks, today);
  const currentCategory = filter.category !== 'all' && filter.category !== 'none' ? filter.category : null;
  const filterCount = activeFilterCount(filter);
  const filtering = filter.search.trim() !== '' || filterCount > 0;
  const summary = filterSummary(filter, (id) => categories.find((c) => c.id === id)?.name);

  // Open tasks for this view, filtered then sorted.
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
  const shown = view === 'done' ? history.length : open.length;

  const openCategoryCounts = useMemo(() => {
    const byId = new Map<string | null, number>();
    for (const t of tasks) if (!t.done) byId.set(t.categoryId, (byId.get(t.categoryId) ?? 0) + 1);
    return byId;
  }, [tasks]);

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

  const clearFilters = () => setFilter((f) => ({ ...EMPTY_FILTER, search: f.search }));
  // Switching view replaces the history entry: it's a filter, not a destination.
  const changeView = (next: TaskTab) => location.replace(`#/tasks/${next}`);
  const viewLabel = TASK_TABS.find((t) => t.id === view)?.label ?? 'Tasks';

  const focusAdd = () => document.getElementById('quick-add')?.focus();
  const emptyCopy: Record<TaskTab, { title: string; body: string; icon: string; cta?: boolean }> = {
    today: { title: 'Nothing due today', body: 'A clear day. Add something, or enjoy it.', icon: 'check', cta: true },
    upcoming: { title: 'Nothing coming up', body: 'Tasks with a future date show up here.', icon: 'calendar' },
    all: { title: 'No tasks yet', body: 'Type one above — try “Pay rent tomorrow 6pm !high #home”.', icon: 'list', cta: true },
    overdue: { title: 'Nothing overdue', body: 'You’re all caught up. 🎉', icon: 'check' },
    done: { title: 'Nothing completed yet', body: 'Finished tasks collect here as a history.', icon: 'check' },
  };
  const empty = filtering ? { title: 'No matches', body: 'Try a different search, or reset the filters.', icon: 'search', cta: false } : emptyCopy[view];
  const emptyState = (
    <Empty title={empty.title} body={empty.body} icon={empty.icon}>
      {empty.cta && (
        <button type="button" class="btn btn-primary" onClick={focusAdd}>
          <Icon name="plus" size={18} /> Add a task
        </button>
      )}
      {filtering && (
        <button type="button" class="btn btn-quiet" onClick={() => setFilter(EMPTY_FILTER)}>
          Reset filters
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
        sub={`${viewLabel} · ${shown} ${view === 'done' ? (shown === 1 ? 'completion' : 'completions') : shown === 1 ? 'task' : 'tasks'}`}
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
          <ToolbarButton icon="filter" label="Filters" badge={filterCount} onClick={() => setSheet('filter')} />
          <ToolbarButton icon="sort" label="Sort" dot={sort !== defaultSort} onClick={() => setSheet('sort')} />
        </div>

        {summary.length > 0 && (
          <p class="mb-3 flex items-center gap-2 px-1 text-[0.8125rem] font-semibold text-muted">
            <Icon name="filter" size={14} />
            <span class="min-w-0 flex-1 truncate">{summary.join(' · ')}</span>
            <button type="button" class="shrink-0 font-bold text-teal" onClick={clearFilters}>
              Clear
            </button>
          </p>
        )}

        {view === 'today' && (progress.total > 0 || counts.overdue > 0) && (
          <div class="mb-4 px-1">
            <div class="mb-1.5 flex items-center justify-between text-[0.8125rem] font-semibold">
              <span class="text-muted">{progress.total > 0 ? `${progress.done} of ${progress.total} done today` : 'Nothing planned for today'}</span>
              {counts.overdue > 0 && (
                <button type="button" class="flex items-center gap-0.5 font-bold text-accent" onClick={() => changeView('overdue')}>
                  {counts.overdue} overdue <Icon name="back" size={14} class="rotate-180" />
                </button>
              )}
            </div>
            {progress.total > 0 && <Meter ratio={progress.done / progress.total} label={`${progress.done} of ${progress.total} tasks done today`} />}
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

      <FilterSheet
        open={sheet === 'filter'}
        onClose={() => setSheet(null)}
        view={view}
        onViewChange={changeView}
        counts={counts}
        completedToday={progress.done}
        filter={filter}
        onFilterChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
        onReset={clearFilters}
        categories={categories}
        categoryCount={(id) => openCategoryCounts.get(id) ?? 0}
        tags={tags}
        resultCount={shown}
        onManageCategories={() => {
          setSheet(null);
          go('/categories');
        }}
      />
      <SortSheet
        open={sheet === 'sort'}
        onClose={() => setSheet(null)}
        sort={sort}
        isDefault={sort === defaultSort}
        onSelect={setSortOverride}
        onUseDefault={() => setSortOverride(null)}
      />
    </>
  );
}
