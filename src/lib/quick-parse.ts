/**
 * Natural-language quick-add. Turns a line like
 *   "Pay rent tomorrow !high #home"
 * into a structured task: a due date, a priority, tags, and the leftover title.
 * Pure and date-injectable so it can be unit-tested. Recognised tokens are
 * stripped from the title; anything it doesn't understand stays in the title.
 */
import { localDate } from './format';
import type { Priority, Weekday } from './types';

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null;
  priority: Priority;
  tags: string[];
}

const WEEKDAYS: Record<string, Weekday> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const PRIORITY_WORDS: Record<string, Priority> = {
  low: 'low', l: 'low',
  med: 'medium', medium: 'medium', m: 'medium',
  high: 'high', h: 'high', hi: 'high',
};

function dateFromParts(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(today: string, n: number): string {
  const base = dateFromParts(today);
  base.setDate(base.getDate() + n);
  return localDate(base);
}

/** The next occurrence of `target` strictly after today (1–7 days ahead). */
function nextWeekday(today: string, target: Weekday): string {
  const delta = ((target - dateFromParts(today).getDay() + 7) % 7) || 7;
  return addDays(today, delta);
}

/** Strip the first regex match from `text`, returning the cleaned text. */
function strip(text: string, re: RegExp): string {
  return text.replace(re, ' ');
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

  const wd = text.match(/\b(next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i);
  if (wd) {
    const target = WEEKDAYS[wd[2].toLowerCase()];
    const base = nextWeekday(today, target);
    const dueDate = wd[1] ? addDays(base, 7) : base; // "next friday" = the one after the coming friday
    return { text: strip(text, /\b(?:next\s+)?(?:sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i), dueDate };
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

  // Date phrase.
  const dated = parseDate(text, today);
  text = dated.text;

  const title = text.replace(/\s+/g, ' ').trim();
  return { title, dueDate: dated.dueDate, priority, tags: [...new Set(tags)] };
}
