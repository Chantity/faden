import type { Task, TodoList } from '../model';

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

/** „Jetzt dran": offen und alle Vorgänger erledigt. */
export function isAvailable(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || task.done) return false;
  return openPredecessors(list, taskId).length === 0;
}

/** Wartet: offen, aber mindestens ein Vorgänger ist noch offen. */
export function isBlocked(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || task.done) return false;
  return openPredecessors(list, taskId).length > 0;
}

/** Vorzeitig abgehakt: erledigt, obwohl ein Vorgänger noch offen ist. */
export function isEarlyDone(list: TodoList, taskId: string): boolean {
  const task = taskMap(list).get(taskId);
  if (!task || !task.done) return false;
  return openPredecessors(list, taskId).length > 0;
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
