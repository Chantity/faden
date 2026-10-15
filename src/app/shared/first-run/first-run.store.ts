import { computed, Injectable, signal } from '@angular/core';

/** localStorage: Hinweis zum lokalen Speicher bestätigt. */
export const STORAGE_NOTICE_KEY = 'faden.storageNoticeAck';
/** localStorage: Anleitung wurde angeboten („Lesen“ oder „Ignorieren“). */
export const GUIDE_OFFERED_KEY = 'faden.guideOffered';
/** localStorage: Die geführte Tour läuft (wird beim Beenden gelöscht). */
export const TOUR_ACTIVE_KEY = 'faden.tourActive';

/** App während der Tour verlassen? Dann den Start-Dialog erneut anbieten. */
function resetAbandonedTour(): boolean {
  try {
    if (localStorage.getItem(TOUR_ACTIVE_KEY) === null) return false;
    localStorage.removeItem(TOUR_ACTIVE_KEY);
    localStorage.removeItem(GUIDE_OFFERED_KEY);
    return true;
  } catch {
    return false; // Ohne Speicher gibt es keinen Merker.
  }
}

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
 * Tour oder Anleitung anbieten → (erst dann) Installations-Banner.
 */
@Injectable({ providedIn: 'root' })
export class FirstRunStore {
  readonly storageAck = signal(read(STORAGE_NOTICE_KEY));
  readonly guideOffered = signal(!resetAbandonedTour() && read(GUIDE_OFFERED_KEY));
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
