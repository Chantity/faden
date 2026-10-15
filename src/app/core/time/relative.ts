// Pausen zwischen ToDos und Einfügen mit relativen Zeiten (Tagesplan und
// fester Zeitplan). Reine Funktionen, ohne Angular.
import { createTask, type Task, type TodoList } from '../model';
import { insertAt, predecessors, reachableIds, successors, type InsertPosition } from '../graph';
import { minutesToHhMm, toLocalIso } from './format';
import { plannedBounds } from './status';

const MINUTE = 60_000;

/** Start und Ende (ms) eines ToDos; ohne Dauer ist das Ende der Start. `null` ohne Startzeit. */
export function taskSpan(list: TodoList, task: Task): { start: number; end: number } | null {
  const bounds = plannedBounds(list, task);
  if (!bounds.start) return null;
  const start = new Date(bounds.start).getTime();
  return { start, end: bounds.end ? new Date(bounds.end).getTime() : start };
}

/** Pause in Minuten zwischen dem Ende von `fromId` und dem Start von `toId`; `null` ohne Startzeiten. */
export function pauseBetween(list: TodoList, fromId: string, toId: string): number | null {
  const from = list.tasks.find((t) => t.id === fromId);
  const to = list.tasks.find((t) => t.id === toId);
  const a = from && taskSpan(list, from);
  const b = to && taskSpan(list, to);
  if (!a || !b) return null;
  return Math.round((b.start - a.end) / MINUTE);
}

/**
 * Startfeld des Modus für einen Zeitpunkt (ms): `startAt` im festen Zeitplan,
 * `dayStart` im Tagesplan. `null`, wenn er im Tagesplan nicht auf den Bezugstag fällt.
 */
export function startFields(list: TodoList, ms: number): Pick<Task, 'dayStart' | 'startAt'> | null {
  if (list.timeboxMode === 'schedule') return { startAt: toLocalIso(new Date(ms)) };
  const ref = list.dayPlanReferenceDate;
  if (list.timeboxMode !== 'dayPlan' || !ref) return null;
  const minutes = Math.round((ms - new Date(`${ref}T00:00:00`).getTime()) / MINUTE);
  return minutes >= 0 && minutes < 24 * 60 ? { dayStart: minutesToHhMm(minutes) } : null;
}

/**
 * Wo ein neues ToDo zeitlich hinkommt, abgeleitet aus seinen Nachbarn nach dem
 * Einfügen: `prev` ist der Vorgänger, der zuletzt endet, `next` der früheste
 * Nachfolger (nur Nachbarn mit Startzeit). `ancestors`/`descendants` sind die
 * transitiven Vorgänger/Nachfolger des neuen ToDos – also nur im eigenen Strang.
 */
export type RelativeContext = {
  ancestors: string[];
  descendants: string[];
} & (
  | { kind: 'first'; next: { id: string; start: number } }
  | { kind: 'last'; prev: { id: string; end: number } }
  | { kind: 'between'; prev: { id: string; end: number }; next: { id: string; start: number } }
);

/** `null`, wenn relative Eingabe nicht passt (kein Zeitmodus oder Nachbarn ohne Startzeit). */
export function relativeContext(list: TodoList, position: InsertPosition): RelativeContext | null {
  if (list.timeboxMode !== 'dayPlan' && list.timeboxMode !== 'schedule') return null;
  const probe = createTask('');
  let after: TodoList;
  try {
    after = insertAt(list, position, probe);
  } catch {
    return null;
  }
  let prev: { id: string; end: number } | undefined;
  let next: { id: string; start: number } | undefined;
  for (const task of predecessors(after, probe.id)) {
    const span = taskSpan(after, task);
    if (span && (!prev || span.end > prev.end)) prev = { id: task.id, end: span.end };
  }
  for (const task of successors(after, probe.id)) {
    const span = taskSpan(after, task);
    if (span && (!next || span.start < next.start)) next = { id: task.id, start: span.start };
  }
  const reach = {
    ancestors: [...reachableIds(after, probe.id, 'inc')],
    descendants: [...reachableIds(after, probe.id, 'out')],
  };
  if (prev && next) return { kind: 'between', prev, next, ...reach };
  if (next) return { kind: 'first', next, ...reach };
  if (prev) return { kind: 'last', prev, ...reach };
  return null;
}

export interface RelativeInput {
  /** Dauer des neuen ToDos (Min). */
  minutes: number;
  /** „Pause danach" (vor dem ersten/dazwischen) bzw. „Pause davor" (nach dem letzten), Min. */
  pause: number;
  /**
   * Die zweite Option: vor dem ersten „Startzeit beibehalten",
   * dazwischen „Davor alles nach vorne schieben".
   */
  alternative: boolean;
}

export interface RelativePlacement {
  /** Start des neuen ToDos (ms). */
  start: number;
  /** ToDos, die mitrücken, und um wie viel (ms, negativ = früher). */
  shiftIds: string[];
  shiftMs: number;
}

/** Berechnet Start und Versatz für relatives Einfügen. */
export function placeRelative(context: RelativeContext, input: RelativeInput): RelativePlacement {
  const length = (input.minutes + input.pause) * MINUTE;
  const still = { shiftIds: [], shiftMs: 0 };
  switch (context.kind) {
    case 'last':
      return { start: context.prev.end + input.pause * MINUTE, ...still };
    case 'first':
      return input.alternative
        ? { start: context.next.start, shiftIds: context.descendants, shiftMs: length }
        : { start: context.next.start - length, ...still };
    case 'between': {
      // Die bisherige Pause A → B wird zur Pause A → neu (Überlappung zählt als 0).
      const gap = Math.max(0, context.next.start - context.prev.end);
      if (input.alternative) {
        const start = context.next.start - length;
        return { start, shiftIds: context.ancestors, shiftMs: start - gap - context.prev.end };
      }
      const start = context.prev.end + gap;
      return { start, shiftIds: context.descendants, shiftMs: start + length - context.next.start };
    }
  }
}
