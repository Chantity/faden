import {
  CHECKLIST_MAX_ITEMS,
  DEFAULT_LOCALE,
  isLocale,
  NOTES_MAX_LENGTH,
  type ChecklistItem,
  SCHEMA_VERSION,
  TIMEBOX_MODES,
  TITLE_MAX_LENGTH,
  titleKey,
  uniqueTitle,
  type AppSettings,
  type Edge,
  type Task,
  type Template,
  type TimeboxMode,
  type TodoList,
} from '../model';
import { validateGraph, type GraphErrorCode } from '../graph';
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

/** Was an einer Sicherungsdatei nicht stimmt. Die Oberfläche übersetzt das (i18n). */
export type BackupIssueCode =
  | 'json'
  | 'not-object'
  | 'not-faden'
  | 'no-version'
  | 'newer-version'
  | 'migration'
  | 'no-lists'
  | 'no-templates'
  | 'entry-invalid'
  | 'entry-missing-fields'
  | 'mode-invalid'
  | 'parts-missing'
  | 'task-invalid'
  | 'task-no-id'
  | 'task-no-title'
  | 'title-too-long'
  | 'notes-invalid'
  | 'checklist-invalid'
  | 'edge-invalid'
  | 'graph';

/** Fundstelle: Zettel/Vorlage Nr. (1-basiert), optional ToDo/Pfeil darin. */
export interface BackupLocation {
  kind: 'list' | 'template';
  index: number;
  part?: { kind: 'task' | 'edge'; index: number };
}

export interface BackupIssue {
  code: BackupIssueCode;
  at?: BackupLocation;
  /** Nur bei `graph`: welche Graph-Invariante verletzt ist. */
  graph?: GraphErrorCode;
}

export type ValidationResult =
  | { ok: true; value: BackupFile }
  | { ok: false; errors: BackupIssue[] };

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

function parseTask(raw: unknown, at: BackupLocation, errors: BackupIssue[]): Task | undefined {
  if (!isRecord(raw)) {
    errors.push({ code: 'task-invalid', at });
    return undefined;
  }
  if (!isString(raw['id']) || raw['id'].length === 0) {
    errors.push({ code: 'task-no-id', at });
    return undefined;
  }
  if (!isString(raw['title'])) {
    errors.push({ code: 'task-no-title', at });
    return undefined;
  }
  if (raw['title'].length > TITLE_MAX_LENGTH) {
    errors.push({ code: 'title-too-long', at });
    return undefined;
  }
  if (raw['notes'] !== undefined && (!isString(raw['notes']) || raw['notes'].length > NOTES_MAX_LENGTH)) {
    errors.push({ code: 'notes-invalid', at });
    return undefined;
  }

  const checklist = raw['checklist'] === undefined ? undefined : parseChecklist(raw['checklist']);
  if (checklist === null) {
    errors.push({ code: 'checklist-invalid', at });
    return undefined;
  }

  const task: Task = { id: raw['id'], title: raw['title'], done: raw['done'] === true };
  if (isString(raw['doneAt'])) task.doneAt = raw['doneAt'];
  if (isNumber(raw['estimateMinutes'])) task.estimateMinutes = raw['estimateMinutes'];
  if (isString(raw['notes'])) task.notes = raw['notes'];
  if (checklist) task.checklist = checklist;
  if (isString(raw['dayStart'])) task.dayStart = raw['dayStart'];
  if (isString(raw['startAt'])) task.startAt = raw['startAt'];
  return task;
}

/** Checkliste prüfen; `null` = ungültig. */
function parseChecklist(raw: unknown): ChecklistItem[] | null {
  if (!Array.isArray(raw) || raw.length > CHECKLIST_MAX_ITEMS) return null;
  const items: ChecklistItem[] = [];
  for (const item of raw) {
    if (
      !isRecord(item) ||
      !isString(item['id']) ||
      !isString(item['text']) ||
      item['text'].trim() === '' ||
      item['text'].length > TITLE_MAX_LENGTH
    ) {
      return null;
    }
    items.push({ id: item['id'], text: item['text'], done: item['done'] === true });
  }
  return items;
}

