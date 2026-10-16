/** Progress displays: a ring with its fraction, and a thin bar. */
import { useEffect, useRef } from 'preact/hooks';

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
