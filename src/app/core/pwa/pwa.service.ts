import { Injectable, isDevMode, signal } from '@angular/core';

/** Chromium-Ereignis vor der Installationsaufforderung (nicht in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Was der Service Worker über den aktiven Precache meldet (siehe public/sw.js). */
export interface PrecacheInfo {
  cache: string;
  version: string;
  build: string;
  files: number;
  installedAt: string;
}

export type OfflineState = 'unsupported' | 'pending' | 'ready';

/**
 * Service-Worker-Registrierung und Installationshilfe (SPEC 9.2, 9.5).
 * Der Service Worker wird nur in Produktionsbuilds registriert.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  /** Precache vollständig → „Offline bereit". */
  readonly offline = signal<OfflineState>('unsupported');
  readonly precache = signal<PrecacheInfo | null>(null);
  /** Der Browser bietet eine eigene Installationsaufforderung an (Chrome/Edge/Android). */
  readonly canPrompt = signal(false);
  /** Läuft bereits als installierte App. */
  readonly installed = signal(false);
  /** iOS/iPadOS: Installation nur über „Teilen → Zum Home-Bildschirm". */
  readonly isIos = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  init(): void {
    if (typeof window === 'undefined') return;

    this.isIos.set(detectIos(navigator));
    this.installed.set(
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canPrompt.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canPrompt.set(false);
      this.installed.set(true);
    });

    if (isDevMode() || !('serviceWorker' in navigator)) return;
    this.offline.set('pending');
    const register = (): void => void this.register();
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  /** Zeigt die native Installationsaufforderung. */
  async install(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;
    this.deferredPrompt = null;
    this.canPrompt.set(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  }

  private async register(): Promise<void> {
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const registration = await navigator.serviceWorker.ready;
      const info = await askWorker<{ active: PrecacheInfo | null }>(registration, {
        type: 'status',
      });
      this.precache.set(info?.active ?? null);
      this.offline.set(info?.active ? 'ready' : 'pending');
    } catch {
      // Registrierung fehlgeschlagen (z. B. ohne HTTPS): App läuft normal weiter.
      this.offline.set('unsupported');
    }
  }
}

function detectIos(nav: Navigator): boolean {
  const ua = nav.userAgent;
  // iPadOS meldet sich als Mac, hat aber Touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}

/** Schickt dem aktiven Service Worker eine Nachricht und wartet (max. 5 s) auf die Antwort. */
function askWorker<T>(registration: ServiceWorkerRegistration, message: unknown): Promise<T | null> {
  const worker = registration.active;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 5000);
    channel.port1.onmessage = (event: MessageEvent<T>) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}
