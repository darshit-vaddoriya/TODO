/** Service worker registration ("New version available") and the install prompt. */
import { registerSW } from 'virtual:pwa-register';
import { getPrefs, setPrefs } from './prefs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function onPwaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let updateReady: (() => void) | null = null;

export function pendingUpdate(): (() => void) | null {
  return updateReady;
}

export function initPwa(): void {
  if (import.meta.env.PROD) {
    const updateSW = registerSW({
      onNeedRefresh() {
        updateReady = () => void updateSW(true);
        emit();
      },
    });
  }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BeforeInstallPromptEvent;
    emit();
  });
  addEventListener('appinstalled', () => {
    deferredInstall = null;
    setPrefs({ installPromptSeen: true });
    emit();
  });
}

export function canInstall(): boolean {
  return deferredInstall !== null;
}

/** The polite banner is shown once; Settings keeps an "Install app" button for later. */
export function shouldShowInstallBanner(): boolean {
  return canInstall() && !getPrefs().installPromptSeen;
}

export function dismissInstallBanner(): void {
  setPrefs({ installPromptSeen: true });
  emit();
}

export async function promptInstall(): Promise<void> {
  if (!deferredInstall) return;
  setPrefs({ installPromptSeen: true });
  await deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  emit();
}
