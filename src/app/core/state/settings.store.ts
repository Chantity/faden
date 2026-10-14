import { computed, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_LOCALE, isLocale, SCHEMA_VERSION, type AppSettings, type Locale } from '../model';
import { I18nStore } from '../i18n/i18n.store';
import { FadenDb } from '../storage';

export type ThemeChoice = AppSettings['theme'];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: DEFAULT_LOCALE,
  schemaVersion: SCHEMA_VERSION,
};

function normalizeSettings(stored: AppSettings | undefined): AppSettings {
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    language: isLocale(stored.language) ? stored.language : DEFAULT_LOCALE,
    schemaVersion: SCHEMA_VERSION,
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly db = inject(FadenDb);
  private readonly i18n = inject(I18nStore);

  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly theme = computed(() => this.settings().theme);
  readonly language = computed(() => this.settings().language);

  async load(): Promise<void> {
    try {
      const stored = await this.db.getSettings();
      const value = normalizeSettings(stored);
      this.settings.set(value);
      this.applyTheme(value.theme);
      this.i18n.setLocale(value.language);
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleiben die Standardwerte aktiv.
      this.i18n.setLocale(DEFAULT_SETTINGS.language);
    }
  }

  async setTheme(theme: ThemeChoice): Promise<void> {
    this.settings.update((s) => ({ ...s, theme }));
    this.applyTheme(theme);
    await this.db.putSettings(this.settings());
  }

  async setLanguage(language: Locale): Promise<void> {
    this.settings.update((s) => ({ ...s, language }));
    this.i18n.setLocale(language);
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
