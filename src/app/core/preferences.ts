/**
 * Einstellungen ab v2.2 (ohne UI-Abhängigkeiten): Notiz-Standard, Umgang mit
 * erledigten Zetteln, einfacher Modus. Eine Prüfung für Laden und Sicherung.
 */

export type NoteKind = 'text' | 'checklist';
export const NOTE_KINDS: readonly NoteKind[] = ['text', 'checklist'];

export type CompletedListsAction = 'archive' | 'delete' | 'keep';
export const COMPLETED_LISTS_ACTIONS: readonly CompletedListsAction[] = ['archive', 'delete', 'keep'];

/** Was der einfache Modus einschränkt – jedes einzeln wieder einblendbar. */
export const SIMPLE_FEATURES = [
  'listModes',
  'fromTemplate',
  'listMenu',
  'focusMenu',
  'flowMenu',
  'simpleLinks',
  'deleteOnly',
  'templatesTab',
  'insertTemplate',
  'shortcutHelp',
] as const;
export type SimpleFeature = (typeof SIMPLE_FEATURES)[number];

export interface SimpleModeSettings {
  enabled: boolean;
  /** `true` = bleibt trotz einfachem Modus sichtbar. */
  show?: Partial<Record<SimpleFeature, boolean>>;
}

export interface Preferences {
  noteKind?: NoteKind;
  completedLists?: CompletedListsAction;
  simpleMode?: SimpleModeSettings;
}

function oneOf<T extends string>(values: readonly T[], raw: unknown): T | undefined {
  return values.includes(raw as T) ? (raw as T) : undefined;
}

export function parseSimpleMode(raw: unknown): SimpleModeSettings | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { enabled, show } = raw as Record<string, unknown>;
  if (typeof enabled !== 'boolean') return undefined;
  const parsed: Partial<Record<SimpleFeature, boolean>> = {};
  if (typeof show === 'object' && show !== null) {
    for (const feature of SIMPLE_FEATURES) {
      if ((show as Record<string, unknown>)[feature] === true) parsed[feature] = true;
    }
  }
  return Object.keys(parsed).length > 0 ? { enabled, show: parsed } : { enabled };
}

/** Übernimmt nur gültige Werte; Unbekanntes fällt weg (gilt dann als Standard). */
export function parsePreferences(raw: Record<string, unknown>): Preferences {
  const noteKind = oneOf(NOTE_KINDS, raw['noteKind']);
  const completedLists = oneOf(COMPLETED_LISTS_ACTIONS, raw['completedLists']);
  const simpleMode = parseSimpleMode(raw['simpleMode']);
  return {
    ...(noteKind ? { noteKind } : {}),
    ...(completedLists ? { completedLists } : {}),
    ...(simpleMode ? { simpleMode } : {}),
  };
}
