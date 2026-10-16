import { describe, expect, it } from 'vitest';
import { clockToMinutes, everyPhrase, formatClockWith, formatDateWith, formatDays, formatInterval, friendlyDateWith, untilPhrase } from '@/domain/dates';

describe('formatInterval', () => {
  it('formats minutes and hours', () => {
    expect(formatInterval(15)).toBe('15m');
    expect(formatInterval(60)).toBe('1h');
    expect(formatInterval(90)).toBe('1h 30m');
    expect(formatInterval(120)).toBe('2h');
  });
});

describe('everyPhrase', () => {
  it('prefixes "every"', () => {
    expect(everyPhrase(30)).toBe('every 30m');
    expect(everyPhrase(120)).toBe('every 2h');
  });
});

describe('untilPhrase', () => {
  it('says "now" for the past or present', () => {
    expect(untilPhrase(0)).toBe('now');
    expect(untilPhrase(-5000)).toBe('now');
  });
  it('formats future gaps', () => {
    expect(untilPhrase(12 * 60000)).toBe('in 12 min');
    expect(untilPhrase(65 * 60000)).toBe('in 1h 5m');
    expect(untilPhrase(120 * 60000)).toBe('in 2h');
  });
});

describe('clockToMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(clockToMinutes('00:00')).toBe(0);
    expect(clockToMinutes('08:30')).toBe(510);
    expect(clockToMinutes('22:00')).toBe(1320);
  });
});

describe('formatDays', () => {
  it('labels common sets', () => {
    expect(formatDays([])).toBe('Every day');
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(formatDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(formatDays([0, 6])).toBe('Weekends');
    expect(formatDays([1, 3, 5])).toBe('Mon, Wed, Fri');
  });
});

describe('clock and date formatting', () => {
  it('formats 12-hour and 24-hour clocks', () => {
    expect(formatClockWith('08:00', false)).toBe('8:00 AM');
    expect(formatClockWith('00:05', false)).toBe('12:05 AM');
    expect(formatClockWith('12:30', false)).toBe('12:30 PM');
    expect(formatClockWith('17:45', false)).toBe('5:45 PM');
    expect(formatClockWith('17:45', true)).toBe('17:45');
    expect(formatClockWith('07:05', true)).toBe('07:05');
  });

  it('writes dates in each style', () => {
    expect(formatDateWith('2026-06-18', 'mdy')).toBe('06/18/2026');
    expect(formatDateWith('2026-06-18', 'dmy')).toBe('18/06/2026');
    expect(formatDateWith('2026-06-18', 'ymd')).toBe('2026-06-18');
  });

  it('uses friendly words near today, the chosen style otherwise', () => {
    expect(friendlyDateWith('2026-06-18', '2026-06-18', 'dmy')).toBe('Today');
    expect(friendlyDateWith('2026-06-19', '2026-06-18', 'dmy')).toBe('Tomorrow');
    expect(friendlyDateWith('2026-06-17', '2026-06-18', 'dmy')).toBe('Yesterday');
    expect(friendlyDateWith('2026-06-25', '2026-06-18', 'dmy')).toBe('25/06/2026');
    expect(friendlyDateWith('2026-03-09', '2026-03-07', 'ymd')).toBe('2026-03-09'); // across DST
  });
});
