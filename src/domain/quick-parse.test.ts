import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '@/domain/quick-parse';

// A Thursday, so weekday maths is easy to reason about.
const TODAY = '2026-06-18'; // 2026-06-18 is a Thursday (getDay() === 4)

describe('parseQuickAdd', () => {
  it('returns a plain title untouched', () => {
    expect(parseQuickAdd('Buy milk', TODAY)).toEqual({ title: 'Buy milk', dueDate: null, dueTime: null, priority: 'none', tags: [], repeat: { kind: 'none' } });
  });

  it('extracts tags and strips them from the title', () => {
    const r = parseQuickAdd('Email #work #urgent report', TODAY);
    expect(r.title).toBe('Email report');
    expect(r.tags).toEqual(['work', 'urgent']);
  });

  it('dedupes repeated tags', () => {
    expect(parseQuickAdd('Ping #a #a', TODAY).tags).toEqual(['a']);
  });

  it('reads an explicit priority word, last one winning', () => {
    expect(parseQuickAdd('Call mom !high', TODAY).priority).toBe('high');
    expect(parseQuickAdd('x !low !med', TODAY).priority).toBe('medium');
    expect(parseQuickAdd('x !h', TODAY).priority).toBe('high');
  });

  it('leaves a non-priority bang token in the title', () => {
    const r = parseQuickAdd('Fix !important bug', TODAY);
    expect(r.priority).toBe('none');
    expect(r.title).toBe('Fix !important bug');
  });

  it('parses today, tonight and tomorrow', () => {
    expect(parseQuickAdd('Rest tonight', TODAY).dueDate).toBe('2026-06-18');
    expect(parseQuickAdd('Ship today', TODAY).dueDate).toBe('2026-06-18');
    expect(parseQuickAdd('Pay rent tomorrow', TODAY)).toMatchObject({ title: 'Pay rent', dueDate: '2026-06-19' });
  });

  it('parses "in N days/weeks"', () => {
    expect(parseQuickAdd('Renew in 3 days', TODAY).dueDate).toBe('2026-06-21');
    expect(parseQuickAdd('Review in 2 weeks', TODAY).dueDate).toBe('2026-07-02');
  });

  it('parses a weekday as its next occurrence', () => {
    // Thursday → next Monday is 2026-06-22.
    expect(parseQuickAdd('Standup monday', TODAY).dueDate).toBe('2026-06-22');
    // Same weekday means next week, never today.
    expect(parseQuickAdd('Weekly thursday', TODAY).dueDate).toBe('2026-06-25');
  });

  it('parses "next <weekday>" as a week further out', () => {
    expect(parseQuickAdd('Demo next monday', TODAY).dueDate).toBe('2026-06-29');
  });

  it('parses an ISO date', () => {
    expect(parseQuickAdd('Launch 2026-12-01', TODAY)).toMatchObject({ title: 'Launch', dueDate: '2026-12-01' });
  });

  it('combines title, date, priority and tags', () => {
    const r = parseQuickAdd('Call mom !high #family tomorrow', TODAY);
    expect(r).toEqual({ title: 'Call mom', dueDate: '2026-06-19', dueTime: null, priority: 'high', tags: ['family'], repeat: { kind: 'none' } });
  });

  it('collapses whitespace left by stripped tokens', () => {
    expect(parseQuickAdd('  Water   plants   #home  ', TODAY).title).toBe('Water plants');
  });

  describe('time of day', () => {
    it('reads 12-hour times', () => {
      expect(parseQuickAdd('Call dentist tomorrow 6pm', TODAY)).toMatchObject({ title: 'Call dentist', dueDate: '2026-06-19', dueTime: '18:00' });
      expect(parseQuickAdd('Standup at 9:30 am', TODAY)).toMatchObject({ title: 'Standup', dueTime: '09:30' });
      expect(parseQuickAdd('Lunch 12pm', TODAY).dueTime).toBe('12:00');
      expect(parseQuickAdd('Sleep 12 am', TODAY).dueTime).toBe('00:00');
    });
    it('reads 24-hour times and noon', () => {
      expect(parseQuickAdd('Train at 18:45', TODAY).dueTime).toBe('18:45');
      expect(parseQuickAdd('Meet at noon', TODAY)).toMatchObject({ title: 'Meet', dueTime: '12:00' });
    });
    it('a time with no date means today', () => {
      expect(parseQuickAdd('Water plants 7pm', TODAY)).toMatchObject({ dueDate: TODAY, dueTime: '19:00' });
    });
    it('does not treat an ISO date or a bare number as a time', () => {
      expect(parseQuickAdd('Launch 2026-12-01', TODAY).dueTime).toBeNull();
      expect(parseQuickAdd('Read 25 pages', TODAY)).toMatchObject({ title: 'Read 25 pages', dueTime: null });
    });
    it('rejects an impossible 12-hour time', () => {
      expect(parseQuickAdd('Odd 13pm', TODAY).dueTime).toBeNull();
    });
  });

  describe('repeat', () => {
    it('daily', () => {
      expect(parseQuickAdd('Stretch every day', TODAY)).toMatchObject({ title: 'Stretch', repeat: { kind: 'daily' }, dueDate: TODAY });
      expect(parseQuickAdd('Stretch daily 7am', TODAY)).toMatchObject({ repeat: { kind: 'daily' }, dueTime: '07:00' });
    });
    it('every <weekday> repeats weekly from the first such day (today counts)', () => {
      expect(parseQuickAdd('Team sync every monday', TODAY)).toMatchObject({
        title: 'Team sync',
        repeat: { kind: 'weekly', days: [1] },
        dueDate: '2026-06-22',
      });
      expect(parseQuickAdd('Review every thursday', TODAY)).toMatchObject({ repeat: { kind: 'weekly', days: [4] }, dueDate: TODAY });
    });
    it('weekly takes its weekday from the date', () => {
      expect(parseQuickAdd('Plan week weekly monday', TODAY)).toMatchObject({ repeat: { kind: 'weekly', days: [1] }, dueDate: '2026-06-22' });
    });
    it('monthly takes its day from the date', () => {
      expect(parseQuickAdd('Pay rent monthly 2026-07-05', TODAY)).toMatchObject({
        title: 'Pay rent',
        repeat: { kind: 'monthly', day: 5 },
        dueDate: '2026-07-05',
      });
      expect(parseQuickAdd('Report every month', TODAY)).toMatchObject({ repeat: { kind: 'monthly', day: 18 } });
    });
    it('every N days / weeks / months', () => {
      expect(parseQuickAdd('Water plants every 3 days', TODAY)).toMatchObject({ title: 'Water plants', repeat: { kind: 'custom', every: 3, unit: 'days' } });
      expect(parseQuickAdd('Deep clean every 2 weeks', TODAY).repeat).toEqual({ kind: 'custom', every: 2, unit: 'weeks' });
      expect(parseQuickAdd('Checkup every 6 months', TODAY).repeat).toEqual({ kind: 'custom', every: 6, unit: 'months' });
    });
    it('everything together', () => {
      expect(parseQuickAdd('Gym every monday 6:30am !high #health', TODAY)).toEqual({
        title: 'Gym',
        dueDate: '2026-06-22',
        dueTime: '06:30',
        priority: 'high',
        tags: ['health'],
        repeat: { kind: 'weekly', days: [1] },
      });
    });
  });
});
