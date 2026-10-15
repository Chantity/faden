import { computed, Injectable, signal } from '@angular/core';

/** localStorage: Hinweis zum lokalen Speicher bestätigt. */
export const STORAGE_NOTICE_KEY = 'faden.storageNoticeAck';
/** localStorage: Anleitung wurde angeboten („Lesen“ oder „Ignorieren“). */
export const GUIDE_OFFERED_KEY = 'faden.guideOffered';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Ohne Speicher (z. B. privates Fenster) gilt es nur für diese Sitzung.
  }
}

/**
 * Einmalige Erst-Start-Hinweise in fester Reihenfolge: Speicher-Hinweis →
 * Anleitung anbieten → (erst dann) Installations-Banner.
 */
@Injectable({ providedIn: 'root' })
export class FirstRunStore {
  readonly storageAck = signal(read(STORAGE_NOTICE_KEY));
  readonly guideOffered = signal(read(GUIDE_OFFERED_KEY));
  /** Beide Popups erledigt – das Installations-Banner darf erscheinen. */
  readonly done = computed(() => this.storageAck() && this.guideOffered());

  acknowledgeStorage(): void {
    write(STORAGE_NOTICE_KEY);
    this.storageAck.set(true);
  }

  markGuideOffered(): void {
    write(GUIDE_OFFERED_KEY);
    this.guideOffered.set(true);
  }
}
