/** Small shared UI pieces. Plain Preact + Tailwind tokens from global.css. */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { clampDrag, resolveSwipe } from '../lib/swipe';
import { dismissToast, onToasts, type Toast } from '../lib/toast';
import { back } from './router';

// ---------------------------------------------------------------------------
// Icons: simple 24px strokes, decorative (labels always come from text).
// ---------------------------------------------------------------------------

const ICONS: Record<string, JSX.Element> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0" />,
  'bell-off': (
    <>
      <path d="M8.3 5.3A6 6 0 0 1 18 11v5l1.5 1.5M6 11v5l-2 2h12" />
      <path d="M10 20.5a2 2 0 0 0 4 0M3 3l18 18" />
    </>
  ),
  sparkles: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  chart: <path d="M4 20V11M10 20V5M16 20v-6M2 20h20" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  snooze: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M9 10h6l-6 6h6M9 2h6M5 4l2-2M19 4l-2-2" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  volume: <path d="M4 9v6h4l5 4V5L8 9zM16 9a3 3 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11" />,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  flag: <path d="M5 21V5h12l-3 4 3 4H5" />,
  tag: (
    <>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-7 7z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  repeat: <path d="M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 0 1-4 4H4" />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
};

export function Icon({ name, size = 22, class: cls = '' }: { name: keyof typeof ICONS | string; size?: number; class?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={`shrink-0 ${cls}`}
    >
      {ICONS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Screen header. The title receives focus on mount so screen readers announce the new screen. */
export function Header({ title, sub, showBack, actions }: { title: string; sub?: string; showBack?: boolean; actions?: ComponentChildren }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus({ preventScroll: true }), []);
  return (
    <header class="safe-top sticky top-0 z-20 bg-paper/90 backdrop-blur-md">
      <div class="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-2">
        {showBack && (
          <button type="button" class="grid size-11 place-items-center rounded-full active:bg-field" onClick={back} aria-label="Back">
            <Icon name="back" size={22} />
          </button>
        )}
        <div class={`min-w-0 flex-1 ${showBack ? 'pl-0.5' : 'pl-2'}`}>
          {sub && <p class="text-[0.8125rem] font-semibold leading-tight text-muted">{sub}</p>}
          <h1 ref={h1} tabIndex={-1} class={`truncate font-extrabold tracking-[-0.02em] outline-none ${showBack ? 'text-[1.25rem]' : 'text-[1.5rem]'}`}>
            {title}
          </h1>
        </div>
        <div class="flex items-center">{actions}</div>
      </div>
    </header>
  );
}

export function Page({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return <main class={`mx-auto w-full max-w-2xl px-4 pb-32 pt-4 ${cls}`}>{children}</main>;
}

export function Section({ title, action, children }: { title?: string; action?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="mt-6 first:mt-0">
      {(title || action) && (
        <div class="mb-2.5 flex min-h-8 items-center justify-between gap-2 px-1">
          {title && <h2 class="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, body, icon, children }: { title: string; body?: string; icon?: string; children?: ComponentChildren }) {
  return (
    <div class="card px-5 py-8 text-center">
      {icon && (
        <span class="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-field text-teal">
          <Icon name={icon} size={24} />
        </span>
      )}
      <p class="text-[1.0625rem] font-extrabold">{title}</p>
      {body && <p class="mx-auto mt-1 max-w-xs text-muted">{body}</p>}
      {children && <div class="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * A round check control with a 44px tap target (the visible circle is smaller).
 * `popping` plays the little completion bounce.
 */
export function Checkbox({ checked, onChange, label, popping, small }: { checked: boolean; onChange: () => void; label: string; popping?: boolean; small?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} class="-m-2 grid size-11 shrink-0 place-items-center" onClick={onChange}>
      <span
        class={`grid place-items-center rounded-full border-2 transition-colors ${small ? 'size-[22px]' : 'size-[26px]'} ${
          checked ? 'border-teal bg-teal text-on-teal' : 'border-muted/50 text-transparent'
        } ${popping ? 'check-pop' : ''}`}
      >
        <Icon name="check" size={small ? 13 : 16} />
      </span>
    </button>
  );
}

/** A circular progress ring with its fraction in the middle. Pure SVG attributes, so the CSP is satisfied. */
export function ProgressRing({ done, total, size = 76, label }: { done: number; total: number; size?: number; label: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <span class="relative grid shrink-0 place-items-center" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--field)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--teal)"
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          class="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span class="absolute inset-0 grid place-items-center text-center">
        <span class="display tnum text-[1.25rem] leading-none">
          {done}
          <span class="text-[0.8125rem] font-bold text-muted">/{total}</span>
        </span>
      </span>
    </span>
  );
}

/** A thin progress bar. Width is set via the style property (not an inline attribute) so the CSP can forbid inline styles. */
export function Meter({ ratio, label }: { ratio: number; label: string }) {
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (fill.current) fill.current.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }, [ratio]);
  return (
    <span class="block h-1.5 w-full overflow-hidden rounded-full bg-field" role="img" aria-label={label}>
      <span ref={fill} class="block h-full rounded-full bg-teal transition-[width] duration-500" />
    </span>
  );
}

export function Field({ label, hint, children, class: cls = '' }: { label: string; hint?: string; children: ComponentChildren; class?: string }) {
  return (
    <label class={`block ${cls}`}>
      <span class="section-label mb-1.5 block">{label}</span>
      {children}
      {hint && <span class="mt-1 block text-[0.8125rem] text-muted">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/** On/off switch. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-teal' : 'bg-field'}`}
      onClick={() => onChange(!checked)}
    >
      <span class={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** One rounded track with equal-width options; the chosen one is a raised pill. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} class="flex w-full rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          class={`min-h-10 flex-1 truncate rounded-full px-1 text-[0.8125rem] font-bold tracking-tight ${value === o.value ? 'bg-teal text-on-teal' : 'text-muted'}`}
          onClick={() => onChange(o.value)}
          key={o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A horizontally swipeable row. Swipe right to fire `onSwipeRight` (complete),
 * left for `onSwipeLeft` (delete); the coloured action peeks out behind the
 * foreground as it moves. Vertical drags fall through to page scroll, and taps
 * still reach the buttons inside. Transforms are set imperatively on refs so
 * the strict CSP (no inline styles) is satisfied.
 */
export function SwipeRow({
  onSwipeRight,
  onSwipeLeft,
  children,
}: {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  children: ComponentChildren;
}) {
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

/** Dialog (native <dialog>: focus trap and Escape for free). */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[24px] bg-surface p-0 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div class="p-5">
          <h2 class="display text-[1.5rem]">{title}</h2>
          <div class="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** One-line banner with an action and a close button. */
export function Nudge({ icon, text, action, onAction, onClose }: { icon: string; text: string; action: string; onAction: () => void; onClose: () => void }) {
  return (
    <div class="card mb-4 flex items-center gap-3 py-2.5 pl-3 pr-1.5">
      <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-field text-teal">
        <Icon name={icon} size={19} />
      </span>
      <p class="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug">{text}</p>
      <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-3.5 text-[0.8125rem] font-bold text-on-teal" onClick={onAction}>
        {action}
      </button>
      <button type="button" class="grid size-9 shrink-0 place-items-center text-muted" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/**
 * A settings row: coloured icon tile, label (and optional hint), then either a
 * control (`children`) or a value and chevron when it opens something.
 */
export function SettingRow({
  icon,
  label,
  hint,
  value,
  onClick,
  danger,
  children,
}: {
  icon: string;
  label: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  children?: ComponentChildren;
}) {
  const body = (
    <>
      <span class={`grid size-9 shrink-0 place-items-center rounded-[12px] bg-field ${danger ? 'text-accent' : 'text-teal'}`}>
        <Icon name={icon} size={19} />
      </span>
      <span class="min-w-0 flex-1">
        <span class={`block font-semibold ${danger ? 'text-accent' : ''}`}>{label}</span>
        {hint && <span class="block text-[0.8125rem] leading-snug text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 py-2 text-left';
  if (children) return <div class={cls}>{body}{children}</div>;
  return (
    <button type="button" class={cls} onClick={onClick}>
      {body}
      {value && <span class="shrink-0 text-[0.875rem] text-muted">{value}</span>}
      {!danger && <Icon name="back" size={16} class="shrink-0 rotate-180 text-muted" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => onToasts(setList), []);
  // Sit above the floating Add button and tab bar on a phone; bottom-centre on desktop.
  return (
    <div
      class="pointer-events-none fixed inset-x-0 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8 lg:pl-60"
      aria-live="polite"
      role="status"
    >
      {list.map((toast) => (
        <div
          key={toast.id}
          class={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-[18px] py-1 pl-4 pr-1.5 shadow-lg ${toast.tone === 'warn' ? 'bg-haldi text-[#0e0e10]' : 'bg-ink text-paper'}`}
        >
          <p class="min-w-0 flex-1 py-1.5 leading-snug">
            <span class="block font-bold">{toast.message}</span>
            {toast.detail && <span class="block text-[0.8125rem] font-medium opacity-75">{toast.detail}</span>}
          </p>
          {toast.action && (
            <button
              type="button"
              class="min-h-10 shrink-0 rounded-full px-3 text-[0.9375rem] font-bold underline underline-offset-4"
              onClick={() => {
                toast.action!.run();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" class="grid size-10 shrink-0 place-items-center rounded-full" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
            <Icon name="close" size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}