function parseEdge(raw: unknown, at: BackupLocation, errors: BackupIssue[]): Edge | undefined {
  if (!isRecord(raw) || !isString(raw['id']) || !isString(raw['from']) || !isString(raw['to'])) {
    errors.push({ code: 'edge-invalid', at });
    return undefined;
  }
  return { id: raw['id'], from: raw['from'], to: raw['to'] };
}

function parseList(raw: unknown, index: number, errors: BackupIssue[]): TodoList | undefined {
  const where: BackupLocation = { kind: 'list', index: index + 1 };
  const part = (k: 'task' | 'edge', i: number): BackupLocation => ({
    ...where,
    part: { kind: k, index: i + 1 },
  });
  const startErrors = errors.length;
  if (!isRecord(raw)) {
    errors.push({ code: 'entry-invalid', at: where });
    return undefined;
  }
  if (!isString(raw['id']) || !isString(raw['title'])) {
    errors.push({ code: 'entry-missing-fields', at: where });
    return undefined;
  }
  if (!isTimeboxMode(raw['timeboxMode'])) {
    errors.push({ code: 'mode-invalid', at: where });
    return undefined;
  }
  if (!Array.isArray(raw['tasks']) || !Array.isArray(raw['edges'])) {
    errors.push({ code: 'parts-missing', at: where });
    return undefined;
  }

  const tasks: Task[] = [];
  for (let i = 0; i < raw['tasks'].length; i++) {
    const task = parseTask(raw['tasks'][i], part('task', i), errors);
    if (task) tasks.push(task);
  }
  const edges: Edge[] = [];
  for (let i = 0; i < raw['edges'].length; i++) {
    const edge = parseEdge(raw['edges'][i], part('edge', i), errors);
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
    errors.push({ code: 'graph', at: where, graph: issue.code });
  }
  return errors.length > startErrors ? undefined : list;
}

function parseTemplate(raw: unknown, index: number, errors: BackupIssue[]): Template | undefined {
  const where: BackupLocation = { kind: 'template', index: index + 1 };
  const part = (k: 'task' | 'edge', i: number): BackupLocation => ({
    ...where,
    part: { kind: k, index: i + 1 },
  });
  const startErrors = errors.length;
  if (!isRecord(raw) || !isString(raw['id']) || !isString(raw['title'])) {
    errors.push({ code: 'entry-invalid', at: where });
    return undefined;
  }
  if (!isTimeboxMode(raw['timeboxMode'])) {
    errors.push({ code: 'mode-invalid', at: where });
    return undefined;
  }
  if (!Array.isArray(raw['tasks']) || !Array.isArray(raw['edges'])) {
    errors.push({ code: 'parts-missing', at: where });
    return undefined;
  }
  const tasks: Omit<Task, 'done' | 'doneAt'>[] = [];
  for (let i = 0; i < raw['tasks'].length; i++) {
    const task = parseTask(raw['tasks'][i], part('task', i), errors);
    if (task) {
      const { done: _done, doneAt: _doneAt, ...rest } = task;
      tasks.push(rest);
    }
  }
  const edges: Edge[] = [];
  for (let i = 0; i < raw['edges'].length; i++) {
    const edge = parseEdge(raw['edges'][i], part('edge', i), errors);
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
    errors.push({ code: 'graph', at: where, graph: issue.code });
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
  const errors: BackupIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ code: 'not-object' }] };
  }
  if (input['app'] !== BACKUP_APP_ID) {
    errors.push({ code: 'not-faden' });
  }
  if (!isNumber(input['schemaVersion'])) {
    errors.push({ code: 'no-version' });
    return { ok: false, errors };
  }
  if (input['schemaVersion'] > SCHEMA_VERSION) {
    errors.push({ code: 'newer-version' });
    return { ok: false, errors };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(input as { schemaVersion: number } & Record<string, unknown>);
  } catch {
    errors.push({ code: 'migration' });
    return { ok: false, errors };
  }

  const rawLists = migrated['lists'];
  const rawTemplates = migrated['templates'];
  if (!Array.isArray(rawLists)) errors.push({ code: 'no-lists' });
  if (!Array.isArray(rawTemplates)) errors.push({ code: 'no-templates' });
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

