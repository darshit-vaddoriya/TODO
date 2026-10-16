/** Form and list controls: checkbox, switch, segmented control, nudge banner and settings row. */
import type { ComponentChildren } from 'preact';
import { Icon } from '@/ui/components/icons';

/**
 * A round check control with a 44px tap target (the visible circle is smaller).
 * `popping` plays the little completion bounce.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  popping,
  small,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  popping?: boolean;
  small?: boolean;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} class="-m-2 grid size-11 shrink-0 place-items-center" onClick={onChange}>
      <span
        class={`grid place-items-center rounded-full border-2 transition-colors ${small ? 'size-[22px]' : 'size-[26px]'} ${
          checked ? 'border-brand bg-brand text-on-brand' : 'border-control text-transparent'
        } ${popping ? 'check-pop' : ''}`}
      >
        <Icon name="check" size={small ? 13 : 16} />
      </span>
    </button>
  );
}

/** On/off switch. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-control'}`}
      onClick={() => onChange(!checked)}
    >
      <span class={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** One rounded track with equal-width options; the chosen one is a raised pill. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} class="flex w-full rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          class={`min-h-10 flex-1 truncate rounded-full px-1 text-[0.8125rem] font-bold tracking-tight ${value === o.value ? 'bg-brand text-on-brand' : 'text-muted'}`}
          onClick={() => onChange(o.value)}
          key={o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One-line banner with an action and a close button. */
export function Nudge({ icon, text, action, onAction, onClose }: { icon: string; text: string; action: string; onAction: () => void; onClose: () => void }) {
  return (
    <div class="card mb-4 flex items-center gap-3 py-2.5 pl-3 pr-1.5">
      <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-field text-brand">
        <Icon name={icon} size={19} />
      </span>
      <p class="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug">{text}</p>
      <button type="button" class="min-h-9 shrink-0 rounded-full bg-brand px-3.5 text-[0.8125rem] font-bold text-on-brand" onClick={onAction}>
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
      <span class={`grid size-9 shrink-0 place-items-center rounded-[12px] bg-field ${danger ? 'text-accent' : 'text-brand'}`}>
        <Icon name={icon} size={19} />
      </span>
      <span class="min-w-0 flex-1">
        <span class={`block font-semibold ${danger ? 'text-accent' : ''}`}>{label}</span>
        {hint && <span class="block text-[0.8125rem] leading-snug text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 py-2 text-left';
  if (children)
    return (
      <div class={cls}>
        {body}
        {children}
      </div>
    );
  return (
    <button type="button" class={cls} onClick={onClick}>
      {body}
      {value && <span class="shrink-0 text-[0.875rem] text-muted">{value}</span>}
      {!danger && <Icon name="back" size={16} class="shrink-0 rotate-180 text-muted" />}
    </button>
  );
}
