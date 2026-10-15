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

/** Nutzergesteuerte Update-Prüfung. */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'unreachable'
  | 'applying'
  | 'failed';

/**
 * Service-Worker-Registrierung und Installationshilfe.
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

  readonly update = signal<UpdateState>('idle');
  /** Version, die der Server anbietet (nur bei `available`). */
  readonly updateVersion = signal<string | null>(null);

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

  /**
   * Fragt den Host nach einer neueren Version. Nur auf Knopfdruck; ohne Netz
   * oder bei kaputtem Host passiert nichts.
   */
  async checkForUpdate(): Promise<void> {
    const registration = await this.registration();
    if (!registration) return;
    this.update.set('checking');
    const answer = await askWorker<{ status: 'current' | 'available' | 'unreachable'; version?: string }>(
      registration,
      { type: 'check-update' },
      15_000,
    );
    this.updateVersion.set(answer?.version ?? null);
    this.update.set(answer?.status ?? 'unreachable');
  }

  /**
   * Lädt die neue Version vollständig in einen neuen Cache; erst danach wird
   * umgeschaltet und neu geladen. Schlägt etwas fehl, bleibt alles beim Alten.
   */
  async applyUpdate(): Promise<void> {
    const registration = await this.registration();
    if (!registration) return;
    this.update.set('applying');
    const answer = await askWorker<{ status: 'updated' | 'failed' }>(
      registration,
      { type: 'apply-update' },
      120_000,
    );
    if (answer?.status === 'updated') {
      window.location.reload();
    } else {
      this.update.set('failed');
    }
  }

  private async registration(): Promise<ServiceWorkerRegistration | null> {
    if (this.offline() === 'unsupported' || !('serviceWorker' in navigator)) return null;
    return (await navigator.serviceWorker.getRegistration()) ?? null;
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

/** Schickt dem aktiven Service Worker eine Nachricht und wartet (begrenzt) auf die Antwort. */
function askWorker<T>(
  registration: ServiceWorkerRegistration,
  message: unknown,
  timeoutMs = 5000,
): Promise<T | null> {
  const worker = registration.active;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<T>) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}
