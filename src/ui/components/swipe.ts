/**
 * Pure helpers for the swipe gesture on task rows, kept separate from the
 * pointer-event wiring so the thresholds can be unit-tested. A right swipe
 * completes a task; a left swipe deletes it.
 */
export type SwipeAction = 'left' | 'right' | null;

/** How far the finger must travel to trigger an action: ~a third of the row, clamped. */
export function swipeThreshold(width: number): number {
  return Math.min(110, Math.max(56, width * 0.33));
}

/** Which action a release at horizontal offset `dx` should fire, if any. */
export function resolveSwipe(dx: number, width: number): SwipeAction {
  const threshold = swipeThreshold(width);
  if (dx >= threshold) return 'right';
  if (dx <= -threshold) return 'left';
  return null;
}

/** Keep the dragged offset within a comfortable range so the row never flies off. */
export function clampDrag(dx: number, width: number): number {
  const max = width * 0.6;
  return Math.max(-max, Math.min(max, dx));
}
