import { describe, expect, it } from 'vitest';
import { clampDrag, resolveSwipe, swipeThreshold } from './swipe';

describe('swipeThreshold', () => {
  it('is about a third of the width, clamped to [56, 110]', () => {
    expect(swipeThreshold(300)).toBe(99);
    expect(swipeThreshold(100)).toBe(56); // floor
    expect(swipeThreshold(600)).toBe(110); // ceiling
  });
});

describe('resolveSwipe', () => {
  const W = 300; // threshold 99
  it('fires right past the positive threshold', () => {
    expect(resolveSwipe(99, W)).toBe('right');
    expect(resolveSwipe(98, W)).toBeNull();
  });
  it('fires left past the negative threshold', () => {
    expect(resolveSwipe(-99, W)).toBe('left');
    expect(resolveSwipe(-98, W)).toBeNull();
  });
  it('returns null for a small nudge', () => {
    expect(resolveSwipe(0, W)).toBeNull();
    expect(resolveSwipe(20, W)).toBeNull();
  });
});

describe('clampDrag', () => {
  it('limits the offset to 60% of the width in either direction', () => {
    expect(clampDrag(500, 300)).toBe(180);
    expect(clampDrag(-500, 300)).toBe(-180);
    expect(clampDrag(40, 300)).toBe(40);
  });
});
