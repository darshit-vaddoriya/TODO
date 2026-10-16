/**
 * Natural-language quick-add. Turns a line like
 *   "Pay rent tomorrow 6pm !high #home every month"
 * into a structured task: a due date and time, a priority, tags, a repeat rule
 * and the leftover title. Pure and date-injectable so it can be unit-tested.
 * Recognised tokens are stripped from the title; anything it doesn't
 * understand stays in the title.
 */
import { localDate } from '@/domain/dates';
import { addDays, dayOfMonth, firstOccurrenceOnOrAfter, weekdayOf } from '@/domain/task-model';
import type { Priority, RepeatRule, Weekday } from '@/domain/types';

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null;
  /** "HH:MM" if a time of day was given. */
  dueTime: string | null;
  priority: Priority;
  tags: string[];
  repeat: RepeatRule;
}

const WEEKDAYS: Record<string, Weekday> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const WD = 'sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday';

const PRIORITY_WORDS: Record<string, Priority> = {
  low: 'low',
  l: 'low',
  med: 'medium',
  medium: 'medium',
  m: 'medium',
  high: 'high',
  h: 'high',
  hi: 'high',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The next occurrence of `target` strictly after today (1–7 days ahead). */
function nextWeekday(today: string, target: Weekday): string {
  const delta = (target - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, delta);
}

const strip = (text: string, re: RegExp) => text.replace(re, ' ');

/** "6pm", "6:30 pm", "at 18:30", "noon" → "HH:MM". */
function parseTime(text: string): { text: string; time: string | null } {
  const h12 = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (h12) {
    const h = Number(h12[1]);
    const m = Number(h12[2] ?? 0);
    if (h >= 1 && h <= 12 && m <= 59) {
      const hour = (h % 12) + (/pm/i.test(h12[3]) ? 12 : 0);
      return { text: strip(text, /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i), time: `${pad(hour)}:${pad(m)}` };
    }
  }
  const h24 = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return { text: strip(text, /\b(?:at\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\b/), time: `${pad(Number(h24[1]))}:${h24[2]}` };
  if (/\bnoon\b/i.test(text)) return { text: strip(text, /\b(?:at\s+)?noon\b/i), time: '12:00' };
  return { text, time: null };
}

/** "every monday", "daily", "weekly", "monthly", "every 2 weeks" … → a repeat rule. */
function parseRepeat(text: string): { text: string; repeat: RepeatRule } {
  const everyWd = text.match(new RegExp(`\\bevery\\s+(${WD})\\b`, 'i'));
  if (everyWd) {
    return { text: strip(text, new RegExp(`\\bevery\\s+(?:${WD})\\b`, 'i')), repeat: { kind: 'weekly', days: [WEEKDAYS[everyWd[1].toLowerCase()]] } };
  }
  const everyN = text.match(/\bevery\s+(\d{1,3})\s+(day|days|week|weeks|month|months)\b/i);
  if (everyN) {
    const unit = /week/i.test(everyN[2]) ? 'weeks' : /month/i.test(everyN[2]) ? 'months' : 'days';
    return {
      text: strip(text, /\bevery\s+\d{1,3}\s+(?:day|days|week|weeks|month|months)\b/i),
      repeat: { kind: 'custom', every: Math.max(1, Number(everyN[1])), unit },
    };
  }
  if (/\b(?:every\s+day|daily)\b/i.test(text)) return { text: strip(text, /\b(?:every\s+day|daily)\b/i), repeat: { kind: 'daily' } };
  if (/\b(?:every\s+week|weekly)\b/i.test(text)) return { text: strip(text, /\b(?:every\s+week|weekly)\b/i), repeat: { kind: 'weekly', days: [] } };
  if (/\b(?:every\s+month|monthly)\b/i.test(text)) return { text: strip(text, /\b(?:every\s+month|monthly)\b/i), repeat: { kind: 'monthly', day: 1 } };
  return { text, repeat: { kind: 'none' } };
}

function parseDate(text: string, today: string): { text: string; dueDate: string | null } {
  // Order matters: try the more specific patterns first.
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return { text: strip(text, /\b\d{4}-\d{2}-\d{2}\b/), dueDate: iso[1] };

  const inN = text.match(/\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i);
  if (inN) {
    const n = Number(inN[1]) * (/week/i.test(inN[2]) ? 7 : 1);
    return { text: strip(text, /\bin\s+\d{1,3}\s+(?:day|days|week|weeks)\b/i), dueDate: addDays(today, n) };
  }

  if (/\btomorrow\b|\btmrw\b|\btmr\b/i.test(text)) {
    return { text: strip(text, /\btomorrow\b|\btmrw\b|\btmr\b/i), dueDate: addDays(today, 1) };
  }
  if (/\btoday\b|\btonight\b/i.test(text)) {
    return { text: strip(text, /\btoday\b|\btonight\b/i), dueDate: today };
  }

  const wd = text.match(new RegExp(`\\b(next\\s+)?(${WD})\\b`, 'i'));
  if (wd) {
    const base = nextWeekday(today, WEEKDAYS[wd[2].toLowerCase()]);
    const dueDate = wd[1] ? addDays(base, 7) : base; // "next friday" = the one after the coming friday
    return { text: strip(text, new RegExp(`\\b(?:next\\s+)?(?:${WD})\\b`, 'i')), dueDate };
  }

  return { text, dueDate: null };
}

export function parseQuickAdd(raw: string, today: string = localDate()): ParsedQuickAdd {
  let text = raw;

  // Tags: #word (letters, digits, _ or -). Collected and stripped.
  const tags: string[] = [];
  text = text.replace(/#([\p{L}\d_-]+)/gu, (_, tag) => {
    tags.push(tag);
    return ' ';
  });

  // Priority: !high / !m / !low … last one wins. Stripped.
  let priority: Priority = 'none';
  text = text.replace(/!([a-z]+)\b/gi, (match, word) => {
    const p = PRIORITY_WORDS[word.toLowerCase()];
    if (p) {
      priority = p;
      return ' ';
    }
    return match; // not a priority word — leave it in the title
  });

  // Repeat first ("every monday" must not be read as the date "monday"), then time, then date.
  const rep = parseRepeat(text);
  text = rep.text;
  let repeat = rep.repeat;
  const timed = parseTime(text);
  text = timed.text;
  const dated = parseDate(text, today);
  text = dated.text;

  let dueDate = dated.dueDate;
  // A repeating task needs a date to repeat from; a time alone means today.
  if (repeat.kind !== 'none' && !dueDate) {
    dueDate = repeat.kind === 'weekly' && repeat.days.length > 0 ? firstOccurrenceOnOrAfter(repeat, today) : today;
  }
  if (timed.time && !dueDate) dueDate = today;

  // Fill in what the rule inherits from the date.
  if (repeat.kind === 'weekly' && repeat.days.length === 0 && dueDate) repeat = { kind: 'weekly', days: [weekdayOf(dueDate)] };
  if (repeat.kind === 'monthly' && dueDate) repeat = { kind: 'monthly', day: dayOfMonth(dueDate) };

  const title = text.replace(/\s+/g, ' ').trim();
  return { title, dueDate, dueTime: dueDate ? timed.time : null, priority, tags: [...new Set(tags)], repeat };
}
