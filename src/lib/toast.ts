/** A single app-wide toast queue. */
export interface Toast {
  id: number;
  message: string;
  /** A quieter second line under the message. */
  detail?: string;
  tone?: 'info' | 'warn';
  action?: { label: string; run: () => void };
  /** ms; 0 keeps it until dismissed. */
  duration?: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<(t: Toast[]) => void>();
const emit = () => listeners.forEach((fn) => fn(toasts));

export function onToasts(fn: (t: Toast[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, opts: Omit<Toast, 'id' | 'message'> = {}): number {
  const id = nextId++;
  toasts = [...toasts.slice(-1), { id, message, ...opts }]; // at most two on screen
  emit();
  const duration = opts.duration ?? (opts.action ? 6000 : 3500);
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}
