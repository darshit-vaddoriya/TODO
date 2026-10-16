/** Overlays: modal dialog and the toast stack. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { dismissToast, onToasts, type Toast } from '@/services/toast';
import { Icon } from '@/ui/components/icons';

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
          class={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-[18px] py-1 pl-4 pr-1.5 shadow-lg ${toast.tone === 'warn' ? 'bg-haldi text-on-haldi' : 'bg-ink text-paper'}`}
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
