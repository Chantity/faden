import { Injectable, signal } from '@angular/core';

/**
 * Liefert ein `now`-Signal, das sich minütlich und bei `visibilitychange`
 * aktualisiert (SPEC 7.3). Kein sekundengenauer Timer.
 */
@Injectable({ providedIn: 'root' })
export class NowStore {
  private readonly value = signal(new Date());
  readonly now = this.value.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    this.timer = setInterval(() => this.tick(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.tick();
    });
  }

  /** Erzwingt eine Aktualisierung (z. B. in Tests). */
  tick(): void {
    this.value.set(new Date());
  }
}
