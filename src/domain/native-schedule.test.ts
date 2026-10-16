import { describe, expect, it } from 'vitest';
import type { AlertSettings } from '@/domain/alerts';
import { MAX_PER_HABIT, MAX_SCHEDULED, planScheduled } from '@/domain/native-schedule';
import { normalizeTask } from '@/domain/task-model';
import type { Reminder, Task } from '@/domain/types';

const S: AlertSettings = {
  defaultReminderTime: '09:00',
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  overdueReminders: true,
  dailySummary: false,
  summaryTime: '08:00',
  summaryDate: '',
};
const at = (h: number, m = 0, day = 18) => new Date(2026, 5, day, h, m, 0, 0).getTime();
const NOW = at(8);
const task = (over: Record<string, unknown> = {}): Task =>
  normalizeTask({ id: 't1', title: 'Pay rent', createdAt: 1, dueDate: '2026-06-18', dueTime: '10:00', reminders: [{ id: 'r0', offsetMin: 30 }], ...over }, NOW);
const habit = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'h1',
  title: 'Water',
  emoji: '💧',
  intervalMin: 120,
  enabled: true,
  startTime: '08:00',
  endTime: '22:00',
  days: [],
  vibrate: true,
  lastFiredAt: NOW,
  firedToday: 0,
  firedTodayDate: '2026-06-18',
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('planScheduled — tasks', () => {
  it('schedules a future task alert at its moment', () => {
    const plan = planScheduled([task()], [], NOW, S);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'task', taskId: 't1', reminderId: 'r0', at: at(9, 30), offsetMin: 30 });
  });

  it('skips done tasks, delivered alerts and alerts already past', () => {
    expect(planScheduled([task({ done: true })], [], NOW, S)).toEqual([]);
    const t = task();
    const key = planScheduled([t], [], NOW, S)[0]!.key;
    expect(planScheduled([{ ...t, firedAlerts: [key] }], [], NOW, S)).toEqual([]);
    expect(planScheduled([t], [], at(9, 45), S)).toEqual([]);
  });

  it('a snooze replaces the task alerts until it ends', () => {
    const plan = planScheduled([task({ snoozedUntil: at(8, 20) })], [], NOW, S);
    expect(plan.map((p) => [p.kind, p.at])).toEqual([['snooze', at(8, 20)]]);
  });

  it('holds an alert that falls in quiet hours until they end', () => {
    const quiet = { ...S, quietEnabled: true, quietStart: '09:00', quietEnd: '11:00' };
    expect(planScheduled([task()], [], NOW, quiet)[0]?.at).toBe(at(11));
  });

  it('holds everything until Do Not Disturb ends', () => {
    expect(planScheduled([task()], [], NOW, S, at(12))[0]?.at).toBe(at(12));
  });

  it('ignores alerts beyond two weeks', () => {
    expect(planScheduled([task({ dueDate: '2026-07-20' })], [], NOW, S)).toEqual([]);
  });
});

describe('planScheduled — repeating reminders', () => {
  it('chains pings one interval apart inside the window', () => {
    const plan = planScheduled([], [habit()], NOW, S).filter((p) => p.at < at(23));
    expect(plan.slice(0, 3).map((p) => p.at)).toEqual([at(10), at(12), at(14)]);
    expect(plan.every((p) => p.kind === 'habit' && p.reminderId === 'h1')).toBe(true);
  });

  it('skips disabled reminders and caps each one', () => {
    expect(planScheduled([], [habit({ enabled: false })], NOW, S)).toEqual([]);
    expect(planScheduled([], [habit({ intervalMin: 5 })], NOW, S).length).toBeLessThanOrEqual(MAX_PER_HABIT);
  });

  it('caps the whole list and keeps it in time order', () => {
    const many = Array.from({ length: 20 }, (_, i) => habit({ id: `h${i}`, intervalMin: 30 }));
    const plan = planScheduled([], many, NOW, S);
    expect(plan.length).toBeLessThanOrEqual(MAX_SCHEDULED);
    expect(plan.map((p) => p.at)).toEqual([...plan.map((p) => p.at)].sort((a, b) => a - b));
  });
});
