/** Page structure: header, page, section, empty state and form field. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from '@/ui/components/icons';
import { back } from '@/ui/router';

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
        <span class="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-field text-brand">
          <Icon name={icon} size={24} />
        </span>
      )}
      <p class="text-[1.0625rem] font-extrabold">{title}</p>
      {body && <p class="mx-auto mt-1 max-w-xs text-muted">{body}</p>}
      {children && <div class="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
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
