import {
  DEFAULT_LOCALE,
  isLocale,
  NOTES_MAX_LENGTH,
  SCHEMA_VERSION,
  TIMEBOX_MODES,
  TITLE_MAX_LENGTH,
  type AppSettings,
  type Edge,
  type Task,
  type Template,
  type TimeboxMode,
  type TodoList,
} from '../model';
import { validateGraph } from '../graph';
import { migrate } from './migrations';

export const BACKUP_APP_ID = 'faden';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  settings: AppSettings;
  lists: TodoList[];
  templates: Template[];
}

export type ValidationResult =
  | { ok: true; value: BackupFile }
  | { ok: false; errors: string[] };

// --- Type Guards -----------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTimeboxMode(value: unknown): value is TimeboxMode {
  return isString(value) && (TIMEBOX_MODES as readonly string[]).includes(value);
}

// --- Parsing ---------------------------------------------------------------

function parseTask(raw: unknown, where: string, errors: string[]): Task | undefined {
  if (!isRecord(raw)) {
    errors.push(`${where}: ToDo ist kein Objekt.`);
    return undefined;
  }
  if (!isString(raw['id']) || raw['id'].length === 0) {
    errors.push(`${where}: ToDo ohne gültige id.`);
    return undefined;
  }
  if (!isString(raw['title'])) {
    errors.push(`${where}: ToDo ohne Titel.`);
    return undefined;
  }
  if (raw['title'].length > TITLE_MAX_LENGTH) {
    errors.push(`${where}: Titel länger als ${TITLE_MAX_LENGTH} Zeichen.`);
    return undefined;
  }
  if (raw['notes'] !== undefined && (!isString(raw['notes']) || raw['notes'].length > NOTES_MAX_LENGTH)) {
    errors.push(`${where}: Notizen ungültig oder zu lang.`);
    return undefined;
  }

  const task: Task = { id: raw['id'], title: raw['title'], done: raw['done'] === true };
  if (isString(raw['doneAt'])) task.doneAt = raw['doneAt'];
  if (isNumber(raw['estimateMinutes'])) task.estimateMinutes = raw['estimateMinutes'];
  if (isString(raw['notes'])) task.notes = raw['notes'];
  if (isString(raw['dayStart'])) task.dayStart = raw['dayStart'];
  if (isString(raw['dayEnd'])) task.dayEnd = raw['dayEnd'];
  if (isString(raw['startAt'])) task.startAt = raw['startAt'];
  if (isString(raw['endAt'])) task.endAt = raw['endAt'];
  return task;
}

function parseEdge(raw: unknown, where: string, errors: string[]): Edge | undefined {
  if (!isRecord(raw) || !isString(raw['id']) || !isString(raw['from']) || !isString(raw['to'])) {
    errors.push(`${where}: Pfeil ist ungültig.`);
    return undefined;
  }
  return { id: raw['id'], from: raw['from'], to: raw['to'] };
}

function parseList(raw: unknown, index: number, errors: string[]): TodoList | undefined {
  const where = `Zettel #${index + 1}`;
  const startErrors = errors.length;
  if (!isRecord(raw)) {
    errors.push(`${where}: kein Objekt.`);
    return undefined;
  }
  if (!isString(raw['id']) || !isString(raw['title'])) {
    errors.push(`${where}: id oder Titel fehlt.`);
    return undefined;
  }
  if (!isTimeboxMode(raw['timeboxMode'])) {
    errors.push(`${where}: ungültiger Zeitmodus.`);
    return undefined;
  }
  if (!Array.isArray(raw['tasks']) || !Array.isArray(raw['edges'])) {
    errors.push(`${where}: tasks/edges fehlen.`);
    return undefined;
  }

  const tasks: Task[] = [];
  for (let i = 0; i < raw['tasks'].length; i++) {
    const task = parseTask(raw['tasks'][i], `${where}/ToDo #${i + 1}`, errors);
    if (task) tasks.push(task);
  }
  const edges: Edge[] = [];
  for (let i = 0; i < raw['edges'].length; i++) {
    const edge = parseEdge(raw['edges'][i], `${where}/Pfeil #${i + 1}`, errors);
    if (edge) edges.push(edge);
  }
  if (errors.length > startErrors) return undefined;

  const now = new Date().toISOString();
  const list: TodoList = {
    id: raw['id'],
    title: raw['title'],
    timeboxMode: raw['timeboxMode'],
    tasks,
    edges,
    archived: raw['archived'] === true,
    createdAt: isString(raw['createdAt']) ? raw['createdAt'] : now,
    updatedAt: isString(raw['updatedAt']) ? raw['updatedAt'] : now,
    sortOrder: isNumber(raw['sortOrder']) ? raw['sortOrder'] : index,
  };
  if (isString(raw['dayPlanReferenceDate'])) list.dayPlanReferenceDate = raw['dayPlanReferenceDate'];

  // Invarianten: keine Zyklen, keine toten Referenzen, keine Doppelpfeile.
  for (const issue of validateGraph(list)) {
    errors.push(`${where}: ${issue.message}`);
  }
  return errors.length > startErrors ? undefined : list;
}

