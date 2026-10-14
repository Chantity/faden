import { edgeId, type Edge, type Task, type TodoList } from '../model';
import { findTask, GraphError, hasEdge, wouldCreateCycle } from './validation';

export type DeleteMode = 'bridge' | 'remove-only';

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function withStructure(
  list: TodoList,
  tasks: Task[],
  edges: Edge[],
  now?: string,
): TodoList {
  return { ...list, tasks, edges, updatedAt: nowIso(now) };
}

function addEdge(edges: Edge[], from: string, to: string): Edge[] {
  if (edges.some((e) => e.from === from && e.to === to)) return edges;
  return [...edges, { id: edgeId(from, to), from, to }];
}

function requireTask(list: TodoList, taskId: string): Task {
  const task = findTask(list, taskId);
  if (!task) throw new GraphError('unknown-task', { from: taskId });
  return task;
}

/**
 * „Davor etwas einfügen": Alle Pfeile `p → n` werden zu `p → m`, plus `m → n`.
 * Hat `n` keine Vorgänger, ist `m` danach der neue Anfang.
 */
export function insertBefore(list: TodoList, targetId: string, newTask: Task, now?: string): TodoList {
  requireTask(list, targetId);
  const incoming = list.edges.filter((e) => e.to === targetId);
  let edges = list.edges.filter((e) => e.to !== targetId);
  for (const e of incoming) edges = addEdge(edges, e.from, newTask.id);
  edges = addEdge(edges, newTask.id, targetId);
  return withStructure(list, [...list.tasks, newTask], edges, now);
}

/**
 * „Danach etwas einfügen": Alle Pfeile `n → s` werden zu `m → s`, plus `n → m`.
 * Hat `n` keine Nachfolger, ist `m` das neue Ende.
 */
export function insertAfter(list: TodoList, targetId: string, newTask: Task, now?: string): TodoList {
  requireTask(list, targetId);
  const outgoing = list.edges.filter((e) => e.from === targetId);
  let edges = list.edges.filter((e) => e.from !== targetId);
  for (const e of outgoing) edges = addEdge(edges, newTask.id, e.to);
  edges = addEdge(edges, targetId, newTask.id);
  return withStructure(list, [...list.tasks, newTask], edges, now);
}

/** „Dazwischen": Pfeil `a → b` entfernen, neu `a → m` und `m → b`. */
export function insertBetween(list: TodoList, edge: string, newTask: Task, now?: string): TodoList {
  const found = list.edges.find((e) => e.id === edge);
  if (!found) throw new GraphError('unknown-edge', { edgeId: edge });
  let edges = list.edges.filter((e) => e.id !== found.id);
  edges = addEdge(edges, found.from, newTask.id);
  edges = addEdge(edges, newTask.id, found.to);
  return withStructure(list, [...list.tasks, newTask], edges, now);
}

/** „Daneben aufteilen": nur neuer Pfeil `n → m`, bestehende bleiben. */
export function addParallelAfter(list: TodoList, taskId: string, newTask: Task, now?: string): TodoList {
  requireTask(list, taskId);
  const edges = addEdge(list.edges, taskId, newTask.id);
  return withStructure(list, [...list.tasks, newTask], edges, now);
}

/** „Daneben zusammenführen": nur neuer Pfeil `m → n`, bestehende bleiben. */
export function addParallelBefore(list: TodoList, taskId: string, newTask: Task, now?: string): TodoList {
  requireTask(list, taskId);
  const edges = addEdge(list.edges, newTask.id, taskId);
  return withStructure(list, [...list.tasks, newTask], edges, now);
}

/** Neues ToDo ohne Pfeile (eigener neuer Strang). */
export function addStandalone(list: TodoList, newTask: Task, now?: string): TodoList {
  return withStructure(list, [...list.tasks, newTask], list.edges, now);
}

/** Neuer Pfeil `from → to` mit Zyklus- und Duplikatprüfung. */
export function connect(list: TodoList, from: string, to: string, now?: string): TodoList {
  requireTask(list, from);
  requireTask(list, to);
  if (from === to) throw new GraphError('self-loop', { from, to });
  if (hasEdge(list, from, to)) throw new GraphError('duplicate-edge', { from, to });
  if (wouldCreateCycle(list, from, to)) throw new GraphError('cycle', { from, to });
  const edges = addEdge(list.edges, from, to);
  return withStructure(list, list.tasks, edges, now);
}

/** Entfernt einen Pfeil. */
export function disconnect(list: TodoList, edge: string, now?: string): TodoList {
  if (!list.edges.some((e) => e.id === edge)) {
    throw new GraphError('unknown-edge', { edgeId: edge });
  }
  return withStructure(
    list,
    list.tasks,
    list.edges.filter((e) => e.id !== edge),
    now,
  );
}

/**
 * Löscht ein ToDo.
 * Standard „Überbrücken": jeder Vorgänger wird mit jedem Nachfolger verbunden
 * (Duplikate vermieden), dann ToDo und seine Pfeile entfernen.
 * „remove-only": nur das ToDo und seine Pfeile entfernen, nichts verbinden.
 */
export function deleteTask(
  list: TodoList,
  taskId: string,
  mode: DeleteMode = 'bridge',
  now?: string,
): TodoList {
  requireTask(list, taskId);
  const predecessors = list.edges.filter((e) => e.to === taskId).map((e) => e.from);
  const successors = list.edges.filter((e) => e.from === taskId).map((e) => e.to);

  let edges = list.edges.filter((e) => e.from !== taskId && e.to !== taskId);
  if (mode === 'bridge') {
    for (const p of predecessors) {
      for (const s of successors) {
        if (p === s) continue;
        edges = addEdge(edges, p, s);
      }
    }
  }

  const tasks = list.tasks.filter((t) => t.id !== taskId);
  return withStructure(list, tasks, edges, now);
}
