/** Touch gestures: swipe a row to act, drag to reorder. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '@/ui/components/icons';
import { clampDrag, resolveSwipe } from '@/ui/components/swipe';

/**
 * A horizontally swipeable row. Swipe right to fire `onSwipeRight` (complete),
 * left for `onSwipeLeft` (delete); the coloured action peeks out behind the
 * foreground as it moves. Vertical drags fall through to page scroll, and taps
 * still reach the buttons inside. Transforms are set imperatively on refs so
 * the strict CSP (no inline styles) is satisfied.
 */
export function SwipeRow({ onSwipeRight, onSwipeLeft, children }: { onSwipeRight?: () => void; onSwipeLeft?: () => void; children: ComponentChildren }) {
  const fg = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null); // revealed on a right swipe (complete)
  const left = useRef<HTMLDivElement>(null); // revealed on a left swipe (delete)
  const st = useRef({ startX: 0, startY: 0, dx: 0, locked: null as boolean | null, active: false, width: 0, pid: -1 });

  const paint = (d: number) => {
    if (fg.current) fg.current.style.transform = d ? `translateX(${d}px)` : '';
    if (right.current) right.current.style.opacity = d > 0 ? '1' : '0';
    if (left.current) left.current.style.opacity = d < 0 ? '1' : '0';
  };
  const reset = (animate: boolean) => {
    const s = st.current;
    if (fg.current) fg.current.style.transition = animate ? 'transform 0.18s ease' : '';
    s.active = false;
    s.dx = 0;
    s.locked = null;
    paint(0);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = st.current;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.dx = 0;
    s.locked = null;
    s.active = true;
    s.pid = e.pointerId;
    s.width = fg.current?.offsetWidth ?? 0;
    if (fg.current) fg.current.style.transition = '';
  };
  const onMove = (e: PointerEvent) => {
    const s = st.current;
    if (!s.active) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.locked = Math.abs(dx) > Math.abs(dy);
      if (s.locked) fg.current?.setPointerCapture?.(e.pointerId);
      else {
        s.active = false; // a vertical drag — let the page scroll
        return;
      }
    }
    if (!s.locked) return;
    e.preventDefault();
    s.dx = clampDrag(dx, s.width);
    paint(s.dx);
  };
  const onUp = () => {
    const s = st.current;
    if (!s.active && s.dx === 0) return;
    const action = resolveSwipe(s.dx, s.width);
    reset(true);
    if (action === 'right') onSwipeRight?.();
    else if (action === 'left') onSwipeLeft?.();
  };

  return (
    <div class="relative overflow-hidden rounded-[16px]">
      <div ref={right} class="pointer-events-none absolute inset-0 flex items-center justify-start bg-teal px-5 text-on-teal opacity-0" aria-hidden="true">
        <Icon name="check" size={22} />
      </div>
      <div ref={left} class="pointer-events-none absolute inset-0 flex items-center justify-end bg-accent px-5 text-on-accent opacity-0" aria-hidden="true">
        <Icon name="trash" size={22} />
      </div>
      <div
        ref={fg}
        class="relative touch-pan-y select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => reset(false)}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A pointer-driven reorderable list. Each rendered row gets a `handle` to
 * spread onto its drag grip; pressing the grip and moving the pointer
 * reorders the list live (crossing a neighbour's midpoint swaps it), and the
 * new id order is committed via `onReorder` on release. Works with touch and
 * mouse; HTML5 drag-and-drop is avoided because it is unreliable on mobile.
 */
export interface DragHandle {
  onPointerDown: (e: PointerEvent) => void;
  'aria-label': string;
}

export function ReorderList<T extends { id: string }>({
  items,
  onReorder,
  render,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  render: (item: T, handle: DragHandle, dragging: boolean) => ComponentChildren;
}) {
  const [ids, setIds] = useState<string[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const cb = useRef(onReorder);
  cb.current = onReorder;

  // Keep in sync with the source list, except mid-drag (so a re-render doesn't fight the finger).
  useEffect(() => {
    if (!dragId) setIds(items.map((i) => i.id));
  }, [items, dragId]);

  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      setIds((cur) => {
        const di = cur.indexOf(dragId);
        if (di < 0) return cur;
        let target = di;
        for (let i = 0; i < cur.length; i++) {
          const el = rows.current.get(cur[i]);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if (i < di && e.clientY < mid) {
            target = i;
            break;
          }
          if (i > di && e.clientY > mid) target = i;
        }
        if (target === di) return cur;
        const next = [...cur];
        const [moved] = next.splice(di, 1);
        next.splice(target, 0, moved);
        return next;
      });
    };
    const up = () => {
      setDragId(null);
      setIds((cur) => {
        cb.current(cur);
        return cur;
      });
    };
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [dragId]);

  return (
    <div class={`space-y-2.5 ${dragId ? 'select-none' : ''}`}>
      {ids.map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return null;
        const handle: DragHandle = {
          onPointerDown: (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragId(id);
          },
          'aria-label': 'Drag to reorder',
        };
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rows.current.set(id, el);
              else rows.current.delete(id);
            }}
            class={dragId === id ? 'relative z-10 scale-[1.02] opacity-90 shadow-lg transition-transform' : ''}
          >
            {render(item, handle, dragId === id)}
          </div>
        );
      })}
    </div>
  );
}
