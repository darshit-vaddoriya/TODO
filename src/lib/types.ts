/** The shape of everything Yaad stores. One reminder = one repeating interval ping. */

/** "HH:MM" in 24-hour local time, e.g. "08:00". */
export type ClockTime = string;

/** Day of week, 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The preset interval choices offered as chips, plus "custom" for a typed value. */
export const INTERVAL_PRESETS = [15, 30, 60, 120] as const;

export interface Reminder {
  id: string;
  /** What to remind about, e.g. "Drink water". */
  title: string;
  /** A single emoji shown on the tile. */
  emoji: string;
  /** Minutes between pings. Any positive integer; the chips offer 15 / 30 / 60 / 120. */
  intervalMin: number;
  /** Off reminders never fire and sit at the bottom of the list. */
  enabled: boolean;
  /** Only ping between these local times (quiet hours are outside the window). */
  startTime: ClockTime;
  endTime: ClockTime;
  /** Only ping on these weekdays. Empty is treated as "every day". */
  days: Weekday[];
  /** Ask the device to vibrate with the notification (where supported). */
  vibrate: boolean;
  /** When this reminder last pinged, epoch ms. null = never fired yet. */
  lastFiredAt: number | null;
  /** If set and in the future, the reminder is snoozed until this epoch ms (no pings before it). */
  snoozedUntil?: number | null;
  /** How many times it has pinged today (resets at local midnight). For the "done so far" count. */
  firedToday: number;
  /** The local date ("YYYY-MM-DD") firedToday counts for. */
  firedTodayDate: string;
  createdAt: number;
  updatedAt: number;
}

/** Everything held in memory and persisted. Kept as an object so it can grow like Hisaab's. */
export interface Collections {
  reminders: Reminder[];
}

/** Task importance. "none" is the default (unflagged). */
export type Priority = 'none' | 'low' | 'medium' | 'high';

/**
 * When a task reappears unchecked. `none` is a one-off; the rest reset `done`
 * at local midnight on the days they next come due.
 */
export type RepeatRule =
  | { kind: 'none' }
  | { kind: 'daily' }
  | { kind: 'weekly'; days: Weekday[] }
  | { kind: 'everyNDays'; n: number };

/** A single checklist item nested under a task. */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** A to-do item. A repeating task reappears unchecked when next due; a one-off is for today only. */
export interface Task {
  id: string;
  title: string;
  /** Free-text details shown when the task is expanded. */
  notes: string;
  done: boolean;
  /** The local date ("YYYY-MM-DD") the current `done` value is for. */
  doneDate: string;
  /** When the task was last completed, epoch ms. null = not done. */
  completedAt: number | null;
  /** Due date as "YYYY-MM-DD", or null for no due date. */
  dueDate: string | null;
  /** The local date we last fired a "due" notification for, so it pings at most once a day. */
  dueNotifiedDate: string | null;
  priority: Priority;
  /** Free-form labels for grouping and filtering. */
  tags: string[];
  /** Nested checklist items. */
  subtasks: Subtask[];
  /** Manual sort position — lower sorts higher in the list. */
  order: number;
  /** Recurrence rule. `{ kind: 'none' }` means a one-off task. */
  repeat: RepeatRule;
  createdAt: number;
  updatedAt: number;
}

/** A ready-made, research-backed reminder the user can add with one tap. */
export interface Preset {
  id: string;
  title: string;
  emoji: string;
  intervalMin: number;
  startTime: ClockTime;
  endTime: ClockTime;
  /** One line explaining the interval, with its source. Shown under the title. */
  evidence: string;
}
