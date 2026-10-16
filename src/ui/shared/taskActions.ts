/** Task actions that come with an Undo toast, shared by the Tasks, Home and Calendar screens. */
import type { Task } from '@/domain/types';
import { completeTaskById, removeTask, reopenTaskById, restoreTask, toggleTask } from '@/data/tasks';
import { toast } from '@/services/toast';

/** Complete a task (a repeating one moves to its next occurrence) with Undo. */
export async function completeWithUndo(task: Task): Promise<void> {
  const before = await completeTaskById(task.id);
  if (!before) return;
  toast(task.repeat.kind === 'none' ? 'Task completed' : 'Done — next one scheduled', { action: { label: 'Undo', run: () => void restoreTask(before) } });
}

/** Check or uncheck: completing offers Undo; unchecking re-opens a done one-off. */
export async function setDoneWithUndo(task: Task, done: boolean): Promise<void> {
  if (done) await completeWithUndo(task);
  else await toggleTask(task.id, false);
}

/** Delete a task but offer a few seconds to undo. */
export function deleteWithUndo(task: Task): void {
  void removeTask(task.id);
  toast('Task deleted', { action: { label: 'Undo', run: () => void restoreTask(task) } });
}

export { reopenTaskById };
