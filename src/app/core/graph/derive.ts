import type { Task, TodoList } from '../model';
import { buildAdjacency } from './validation';

/**
 * Alle mittelbaren und unmittelbaren Vorgänger (`'inc'`) bzw. Nachfolger
 * (`'out'`) von `taskId` (transitiv).
 */
export function reachableIds(list: TodoList, taskId: string, direction: 'inc' | 'out' = 'inc'): Set<string> {
  const adjacent = buildAdjacency(list.edges)[direction];
  const seen = new Set<string>();
  const stack = [...(adjacent.get(taskId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacent.get(current) ?? []) stack.push(next);
  }
  return seen;
}

/** Vorgänger von `taskId` (ToDos, die vorher erledigt sein müssen). */
export function predecessors(list: TodoList, taskId: string): Task[] {
  const byId = taskMap(list);
  return list.edges
    .filter((e) => e.to === taskId)
    .map((e) => byId.get(e.from))
    .filter((t): t is Task => t !== undefined);
}

/** Nachfolger von `taskId` (ToDos, die danach kommen). */
export function successors(list: TodoList, taskId: string): Task[] {
  const byId = taskMap(list);
  return list.edges
    .filter((e) => e.from === taskId)
    .map((e) => byId.get(e.to))
    .filter((t): t is Task => t !== undefined);
}

/** Noch offene Vorgänger. */
export function openPredecessors(list: TodoList, taskId: string): Task[] {
  return predecessors(list, taskId).filter((t) => !t.done);
}

/**
 * Noch offene, mittelbare und unmittelbare Vorgänger. „Wartet“ wird transitiv
 * bestimmt: Auch wenn der direkte Vorgänger schon erledigt ist, kann weiter oben
 * in der Kette noch eine offene Vorarbeit stecken (Nutzerwunsch).
 */
export function openAncestors(list: TodoList, taskId: string): Task[] {
  const byId = taskMap(list);
  return [...reachableIds(list, taskId)]
    .map((id) => byId.get(id))
    .filter((t): t is Task => t !== undefined && !t.done);
}

/** „Jetzt dran": offen und keine offene Vorarbeit (auch keine mittelbare). */
export function isAvailable(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || task.done) return false;
  return openAncestors(list, taskId).length === 0;
}

/** Wartet: offen, aber mindestens eine (auch mittelbare) Vorarbeit ist offen. */
export function isBlocked(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || task.done) return false;
  return openAncestors(list, taskId).length > 0;
}

/** Vorzeitig abgehakt: erledigt, obwohl eine Vorarbeit noch offen ist. */
export function isEarlyDone(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || !task.done) return false;
  return openAncestors(list, taskId).length > 0;
}

/**
 * Die ToDos, die `taskId` tatsächlich aufhalten. Bevorzugt die direkten offenen
 * Vorgänger (für eine kurze „wartet auf …“-Liste); gibt es keine, die nächsten
 * offenen Vorfahren.
 */
export function blockingTasks(list: TodoList, taskId: string): Task[] {
  const direct = openPredecessors(list, taskId);
  if (direct.length > 0) return direct;
  return openAncestors(list, taskId);
}

/** Aufteilen: mindestens zwei Nachfolger. */
export function isSplit(list: TodoList, taskId: string): boolean {
  return list.edges.filter((e) => e.from === taskId).length >= 2;
}

/** Zusammenführen: mindestens zwei Vorgänger (UND-Semantik). */
export function isJoin(list: TodoList, taskId: string): boolean {
  return list.edges.filter((e) => e.to === taskId).length >= 2;
}

export interface Progress {
  done: number;
  total: number;
}

export function progress(list: TodoList): Progress {
  const total = list.tasks.length;
  const done = list.tasks.filter((t) => t.done).length;
  return { done, total };
}

/** Alle „Jetzt dran"-ToDos in Erstellungsreihenfolge. */
export function availableTasks(list: TodoList): Task[] {
  return list.tasks.filter((t) => isAvailable(list, t.id));
}

/** Alle gesperrten ToDos in Erstellungsreihenfolge. */
export function blockedTasks(list: TodoList): Task[] {
  return list.tasks.filter((t) => isBlocked(list, t.id));
}

/** Erledigte ToDos in Erstellungsreihenfolge. */
export function doneTasks(list: TodoList): Task[] {
  return list.tasks.filter((t) => t.done);
}

function taskMap(list: TodoList): Map<string, Task> {
  return new Map(list.tasks.map((t) => [t.id, t]));
}

/**
 * Macht das „Überbrücken" beim Löschen einen Unterschied? Nur wenn das ToDo
 * sowohl Vorgänger als auch Nachfolger hat (deleteTask).
 */
export function deleteBridges(list: TodoList, taskId: string): boolean {
  return list.edges.some((e) => e.to === taskId) && list.edges.some((e) => e.from === taskId);
}

/**
 * Auswahl für ein einzelnes Dropdown (einfacher Modus): der aktuelle Nachbar plus
 * alle ToDos mit freiem Ende auf dieser Seite (kein Nachfolger bzw. kein Vorgänger),
 * die keinen Kreis erzeugen. So bleibt eine Kette gerade, ohne Verzweigung.
 */
export function singleLinkOptions(list: TodoList, taskId: string, side: 'prev' | 'succ'): Task[] {
  const current = new Set((side === 'prev' ? predecessors(list, taskId) : successors(list, taskId)).map((t) => t.id));
  const cycle = reachableIds(list, taskId, side === 'prev' ? 'out' : 'inc');
  const free = (id: string) => (side === 'prev' ? successors(list, id) : predecessors(list, id)).length === 0;
  return list.tasks.filter((t) => t.id !== taskId && (current.has(t.id) || (free(t.id) && !cycle.has(t.id))));
}
