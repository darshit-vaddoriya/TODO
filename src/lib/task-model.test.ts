import { describe, expect, it } from 'vitest';
import { daysBetween, isDueOn, normalizeTask, repeatLabel } from './task-model';

describe('daysBetween', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
  });

  it('is DST-safe across a spring-forward boundary', () => {
    // US DST starts 2026-03-08; a naive local-ms diff would be off by an hour.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('normalizeTask', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it('migrates a legacy daily:true record to a repeat rule', () => {
    const legacy = { id: 'a', title: 'Water', done: false, daily: true, doneDate: '2026-01-14', createdAt: 100, updatedAt: 100 };
    const t = normalizeTask(legacy, now);
    expect(t.repeat).toEqual({ kind: 'daily' });
    expect(t.priority).toBe('none');
    expect(t.tags).toEqual([]);
    expect(t.subtasks).toEqual([]);
    expect(t.dueDate).toBeNull();
    expect(t.notes).toBe('');
    expect(t.order).toBe(100); // defaults to createdAt so legacy order is stable
  });

  it('migrates a legacy daily:false record to a one-off', () => {
    const t = normalizeTask({ id: 'b', title: 'Call', done: false, daily: false, createdAt: 1 }, now);
    expect(t.repeat).toEqual({ kind: 'none' });
  });

  it('sets completedAt for an already-done legacy task', () => {
    const t = normalizeTask({ id: 'c', title: 'x', done: true, daily: false, createdAt: 42 }, now);
    expect(t.completedAt).toBe(42);
  });

  it('is idempotent on a current-shape task', () => {
    const once = normalizeTask({ id: 'd', title: 'y', createdAt: 5 }, now);
    expect(normalizeTask(once, now)).toEqual(once);
  });

  it('fills defaults for a bare record and keeps a valid priority', () => {
    const t = normalizeTask({ title: 'z', priority: 'high', tags: ['work', 7] }, now);
    expect(t.id).toMatch(/.+/);
    expect(t.priority).toBe('high');
    expect(t.tags).toEqual(['work']); // non-strings dropped
  });

  it('normalizes a weekly repeat and drops out-of-range weekdays', () => {
    const t = normalizeTask({ title: 'gym', repeat: { kind: 'weekly', days: [1, 3, 9, 'x'] } }, now);
    expect(t.repeat).toEqual({ kind: 'weekly', days: [1, 3] });
  });
});

describe('isDueOn', () => {
  const mk = (repeat: Parameters<typeof isDueOn>[0]['repeat'], createdAt = Date.UTC(2026, 0, 1)) => ({ repeat, createdAt });

  it('a one-off is never auto-due', () => {
    expect(isDueOn(mk({ kind: 'none' }), '2026-01-02')).toBe(false);
  });

  it('a daily task is due every day', () => {
    expect(isDueOn(mk({ kind: 'daily' }), '2026-06-30')).toBe(true);
  });

  it('a weekly task is due only on its weekdays', () => {
    // 2026-01-05 is a Monday (getDay() === 1).
    expect(isDueOn(mk({ kind: 'weekly', days: [1] }), '2026-01-05')).toBe(true);
    expect(isDueOn(mk({ kind: 'weekly', days: [1] }), '2026-01-06')).toBe(false);
  });

  it('weekly with no days falls back to daily', () => {
    expect(isDueOn(mk({ kind: 'weekly', days: [] }), '2026-01-06')).toBe(true);
  });

  it('an every-N-days task is due on the cadence from its creation date', () => {
    const anchor = new Date(2026, 0, 1).getTime(); // local anchor → 2026-01-01
    const r = mk({ kind: 'everyNDays', n: 3 }, anchor);
    expect(isDueOn(r, '2026-01-01')).toBe(true);
    expect(isDueOn(r, '2026-01-02')).toBe(false);
    expect(isDueOn(r, '2026-01-04')).toBe(true);
  });
});

describe('repeatLabel', () => {
  it('describes each repeat kind', () => {
    expect(repeatLabel({ kind: 'none' })).toBeNull();
    expect(repeatLabel({ kind: 'daily' })).toBe('Every day');
    expect(repeatLabel({ kind: 'weekly', days: [1, 2] })).toBe('Weekly');
    expect(repeatLabel({ kind: 'weekly', days: [] })).toBe('Every day');
    expect(repeatLabel({ kind: 'everyNDays', n: 3 })).toBe('Every 3 days');
    expect(repeatLabel({ kind: 'everyNDays', n: 1 })).toBe('Every day');
  });
});