/**
 * Was mit einem importierten Zettel passiert, dessen Name lokal schon existiert:
 * `suffix` = als „Name (2)" dazu, `overwrite` = lokalen Inhalt ersetzen,
 * `skip` = nicht importieren, `newer` = ersetzen nur bei neuerem `updatedAt`.
 */
export type ConflictStrategy = 'suffix' | 'overwrite' | 'skip' | 'newer';

export interface ImportCounts {
  imported: number;
  skipped: number;
  overwritten: number;
}

export interface ImportResult {
  lists: TodoList[];
  templates: Template[];
  counts: ImportCounts;
}

/** Namen der importierten Zettel, die es lokal schon gibt (Vergleich wie `titleKey`). */
export function findConflicts(local: readonly TodoList[], incoming: readonly TodoList[]): string[] {
  const taken = new Set(local.map((l) => titleKey(l.title)));
  return incoming.filter((l) => taken.has(titleKey(l.title))).map((l) => l.title);
}

/**
 * Führt importierte Zettel mit lokalen zusammen. Bewusst unabhängig von der
 * Import-Oberfläche, damit ein späterer Sync sie wiederverwenden kann.
 * Überschreiben behält ID und Position des lokalen Zettels. Neue Zettel bekommen
 * bei ID-Kollision eine neue ID und stets einen eindeutigen Namen.
 */
export function resolveConflicts(
  local: readonly TodoList[],
  incoming: readonly TodoList[],
  strategy: ConflictStrategy,
): { lists: TodoList[]; counts: ImportCounts } {
  const lists = [...local];
  const counts: ImportCounts = { imported: 0, skipped: 0, overwritten: 0 };
  const usedIds = new Set(local.map((l) => l.id));
  const byKey = new Map(local.map((l, index) => [titleKey(l.title), index]));
  const claimed = new Set<number>();
  let sortOrder = local.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;

  for (const list of incoming) {
    const match = byKey.get(titleKey(list.title));
    // Ein lokaler Zettel wird höchstens einmal ersetzt; weitere Gleichnamige kommen dazu.
    if (match !== undefined && !claimed.has(match) && strategy !== 'suffix') {
      const current = lists[match] as TodoList;
      const newer = Date.parse(list.updatedAt) > Date.parse(current.updatedAt);
      if (strategy === 'skip' || (strategy === 'newer' && !newer)) {
        counts.skipped++;
        continue;
      }
      lists[match] = { ...list, id: current.id, sortOrder: current.sortOrder };
      claimed.add(match);
      counts.overwritten++;
      continue;
    }
    const id = usedIds.has(list.id) ? crypto.randomUUID() : list.id;
    usedIds.add(id);
    const title = uniqueTitle(list.title, lists.map((l) => l.title));
    lists.push({ ...list, id, title, sortOrder: sortOrder++ });
    counts.imported++;
  }
  return { lists, counts };
}

/**
 * Führt ein validiertes Backup mit vorhandenen Daten zusammen.
 * `merge`: Zettel über `resolveConflicts`, bestehende Daten bleiben.
 * `replace`: vorhandene Daten werden vollständig ersetzt.
 */
export function applyImport(
  backup: BackupFile,
  existing: { lists: readonly TodoList[]; templates: readonly Template[] },
  mode: ImportMode,
  strategy: ConflictStrategy = 'suffix',
): ImportResult {
  if (mode === 'replace') {
    return {
      lists: backup.lists,
      templates: backup.templates,
      counts: { imported: backup.lists.length, skipped: 0, overwritten: 0 },
    };
  }

  const { lists: mergedLists, counts } = resolveConflicts(existing.lists, backup.lists, strategy);

  const usedTemplateIds = new Set(existing.templates.map((t) => t.id));
  const mergedTemplates: Template[] = [...existing.templates];
  for (const template of backup.templates) {
    const id = usedTemplateIds.has(template.id) ? crypto.randomUUID() : template.id;
    usedTemplateIds.add(id);
    mergedTemplates.push({ ...template, id });
  }

  return { lists: mergedLists, templates: mergedTemplates, counts };
}
