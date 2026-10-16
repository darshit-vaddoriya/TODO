import { describe, expect, it } from 'vitest';
import {
  alertKey,
  alertMoment,
  dueInPhrase,
  dueMoment,
  effectiveMoment,
  FRESH_MS,
  inQuietHours,
  liveAlertKeys,
  localMoment,
  newlyPastKeys,
  offsetLabel,
  planAlerts,
  planSummary,
  quietEndAfter,
  type AlertSettings,
} from './alerts';
import { normalizeTask } from './task-model';
import type { Task } from './types';

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
const mk = (over: Record<string, unknown> = {}): Task => normalizeTask({ id: 't1', title: 'Pay rent', createdAt: 1, ...over }, at(8));
const withReminders = (offsets: number[], over: Record<string, unknown> = {}) =>
  mk({ dueDate: '2026-06-18', dueTime: '10:00', reminders: offsets.map((o, i) => ({ id: `r${i}`, offsetMin: o })), ...over });

describe('moments', () => {
  it('a due moment uses the task time, else the default reminder time', () => {
    expect(dueMoment({ dueDate: '2026-06-18', dueTime: '17:30' }, '09:00')).toBe(at(17, 30));
    expect(dueMoment({ dueDate: '2026-06-18', dueTime: null }, '09:00')).toBe(at(9));
    expect(dueMoment({ dueDate: null, dueTime: null }, '09:00')).toBeNull();
  });
  it('an alert is offset minutes before the due moment', () => {
    expect(alertMoment({ dueDate: '2026-06-18', dueTime: '10:00' }, { offsetMin: 30 }, '09:00')).toBe(at(9, 30));
    expect(alertMoment({ dueDate: '2026-06-18', dueTime: '10:00' }, { offsetMin: 1440 }, '09:00')).toBe(at(10, 0, 17));
  });
  it('the key changes when the moment changes (so edits recalculate)', () => {
    expect(alertKey('t', 'r', 1)).not.toBe(alertKey('t', 'r', 2));
  });
  it('localMoment builds a local epoch', () => {
    expect(localMoment('2026-06-18', '07:30')).toBe(at(7, 30));
  });
});

describe('planAlerts — firing', () => {
  it('fires a reminder that just came due', () => {
    const plan = planAlerts([withReminders([0])], at(10, 0, 18) + 20_000, S);
    expect(plan.fire).toHaveLength(1);
    expect(plan.fire[0]).toMatchObject({ taskId: 't1', kind: 'reminder', offsetMin: 0 });
    expect(plan.missed).toEqual([]);
  });

  it('does not fire before the moment', () => {
    expect(planAlerts([withReminders([0])], at(9, 59), S).fire).toEqual([]);
  });

  it('supports several reminders on one task, each firing at its own time', () => {
    const t = withReminders([60, 10, 0]);
    expect(planAlerts([t], at(9, 0, 18) + 10_000, S).fire.map((a) => a.offsetMin)).toEqual([60]);
    expect(planAlerts([t], at(9, 50) + 10_000, S).fire.map((a) => a.offsetMin).sort((a, b) => a - b)).toEqual([10]); // 60 is too old → missed
    expect(planAlerts([t], at(10, 0) + 10_000, S).fire.map((a) => a.offsetMin)).toEqual([0]);
  });

  it('prevents duplicates: an already-fired key never fires again', () => {
    const t = withReminders([0]);
    const key = planAlerts([t], at(10, 0) + 1000, S).fire[0].key;
    const again = planAlerts([{ ...t, firedAlerts: [key] }], at(10, 0) + 21_000, S);
    expect(again.fire).toEqual([]);
    expect(again.missed).toEqual([]);
  });

  it('a task with no due date or reminders never alerts', () => {
    expect(planAlerts([mk({ dueDate: null })], at(12), S).fire).toEqual([]);
    expect(planAlerts([mk({ dueDate: '2026-06-18', dueTime: '10:00' })], at(12), S).fire).toEqual([]);
  });

  it('completed tasks do not trigger alerts', () => {
    const done = withReminders([0], { done: true });
    const plan = planAlerts([done], at(10, 0) + 1000, S);
    expect(plan.fire).toEqual([]);
    expect(plan.missed).toEqual([]);
  });

  it('uses the default reminder time when the task has no time', () => {
    const t = mk({ dueDate: '2026-06-18', reminders: [{ id: 'r', offsetMin: 0 }] });
    expect(planAlerts([t], at(9, 0) + 5000, S).fire).toHaveLength(1);
    expect(planAlerts([t], at(8, 59), S).fire).toEqual([]);
  });

  it('editing the due time recalculates: old fired key does not suppress the new moment', () => {
    const t = withReminders([0]);
    const oldKey = planAlerts([t], at(10, 0) + 1000, S).fire[0].key;
    const moved = { ...t, dueTime: '15:00', firedAlerts: [oldKey] };
    expect(planAlerts([moved], at(15, 0) + 1000, S).fire).toHaveLength(1);
  });
});

