import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_LOCALE, SCHEMA_VERSION, uniqueTitle, type AppSettings, type Locale } from '../model';
import { I18nStore } from '../i18n/i18n.store';
import { FadenDb, parseSettings } from '../storage';
import { resolveKeymap, type KeyCombo, type ShortcutAction } from '../keymap';
import type { CompletedListsAction, NoteKind, SimpleFeature } from '../preferences';
import {
  DEFAULT_SCHEME,
  DEFAULT_SCHEME_ID,
  SCHEME_PROPERTIES,
  schemeProperties,
  type ColorScheme,
} from '../color-scheme';

export type ThemeChoice = AppSettings['theme'];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: DEFAULT_LOCALE,
  schemaVersion: SCHEMA_VERSION,
};

function normalizeSettings(stored: AppSettings | undefined): AppSettings {
  return stored ? { ...parseSettings(stored), schemaVersion: SCHEMA_VERSION } : DEFAULT_SETTINGS;
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly db = inject(FadenDb);
  private readonly i18n = inject(I18nStore);

  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly theme = computed(() => this.settings().theme);
  readonly language = computed(() => this.settings().language);
  /** Gültige Tastenkürzel: Standardbelegung plus eigene Änderungen. */
  readonly keymap = computed(() => resolveKeymap(this.settings().keymap));
  readonly noteKind = computed<NoteKind>(() => this.settings().noteKind ?? 'text');
  readonly completedLists = computed<CompletedListsAction>(() => this.settings().completedLists ?? 'archive');

  /** Fehlt die Angabe (Alt-Daten, alte Sicherung), ist der einfache Modus aus. */
  readonly simpleEnabled = computed(() => this.settings().simpleMode?.enabled ?? false);
  /** Greift die Einschränkung `feature` gerade? */
  readonly simple = computed(() => {
    const mode = this.settings().simpleMode;
    return (feature: SimpleFeature): boolean => !!mode?.enabled && !mode.show?.[feature];
  });

  /** Standardschema (mit Namen in der aktuellen Sprache) plus eigene Schemata. */
  readonly defaultScheme = computed<ColorScheme>(() => ({
    ...DEFAULT_SCHEME,
    name: this.i18n.t().schemes.defaultName,
  }));
  readonly schemes = computed<ColorScheme[]>(() => [
    this.defaultScheme(),
    ...(this.settings().colorSchemes ?? []),
  ]);
  readonly activeScheme = computed(
    () => this.schemes().find((s) => s.id === this.settings().activeScheme) ?? this.defaultScheme(),
  );

  constructor() {
    effect(() => this.applyScheme(this.activeScheme()));
  }

  async load(): Promise<void> {
    try {
      const stored = await this.db.getSettings();
      let value = normalizeSettings(stored);
      if (!value.simpleMode) {
        // Erst-Start: neue Nutzer beginnen im einfachen Modus, bestehende nicht.
        const existing =
          stored !== undefined ||
          (await this.db.getLists()).length > 0 ||
          (await this.db.getTemplates()).length > 0;
        value = { ...value, simpleMode: { enabled: !existing } };
        await this.db.putSettings(value);
      }
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

  /** Belegt ein Tastenkürzel neu; `null` stellt die Standardbelegung wieder her. */
  async setShortcut(action: ShortcutAction, combos: KeyCombo[] | null): Promise<void> {
    this.settings.update(({ keymap, ...s }) => {
      const next = { ...keymap };
      if (combos) next[action] = combos;
      else delete next[action];
      return Object.keys(next).length > 0 ? { ...s, keymap: next } : s;
    });
    await this.save();
  }

  /** Alle Tastenkürzel auf die Standardbelegung. */
  async resetShortcuts(): Promise<void> {
    this.settings.update(({ keymap: _keymap, ...s }) => s);
    await this.save();
  }

  async setNoteKind(noteKind: NoteKind): Promise<void> {
    this.settings.update((s) => ({ ...s, noteKind }));
    await this.save();
  }

  async setCompletedLists(completedLists: CompletedListsAction): Promise<void> {
    this.settings.update((s) => ({ ...s, completedLists }));
    await this.save();
  }

  async setSimpleEnabled(enabled: boolean): Promise<void> {
    this.settings.update((s) => ({ ...s, simpleMode: { ...s.simpleMode, enabled } }));
    await this.save();
  }

  /** `show = true`: Feature bleibt im einfachen Modus sichtbar. */
  async setSimpleShow(feature: SimpleFeature, show: boolean): Promise<void> {
    this.settings.update((s) => {
      const current = s.simpleMode ?? { enabled: false };
      const next = { ...current.show };
      if (show) next[feature] = true;
      else delete next[feature];
      return { ...s, simpleMode: { enabled: current.enabled, show: next } };
    });
    await this.save();
  }

  // --- Farbschemata --------------------------------------------------------

  isSchemeNameTaken(name: string, exceptId?: string): boolean {
    const key = name.trim().toLocaleLowerCase();
    return this.schemes().some((s) => s.id !== exceptId && s.name.trim().toLocaleLowerCase() === key);
  }

  /** Legt eine Kopie von `sourceId` als eigenes Schema an und liefert sie. */
  async duplicateScheme(sourceId: string): Promise<ColorScheme> {
    const source = this.schemes().find((s) => s.id === sourceId) ?? this.defaultScheme();
    const copy: ColorScheme = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: uniqueTitle(source.name, this.schemes().map((s) => s.name)),
    };
    this.settings.update((s) => ({ ...s, colorSchemes: [...(s.colorSchemes ?? []), copy] }));
    await this.save();
    return copy;
  }

  /** Speichert ein eigenes Schema (nie das Standardschema). */
  async saveScheme(scheme: ColorScheme): Promise<void> {
    if (scheme.id === DEFAULT_SCHEME_ID) return;
    this.settings.update((s) => ({
      ...s,
      colorSchemes: (s.colorSchemes ?? []).map((c) => (c.id === scheme.id ? scheme : c)),
    }));
    await this.save();
  }

  async deleteScheme(id: string): Promise<void> {
    this.settings.update(({ activeScheme, colorSchemes, ...s }) => {
      const rest = (colorSchemes ?? []).filter((c) => c.id !== id);
      return {
        ...s,
        ...(rest.length > 0 ? { colorSchemes: rest } : {}),
        ...(activeScheme && activeScheme !== id ? { activeScheme } : {}),
      };
    });
    await this.save();
  }

  async setActiveScheme(id: string): Promise<void> {
    this.settings.update(({ activeScheme: _old, ...s }) => (id === DEFAULT_SCHEME_ID ? s : { ...s, activeScheme: id }));
    await this.save();
  }

  private async save(): Promise<void> {
    try {
      await this.db.putSettings(this.settings());
    } catch {
      // Ohne IndexedDB (Tests) gilt die Änderung nur für diese Sitzung.
    }
  }

  /** Setzt das Theme am <html>-Element; 'system' folgt der Browser-Einstellung. */
  private applyTheme(theme: ThemeChoice): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }

  /** Eigene Schemata als Inline-Variablen; das Standardschema lässt styles.css gelten. */
  private applyScheme(scheme: ColorScheme): void {
    if (typeof document === 'undefined') return;
    const style = document.documentElement.style;
    for (const name of SCHEME_PROPERTIES) style.removeProperty(name);
    if (scheme.id === DEFAULT_SCHEME_ID) return;
    for (const [name, value] of Object.entries(schemeProperties(scheme))) style.setProperty(name, value);
  }
}
