// Ableitung des Zeitstatus. Nie speichern, immer berechnen.
import type { Task, TodoList, TimeboxMode } from '../model';
import { parseHhMm, toIsoDate } from './format';

/**
 * Abgeleiteter Zeitstatus:
 * - 'running'  – „Läuft gerade"
 * - 'next'     – „Als Nächstes"
 * - 'late'     – „Nicht abgehakt"
 * - 'planned'  – „Geplant" (Zukunfts-Bezugstag im Tagesplan)
 */
export type TimeStatus = 'running' | 'next' | 'late' | 'planned';

export interface PlannedBounds {
  /** Start als ISO-Timestamp (lokale Zeit), falls gesetzt. */
  start?: string;
  /** Ende als ISO-Timestamp (lokale Zeit), falls gesetzt. */
  end?: string;
}

/** Vergleichbare Zeitachse: Minuten seit Epoche (lokal). */
function toMs(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

/**
 * Liefert die geplanten Start-/End-Zeiten eines ToDos je Zeitmodus als
 * absolute Zeitstempel (lokal). Im Modus 'dayPlan' werden `dayStart`/`dayEnd`
 * mit dem Bezugstag zu einem Timestamp ergänzt.
 */
export function plannedBounds(
  list: TodoList,
  task: Task,
  referenceDate?: string,
): PlannedBounds {
  const bounds: PlannedBounds = {};
  if (list.timeboxMode === 'dayPlan') {
    const ref = referenceDate ?? list.dayPlanReferenceDate;
    if (!ref) return bounds;
    const startMinutes = parseHhMm(task.dayStart);
    const endMinutes = parseHhMm(task.dayEnd);
    if (startMinutes !== null) bounds.start = combineDayAndMinutes(ref, startMinutes);
    if (endMinutes !== null) bounds.end = combineDayAndMinutes(ref, endMinutes);
  } else if (list.timeboxMode === 'schedule') {
    if (task.startAt) bounds.start = task.startAt;
    if (task.endAt) bounds.end = task.endAt;
  }
  return bounds;
}

function combineDayAndMinutes(day: string, minutes: number): string {
  const date = new Date(`${day}T00:00:00`);
  const withMinutes = new Date(date.getTime() + minutes * 60_000);
  const m = String(withMinutes.getMonth() + 1).padStart(2, '0');
  const d = String(withMinutes.getDate()).padStart(2, '0');
  const h = String(withMinutes.getHours()).padStart(2, '0');
  const min = String(withMinutes.getMinutes()).padStart(2, '0');
  return `${withMinutes.getFullYear()}-${m}-${d}T${h}:${min}`;
}

/**
 * Vergleicht den Bezugstag des Tagesplans mit dem heutigen Tag:
 * 'today' | 'past' | 'future'.
 */
export function referenceRelation(list: TodoList, now: Date): 'today' | 'past' | 'future' {
  const ref = list.dayPlanReferenceDate;
  if (!ref) return 'today';
  const refDate = new Date(`${ref}T00:00:00`);
  const today = now;
  const refDay = refDate.getTime();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  if (refDay < startOfToday) return 'past';
  if (refDay > startOfToday) return 'future';
  return 'today';
}

/**
 * Leitet den Zeitstatus eines offenen ToDos ab.
 * Gibt undefined zurück, wenn der Zettel keinen Zeitmodus nutzt oder das ToDo
 * keine Zeiten hat.
 */
export function timeStatus(list: TodoList, task: Task, now: Date): TimeStatus | undefined {
  if (task.done) return undefined;
  const mode: TimeboxMode = list.timeboxMode;
  if (mode !== 'dayPlan' && mode !== 'schedule') return undefined;

  const bounds = plannedBounds(list, task, list.dayPlanReferenceDate);
  if (bounds.start === undefined && bounds.end === undefined) return undefined;

  const nowMs = now.getTime();

  if (mode === 'dayPlan') {
    const relation = referenceRelation(list, now);
    if (relation === 'future') return 'planned';
    if (relation === 'past') return 'late';
  }

  const endMs = bounds.end !== undefined ? toMs(bounds.end) : undefined;
  const startMs = bounds.start !== undefined ? toMs(bounds.start) : undefined;

  // „Nicht abgehakt": Bis ≤ jetzt.
  if (endMs !== undefined && nowMs >= endMs) return 'late';
  // „Läuft gerade": Von ≤ jetzt (und kein abgelaufenes Ende, siehe oben).
  if (startMs !== undefined && nowMs >= startMs) return 'running';
  // Alles andere: „Als Nächstes" (nur im gleichen Tag sinnvoll).
  return 'next';
}

/** Nur im Tagesplan relevant: gibt das früheste offene „Als Nächstes"-ToDo zurück. */
export function earliestNextTask(list: TodoList, now: Date): Task | undefined {
  if (list.timeboxMode !== 'dayPlan' && list.timeboxMode !== 'schedule') return undefined;
  let earliest: Task | undefined;
  let earliestMs = Number.POSITIVE_INFINITY;
  for (const task of list.tasks) {
    if (timeStatus(list, task, now) !== 'next') continue;
    const bounds = plannedBounds(list, task, list.dayPlanReferenceDate);
    const startMs = bounds.start !== undefined ? toMs(bounds.start) : undefined;
    if (startMs === undefined) continue;
    if (startMs < earliestMs) {
      earliestMs = startMs;
      earliest = task;
    }
  }
  return earliest;
}

/** Sortiert ToDos in „Jetzt dran" nach Von-Uhrzeit. */
export function sortPlannedFirst(list: TodoList, tasks: Task[], now: Date): Task[] {
  if (list.timeboxMode !== 'dayPlan' && list.timeboxMode !== 'schedule') return tasks;
  const rank: Record<TimeStatus, number> = { running: 0, late: 1, next: 2, planned: 3 };
  return tasks
    .slice()
    .sort((a, b) => {
      const sa = timeStatus(list, a, now);
      const sb = timeStatus(list, b, now);
      const ra = sa ? rank[sa] : 4;
      const rb = sb ? rank[sb] : 4;
      if (ra !== rb) return ra - rb;
      const ba = plannedBounds(list, a, list.dayPlanReferenceDate);
      const bb = plannedBounds(list, b, list.dayPlanReferenceDate);
      const ta = ba.start !== undefined ? toMs(ba.start) : Number.MAX_SAFE_INTEGER;
      const tb = bb.start !== undefined ? toMs(bb.start) : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
}

/** Formatiert die Zeitspanne für die „Nicht abgehakt"-Anzeige. */
export function formatPlannedRange(list: TodoList, task: Task): string | null {
  const bounds = plannedBounds(list, task, list.dayPlanReferenceDate);
  const startHm = bounds.start !== undefined ? hhMmOf(bounds.start) : undefined;
  const endHm = bounds.end !== undefined ? hhMmOf(bounds.end) : undefined;
  if (startHm === undefined && endHm === undefined) return null;
  if (startHm && endHm) return `${startHm}–${endHm}`;
  return startHm ?? endHm ?? null;
}

/** Liefert Start-/End-Uhrzeit („HH:mm") der geplanten Zeitspanne. */
export function plannedTimeParts(
  list: TodoList,
  task: Task,
): { start?: string; end?: string } {
  const bounds = plannedBounds(list, task, list.dayPlanReferenceDate);
  const parts: { start?: string; end?: string } = {};
  if (bounds.start !== undefined) parts.start = hhMmOf(bounds.start);
  if (bounds.end !== undefined) parts.end = hhMmOf(bounds.end);
  return parts;
}

function hhMmOf(iso: string): string {
  const date = new Date(iso);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Gibt den heutigen Kalendertag als „YYYY-MM-DD" zurück (lokal). */
export function todayIso(now: Date): string {
  return toIsoDate(now);
}
