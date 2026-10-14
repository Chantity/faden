import type { Edge, TodoList } from '../model';

export type GraphErrorCode =
  | 'cycle'
  | 'self-loop'
  | 'duplicate-edge'
  | 'unknown-task'
  | 'unknown-edge';

/**
 * Fehler bei Verletzung einer Graph-Invariante. Die Oberfläche erzeugt daraus
 * einen freundlichen, deutschen Text (siehe SPEC 4.1).
 */
export class GraphError extends Error {
  constructor(
    readonly code: GraphErrorCode,
    readonly details: { from?: string; to?: string; edgeId?: string } = {},
    message = code,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export function findTask(list: TodoList, taskId: string): TodoList['tasks'][number] | undefined {
  return list.tasks.find((t) => t.id === taskId);
}

export function hasEdge(list: TodoList, from: string, to: string): boolean {
  return list.edges.some((e) => e.from === from && e.to === to);
}

/** Kann `start` über bestehende Pfeile `target` erreichen? */
function canReach(list: TodoList, start: string, target: string): boolean {
  const outgoing = new Map<string, string[]>();
  for (const e of list.edges) {
    const bucket = outgoing.get(e.from);
    if (bucket) bucket.push(e.to);
    else outgoing.set(e.from, [e.to]);
  }
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of outgoing.get(current) ?? []) stack.push(next);
  }
  return false;
}

/**
 * Würde der Pfeil `from → to` einen Zyklus erzeugen?
 * Das ist der Fall, wenn `to` `from` bereits erreichen kann (inkl. from === to).
 */
export function wouldCreateCycle(list: TodoList, from: string, to: string): boolean {
  if (from === to) return true;
  return canReach(list, to, from);
}

export interface GraphIssue {
  code: GraphErrorCode;
  message: string;
  taskIds: string[];
}

/**
 * Prüft alle Invarianten (SPEC 4.1) und liefert gefundene Verstöße.
 * Leeres Ergebnis = gültiger Graph.
 */
export function validateGraph(list: TodoList): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(list.tasks.map((t) => t.id));
  const seenEdges = new Set<string>();

  for (const e of list.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      issues.push({
        code: 'unknown-task',
        message: 'Ein Pfeil verweist auf ein ToDo, das es nicht (mehr) gibt.',
        taskIds: [e.from, e.to],
      });
      continue;
    }
    if (e.from === e.to) {
      issues.push({ code: 'self-loop', message: 'Ein ToDo wartet auf sich selbst.', taskIds: [e.from] });
    }
    const pair = `${e.from}__${e.to}`;
    if (seenEdges.has(pair)) {
      issues.push({
        code: 'duplicate-edge',
        message: 'Es gibt denselben Pfeil doppelt.',
        taskIds: [e.from, e.to],
      });
    }
    seenEdges.add(pair);
  }

  const adjacency = buildAdjacency(list.edges);
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    const current = state.get(id);
    if (current === 'visiting') return true;
    if (current === 'done') return false;
    state.set(id, 'visiting');
    for (const next of adjacency.out.get(id) ?? []) {
      if (visit(next)) return true;
    }
    state.set(id, 'done');
    return false;
  };
  for (const t of list.tasks) {
    if (visit(t.id)) {
      issues.push({ code: 'cycle', message: 'Die ToDos warten im Kreis aufeinander.', taskIds: [] });
      break;
    }
  }

  return issues;
}

export interface Adjacency {
  out: Map<string, string[]>;
  inc: Map<string, string[]>;
}

export function buildAdjacency(edges: readonly Edge[]): Adjacency {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const e of edges) {
    push(out, e.from, e.to);
    push(inc, e.to, e.from);
  }
  return { out, inc };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}
