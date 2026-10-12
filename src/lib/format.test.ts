import { describe, expect, it } from 'vitest';
import { clockToMinutes, everyPhrase, formatDays, formatInterval, untilPhrase } from './format';

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
