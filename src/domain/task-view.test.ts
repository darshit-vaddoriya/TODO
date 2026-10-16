import { describe, expect, it } from 'vitest';
import { normalizeTask } from '@/domain/task-model';
import {
  activeFilterCount,
  allTags,
  buildView,
  completedHistory,
  dayProgress,
  dueBucket,
  EMPTY_FILTER,
  filterSummary,
  groupByDate,
  isTaskTab,
  isUrgent,
  matchesFilter,
  sortTasks,
  tabCounts,
  tabTasks,
} from '@/domain/task-view';
import type { Task } from '@/domain/types';

const task = (over: Partial<Task> & { title: string }, i = 0): Task => normalizeTask({ createdAt: 1000 + i, ...over }, Date.UTC(2026, 5, 15, 12));

const TODAY = '2026-06-15';

describe('matchesFilter', () => {
  const t = task({ title: 'Buy milk', notes: 'skim', tags: ['shop'], priority: 'high' });

  it('matches title, notes, tags and subtasks case-insensitively', () => {
    expect(matchesFilter(t, { ...EMPTY_FILTER, search: 'MILK' })).toBe(true);
    expect(matchesFilter(t, { ...EMPTY_FILTER, search: 'skim' })).toBe(true);
    expect(matchesFilter(t, { ...EMPTY_FILTER, search: 'shop' })).toBe(true);
    expect(matchesFilter(t, { ...EMPTY_FILTER, search: 'eggs' })).toBe(false);
  });

  it('filters by tag and priority', () => {
    expect(matchesFilter(t, { ...EMPTY_FILTER, tag: 'shop' })).toBe(true);
    expect(matchesFilter(t, { ...EMPTY_FILTER, tag: 'work' })).toBe(false);
    expect(matchesFilter(t, { ...EMPTY_FILTER, priority: 'high' })).toBe(true);
    expect(matchesFilter(t, { ...EMPTY_FILTER, priority: 'low' })).toBe(false);
  });

  it('filters by category, with "none" meaning the Inbox', () => {
    const inbox = task({ title: 'loose' });
    const inP1 = task({ title: 'grouped', categoryId: 'p1' });
    expect(matchesFilter(inbox, { ...EMPTY_FILTER, category: 'none' })).toBe(true);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, category: 'none' })).toBe(false);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, category: 'p1' })).toBe(true);
    expect(matchesFilter(inbox, { ...EMPTY_FILTER, category: 'p1' })).toBe(false);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, category: 'all' })).toBe(true);
  });
});

describe('allTags', () => {
  it('collects distinct tags alphabetically', () => {
    const tasks = [task({ title: 'a', tags: ['z', 'a'] }), task({ title: 'b', tags: ['a', 'm'] })];
    expect(allTags(tasks)).toEqual(['a', 'm', 'z']);
  });
});

describe('dueBucket', () => {
  it('classifies by due date relative to today', () => {
    expect(dueBucket({ dueDate: null }, TODAY)).toBe('none');
    expect(dueBucket({ dueDate: '2026-06-14' }, TODAY)).toBe('overdue');
    expect(dueBucket({ dueDate: '2026-06-15' }, TODAY)).toBe('today');
    expect(dueBucket({ dueDate: '2026-06-16' }, TODAY)).toBe('upcoming');
  });
});

describe('sortTasks', () => {
  const a = task({ title: 'Banana', order: 2, priority: 'low', dueDate: '2026-06-20' }, 1);
  const b = task({ title: 'apple', order: 1, priority: 'high', dueDate: null }, 2);
  const c = task({ title: 'Cherry', order: 3, priority: 'none', dueDate: '2026-06-10' }, 3);
  const list = [a, b, c];

  it('manual follows the order field', () => {
    expect(sortTasks(list, 'manual').map((t) => t.title)).toEqual(['apple', 'Banana', 'Cherry']);
  });
  it('priority floats high to the top', () => {
    expect(sortTasks(list, 'priority').map((t) => t.title)).toEqual(['apple', 'Banana', 'Cherry']);
  });
  it('due sorts dated ascending, undated last', () => {
    expect(sortTasks(list, 'due').map((t) => t.title)).toEqual(['Cherry', 'Banana', 'apple']);
  });
  it('alpha is case-insensitive', () => {
    expect(sortTasks(list, 'alpha').map((t) => t.title)).toEqual(['apple', 'Banana', 'Cherry']);
  });
  it('newest first by createdAt', () => {
    expect(sortTasks(list, 'created').map((t) => t.title)).toEqual(['Cherry', 'apple', 'Banana']);
  });
  it('does not mutate the input array', () => {
    const copy = [...list];
    sortTasks(list, 'alpha');
    expect(list).toEqual(copy);
  });
});

describe('buildView', () => {
  const overdue = task({ title: 'late', dueDate: '2026-06-10' }, 1);
  const todayTask = task({ title: 'now', dueDate: TODAY }, 2);
  const upcoming = task({ title: 'soon', dueDate: '2026-06-20' }, 3);
  const noDate = task({ title: 'whenever' }, 4);
  const doneTask = task({ title: 'finished', done: true, completedAt: 5000 }, 5);
  const tasks = [upcoming, doneTask, overdue, noDate, todayTask];

  it('groups active tasks into ordered due buckets and lists done separately', () => {
    const view = buildView(tasks, EMPTY_FILTER, 'manual', TODAY);
    expect(view.groups.map((g) => g.key)).toEqual(['overdue', 'today', 'upcoming', 'none']);
    expect(view.groups.flatMap((g) => g.tasks.map((t) => t.title))).toEqual(['late', 'now', 'soon', 'whenever']);
    expect(view.done.map((t) => t.title)).toEqual(['finished']);
    expect(view.total).toBe(5);
  });

  it('omits empty groups and respects the filter', () => {
    const view = buildView(tasks, { ...EMPTY_FILTER, search: 'soon' }, 'manual', TODAY);
    expect(view.groups.map((g) => g.key)).toEqual(['upcoming']);
    expect(view.matched).toBe(1);
    expect(view.done).toEqual([]);
  });
});

