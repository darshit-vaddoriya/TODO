import { describe, expect, it } from 'vitest';
import { normalizeTask } from '@/domain/task-model';
import type { Task } from '@/domain/types';
import { widgetSummary } from '@/domain/widget';

const TODAY = '2026-06-15';
const task = (over: Partial<Task> & { title: string }, i = 0): Task => normalizeTask({ createdAt: 1000 + i, order: i, ...over }, Date.UTC(2026, 5, 15, 12));

describe('widgetSummary', () => {
  it('counts progress and lists overdue first, then today by time, capped at three', () => {
    const tasks = [
      task({ title: 'Late', dueDate: '2026-06-14' }, 0),
      task({ title: 'Evening', dueDate: TODAY, dueTime: '18:00' }, 1),
      task({ title: 'Morning', dueDate: TODAY, dueTime: '08:00' }, 2),
      task({ title: 'No time', dueDate: TODAY }, 3),
      task({ title: 'Later', dueDate: '2026-06-20' }, 4),
    ];
    const s = widgetSummary(tasks, [], TODAY);
    expect(s.next.map((n) => n.title)).toEqual(['Late', 'Morning', 'Evening']);
    expect(s.next[0]?.overdue).toBe(true);
    expect(s.overdue).toBe(1);
    expect(s.tasksTotal).toBe(4);
    expect(s.tasksDone).toBe(0);
    expect(s.date).toBe(TODAY);
  });

  it('is empty with nothing planned', () => {
    expect(widgetSummary([], [], TODAY)).toEqual({ date: TODAY, tasksDone: 0, tasksTotal: 0, habitsDone: 0, habitsTarget: 0, overdue: 0, next: [] });
  });
});
