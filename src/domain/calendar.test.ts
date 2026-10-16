import { describe, expect, it } from 'vitest';
import { itemsByDay, monthGrid, monthKey, shiftMonth, weekdayOrder } from '@/domain/calendar';
import { normalizeTask } from '@/domain/task-model';
import type { Task } from '@/domain/types';

const NOW = new Date(2026, 5, 18, 12).getTime();
const mk = (over: Record<string, unknown>): Task => normalizeTask({ title: 't', createdAt: 1, ...over }, NOW);

describe('monthGrid', () => {
  it('is always 6 weeks of 7 days', () => {
    expect(monthGrid(2026, 6, 1)).toHaveLength(42);
    expect(monthGrid(2026, 2, 0)).toHaveLength(42);
  });

  it('starts on the chosen weekday and includes the whole month', () => {
    // June 2026 starts on a Monday.
    const monStart = monthGrid(2026, 6, 1);
    expect(monStart[0]).toBe('2026-06-01');
    expect(monStart).toContain('2026-06-30');
    // Sunday-first pulls in the previous Sunday.
    const sunStart = monthGrid(2026, 6, 0);
    expect(sunStart[0]).toBe('2026-05-31');
    expect(sunStart[1]).toBe('2026-06-01');
  });

  it('handles a month that starts on the week-start day and year boundaries', () => {
    expect(monthGrid(2026, 1, 1)[0]).toBe('2025-12-29'); // Jan 1 2026 is a Thursday
    expect(monthGrid(2026, 12, 1).at(-1)).toBe('2027-01-10');
  });
});

describe('month helpers', () => {
  it('shiftMonth wraps years in both directions', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
    expect(shiftMonth(2026, 6, 14)).toEqual({ year: 2027, month: 8 });
  });
  it('weekdayOrder follows the week start', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('monthKey pads', () => expect(monthKey(2026, 6)).toBe('2026-06'));
});

describe('itemsByDay', () => {
  const range: [string, string] = ['2026-06-01', '2026-06-30'];

  it('places an open task on its due date', () => {
    const map = itemsByDay([mk({ title: 'a', dueDate: '2026-06-18' })], ...range);
    expect(map.get('2026-06-18')).toHaveLength(1);
    expect(map.get('2026-06-18')![0]).toMatchObject({ projected: false, done: false });
  });

  it('categories a weekly task across the month, marking later ones projected', () => {
    const map = itemsByDay([mk({ title: 'gym', repeat: { kind: 'weekly', days: [4] }, dueDate: '2026-06-18' })], ...range);
    expect([...map.keys()].sort()).toEqual(['2026-06-18', '2026-06-25']);
    expect(map.get('2026-06-18')![0].projected).toBe(false);
    expect(map.get('2026-06-25')![0].projected).toBe(true);
  });

  it('shows a done one-off on its due date as done', () => {
    const map = itemsByDay([mk({ title: 'x', done: true, dueDate: '2026-06-10' })], ...range);
    expect(map.get('2026-06-10')![0]).toMatchObject({ done: true, projected: false });
  });

  it('ignores undated tasks and dates outside the range', () => {
    const map = itemsByDay([mk({ title: 'none' }), mk({ title: 'far', dueDate: '2026-08-01' })], ...range);
    expect(map.size).toBe(0);
  });

  it('orders a day: open before done, then by time, untimed last', () => {
    const tasks = [
      mk({ id: 'c', title: 'untimed', dueDate: '2026-06-18', order: 1 }),
      mk({ id: 'b', title: 'late', dueDate: '2026-06-18', dueTime: '17:00', order: 2 }),
      mk({ id: 'a', title: 'early', dueDate: '2026-06-18', dueTime: '08:00', order: 3 }),
      mk({ id: 'd', title: 'finished', done: true, dueDate: '2026-06-18', dueTime: '07:00', order: 4 }),
    ];
    expect(
      itemsByDay(tasks, ...range)
        .get('2026-06-18')!
        .map((i) => i.task.title),
    ).toEqual(['early', 'late', 'untimed', 'finished']);
  });
});