describe('dayProgress', () => {
  it("counts today's completions (incl. repeating tasks) against everything planned", () => {
    const doneToday = task({ title: 'a', done: true, completedDates: [TODAY] }, 1);
    // A repeating task already completed today has moved on to tomorrow.
    const repeatedToday = task({ title: 'b', repeat: { kind: 'daily' }, dueDate: '2026-06-16', completedDates: [TODAY] }, 2);
    const dueNow = task({ title: 'c', dueDate: TODAY }, 3);
    const late = task({ title: 'd', dueDate: '2026-06-10' }, 4);
    const later = task({ title: 'e', dueDate: '2026-06-20' }, 5);
    const undated = task({ title: 'f' }, 6);
    expect(dayProgress([doneToday, repeatedToday, dueNow, late, later, undated], TODAY)).toEqual({ done: 2, total: 4 }); // 2 done + due-today + overdue
  });
});

describe('tab views', () => {
  const overdue = task({ title: 'late', dueDate: '2026-06-10' }, 1);
  const today = task({ title: 'now', dueDate: TODAY }, 2);
  const upcoming = task({ title: 'soon', dueDate: '2026-06-20' }, 3);
  const undated = task({ title: 'whenever' }, 4);
  const done = task({ title: 'finished', done: true, dueDate: TODAY }, 5);
  const all = [overdue, today, upcoming, undated, done];

  it('assigns open tasks to the right tab', () => {
    expect(tabTasks(all, 'today', TODAY).map((t) => t.title)).toEqual(['now']);
    expect(tabTasks(all, 'upcoming', TODAY).map((t) => t.title)).toEqual(['soon']);
    expect(tabTasks(all, 'overdue', TODAY).map((t) => t.title)).toEqual(['late']);
    expect(tabTasks(all, 'all', TODAY).map((t) => t.title)).toEqual(['late', 'now', 'soon', 'whenever']);
    expect(tabTasks(all, 'done', TODAY)).toEqual([]);
  });

  it('counts each tab', () => {
    expect(tabCounts(all, TODAY)).toEqual({ today: 1, upcoming: 1, all: 4, overdue: 1 });
  });

  it('recognises tab ids', () => {
    expect(isTaskTab('overdue')).toBe(true);
    expect(isTaskTab('nope')).toBe(false);
    expect(isTaskTab(undefined)).toBe(false);
  });

  it('groups upcoming tasks by date, ordered by date then time', () => {
    const a = task({ title: 'a', dueDate: '2026-06-21', dueTime: '15:00' }, 1);
    const b = task({ title: 'b', dueDate: '2026-06-20', dueTime: '09:00' }, 2);
    const c = task({ title: 'c', dueDate: '2026-06-21', dueTime: '08:00' }, 3);
    expect(groupByDate([a, b, c]).map((g) => [g.date, g.tasks.map((t) => t.title)])).toEqual([
      ['2026-06-20', ['b']],
      ['2026-06-21', ['c', 'a']],
    ]);
  });

  it('builds completed history, newest first, one entry per completion (repeating tasks repeat)', () => {
    const one = task({ title: 'one', done: true, completedDates: ['2026-06-14'], completedAt: 100 }, 1);
    const habit = task({ title: 'habit', repeat: { kind: 'daily' }, dueDate: '2026-06-16', completedDates: ['2026-06-13', '2026-06-15'], completedAt: 200 }, 2);
    expect(completedHistory([one, habit]).map((e) => `${e.date} ${e.task.title}`)).toEqual(['2026-06-15 habit', '2026-06-14 one', '2026-06-13 habit']);
  });

  it('flags overdue and high-priority-due tasks as urgent', () => {
    expect(isUrgent(task({ title: 'x', dueDate: '2026-06-10' }), TODAY)).toBe(true);
    expect(isUrgent(task({ title: 'x', dueDate: TODAY, priority: 'high' }), TODAY)).toBe(true);
    expect(isUrgent(task({ title: 'x', dueDate: TODAY, priority: 'low' }), TODAY)).toBe(false);
    expect(isUrgent(task({ title: 'x', dueDate: '2026-06-20', priority: 'high' }), TODAY)).toBe(false);
    expect(isUrgent(task({ title: 'x', dueDate: '2026-06-10', done: true }), TODAY)).toBe(false);
  });
});

describe('filter bar helpers', () => {
  it('counts only category, priority and tag filters', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTER, search: 'milk' })).toBe(0); // search is its own box
    expect(activeFilterCount({ ...EMPTY_FILTER, category: 'none' })).toBe(1);
    expect(activeFilterCount({ category: 'work', priority: 'high', tag: 'x', search: '' })).toBe(3);
  });

  it('describes the active filters in plain words', () => {
    const name = (id: string) => (id === 'work' ? 'Work' : undefined);
    expect(filterSummary(EMPTY_FILTER, name)).toEqual([]);
    expect(filterSummary({ ...EMPTY_FILTER, category: 'none' }, name)).toEqual(['Inbox']);
    expect(filterSummary({ category: 'work', priority: 'high', tag: 'errands', search: '' }, name)).toEqual(['Work', 'High priority', '#errands']);
    expect(filterSummary({ ...EMPTY_FILTER, category: 'gone' }, name)).toEqual(['Category']); // a deleted category doesn't crash
  });
});
