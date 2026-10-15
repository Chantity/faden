import { DEFAULT_LOCALE, isLocale, SCHEMA_VERSION, titleKey, uniqueTitle } from '../model';
import { minutesToHhMm, parseHhMm, toLocalIso } from '../time/format';

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

  // v2 -> v3: Ende → Dauer, eindeutige Zettel-Namen (beides idempotent).
  if (fromVersion < 3) {
    if (Array.isArray(current.lists)) {
      current = { ...current, lists: upgradeLists(current.lists.map(upgradeList)) };
    }
    if (Array.isArray(current.templates)) {
      current = { ...current, templates: current.templates.map(upgradeList) };
    }
  }

  if (current.schemaVersion !== SCHEMA_VERSION) {
    current = { ...current, schemaVersion: SCHEMA_VERSION };
  }

  return current;
}

type Raw = Record<string, unknown>;

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Standarddauer, wenn ein Alt-ToDo nur ein Ende, aber keine Dauer hat. */
const FALLBACK_MINUTES = 15;

/**
 * Schema 3 für einen Zettel oder eine Vorlage: Ende (`dayEnd`/`endAt`) wird zur
 * Dauer (`estimateMinutes`). Idempotent; unbekannte Formen bleiben unverändert
 * (die Backup-Prüfung lehnt sie danach ab).
 */
export function upgradeList<T>(list: T): T {
  if (!isRaw(list) || !Array.isArray(list['tasks'])) return list;
  const mode = list['timeboxMode'];
  const tasks = list['tasks'].map((task) => upgradeTask(task, mode));
  return tasks.some((t, i) => t !== (list['tasks'] as unknown[])[i]) ? ({ ...list, tasks } as T) : list;
}

function upgradeTask(task: unknown, mode: unknown): unknown {
  if (!isRaw(task) || (!('dayEnd' in task) && !('endAt' in task))) return task;
  const { dayEnd, endAt, ...next } = task;

  const dayStart = parseHhMm(asString(next['dayStart']));
  const dayStop = parseHhMm(asString(dayEnd));
  const startMs = msOf(next['startAt']);
  const stopMs = msOf(endAt);
  const dayMinutes = positive(dayStart !== null && dayStop !== null ? dayStop - dayStart : null);
  const scheduleMinutes = positive(
    startMs !== null && stopMs !== null ? Math.round((stopMs - startMs) / 60_000) : null,
  );
  const estimate = typeof next['estimateMinutes'] === 'number' ? next['estimateMinutes'] : null;

  // Der konkrete Plan des aktiven Modus gewinnt; sonst bleibt die Schätzung.
  const duration =
    mode === 'dayPlan'
      ? (dayMinutes ?? estimate ?? scheduleMinutes)
      : mode === 'schedule'
        ? (scheduleMinutes ?? estimate ?? dayMinutes)
        : (estimate ?? dayMinutes ?? scheduleMinutes);
  if (duration !== null) next['estimateMinutes'] = duration;

  // Nur ein Ende bekannt: Start = Ende − Dauer.
  if (dayStart === null && dayStop !== null) {
    const minutes = estimate ?? FALLBACK_MINUTES;
    next['dayStart'] = minutesToHhMm(Math.max(0, dayStop - minutes));
    next['estimateMinutes'] ??= minutes;
  }
  if (startMs === null && stopMs !== null) {
    const minutes = estimate ?? FALLBACK_MINUTES;
    next['startAt'] = toLocalIso(new Date(stopMs - minutes * 60_000));
    next['estimateMinutes'] ??= minutes;
  }
  return next;
}

/**
 * Macht Zettel-Namen eindeutig: Bei gleichem Namen behält der ältere Zettel ihn,
 * jüngere erhalten „ (2)", „ (3)" … Gelöschte Zettel zählen nicht.
 */
export function upgradeLists<T>(lists: T[]): T[] {
  const byAge = lists
    .map((list, index) => ({ list, index }))
    .filter(({ list }) => isRaw(list) && typeof list['title'] === 'string' && !list['deletedAt'])
    .sort((a, b) => String((a.list as Raw)['createdAt']).localeCompare(String((b.list as Raw)['createdAt'])));
  const taken: string[] = [];
  const renamed = new Map<number, string>();
  for (const { list, index } of byAge) {
    const title = (list as Raw)['title'] as string;
    const unique = uniqueTitle(title, taken);
    if (titleKey(unique) !== titleKey(title)) renamed.set(index, unique);
    taken.push(unique);
  }
  if (renamed.size === 0) return lists;
  return lists.map((list, index) =>
    renamed.has(index) ? ({ ...(list as Raw), title: renamed.get(index) } as T) : list,
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function msOf(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function positive(minutes: number | null): number | null {
  return minutes !== null && minutes > 0 ? minutes : null;
}
