import { describe, expect, it } from 'vitest';
import {
  addDays,
  completeTask,
  daysBetween,
  daysInMonth,
  firstOccurrenceOnOrAfter,
  nextOccurrence,
  normalizeTask,
  occurrencesBetween,
  reopenTask,
  repeatLabel,
  weekdayOf,
} from './task-model';
import type { RepeatRule, Task } from './types';

const NOW = new Date(2026, 5, 18, 12, 0, 0).getTime(); // Thu 2026-06-18, local
const TODAY = '2026-06-18';
const mk = (over: Record<string, unknown> = {}): Task => normalizeTask({ title: 't', createdAt: 1000, ...over }, NOW);

describe('date arithmetic', () => {
  it('daysBetween counts whole days, DST-safe', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysInMonth handles leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it('weekdayOf matches the calendar', () => {
    expect(weekdayOf('2026-06-18')).toBe(4); // Thursday
    expect(weekdayOf('2026-06-21')).toBe(0); // Sunday
  });
});

describe('nextOccurrence', () => {
  it('one-off has none', () => expect(nextOccurrence({ kind: 'none' }, TODAY)).toBeNull());
  it('daily is the next day', () => expect(nextOccurrence({ kind: 'daily' }, TODAY)).toBe('2026-06-19'));

  it('weekly picks the next selected weekday, strictly after', () => {
    const mon: RepeatRule = { kind: 'weekly', days: [1] };
    expect(nextOccurrence(mon, TODAY)).toBe('2026-06-22'); // Thu → next Mon
    expect(nextOccurrence(mon, '2026-06-22')).toBe('2026-06-29'); // Mon → following Mon, not itself
    expect(nextOccurrence({ kind: 'weekly', days: [1, 4] }, TODAY)).toBe('2026-06-22');
  });
  it('weekly with no days behaves like daily', () => {
    expect(nextOccurrence({ kind: 'weekly', days: [] }, TODAY)).toBe('2026-06-19');
  });

  it('monthly keeps the day and clamps to short months', () => {
    expect(nextOccurrence({ kind: 'monthly', day: 18 }, TODAY)).toBe('2026-07-18');
    expect(nextOccurrence({ kind: 'monthly', day: 31 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence({ kind: 'monthly', day: 31 }, '2026-02-28')).toBe('2026-03-31'); // recovers the 31st
    expect(nextOccurrence({ kind: 'monthly', day: 15 }, '2026-12-15')).toBe('2027-01-15');
  });

  it('custom every N days / weeks / months', () => {
    expect(nextOccurrence({ kind: 'custom', every: 3, unit: 'days' }, TODAY)).toBe('2026-06-21');
    expect(nextOccurrence({ kind: 'custom', every: 2, unit: 'weeks' }, TODAY)).toBe('2026-07-02');
    expect(nextOccurrence({ kind: 'custom', every: 2, unit: 'months' }, TODAY)).toBe('2026-08-18');
  });
});

describe('firstOccurrenceOnOrAfter', () => {
  it('weekly lands on the first matching weekday, including the date itself', () => {
    expect(firstOccurrenceOnOrAfter({ kind: 'weekly', days: [4] }, TODAY)).toBe(TODAY);
    expect(firstOccurrenceOnOrAfter({ kind: 'weekly', days: [1] }, TODAY)).toBe('2026-06-22');
  });
  it('monthly lands this month if not past, else next month', () => {
    expect(firstOccurrenceOnOrAfter({ kind: 'monthly', day: 25 }, TODAY)).toBe('2026-06-25');
    expect(firstOccurrenceOnOrAfter({ kind: 'monthly', day: 10 }, TODAY)).toBe('2026-07-10');
  });
  it('other rules start on the date itself', () => {
    expect(firstOccurrenceOnOrAfter({ kind: 'daily' }, TODAY)).toBe(TODAY);
  });
});

describe('occurrencesBetween', () => {
  it('projects a repeating task across a range', () => {
    const t = { dueDate: '2026-06-18', repeat: { kind: 'weekly', days: [4] } as RepeatRule };
    expect(occurrencesBetween(t, '2026-06-01', '2026-07-05')).toEqual(['2026-06-18', '2026-06-25', '2026-07-02']);
  });
  it('a one-off appears once, only inside the range', () => {
    const t = { dueDate: '2026-06-18', repeat: { kind: 'none' } as RepeatRule };
    expect(occurrencesBetween(t, '2026-06-01', '2026-06-30')).toEqual(['2026-06-18']);
    expect(occurrencesBetween(t, '2026-07-01', '2026-07-31')).toEqual([]);
  });
  it('a task with no date has no occurrences', () => {
    expect(occurrencesBetween({ dueDate: null, repeat: { kind: 'daily' } }, '2026-06-01', '2026-06-30')).toEqual([]);
  });
  it('is capped so a long daily range stays cheap', () => {
    const t = { dueDate: '2026-01-01', repeat: { kind: 'daily' } as RepeatRule };
    expect(occurrencesBetween(t, '2026-01-01', '2030-01-01', 50)).toHaveLength(50);
  });
});

describe('completeTask', () => {
  it('a one-off becomes done and logs history', () => {
    const done = completeTask(mk({ dueDate: TODAY }), TODAY, NOW);
    expect(done.done).toBe(true);
    expect(done.completedDates).toEqual([TODAY]);
    expect(done.completedAt).toBe(NOW);
  });

  it('a daily task stays open and moves to tomorrow', () => {
    const t = completeTask(mk({ repeat: { kind: 'daily' }, dueDate: TODAY }), TODAY, NOW);
    expect(t.done).toBe(false);
    expect(t.dueDate).toBe('2026-06-19');
    expect(t.completedDates).toEqual([TODAY]);
  });

  it('an overdue repeating task skips the backlog (counts from today)', () => {
    const t = completeTask(mk({ repeat: { kind: 'daily' }, dueDate: '2026-06-10' }), TODAY, NOW);
    expect(t.dueDate).toBe('2026-06-19');
  });

  it('completing a future occurrence early moves past it', () => {
    // Weekly Monday task, due next Monday 06-22, completed on Thursday 06-18.
    const t = completeTask(mk({ repeat: { kind: 'weekly', days: [1] }, dueDate: '2026-06-22' }), TODAY, NOW);
    expect(t.dueDate).toBe('2026-06-29');
  });

  it('resets subtasks, snooze and fired alerts for the next occurrence', () => {
    const t = completeTask(
      mk({ repeat: { kind: 'daily' }, dueDate: TODAY, snoozedUntil: NOW + 1, firedAlerts: ['k'], subtasks: [{ id: 's', title: 'x', done: true }] }),
      TODAY,
      NOW,
    );
    expect(t.subtasks[0].done).toBe(false);
    expect(t.snoozedUntil).toBeNull();
    expect(t.firedAlerts).toEqual([]);
  });

  it('does not duplicate a history date', () => {
    const t = completeTask(mk({ repeat: { kind: 'daily' }, dueDate: TODAY, completedDates: [TODAY] }), TODAY, NOW);
    expect(t.completedDates).toEqual([TODAY]);
  });
});

describe('reopenTask', () => {
  it('re-opens a done one-off and removes its history entry', () => {
    const done = completeTask(mk({ dueDate: TODAY }), TODAY, NOW);
    const open = reopenTask(done, NOW);
    expect(open.done).toBe(false);
    expect(open.completedAt).toBeNull();
    expect(open.completedDates).toEqual([]);
  });
});

describe('normalizeTask', () => {
  it('migrates a legacy daily:true record to a repeat rule with a due date', () => {
    const t = mk({ id: 'a', daily: true });
    expect(t.repeat).toEqual({ kind: 'daily' });
    expect(t.dueDate).toBe(TODAY); // repeating tasks always get an anchor
    expect(t.reminders).toEqual([]);
    expect(t.completedDates).toEqual([]);
  });

  it('migrates a legacy daily:false record to a one-off', () => {
    expect(mk({ daily: false }).repeat).toEqual({ kind: 'none' });
  });

  it('settles a legacy done repeating task onto its next occurrence', () => {
    const t = mk({ daily: true, done: true, doneDate: TODAY });
    expect(t.done).toBe(false);
    expect(t.dueDate).toBe('2026-06-19');
    expect(t.completedDates).toEqual([TODAY]);
  });

  it('converts the old everyNDays rule to custom days', () => {
    expect(mk({ repeat: { kind: 'everyNDays', n: 3 }, dueDate: TODAY }).repeat).toEqual({ kind: 'custom', every: 3, unit: 'days' });
  });

  it('seeds history for an already-done legacy one-off', () => {
    const t = mk({ done: true, doneDate: '2026-06-10' });
    expect(t.completedDates).toEqual(['2026-06-10']);
  });

  it('is idempotent on a current-shape task', () => {
    const once = mk({ repeat: { kind: 'weekly', days: [1] }, reminders: [{ id: 'r', offsetMin: 10 }] });
    expect(normalizeTask(once, NOW)).toEqual(once);
  });

  it('keeps a valid priority, drops non-string tags, validates time and date', () => {
    const t = mk({ priority: 'high', tags: ['work', 7], dueTime: '9:5', dueDate: 'soon' });
    expect(t.priority).toBe('high');
    expect(t.tags).toEqual(['work']);
    expect(t.dueTime).toBeNull();
    expect(t.dueDate).toBeNull();
  });

  it('normalizes weekly days and a monthly day', () => {
    expect(mk({ repeat: { kind: 'weekly', days: [1, 3, 9, 'x'] }, dueDate: TODAY }).repeat).toEqual({ kind: 'weekly', days: [1, 3] });
    expect(mk({ repeat: { kind: 'monthly', day: 99 }, dueDate: '2026-06-18' }).repeat).toEqual({ kind: 'monthly', day: 18 });
  });

  it('normalizes reminders: de-duplicates offsets and sorts earliest-first', () => {
    const t = mk({ reminders: [{ id: 'a', offsetMin: 0 }, { id: 'b', offsetMin: 60 }, { id: 'c', offsetMin: 60 }, { offsetMin: -5 }, { offsetMin: 'x' }] });
    expect(t.reminders.map((r) => r.offsetMin)).toEqual([60, 0]);
  });
});

describe('repeatLabel', () => {
  it('describes each repeat kind', () => {
    expect(repeatLabel({ kind: 'none' })).toBeNull();
    expect(repeatLabel({ kind: 'daily' })).toBe('Every day');
    expect(repeatLabel({ kind: 'weekly', days: [1, 2] })).toBe('Weekly');
    expect(repeatLabel({ kind: 'monthly', day: 5 })).toBe('Monthly');
    expect(repeatLabel({ kind: 'custom', every: 3, unit: 'days' })).toBe('Every 3 days');
    expect(repeatLabel({ kind: 'custom', every: 1, unit: 'weeks' })).toBe('Every week');
    expect(repeatLabel({ kind: 'custom', every: 2, unit: 'months' })).toBe('Every 2 months');
  });
});
