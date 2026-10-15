import { Injectable, signal } from '@angular/core';

export interface SnackbarAction {
  label: string;
  run: () => void;
}

export interface SnackbarState {
  message: string;
  action?: SnackbarAction;
}

const DEFAULT_DURATION_MS = 8000;

/**
 * Nicht-modaler Hinweisband-Dienst: erscheint unten, blockiert nicht,
 * wird per aria-live="polite" angekündigt und verschwindet nach ~8 Sekunden.
 */
@Injectable({ providedIn: 'root' })
export class SnackbarService {
  readonly state = signal<SnackbarState | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, action?: SnackbarAction, durationMs = DEFAULT_DURATION_MS): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.state.set(action ? { message, action } : { message });
    if (typeof window !== 'undefined') {
      this.timer = setTimeout(() => this.dismiss(), durationMs);
    }
  }

  dismiss(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.set(null);
  }
}
