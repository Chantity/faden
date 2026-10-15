// Zeitplan-Werkzeuge: Validierung, Verschieben, Strecken,
// Zeiten aus Schätzungen vorschlagen und Tageszeiten auf ein Datum übertragen.
// Reine Funktionen, ohne Angular.
import { type Task, type TodoList, type TimeboxMode } from '../model';
import { minutesToHhMm, parseHhMm, roundToFiveMinutes, toIsoDate, toLocalIso } from './format';

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

/** Summiert Schätzungen. */
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

/**
 * Validiert Start + Dauer im Tagesplan: gültige Uhrzeit, und das Ende liegt
 * spätestens um 24:00 (über Mitternacht geht nur der feste Zeitplan).
 */
export function validateDayTimes(
  dayStart: string | undefined,
  minutes: number | undefined,
): { ok: boolean; message?: 'invalid' | 'order' } {
  if (!dayStart) return { ok: true };
  const start = parseHhMm(dayStart);
  if (start === null) return { ok: false, message: 'invalid' };
  if (minutes !== undefined && start + minutes > 24 * 60) {
    return { ok: false, message: 'order' };
  }
  return { ok: true };
}

/** Rechnet in lokalen Uhrzeit-Feldern: „+1 Tag" bleibt über die Zeitumstellung 09:00. */
function shiftIso(value: string, deltaMs: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + Math.round(deltaMs / 60_000));
  return toLocalIso(date);
}

/**
 * Verschiebt die geplanten Startzeiten eines Zettels um `deltaMs`
 * („Alles verschieben"), mit `ids` nur diese ToDos (z. B. einen Strang).
 * Wirkt auf `startAt` sowie – sofern der Modus `dayPlan` ist – auf `dayStart`.
 * Die Dauern bleiben; erledigte ToDos rücken mit, damit Pausen erhalten bleiben.
 */
export function shiftPlan(list: TodoList, deltaMs: number, ids?: ReadonlySet<string>): TodoList {
  const tasks = list.tasks.map((task) => {
    if (ids && !ids.has(task.id)) return task;
    const next: Task = { ...task };
    if (list.timeboxMode === 'dayPlan') {
      const start = parseHhMm(task.dayStart);
      if (start !== null) next.dayStart = minutesToHhMm(start + Math.round(deltaMs / 60_000));
    } else if (task.startAt) {
      next.startAt = shiftIso(task.startAt, deltaMs);
    }
    return next;
  });
  return { ...list, tasks };
}

/**
 * Nur im Tagesplan: Würde `shiftPlan` ein ToDo vor 0:00 oder über 24:00
 * hinausschieben? Dann würde die Uhrzeit sonst stillschweigend umbrechen.
 */
export function shiftLeavesDay(list: TodoList, deltaMs: number, ids?: ReadonlySet<string>): boolean {
  if (list.timeboxMode !== 'dayPlan') return false;
  const delta = Math.round(deltaMs / 60_000);
  return list.tasks.some((task) => {
    const start = parseHhMm(task.dayStart);
    if (start === null || (ids && !ids.has(task.id))) return false;
    return start + delta < 0 || start + delta + (task.estimateMinutes ?? 0) > 24 * 60;
  });
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
 * Bildet alle Zeiten proportional auf einen neuen Zeitraum ab
 * („Auf Zeitraum strecken/stauchen"), auf 5 Minuten gerundet: Start und Ende
 * jedes ToDos werden abgebildet, die Dauer ergibt sich aus beiden.
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

  const map = (ms: number): number =>
    roundToFiveMinutes((newStartMs + (ms - oldStartMs) * scale) / 60_000) * 60_000;

  const tasks = list.tasks.map((task) => {
    if (!task.startAt) return task;
    const startMs = new Date(task.startAt).getTime();
    if (Number.isNaN(startMs)) return task;
    const next: Task = { ...task, startAt: toLocalIso(new Date(map(startMs))) };
    if (task.estimateMinutes !== undefined) {
      const endMs = map(startMs + task.estimateMinutes * 60_000);
      next.estimateMinutes = Math.max(5, Math.round((endMs - map(startMs)) / 60_000));
    }
    return next;
  });
  return { ...list, tasks };
}

/** Gibt die früheste und späteste geplante Zeit des Zettels zurück (ISO). */
export function planBounds(list: TodoList): { start: string; end: string } | null {
  let start: number | undefined;
  let end: number | undefined;
  for (const task of list.tasks) {
    if (!task.startAt) continue;
    const startMs = new Date(task.startAt).getTime();
    if (Number.isNaN(startMs)) continue;
    const endMs = startMs + (task.estimateMinutes ?? 0) * 60_000;
    if (start === undefined || startMs < start) start = startMs;
    if (end === undefined || endMs > end) end = endMs;
  }
  if (start === undefined || end === undefined) return null;
  return { start: toLocalIso(new Date(start)), end: toLocalIso(new Date(end)) };
}

/**
 * Überträgt Tageszeiten (`dayStart`) auf ein gewähltes Datum und erzeugt daraus
 * `startAt` (Moduswechsel `dayPlan` → `schedule`). Die Dauer bleibt.
 */
export function transferDayTimesToList(list: TodoList, day: string): TodoList {
  const tasks = list.tasks.map((task) => {
    const start = parseHhMm(task.dayStart);
    return start === null ? task : { ...task, startAt: combine(day, start) };
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
  /** Standarddauer für ToDos ohne Schätzung. */
  fallbackMinutes?: number;
}

/**
 * Legt die ToDos in topologischer Reihenfolge nacheinander ab einer gewählten
 * Startzeit an. `dayPlan` setzt `dayStart`, `schedule` `startAt`; ToDos ohne
 * Dauer erhalten die Standarddauer.
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
    const next: Task = { ...task, estimateMinutes: duration };
    if (list.timeboxMode === 'dayPlan') {
      next.dayStart = minutesToHhMm(cursorMinutes);
    } else if (list.timeboxMode === 'schedule') {
      next.startAt = combine(day, cursorMinutes);
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
      return ['dayStart', 'estimateMinutes'];
    case 'schedule':
      return ['startAt', 'estimateMinutes'];
    default:
      return [];
  }
}

/**
 * Setzt den Zeitmodus eines Zettels. Wird der Tagesplan aktiviert (oder fehlt
 * sein Bezugstag), gilt ab jetzt der heutige Tag als Bezugstag.
 * Zeitfelder der ToDos bleiben unberührt.
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
 * Was beim Moduswechsel angeboten wird:
 * - 'convert': `dayPlan` → `schedule` und es gibt Tageszeiten → Übertragen anbieten.
 * - 'scheduleKept': `schedule` → `dayPlan` und es gibt Datums-Zeiten → nur Hinweis.
 */
export function modeSwitchOffer(
  before: TodoList,
  next: TimeboxMode,
): 'convert' | 'scheduleKept' | null {
  if (before.timeboxMode === 'dayPlan' && next === 'schedule') {
    return before.tasks.some((t) => t.dayStart) ? 'convert' : null;
  }
  if (before.timeboxMode === 'schedule' && next === 'dayPlan') {
    return before.tasks.some((t) => t.startAt) ? 'scheduleKept' : null;
  }
  return null;
}
