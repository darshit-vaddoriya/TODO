import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quick-parse';

// A Thursday, so weekday maths is easy to reason about.
const TODAY = '2026-06-18'; // 2026-06-18 is a Thursday (getDay() === 4)

describe('parseQuickAdd', () => {
  it('returns a plain title untouched', () => {
    expect(parseQuickAdd('Buy milk', TODAY)).toEqual({ title: 'Buy milk', dueDate: null, priority: 'none', tags: [] });
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
    expect(r).toEqual({ title: 'Call mom', dueDate: '2026-06-19', priority: 'high', tags: ['family'] });
  });

  it('collapses whitespace left by stripped tokens', () => {
    expect(parseQuickAdd('  Water   plants   #home  ', TODAY).title).toBe('Water plants');
  });
});
