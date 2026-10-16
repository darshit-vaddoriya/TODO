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

export type InstallStatus = 'installed' | 'available' | 'unavailable';

/**
 * Whether Yaad is running as an installed app (standalone window), can be
 * installed right now (the browser offered a prompt), or neither (already in a
 * browser tab on a browser/OS that offers no prompt, e.g. iOS Safari — there
 * the user adds it from the Share menu).
 */
export function installStatus(): InstallStatus {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  return canInstall() ? 'available' : 'unavailable';
}