describe('planAlerts — missed on reopen', () => {
  it('reports old unfired alerts as missed, not fired', () => {
    const plan = planAlerts([withReminders([0])], at(10, 0) + FRESH_MS + 60_000, S);
    expect(plan.fire).toEqual([]);
    expect(plan.missed).toHaveLength(1);
  });

  it('the boundary: exactly FRESH_MS late still fires', () => {
    expect(planAlerts([withReminders([0])], at(10, 0) + FRESH_MS, S).fire).toHaveLength(1);
  });

  it('missed alerts disappear once dismissed (key recorded) or the task completes', () => {
    const t = withReminders([0]);
    const missed = planAlerts([t], at(14), S).missed;
    expect(missed).toHaveLength(1);
    expect(planAlerts([{ ...t, firedAlerts: [missed[0].key] }], at(14), S).missed).toEqual([]);
    expect(planAlerts([{ ...t, done: true }], at(14), S).missed).toEqual([]);
  });
});

describe('planAlerts — snooze', () => {
  it('a snoozed task is silent until the snooze ends', () => {
    const t = withReminders([0], { snoozedUntil: at(10, 30) });
    expect(planAlerts([t], at(10, 5), S)).toMatchObject({ fire: [], missed: [] });
  });

  it('fires one wake-up when the snooze ends, then clearing it resumes normal alerts', () => {
    const t = withReminders([0], { snoozedUntil: at(10, 30) });
    const plan = planAlerts([t], at(10, 30) + 5000, S);
    expect(plan.fire).toHaveLength(1);
    expect(plan.fire[0].kind).toBe('snoozed');
  });

  it('a snooze that ended long ago is reported as missed', () => {
    const t = withReminders([0], { snoozedUntil: at(10, 30) });
    expect(planAlerts([t], at(13), S).missed[0].kind).toBe('snoozed');
  });
});

describe('quiet hours', () => {
  const Q = { ...S, quietEnabled: true };
  it('detects windows that wrap midnight', () => {
    expect(inQuietHours(at(23), Q)).toBe(true);
    expect(inQuietHours(at(2), Q)).toBe(true);
    expect(inQuietHours(at(7), Q)).toBe(false);
    expect(inQuietHours(at(12), Q)).toBe(false);
    expect(inQuietHours(at(23), S)).toBe(false); // disabled
  });
  it('detects same-day windows', () => {
    const day = { ...Q, quietStart: '13:00', quietEnd: '15:00' };
    expect(inQuietHours(at(14), day)).toBe(true);
    expect(inQuietHours(at(16), day)).toBe(false);
  });
  it('quietEndAfter finds the next end', () => {
    expect(quietEndAfter(at(2), Q)).toBe(at(7));
    expect(quietEndAfter(at(23), Q)).toBe(at(7, 0, 19));
  });

  it('holds an alert that falls inside quiet hours, then fires it when they end', () => {
    const t = mk({ dueDate: '2026-06-18', dueTime: '02:00', reminders: [{ id: 'r', offsetMin: 0 }] });
    expect(planAlerts([t], at(2, 0) + 5000, Q).fire).toEqual([]); // held
    expect(planAlerts([t], at(6, 59), Q).fire).toEqual([]);
    expect(planAlerts([t], at(7, 0) + 10_000, Q).fire).toHaveLength(1); // released
  });

  it('does not notify for an alert that came due just as quiet hours began; it surfaces as missed in the morning', () => {
    const t = mk({ dueDate: '2026-06-18', dueTime: '21:59', reminders: [{ id: 'r', offsetMin: 0 }] });
    expect(planAlerts([t], at(22, 0) + 5000, Q)).toMatchObject({ fire: [], missed: [] }); // held, no night-time ping
    const morning = planAlerts([t], at(7, 0, 19) + 5000, Q);
    expect(morning.fire).toEqual([]);
    expect(morning.missed).toHaveLength(1); // not lost — shown in the app
  });

  it('an old missed alert is still reported as missed during quiet hours', () => {
    const t = withReminders([0]);
    expect(planAlerts([t], at(23), Q).missed).toHaveLength(1);
  });

  it('effectiveMoment leaves ordinary alerts alone', () => {
    expect(effectiveMoment(at(12), at(12, 0) + 1000, Q)).toBe(at(12));
  });
});

describe('overdue nudge', () => {
  it('lists open tasks whose date has passed, after the default reminder time', () => {
    const late = mk({ dueDate: '2026-06-10' });
    expect(planAlerts([late], at(9, 30), S).overdue).toHaveLength(1);
    expect(planAlerts([late], at(8, 30), S).overdue).toEqual([]); // before 09:00
  });
  it('once a day, and not when disabled, done, or in quiet hours', () => {
    const late = mk({ dueDate: '2026-06-10' });
    expect(planAlerts([{ ...late, dueNotifiedDate: '2026-06-18' }], at(10), S).overdue).toEqual([]);
    expect(planAlerts([late], at(10), { ...S, overdueReminders: false }).overdue).toEqual([]);
    expect(planAlerts([{ ...late, done: true }], at(10), S).overdue).toEqual([]);
    expect(planAlerts([late], at(23), { ...S, quietEnabled: true }).overdue).toEqual([]);
  });
  it('a task due today is not overdue', () => {
    expect(planAlerts([mk({ dueDate: '2026-06-18' })], at(12), S).overdue).toEqual([]);
  });
});

