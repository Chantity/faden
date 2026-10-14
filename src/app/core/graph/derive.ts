import type { Task, TodoList } from '../model';
import { buildAdjacency } from './validation';

/** Alle mittelbaren und unmittelbaren Vorgänger von `taskId` (transitiv). */
function ancestorIds(list: TodoList, taskId: string): Set<string> {
  const inc = buildAdjacency(list.edges).inc;
  const seen = new Set<string>();
  const stack = [...(inc.get(taskId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of inc.get(current) ?? []) stack.push(next);
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
 * in der Kette noch eine offene Vorarbeit stecken (SPEC 4.2/4.4, Nutzerwunsch).
 */
export function openAncestors(list: TodoList, taskId: string): Task[] {
  const byId = taskMap(list);
  return [...ancestorIds(list, taskId)]
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
