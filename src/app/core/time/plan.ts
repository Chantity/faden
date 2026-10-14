// Zeitplan-Werkzeuge (SPEC 7.3–7.5): Validierung, Verschieben, Strecken,
// Zeiten aus Schätzungen vorschlagen und Tageszeiten auf ein Datum übertragen.
// Reine Funktionen, ohne Angular.
import { type Task, type TodoList, type TimeboxMode } from '../model';
import { parseHhMm, roundToFiveMinutes, toIsoDate } from './format';

export interface EstimateSums {
  /** Summe der Minuten aller offenen ToDos mit Schätzung. */
  openMinutes: number;
  /** Summe der Minuten aller ToDos (offen + erledigt) mit Schätzung. */
  totalMinutes: number;
  /** Summe der Minuten aller erledigten ToDos mit Schätzung. */
  doneMinutes: number;
  /** Anzahl offener ToDos ohne Schätzung. */
  openWithoutEstimate: number;
}

/** Summiert Schätzungen (SPEC 7.2). */
export function estimateSums(list: TodoList): EstimateSums {
  let openMinutes = 0;
  let totalMinutes = 0;
  let doneMinutes = 0;
  let openWithoutEstimate = 0;
  for (const task of list.tasks) {
    const minutes = task.estimateMinutes;
    if (typeof minutes === 'number' && Number.isFinite(minutes)) {
      totalMinutes += minutes;
      if (task.done) doneMinutes += minutes;
      else openMinutes += minutes;
    } else if (!task.done) {
      openWithoutEstimate += 1;
    }
  }
  return { openMinutes, totalMinutes, doneMinutes, openWithoutEstimate };
}

/** Validiert „Bis > Von" im Tagesplan (SPEC 7.3). */
export function validateDayTimes(
  dayStart: string | undefined,
  dayEnd: string | undefined,
): { ok: boolean; message?: 'invalid' | 'order' } {
  const start = dayStart !== undefined && dayStart !== '' ? parseHhMm(dayStart) : null;
  const end = dayEnd !== undefined && dayEnd !== '' ? parseHhMm(dayEnd) : null;
  if ((dayStart && start === null) || (dayEnd && end === null)) {
    return { ok: false, message: 'invalid' };
  }
  if (start !== null && end !== null && end <= start) {
    return { ok: false, message: 'order' };
  }
  return { ok: true };
}

function shiftIso(value: string, deltaMs: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toLocalIso(new Date(date.getTime() + deltaMs));
}

function toLocalIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}T${h}:${min}`;
}

/**
 * Verschiebt alle geplanten Zeiten eines Zettels um `deltaMs`
 * (SPEC 7.4, „Alles verschieben"). Wirkt auf `startAt`/`endAt` sowie – sofern
 * der Modus `dayPlan` ist – auch auf `dayStart`/`dayEnd`.
 */
export function shiftPlan(list: TodoList, deltaMs: number): TodoList {
  const tasks = list.tasks.map((task) => {
    const next: Task = { ...task };
    if (list.timeboxMode === 'dayPlan') {
      const start = parseHhMm(task.dayStart);
      const end = parseHhMm(task.dayEnd);
      const deltaMinutes = Math.round(deltaMs / 60_000);
      if (start !== null) next.dayStart = minutesToHh(start + deltaMinutes);
      if (end !== null) next.dayEnd = minutesToHh(end + deltaMinutes);
    } else {
      if (task.startAt) next.startAt = shiftIso(task.startAt, deltaMs);
      if (task.endAt) next.endAt = shiftIso(task.endAt, deltaMs);
    }
    return next;
  });
  return { ...list, tasks };
}

function minutesToHh(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface StretchInput {
  /** Alter Start (ISO, lokal). */
  oldStart: string;
  /** Altes Ende (ISO, lokal). */
  oldEnd: string;
  /** Neuer Start (ISO, lokal). */
  newStart: string;
  /** Neues Ende (ISO, lokal). */
  newEnd: string;
}

/**
 * Bildet alle `startAt`/`endAt` proportional auf einen neuen Zeitraum ab
 * (SPEC 7.4, „Auf Zeitraum strecken/stauchen"), auf 5 Minuten gerundet.
 */
export function stretchPlan(list: TodoList, input: StretchInput): TodoList {
  const oldStartMs = new Date(input.oldStart).getTime();
  const oldEndMs = new Date(input.oldEnd).getTime();
  const newStartMs = new Date(input.newStart).getTime();
  const newEndMs = new Date(input.newEnd).getTime();
  const oldSpan = oldEndMs - oldStartMs;
  if (Number.isNaN(oldStartMs) || Number.isNaN(oldEndMs)) return list;
  if (Number.isNaN(newStartMs) || Number.isNaN(newEndMs)) return list;
  if (oldSpan <= 0) return list;

  const scale = (newEndMs - newStartMs) / oldSpan;

  const map = (value: string): string => {
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) return value;
    const offsetMs = ms - oldStartMs;
    const mapped = newStartMs + offsetMs * scale;
    const rounded = roundToFiveMinutes(mapped / 60_000) * 60_000;
    return toLocalIso(new Date(rounded));
  };

  const tasks = list.tasks.map((task) => {
    const next: Task = { ...task };
    if (task.startAt) next.startAt = map(task.startAt);
    if (task.endAt) next.endAt = map(task.endAt);
    return next;
  });
  return { ...list, tasks };
}

/** Gibt die früheste und späteste geplante Zeit des Zettels zurück (ISO). */
export function planBounds(list: TodoList): { start: string; end: string } | null {
  let start: number | undefined;
  let end: number | undefined;
  for (const task of list.tasks) {
    for (const value of [task.startAt, task.endAt]) {
      if (!value) continue;
      const ms = new Date(value).getTime();
      if (Number.isNaN(ms)) continue;
      if (start === undefined || ms < start) start = ms;
      if (end === undefined || ms > end) end = ms;
    }
  }
  if (start === undefined || end === undefined) return null;
  return { start: toLocalIso(new Date(start)), end: toLocalIso(new Date(end)) };
}

/**
 * Überträgt Tageszeiten (`dayStart`/`dayEnd`) auf ein gewähltes Datum und
 * erzeugt daraus `startAt`/`endAt` (SPEC 7.4, Moduswechsel `dayPlan` →
 * `schedule`).
 */
export function transferDayTimesToList(list: TodoList, day: string): TodoList {
  const tasks = list.tasks.map((task) => {
    const next: Task = { ...task };
    const start = parseHhMm(task.dayStart);
    const end = parseHhMm(task.dayEnd);
    if (start !== null) next.startAt = combine(day, start);
    if (end !== null) next.endAt = combine(day, end);
    return next;
  });
  return { ...list, tasks };
}

function combine(day: string, minutes: number): string {
  const date = new Date(`${day}T00:00:00`);
  const withMinutes = new Date(date.getTime() + minutes * 60_000);
  return toLocalIso(withMinutes);
}

export interface ProposeOptions {
  /** Startzeit („YYYY-MM-DDTHH:mm") für `schedule`, sonst „HH:mm" für `dayPlan`. */
  startAt: string;
  /** Standarddauer für ToDos ohne Schätzung (SPEC 7.5). */
  fallbackMinutes?: number;
}

/**
 * Legt die ToDos in topologischer Reihenfolge nacheinander ab einer gewählten
 * Startzeit an (SPEC 7.5). `dayPlan` nutzt `dayStart`/`dayEnd`, `schedule`
 * `startAt`/`endAt`.
 */
export function proposeTimes(
  list: TodoList,
  options: ProposeOptions,
  order: string[],
): TodoList {
  const fallback = options.fallbackMinutes ?? 15;
  const tasksById = new Map(list.tasks.map((t) => [t.id, t]));
  const tasks: Task[] = [];
  let cursorMinutes = parseHhMm(options.startAt.slice(11));
  if (cursorMinutes === null) cursorMinutes = 0;
  const day = options.startAt.slice(0, 10);

  for (const id of order) {
    const task = tasksById.get(id);
    if (!task || task.done) continue;
    const duration = task.estimateMinutes ?? fallback;
    const next: Task = { ...task };
    if (list.timeboxMode === 'dayPlan') {
      next.dayStart = minutesToHh(cursorMinutes);
      next.dayEnd = minutesToHh(cursorMinutes + duration);
    } else if (list.timeboxMode === 'schedule') {
      next.startAt = combine(day, cursorMinutes);
      next.endAt = combine(day, cursorMinutes + duration);
    }
    tasks.push(next);
    cursorMinutes += duration;
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const merged = list.tasks.map((t) => byId.get(t.id) ?? t);
  return { ...list, tasks: merged };
}

/** Liefert die für den Modus relevanten Zeitfelder einer Task (für Tests/UI). */
export function modeFields(mode: TimeboxMode): readonly (keyof Task)[] {
  switch (mode) {
    case 'estimate':
      return ['estimateMinutes'];
    case 'dayPlan':
      return ['dayStart', 'dayEnd'];
    case 'schedule':
      return ['startAt', 'endAt'];
    default:
      return [];
  }
}

/**
 * Setzt den Zeitmodus eines Zettels. Wird der Tagesplan aktiviert (oder fehlt
 * sein Bezugstag), gilt ab jetzt der heutige Tag als Bezugstag (SPEC 7.3).
 * Zeitfelder der ToDos bleiben unberührt (SPEC 7: kein Datenverlust).
 */
export function withTimeboxMode(list: TodoList, mode: TimeboxMode, now: Date): TodoList {
  const activatesDayPlan =
    mode === 'dayPlan' && (list.timeboxMode !== 'dayPlan' || !list.dayPlanReferenceDate);
  if (list.timeboxMode === mode && !activatesDayPlan) return list;
  return {
    ...list,
    timeboxMode: mode,
    ...(activatesDayPlan ? { dayPlanReferenceDate: toIsoDate(now) } : {}),
  };
}

/**
 * Was beim Moduswechsel angeboten wird (SPEC 7.4):
 * - 'convert': `dayPlan` → `schedule` und es gibt Tageszeiten → Übertragen anbieten.
 * - 'scheduleKept': `schedule` → `dayPlan` und es gibt Datums-Zeiten → nur Hinweis.
 */
export function modeSwitchOffer(
  before: TodoList,
  next: TimeboxMode,
): 'convert' | 'scheduleKept' | null {
  if (before.timeboxMode === 'dayPlan' && next === 'schedule') {
    return before.tasks.some((t) => t.dayStart || t.dayEnd) ? 'convert' : null;
  }
  if (before.timeboxMode === 'schedule' && next === 'dayPlan') {
    return before.tasks.some((t) => t.startAt || t.endAt) ? 'scheduleKept' : null;
  }
  return null;
}