describe('stale fired keys', () => {
  it('flags tasks whose stored keys no longer match a live alert', () => {
    const t = { ...withReminders([0]), firedAlerts: ['t1:r0:12345'] };
    const plan = planAlerts([t], at(9), S);
    expect(plan.stale).toHaveLength(1);
    expect(plan.stale[0].live.size).toBe(1);
  });
  it('does not flag a task whose keys are all live', () => {
    const base = withReminders([0]);
    const key = planAlerts([base], at(10, 0) + 1000, S).fire[0].key;
    expect(planAlerts([{ ...base, firedAlerts: [key] }], at(10, 1), S).stale).toEqual([]);
  });
});

describe('planSummary', () => {
  const SUM = { ...S, dailySummary: true };
  const tasks = [mk({ id: 'a', dueDate: '2026-06-18' }), mk({ id: 'b', dueDate: '2026-06-18' }), mk({ id: 'c', dueDate: '2026-06-10' })];

  it('sends once a day at the chosen time', () => {
    expect(planSummary(tasks, at(7, 59), SUM)).toEqual({ mark: false, text: null });
    const plan = planSummary(tasks, at(8, 1), SUM);
    expect(plan.mark).toBe(true);
    expect(plan.text).toEqual({ title: 'Your day', body: '2 tasks due today · 1 overdue' });
    expect(planSummary(tasks, at(8, 5), { ...SUM, summaryDate: '2026-06-18' })).toEqual({ mark: false, text: null });
  });
  it('stays quiet when disabled', () => {
    expect(planSummary(tasks, at(9), S)).toEqual({ mark: false, text: null });
  });
  it('skips (but marks) a day with nothing due, and a summary that is hours late', () => {
    expect(planSummary([], at(8, 1), SUM)).toEqual({ mark: true, text: null });
    expect(planSummary(tasks, at(20), SUM)).toEqual({ mark: true, text: null });
  });
  it('waits during quiet hours', () => {
    const q = { ...SUM, quietEnabled: true, quietStart: '07:00', quietEnd: '09:00' };
    expect(planSummary(tasks, at(8, 30), q)).toEqual({ mark: false, text: null });
  });
  it('uses the singular for one task', () => {
    expect(planSummary([tasks[0]], at(8, 1), SUM).text?.body).toBe('1 task due today');
  });
});

describe('wording', () => {
  it('labels offsets', () => {
    expect(offsetLabel(0)).toBe('At time');
    expect(offsetLabel(10)).toBe('10 minutes before');
    expect(offsetLabel(60)).toBe('1 hour before');
    expect(offsetLabel(120)).toBe('2 hours before');
    expect(offsetLabel(1440)).toBe('1 day before');
  });
  it('phrases when the task is due', () => {
    expect(dueInPhrase(0)).toBe('now');
    expect(dueInPhrase(10)).toBe('in 10 minutes');
    expect(dueInPhrase(1440)).toBe('in 1 day');
  });
});

describe('newlyPastKeys — alerts that are already in the past when added', () => {
  it('skips a new reminder whose moment has passed, keeps a future one', () => {
    // Due 10:00 with reminders 1 day before (yesterday 10:00) and at time; "now" is 08:00.
    const t = withReminders([1440, 0]);
    const keys = newlyPastKeys(t, undefined, at(8), '09:00');
    const past = liveAlertKeys(t, '09:00').filter((a) => a.moment <= at(8));
    expect(keys).toEqual(past.map((a) => a.key));
    expect(keys).toHaveLength(1);
  });

  it('leaves alerts the task already had (genuinely missed ones) alone', () => {
    const t = withReminders([0]);
    expect(newlyPastKeys(t, t, at(14), '09:00')).toEqual([]);
  });

  it('treats a changed due time as new alerts', () => {
    const t = withReminders([0]);
    const moved = { ...t, dueTime: '07:00' }; // new moment 07:00 is already past at 08:00
    expect(newlyPastKeys(moved, t, at(8), '09:00')).toHaveLength(1);
  });

  it('does not repeat a key already recorded as fired', () => {
    const t = withReminders([0]);
    const key = liveAlertKeys(t, '09:00')[0].key;
    expect(newlyPastKeys({ ...t, dueTime: '07:00', firedAlerts: [] }, undefined, at(8), '09:00')).toHaveLength(1);
    expect(newlyPastKeys({ ...t, firedAlerts: [key] }, undefined, at(23), '09:00')).toEqual([]);
  });
});
