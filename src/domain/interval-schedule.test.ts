import { describe, expect, it } from 'vitest';
import { habitProgress, isDue, nextDueAt, pingsPerDay, withinWindow } from '@/domain/interval-schedule';
import type { Reminder } from '@/domain/types';

/** A reminder fixture; override whatever a test needs. */
function make(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    title: 'Water',
    emoji: '💧',
    intervalMin: 120,
    enabled: true,
    startTime: '08:00',
    endTime: '22:00',
    days: [],
    vibrate: true,
    lastFiredAt: null,
    firedToday: 0,
    firedTodayDate: '2026-01-01',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Local time helper so tests don't depend on the machine's timezone offset in a confusing way. */
function at(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

describe('withinWindow', () => {
  it('is inside the time window', () => {
    const r = make({ startTime: '08:00', endTime: '22:00' });
    expect(withinWindow(r, new Date(at(2026, 1, 5, 10)))).toBe(true);
    expect(withinWindow(r, new Date(at(2026, 1, 5, 7, 59)))).toBe(false);
    expect(withinWindow(r, new Date(at(2026, 1, 5, 22, 1)))).toBe(false);
  });

  it('respects selected weekdays', () => {
    // 2026-01-05 is a Monday. Allow only Tue(2)/Thu(4).
    const r = make({ days: [2, 4] });
    expect(withinWindow(r, new Date(at(2026, 1, 5, 10)))).toBe(false); // Mon
    expect(withinWindow(r, new Date(at(2026, 1, 6, 10)))).toBe(true); // Tue
  });
});

describe('isDue', () => {
  it('is not due before one interval has passed', () => {
    const now = at(2026, 1, 5, 10);
    const r = make({ intervalMin: 120, lastFiredAt: now - 60 * 60000 }); // 60 min ago
    expect(isDue(r, now)).toBe(false);
  });

  it('is due once the interval has elapsed inside the window', () => {
    const now = at(2026, 1, 5, 10);
    const r = make({ intervalMin: 120, lastFiredAt: now - 120 * 60000 });
    expect(isDue(r, now)).toBe(true);
  });

  it('is never due outside the window even if overdue', () => {
    const now = at(2026, 1, 5, 23); // after 22:00
    const r = make({ intervalMin: 120, lastFiredAt: now - 500 * 60000 });
    expect(isDue(r, now)).toBe(false);
  });

  it('is never due when disabled', () => {
    const now = at(2026, 1, 5, 10);
    expect(isDue(make({ enabled: false, lastFiredAt: now - 999 * 60000 }), now)).toBe(false);
  });

  it('is not due while snoozed, then due after the snooze ends', () => {
    const now = at(2026, 1, 5, 10);
    const base = make({ intervalMin: 120, lastFiredAt: now - 200 * 60000 }); // overdue
    expect(isDue({ ...base, snoozedUntil: now + 5 * 60000 }, now)).toBe(false);
    expect(isDue({ ...base, snoozedUntil: now - 1000 }, now)).toBe(true);
  });
});

describe('nextDueAt', () => {
  it('schedules one interval after the last ping', () => {
    const now = at(2026, 1, 5, 10);
    const r = make({ intervalMin: 120, lastFiredAt: now });
    expect(nextDueAt(r, now)).toBe(at(2026, 1, 5, 12));
  });

  it('pushes a ping that lands before the window to the next window open', () => {
    // Last fired at 21:00, +2h = 23:00 which is outside 08:00–22:00 → next day 08:00.
    const last = at(2026, 1, 5, 21);
    const now = at(2026, 1, 5, 21, 30);
    const r = make({ intervalMin: 120, lastFiredAt: last });
    expect(nextDueAt(r, now)).toBe(at(2026, 1, 6, 8));
  });

  it('returns null when disabled', () => {
    expect(nextDueAt(make({ enabled: false }), at(2026, 1, 5, 10))).toBeNull();
  });

  it('never schedules before a snooze ends', () => {
    const now = at(2026, 1, 5, 10);
    const snoozedUntil = at(2026, 1, 5, 10, 45);
    // Interval would put it at 10:30, but the snooze holds it to 10:45.
    const r = make({ intervalMin: 30, lastFiredAt: at(2026, 1, 5, 10), snoozedUntil });
    expect(nextDueAt(r, now)).toBe(snoozedUntil);
  });

  it('skips days that are not selected', () => {
    // Fri 2026-01-02, allow only Mon(1). Next ping should be Mon 2026-01-05 at 08:00.
    const now = at(2026, 1, 2, 9);
    const r = make({ days: [1], intervalMin: 30, lastFiredAt: now });
    expect(nextDueAt(r, now)).toBe(at(2026, 1, 5, 8));
  });
});

describe('pingsPerDay', () => {
  it('counts pings across the active window', () => {
    // 08:00–22:00 is 840 min; every 120 → floor(840/120)+1 = 8.
    expect(pingsPerDay(make({ intervalMin: 120 }))).toBe(8);
    expect(pingsPerDay(make({ intervalMin: 60, startTime: '09:00', endTime: '18:00' }))).toBe(10);
  });
});

describe('habitProgress', () => {
  it("sums today's acknowledged pings against each window's target, ignoring disabled reminders", () => {
    const water = make({ id: 'w', intervalMin: 120, startTime: '08:00', endTime: '22:00', firedToday: 3, firedTodayDate: '2026-06-18' }); // target 8
    const eyes = make({ id: 'e', intervalMin: 60, startTime: '09:00', endTime: '17:00', firedToday: 2, firedTodayDate: '2026-06-18' }); // target 9
    const off = make({ id: 'o', enabled: false, firedToday: 5, firedTodayDate: '2026-06-18' });
    expect(habitProgress([water, eyes, off], '2026-06-18')).toEqual({ done: 5, target: 17 });
  });

  it("ignores counts from an earlier day and never exceeds a reminder's target", () => {
    const stale = make({ firedToday: 4, firedTodayDate: '2026-06-17' });
    expect(habitProgress([stale], '2026-06-18').done).toBe(0);
    const over = make({ intervalMin: 120, startTime: '08:00', endTime: '10:00', firedToday: 99, firedTodayDate: '2026-06-18' }); // target 2
    expect(habitProgress([over], '2026-06-18')).toEqual({ done: 2, target: 2 });
  });

  it('is zero with no reminders', () => {
    expect(habitProgress([], '2026-06-18')).toEqual({ done: 0, target: 0 });
  });
});
