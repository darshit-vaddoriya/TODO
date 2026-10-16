/** Progress displays: concentric rings, and a thin bar. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface RingSpec {
  done: number;
  total: number;
  /** A CSS colour, normally a theme variable such as "var(--teal)". */
  color: string;
}

/**
 * Concentric progress rings in the style of a fitness summary: the first ring is
 * the outermost. Whatever is passed as children sits in the middle. Drawn with
 * SVG attributes only, so the strict CSP (no inline styles) is satisfied.
 */
export function ConcentricRings({ rings, size = 112, label, children }: { rings: RingSpec[]; size?: number; label: string; children?: ComponentChildren }) {
  const stroke = 10;
  const gap = 4;
  const mid = size / 2;
  return (
    <span class="relative grid shrink-0 place-items-center" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const ratio = ring.total > 0 ? Math.min(1, ring.done / ring.total) : 0;
          return (
            <g key={i}>
              <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--field)" stroke-width={stroke} />
              {ratio > 0 && (
                <circle
                  cx={mid}
                  cy={mid}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  stroke-width={stroke}
                  stroke-linecap="round"
                  stroke-dasharray={c}
                  stroke-dashoffset={c * (1 - ratio)}
                  transform={`rotate(-90 ${mid} ${mid})`}
                  class="transition-[stroke-dashoffset] duration-500"
                />
              )}
            </g>
          );
        })}
      </svg>
      <span class="absolute inset-0 grid place-items-center text-center">{children}</span>
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
