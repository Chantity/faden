import type { Edge, Task, TodoList } from '../model';
import { buildAdjacency } from './validation';

/**
 * Stabile topologische Reihenfolge (SPEC 4.5): bei Gleichstand entscheidet die
 * Erstellungsreihenfolge (= Position in `list.tasks`).
 */
export function topologicalOrder(list: TodoList): Task[] {
  const index = new Map<string, number>(list.tasks.map((t, i) => [t.id, i]));
  const indegree = new Map<string, number>(list.tasks.map((t) => [t.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const e of list.edges) {
    if (!index.has(e.from) || !index.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    const bucket = outgoing.get(e.from);
    if (bucket) bucket.push(e.to);
    else outgoing.set(e.from, [e.to]);
  }

  const remaining = [...list.tasks];
  const result: Task[] = [];
  const emitted = new Set<string>();

  while (result.length < list.tasks.length) {
    let pick: Task | undefined;
    let pickIndex = Number.POSITIVE_INFINITY;
    for (const t of remaining) {
      if (emitted.has(t.id)) continue;
      if ((indegree.get(t.id) ?? 0) !== 0) continue;
      const i = index.get(t.id) ?? Number.POSITIVE_INFINITY;
      if (i < pickIndex) {
        pickIndex = i;
        pick = t;
      }
    }
    if (!pick) break; // Zyklus: Rest wird nicht ausgegeben.
    emitted.add(pick.id);
    result.push(pick);
    for (const next of outgoing.get(pick.id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
    }
  }

  // Bei Zyklus blieben ToDos übrig – restliche stabil anhängen, nichts verlieren.
  for (const t of remaining) {
    if (!emitted.has(t.id)) result.push(t);
  }
  return result;
}

export interface Strand {
  tasks: Task[];
  edges: Edge[];
}

/**
 * Zerlegt den Zettel in seine unabhängigen Stränge (verbundene Komponenten,
 * SPEC 4.5). Die Reihenfolge folgt der Erstellungsreihenfolge.
 */
export function connectedComponents(list: TodoList): Strand[] {
  const parent = new Map<string, string>(list.tasks.map((t) => [t.id, t.id]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of list.edges) {
    if (parent.has(e.from) && parent.has(e.to)) union(e.from, e.to);
  }

  const groups = new Map<string, Task[]>();
  const order: string[] = [];
  for (const t of list.tasks) {
    const root = find(t.id);
    const bucket = groups.get(root);
    if (bucket) bucket.push(t);
    else {
      groups.set(root, [t]);
      order.push(root);
    }
  }

  return order.map((root) => {
    const tasks = groups.get(root) as Task[];
    const ids = new Set(tasks.map((t) => t.id));
    const edges = list.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return { tasks, edges };
  });
}

/** Der Strang (Teilgraph), zu dem `taskId` gehört (SPEC 4.5). */
export function extractStrand(list: TodoList, taskId: string): Strand {
  const component = connectedComponents(list).find((c) => c.tasks.some((t) => t.id === taskId));
  return component ?? { tasks: [], edges: [] };
}

/**
 * Transitive Reduktion (SPEC 4.1.4): blendet „Umweg“-Pfeile aus, die bereits
 * durch eine längere Kette ausgedrückt werden (z. B. A→C, wenn A→B→C existiert).
 * Nur fürs Zeichnen gedacht – der gespeicherte Graph behält alle Pfeile, und die
 * Erreichbarkeit (und damit „jetzt dran“/„wartet“) bleibt unverändert.
 */
export function transitiveReduction(list: TodoList): Edge[] {
  const out = buildAdjacency(list.edges).out;
  const reaches = (start: string, target: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === target) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of out.get(current) ?? []) stack.push(next);
    }
    return false;
  };

  return list.edges.filter((edge) => {
    for (const succ of out.get(edge.from) ?? []) {
      if (succ === edge.to) continue;
      if (reaches(succ, edge.to)) return false;
    }
    return true;
  });
}
