import { SCHEMA_VERSION } from '../model';

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
 * Reine Migrationsfunktion. Aktuell ist nur Schema-Version 1 vorhanden, daher
 * die Identität. Zukünftige Schritte werden hier angehängt (SPEC 8.7).
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
  let version = fromVersion;

  // Beispiel für die Zukunft:
  // if (version < 2) { current = { ...current, ... }; version = 2; }

  if (version < SCHEMA_VERSION) {
    current = { ...current, schemaVersion: SCHEMA_VERSION };
    version = SCHEMA_VERSION;
  }

  return current;
}
