/**
 * Completing a task with a bit of feedback: the check pops and the row slides
 * out before the list updates, then an Undo toast offers the way back.
 * Un-checking a done task is immediate.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { buzz } from '../lib/notify';
import type { Task } from '../lib/types';
import { completeWithUndo, setDoneWithUndo } from './taskActions';

const LEAVE_MS = 200;

export function useTaskComplete(task: Task): { leaving: boolean; toggle: () => void } {
  const [leaving, setLeaving] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const toggle = () => {
    if (task.done) {
      void setDoneWithUndo(task, false);
      return;
    }
    if (leaving) return;
    buzz(12);
    setLeaving(true);
    setTimeout(() => {
      void completeWithUndo(task);
      if (alive.current) setLeaving(false); // a repeating task stays in the list, now on its next date
    }, LEAVE_MS);
  };
  return { leaving, toggle };
}
