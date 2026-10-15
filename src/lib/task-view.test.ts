import { describe, expect, it } from 'vitest';
import { normalizeTask } from './task-model';
import { allTags, buildView, dayProgress, dueBucket, EMPTY_FILTER, matchesFilter, sortTasks } from './task-view';
import type { Task } from './types';

const task = (over: Partial<Task> & { title: string }, i = 0): Task =>
  normalizeTask({ createdAt: 1000 + i, ...over }, Date.UTC(2026, 5, 15, 12));

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

  it('filters by project, with "none" meaning the Inbox', () => {
    const inbox = task({ title: 'loose' });
    const inP1 = task({ title: 'grouped', projectId: 'p1' });
    expect(matchesFilter(inbox, { ...EMPTY_FILTER, project: 'none' })).toBe(true);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, project: 'none' })).toBe(false);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, project: 'p1' })).toBe(true);
    expect(matchesFilter(inbox, { ...EMPTY_FILTER, project: 'p1' })).toBe(false);
    expect(matchesFilter(inP1, { ...EMPTY_FILTER, project: 'all' })).toBe(true);
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
  it('counts today\'s completions (incl. repeating tasks) against everything planned', () => {
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
