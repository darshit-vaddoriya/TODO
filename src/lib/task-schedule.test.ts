import { describe, expect, it } from 'vitest';
import { normalizeTask } from './task-model';
import { taskDueNow } from './task-schedule';
import type { Task } from './types';

const mk = (over: Partial<Task>): Task => normalizeTask({ title: 't', ...over });
// A fixed local time at 9am and at 3am on 2026-06-15.
const at = (h: number) => new Date(2026, 5, 15, h, 0, 0);

describe('taskDueNow', () => {
  it('fires for a task due today, not done, not yet notified, after the morning floor', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-15' }), at(9))).toBe(true);
  });

  it('fires for an overdue task', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-10' }), at(9))).toBe(true);
  });

  it('does not fire before a due date', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-16' }), at(9))).toBe(false);
  });

  it('does not fire for a task without a due date', () => {
    expect(taskDueNow(mk({ dueDate: null }), at(9))).toBe(false);
  });

  it('does not fire for a completed task', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-15', done: true }), at(9))).toBe(false);
  });

  it('does not fire twice on the same day', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-15', dueNotifiedDate: '2026-06-15' }), at(9))).toBe(false);
  });

  it('re-fires on a later day even if notified earlier', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-10', dueNotifiedDate: '2026-06-14' }), at(9))).toBe(true);
  });

  it('stays quiet before the morning floor', () => {
    expect(taskDueNow(mk({ dueDate: '2026-06-15' }), at(3))).toBe(false);
  });
});
