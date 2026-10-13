/**
 * A tiny on-device activity log for the Report screen: how many reminder
 * completions and tasks were done each day. Stored as one object in the `meta`
 * store, trimmed to the last 30 days. No history leaves the device.
 */
import { getMeta, setMeta } from './db';
import { localDate } from './format';

export type StatKind = 'reminders' | 'tasks';
export interface DayStat {
  reminders: number;
  tasks: number;
}
type StatLog = Record<string, DayStat>;

const KEY = 'stats';
const KEEP_DAYS = 30;

let cache: StatLog | null = null;

async function load(): Promise<StatLog> {
  if (cache) return cache;
  cache = (await getMeta<StatLog>(KEY)) ?? {};
  return cache;
}

/** Preload the log so the first bump/read is instant. */
export async function initStats(): Promise<void> {
  await load();
}

function trim(log: StatLog): StatLog {
  const cutoff = localDate(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  const kept: StatLog = {};
  for (const [date, value] of Object.entries(log)) if (date >= cutoff) kept[date] = value;
  return kept;
}

/** Record one completion for today. */
export async function bump(kind: StatKind, by = 1): Promise<void> {
  const log = await load();
  const today = localDate();
  const day = log[today] ?? { reminders: 0, tasks: 0 };
  day[kind] = Math.max(0, day[kind] + by);
  cache = trim({ ...log, [today]: day });
  await setMeta(KEY, cache);
}

/** The last `days` days (oldest first), each with its date and counts (zeros filled in). */
export async function recentDays(days = 7): Promise<{ date: string; reminders: number; tasks: number }[]> {
  const log = await load();
  const out: { date: string; reminders: number; tasks: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = localDate(new Date(Date.now() - i * 86_400_000));
    const day = log[date] ?? { reminders: 0, tasks: 0 };
    out.push({ date, reminders: day.reminders, tasks: day.tasks });
  }
  return out;
}

/** Clear the cached copy (used after "Delete everything"). */
export function clearStatsCache(): void {
  cache = null;
}
