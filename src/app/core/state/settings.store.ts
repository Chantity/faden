import { computed, inject, Injectable, signal } from '@angular/core';
import { SCHEMA_VERSION, type AppSettings } from '../model';
import { FadenDb } from '../storage';

export type ThemeChoice = AppSettings['theme'];

const DEFAULT_SETTINGS: AppSettings = { theme: 'system', schemaVersion: SCHEMA_VERSION };

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly db = inject(FadenDb);

  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly theme = computed(() => this.settings().theme);

  async load(): Promise<void> {
    try {
      const stored = await this.db.getSettings();
      const value = stored ?? DEFAULT_SETTINGS;
      this.settings.set(value);
      this.applyTheme(value.theme);
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleiben die Standardwerte aktiv.
    }
  }

  async setTheme(theme: ThemeChoice): Promise<void> {
    this.settings.update((s) => ({ ...s, theme }));
    this.applyTheme(theme);
    await this.db.putSettings(this.settings());
  }

  async markBackup(iso: string): Promise<void> {
    this.settings.update((s) => ({ ...s, lastBackupAt: iso }));
    await this.db.putSettings(this.settings());
  }

  /** Setzt das Theme am <html>-Element; 'system' folgt der Browser-Einstellung. */
  private applyTheme(theme: ThemeChoice): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }
}