function parseTemplate(raw: unknown, index: number, errors: string[]): Template | undefined {
  const where = `Vorlage #${index + 1}`;
  const startErrors = errors.length;
  if (!isRecord(raw) || !isString(raw['id']) || !isString(raw['title'])) {
    errors.push(`${where}: ungültig.`);
    return undefined;
  }
  if (!isTimeboxMode(raw['timeboxMode'])) {
    errors.push(`${where}: ungültiger Zeitmodus.`);
    return undefined;
  }
  if (!Array.isArray(raw['tasks']) || !Array.isArray(raw['edges'])) {
    errors.push(`${where}: tasks/edges fehlen.`);
    return undefined;
  }
  const tasks: Omit<Task, 'done' | 'doneAt'>[] = [];
  for (let i = 0; i < raw['tasks'].length; i++) {
    const task = parseTask(raw['tasks'][i], `${where}/ToDo #${i + 1}`, errors);
    if (task) {
      const { done: _done, doneAt: _doneAt, ...rest } = task;
      tasks.push(rest);
    }
  }
  const edges: Edge[] = [];
  for (let i = 0; i < raw['edges'].length; i++) {
    const edge = parseEdge(raw['edges'][i], `${where}/Pfeil #${i + 1}`, errors);
    if (edge) edges.push(edge);
  }
  if (errors.length > startErrors) return undefined;

  const template: Template = {
    id: raw['id'],
    title: raw['title'],
    tasks,
    edges,
    timeboxMode: raw['timeboxMode'],
    createdAt: isString(raw['createdAt']) ? raw['createdAt'] : new Date().toISOString(),
  };
  const asList: TodoList = {
    ...template,
    tasks: template.tasks.map((t) => ({ ...t, done: false })),
    archived: false,
    updatedAt: template.createdAt,
    sortOrder: index,
  };
  for (const issue of validateGraph(asList)) {
    errors.push(`${where}: ${issue.message}`);
  }
  return errors.length > startErrors ? undefined : template;
}

function parseSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) {
    return { theme: 'system', language: DEFAULT_LOCALE, schemaVersion: SCHEMA_VERSION };
  }
  const theme = raw['theme'];
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    language: isLocale(raw['language']) ? raw['language'] : DEFAULT_LOCALE,
    schemaVersion: isNumber(raw['schemaVersion']) ? raw['schemaVersion'] : SCHEMA_VERSION,
    ...(isString(raw['lastBackupAt']) ? { lastBackupAt: raw['lastBackupAt'] } : {}),
  };
}

// --- Public API ------------------------------------------------------------

export function createBackup(
  settings: AppSettings,
  lists: readonly TodoList[],
  templates: readonly Template[],
  exportedAt: string = new Date().toISOString(),
): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    settings: { ...settings, schemaVersion: SCHEMA_VERSION },
    lists: lists.map((l) => structuredClone(l)),
    templates: templates.map((t) => structuredClone(t)),
  };
}

/** Prüft rohe Backup-Daten vollständig (Schema, Version, Zyklen, Referenzen). */
export function validateBackup(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ['Die Datei enthält kein gültiges Datenobjekt.'] };
  }
  if (input['app'] !== BACKUP_APP_ID) {
    errors.push('Das ist keine Faden-Sicherungsdatei.');
  }
  if (!isNumber(input['schemaVersion'])) {
    errors.push('Die Schema-Version fehlt.');
    return { ok: false, errors };
  }
  if (input['schemaVersion'] > SCHEMA_VERSION) {
    errors.push('Die Sicherung stammt aus einer neueren App-Version und kann nicht gelesen werden.');
    return { ok: false, errors };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(input as { schemaVersion: number } & Record<string, unknown>);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Migration fehlgeschlagen.');
    return { ok: false, errors };
  }

  const rawLists = migrated['lists'];
  const rawTemplates = migrated['templates'];
  if (!Array.isArray(rawLists)) errors.push('Die Zettel-Liste fehlt.');
  if (!Array.isArray(rawTemplates)) errors.push('Die Vorlagen-Liste fehlt.');
  if (errors.length > 0) return { ok: false, errors };

  const lists: TodoList[] = [];
  for (let i = 0; i < (rawLists as unknown[]).length; i++) {
    const list = parseList((rawLists as unknown[])[i], i, errors);
    if (list) lists.push(list);
  }
  const templates: Template[] = [];
  for (let i = 0; i < (rawTemplates as unknown[]).length; i++) {
    const template = parseTemplate((rawTemplates as unknown[])[i], i, errors);
    if (template) templates.push(template);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: isString(migrated['exportedAt']) ? migrated['exportedAt'] : new Date().toISOString(),
      settings: parseSettings(migrated['settings']),
      lists,
      templates,
    },
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  lists: TodoList[];
  templates: Template[];
}

/**
 * Führt ein validiertes Backup mit vorhandenen Daten zusammen.
 * `merge`: neue IDs bei Kollisionen, bestehende Daten bleiben.
 * `replace`: vorhandene Daten werden vollständig ersetzt.
 */
export function applyImport(
  backup: BackupFile,
  existing: { lists: readonly TodoList[]; templates: readonly Template[] },
  mode: ImportMode,
): ImportResult {
  if (mode === 'replace') {
    return { lists: backup.lists, templates: backup.templates };
  }

  const usedListIds = new Set(existing.lists.map((l) => l.id));
  const mergedLists: TodoList[] = [...existing.lists];
  const baseSort = existing.lists.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
  backup.lists.forEach((list, index) => {
    const id = usedListIds.has(list.id) ? crypto.randomUUID() : list.id;
    usedListIds.add(id);
    mergedLists.push({ ...list, id, sortOrder: baseSort + index });
  });

  const usedTemplateIds = new Set(existing.templates.map((t) => t.id));
  const mergedTemplates: Template[] = [...existing.templates];
  for (const template of backup.templates) {
    const id = usedTemplateIds.has(template.id) ? crypto.randomUUID() : template.id;
    usedTemplateIds.add(id);
    mergedTemplates.push({ ...template, id });
  }

  return { lists: mergedLists, templates: mergedTemplates };
}
