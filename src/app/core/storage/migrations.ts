import { DEFAULT_LOCALE, isLocale, SCHEMA_VERSION } from '../model';

/**
 * Datenformat der exportierbaren App-Daten (auch Basis für IndexedDB-Records
 * nach Migration). Absichtlich locker typisiert, da es Rohdaten aus Backups sind.
 */
export interface PersistedData {
  schemaVersion: number;
  settings?: unknown;
  lists?: unknown;
  templates?: unknown;
}

/**
 * Reine Migrationsfunktion. Bringt Daten älterer Schema-Versionen auf den
 * aktuellen Stand. Weitere Schritte werden hier angehängt.
 *
 * @throws Error bei unbekannter/zukünftiger Version.
 */
export function migrate<T extends PersistedData>(data: T, fromVersion: number = data.schemaVersion): T {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `Die Daten stammen aus einer neueren Version (${fromVersion} > ${SCHEMA_VERSION}).`,
    );
  }

  let current = data;

  // v1 -> v2: AppSettings erhält das Feld `language` (Standard Englisch).
  if (fromVersion < 2) {
    const settings = current.settings;
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      const record = settings as Record<string, unknown>;
      if (!isLocale(record['language'])) {
        current = {
          ...current,
          settings: { ...record, language: DEFAULT_LOCALE },
        };
      }
    }
  }

  if (current.schemaVersion !== SCHEMA_VERSION) {
    current = { ...current, schemaVersion: SCHEMA_VERSION };
  }

  return current;
}
