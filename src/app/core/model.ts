// Datenmodell von Faden.
// Zeitfelder werden IMMER gespeichert und beim Moduswechsel NICHT gelöscht.

export type TimeboxMode = 'none' | 'estimate' | 'dayPlan' | 'schedule';

export const TIMEBOX_MODES: readonly TimeboxMode[] = ['none', 'estimate', 'dayPlan', 'schedule'];

/** Unterstützte Oberflächensprachen (Standard: Englisch). */
export type Locale = 'en' | 'de';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'de'];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export interface TodoList {
  id: string;
  title: string;
  timeboxMode: TimeboxMode;
  tasks: Task[];
  edges: Edge[];
  /** 'YYYY-MM-DD', nur Modus 'dayPlan'. */
  dayPlanReferenceDate?: string;
  archived: boolean;
  /** ISO */
  createdAt: string;
  /** ISO */
  updatedAt: string;
  sortOrder: number;
  /**
   * ISO; gesetzt = gelöscht, aber noch innerhalb der Rückgängig-Frist (Soft-Delete).
   * Solche Zettel sind unsichtbar und werden danach endgültig entfernt.
   */
  deletedAt?: string;
}

export interface Task {
  id: string;
  /** Pflicht, max. 200 Zeichen. */
  title: string;
  /** optional, max. 2000 Zeichen. Gilt nur, solange `checklist` fehlt. */
  notes?: string;
  /** Gesetzt = die Beschreibung ist eine Checkliste statt Freitext. */
  checklist?: ChecklistItem[];
  done: boolean;
  /** ISO, wann abgehakt. */
  doneAt?: string;
  /**
   * Dauer in Minuten (ganzzahlig, 1–1440): Schätzung im Modus 'estimate', Plan-Dauer
   * in 'dayPlan'/'schedule'. Das Ende wird daraus berechnet, nie gespeichert.
   */
  estimateMinutes?: number;
  /** Start 'HH:mm', Modus 'dayPlan'. */
  dayStart?: string;
  /** Start 'YYYY-MM-DDTHH:mm' (lokale Zeit ohne Zeitzone), Modus 'schedule'. */
  startAt?: string;
}

export interface ChecklistItem {
  id: string;
  /** Pflicht, max. 200 Zeichen. */
  text: string;
  done: boolean;
}

export interface Edge {
  id: string;
  /** Task.id – muss vor `to` erledigt sein. */
  from: string;
  /** Task.id */
  to: string;
}

export interface Template {
  id: string;
  title: string;
  tasks: Omit<Task, 'done' | 'doneAt'>[];
  edges: Edge[];
  timeboxMode: TimeboxMode;
  createdAt: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  /** Oberflächensprache; fehlt bei Alt-Daten und wird dann auf DEFAULT_LOCALE gesetzt. */
  language: Locale;
  lastBackupAt?: string;
  schemaVersion: number;
}

export const SCHEMA_VERSION = 3;

export const TITLE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 2000;
export const CHECKLIST_MAX_ITEMS = 100;

/** Deterministische Kanten-ID aus dem from/to-Paar (Doppelpfeile sind verboten). */
export function edgeId(from: string, to: string): string {
  return `${from}__${to}`;
}

/** Erzeugt eine neue Task mit Standardwerten. */
export function createTask(title: string, id: string = crypto.randomUUID()): Task {
  return { id, title, done: false };
}

/** Vergleichsschlüssel für Zettel-Namen: getrimmt, ohne Groß-/Kleinschreibung. */
export function titleKey(title: string): string {
  return title.trim().toLocaleLowerCase();
}

/**
 * Macht `title` eindeutig gegenüber `taken` (Namen anderer Zettel): „Einkauf",
 * sonst „Einkauf (2)", „Einkauf (3)" … Ein vorhandenes „ (n)" wird weitergezählt.
 */
export function uniqueTitle(title: string, taken: Iterable<string>): string {
  const keys = new Set([...taken].map(titleKey));
  const trimmed = title.trim();
  if (!keys.has(titleKey(trimmed))) return trimmed;
  const base = trimmed.replace(/ \(\d+\)$/, '');
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, TITLE_MAX_LENGTH - suffix.length) + suffix;
    if (!keys.has(titleKey(candidate))) return candidate;
  }
}

/** Erzeugt einen leeren Zettel. */
export function createList(
  title: string,
  timeboxMode: TimeboxMode = 'none',
  now: string = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): TodoList {
  return {
    id,
    title,
    timeboxMode,
    tasks: [],
    edges: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
  };
}
