import { edgeId, type Edge, type Task, type TodoList } from '../model';
import {
  addParallelAfter,
  addParallelBefore,
  addStandalone,
  connect,
  deleteTask,
  disconnect,
  extractStrand,
  GraphError,
  insertAfter,
  insertAt,
  insertBefore,
  insertBetween,
  isAvailable,
  nextInChain,
  isBlocked,
  isEarlyDone,
  isJoin,
  isSplit,
  openPredecessors,
  predecessors,
  progress,
  successors,
  topologicalOrder,
  transitiveReduction,
  connectedComponents,
  validateGraph,
  wouldCreateCycle,
} from './index';

const NOW = '2026-01-01T00:00:00.000Z';

function makeTask(id: string, done = false): Task {
  return { id, title: `ToDo ${id}`, done };
}

function makeEdge(from: string, to: string): Edge {
  return { id: edgeId(from, to), from, to };
}

function makeList(tasks: Task[], edges: Edge[]): TodoList {
  return {
    id: 'list-1',
    title: 'Test',
    timeboxMode: 'none',
    tasks,
    edges,
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    sortOrder: 0,
  };
}

/** Kanonische, sortierte Kantenliste zum einfachen Vergleichen. */
function pairs(list: TodoList): string[] {
  return list.edges.map((e) => `${e.from}->${e.to}`).sort();
}

// ---------------------------------------------------------------------------
// insertBefore
// ---------------------------------------------------------------------------

describe('insertBefore', () => {
  it('macht die neue Vorarbeit zum neuen Anfang, wenn n keine Vorgänger hat', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    const result = insertBefore(list, 'a', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->b', 'm->a']);
    expect(result.tasks.map((t) => t.id)).toEqual(['a', 'b', 'm']);
  });

  it('ersetzt alle Vorgänger-Pfeile durch Pfeile auf die neue Vorarbeit', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('n')],
      [makeEdge('a', 'n'), makeEdge('b', 'n')],
    );
    const result = insertBefore(list, 'n', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->m', 'b->m', 'm->n']);
  });

  it('erhält Aufteilungen, wenn vor ein Zusammenführungs-ToDo eingefügt wird', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('n')],
      [makeEdge('a', 'n'), makeEdge('b', 'c'), makeEdge('c', 'n')],
    );
    const result = insertBefore(list, 'n', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->m', 'b->c', 'c->m', 'm->n']);
  });
});

// ---------------------------------------------------------------------------
// insertAfter
// ---------------------------------------------------------------------------

describe('insertAfter', () => {
  it('macht die neue Arbeit zum neuen Ende, wenn n keine Nachfolger hat', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    const result = insertAfter(list, 'b', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->b', 'b->m']);
  });

  it('hängt alle Nachfolger an die neue Arbeit um', () => {
    const list = makeList(
      [makeTask('n'), makeTask('x'), makeTask('y')],
      [makeEdge('n', 'x'), makeEdge('n', 'y')],
    );
    const result = insertAfter(list, 'n', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['m->x', 'm->y', 'n->m']);
  });
});

// ---------------------------------------------------------------------------
// insertBetween
// ---------------------------------------------------------------------------

describe('insertBetween', () => {
  it('teilt einen Pfeil a->b in a->m und m->b', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    const result = insertBetween(list, edgeId('a', 'b'), makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->m', 'm->b']);
  });

  it('wirft bei unbekanntem Pfeil', () => {
    const list = makeList([makeTask('a'), makeTask('b')], []);
    expect(() => insertBetween(list, 'nope', makeTask('m'))).toThrow(GraphError);
  });
});

// ---------------------------------------------------------------------------
// addParallelAfter / addParallelBefore / addStandalone
// ---------------------------------------------------------------------------

describe('addParallelAfter', () => {
  it('fügt nur einen zusätzlichen Pfeil hinzu (Verzweigung)', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    const result = addParallelAfter(list, 'a', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->b', 'a->m']);
    expect(isSplit(result, 'a')).toBe(true);
  });
});

describe('addParallelBefore', () => {
  it('fügt nur einen zusätzlichen Pfeil hinzu (Zusammenführung)', () => {
    const list = makeList([makeTask('a'), makeTask('n')], [makeEdge('a', 'n')]);
    const result = addParallelBefore(list, 'n', makeTask('m'), NOW);
    expect(pairs(result)).toEqual(['a->n', 'm->n']);
    expect(isJoin(result, 'n')).toBe(true);
  });
});

describe('addStandalone', () => {
  it('erzeugt ein ToDo ohne Pfeile', () => {
    const list = makeList([makeTask('a')], []);
    const result = addStandalone(list, makeTask('m'), NOW);
    expect(result.edges).toHaveLength(0);
    expect(result.tasks.map((t) => t.id)).toEqual(['a', 'm']);
  });
});

describe('insertAt / nextInChain', () => {
  const branch = () => makeList([makeTask('a'), makeTask('b'), makeTask('c')], [makeEdge('a', 'b'), makeEdge('a', 'c')]);

  it('verteilt auf die passende Einfüge-Operation', () => {
    expect(pairs(insertAt(branch(), { kind: 'after', anchor: 'a' }, makeTask('m')))).toEqual(
      ['a->m', 'm->b', 'm->c'],
    );
    expect(pairs(insertAt(branch(), { kind: 'before', anchor: 'b' }, makeTask('m')))).toEqual(
      ['a->c', 'a->m', 'm->b'],
    );
    expect(pairs(insertAt(branch(), { kind: 'between', edgeId: edgeId('a', 'b') }, makeTask('m')))).toEqual(
      ['a->c', 'a->m', 'm->b'],
    );
    expect(pairs(insertAt(branch(), { kind: 'split', anchor: 'a' }, makeTask('m')))).toEqual(
      ['a->b', 'a->c', 'a->m'],
    );
    expect(pairs(insertAt(branch(), { kind: 'join', anchor: 'b' }, makeTask('m')))).toEqual(
      ['a->b', 'a->c', 'm->b'],
    );
    expect(pairs(insertAt(branch(), { kind: 'standalone' }, makeTask('m')))).toEqual(['a->b', 'a->c']);
  });

  it('Kette: Vorarbeiten reihen sich davor, alles andere danach', () => {
    expect(nextInChain({ kind: 'before', anchor: 'a' }, 'm')).toEqual({ kind: 'before', anchor: 'm' });
    expect(nextInChain({ kind: 'standalone' }, 'm')).toEqual({ kind: 'after', anchor: 'm' });
    expect(nextInChain({ kind: 'split', anchor: 'a' }, 'm')).toEqual({ kind: 'after', anchor: 'm' });
  });
});

// ---------------------------------------------------------------------------
// connect / disconnect / Zyklen
// ---------------------------------------------------------------------------

describe('connect', () => {
  it('verbindet zwei Stränge', () => {
    const list = makeList([makeTask('a'), makeTask('b')], []);
    const result = connect(list, 'a', 'b', NOW);
    expect(pairs(result)).toEqual(['a->b']);
  });

  it('lehnt einen direkten Zyklus ab', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    expect(() => connect(list, 'b', 'a')).toThrow(GraphError);
  });

  it('lehnt einen indirekten Zyklus ab', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c')],
      [makeEdge('a', 'b'), makeEdge('b', 'c')],
    );
    expect(() => connect(list, 'c', 'a')).toThrow(GraphError);
  });

  it('lehnt eine Selbstschleife ab', () => {
    const list = makeList([makeTask('a')], []);
    expect(() => connect(list, 'a', 'a')).toThrow(GraphError);
  });

  it('lehnt doppelte Pfeile ab', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    expect(() => connect(list, 'a', 'b')).toThrow(GraphError);
  });

  it('lehnt unbekannte ToDos ab', () => {
    const list = makeList([makeTask('a')], []);
    expect(() => connect(list, 'a', 'x')).toThrow(GraphError);
  });
});

describe('wouldCreateCycle', () => {
  it('erkennt direkte und indirekte Zyklen', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c')],
      [makeEdge('a', 'b'), makeEdge('b', 'c')],
    );
    expect(wouldCreateCycle(list, 'b', 'a')).toBe(true);
    expect(wouldCreateCycle(list, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(list, 'a', 'a')).toBe(true);
    expect(wouldCreateCycle(list, 'c', 'x')).toBe(false);
  });
});

describe('disconnect', () => {
  it('entfernt einen Pfeil', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    const result = disconnect(list, edgeId('a', 'b'), NOW);
    expect(result.edges).toHaveLength(0);
  });

  it('wirft bei unbekanntem Pfeil', () => {
    const list = makeList([makeTask('a'), makeTask('b')], []);
    expect(() => disconnect(list, 'nope')).toThrow(GraphError);
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

describe('deleteTask', () => {
  it('überbrückt mehrere Vorgänger und Nachfolger (Duplikate vermieden)', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('n'), makeTask('x'), makeTask('y')],
      [
        makeEdge('a', 'n'),
        makeEdge('b', 'n'),
        makeEdge('n', 'x'),
        makeEdge('n', 'y'),
      ],
    );
    const result = deleteTask(list, 'n', 'bridge', NOW);
    expect(pairs(result)).toEqual(['a->x', 'a->y', 'b->x', 'b->y']);
    expect(result.tasks.map((t) => t.id)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('verbindet nicht doppelt, wenn der Pfeil schon existiert (Umweg)', () => {
    const list = makeList(
      [makeTask('a'), makeTask('n'), makeTask('b')],
      [makeEdge('a', 'n'), makeEdge('n', 'b'), makeEdge('a', 'b')],
    );
    const result = deleteTask(list, 'n', 'bridge', NOW);
    expect(pairs(result)).toEqual(['a->b']);
  });

  it('erzeugt beim Überbrücken keinen Zyklus', () => {
    const list = makeList(
      [makeTask('a'), makeTask('n'), makeTask('b')],
      [makeEdge('a', 'n'), makeEdge('n', 'b')],
    );
    const result = deleteTask(list, 'n', 'bridge', NOW);
    expect(validateGraph(result)).toHaveLength(0);
  });

  it('entfernt ohne Verbinden bei remove-only', () => {
    const list = makeList(
      [makeTask('a'), makeTask('n'), makeTask('b')],
      [makeEdge('a', 'n'), makeEdge('n', 'b')],
    );
    const result = deleteTask(list, 'n', 'remove-only', NOW);
    expect(result.edges).toHaveLength(0);
    expect(result.tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('entfernt ein isoliertes ToDo', () => {
    const list = makeList([makeTask('a'), makeTask('m')], []);
    const result = deleteTask(list, 'm');
    expect(result.tasks.map((t) => t.id)).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// Ableitungen (Jetzt dran / Wartet / UND-Semantik)
// ---------------------------------------------------------------------------

describe('Ableitungen', () => {
  it('versteht UND-Semantik bei Zusammenführungen', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('join')],
      [makeEdge('a', 'join'), makeEdge('b', 'join')],
    );
    expect(isAvailable(list, 'join')).toBe(false);
    expect(isBlocked(list, 'join')).toBe(true);

    const doneA = { ...list, tasks: [makeTask('a', true), makeTask('b'), makeTask('join')] };
    expect(isAvailable(doneA, 'join')).toBe(false);

    const doneBoth = {
      ...list,
      tasks: [makeTask('a', true), makeTask('b', true), makeTask('join')],
    };
    expect(isAvailable(doneBoth, 'join')).toBe(true);
    expect(isBlocked(doneBoth, 'join')).toBe(false);
  });

  it('Jetzt dran gilt für ToDos ohne offene Vorgänger', () => {
    const list = makeList([makeTask('a'), makeTask('b')], [makeEdge('a', 'b')]);
    expect(isAvailable(list, 'a')).toBe(true);
    expect(isAvailable(list, 'b')).toBe(false);
    expect(openPredecessors(list, 'b').map((t) => t.id)).toEqual(['a']);
  });

  it('erkennt vorzeitiges Abhaken', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b', true)],
      [makeEdge('a', 'b')],
    );
    expect(isEarlyDone(list, 'b')).toBe(true);
    expect(isEarlyDone(list, 'a')).toBe(false);
  });

  it('hält bei erledigtem Mittelglied nur den vordersten offenen Schritt „Jetzt dran“', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b', true), makeTask('c')],
      [makeEdge('a', 'b'), makeEdge('b', 'c')],
    );
    expect(isAvailable(list, 'a')).toBe(true);
    expect(isBlocked(list, 'a')).toBe(false);
    expect(isEarlyDone(list, 'b')).toBe(true);
    expect(isAvailable(list, 'c')).toBe(false);
    expect(isBlocked(list, 'c')).toBe(true);
  });

  it('liefert Vorgänger, Nachfolger und Fortschritt', () => {
    const list = makeList(
      [makeTask('a', true), makeTask('b'), makeTask('c')],
      [makeEdge('a', 'b'), makeEdge('b', 'c')],
    );
    expect(predecessors(list, 'b').map((t) => t.id)).toEqual(['a']);
    expect(successors(list, 'b').map((t) => t.id)).toEqual(['c']);
    expect(progress(list)).toEqual({ done: 1, total: 3 });
  });
});

// ---------------------------------------------------------------------------
// Reihenfolge & Komponenten
// ---------------------------------------------------------------------------

describe('topologicalOrder', () => {
  it('ordnet stabil in Abhängigkeitsreihenfolge', () => {
    const list = makeList(
      [makeTask('c'), makeTask('b'), makeTask('a')],
      [makeEdge('a', 'b'), makeEdge('b', 'c')],
    );
    expect(topologicalOrder(list).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('behält bei Gleichstand die Erstellungsreihenfolge', () => {
    const list = makeList(
      [makeTask('x'), makeTask('y'), makeTask('z')],
      [],
    );
    expect(topologicalOrder(list).map((t) => t.id)).toEqual(['x', 'y', 'z']);
  });
});

describe('connectedComponents / extractStrand', () => {
  it('trennt unabhängige Stränge', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('d')],
      [makeEdge('a', 'b'), makeEdge('c', 'd')],
    );
    const components = connectedComponents(list);
    expect(components.map((c) => c.tasks.map((t) => t.id).join(','))).toEqual(['a,b', 'c,d']);
  });

  it('zählt ein isoliertes ToDo als eigenen Strang', () => {
    const list = makeList([makeTask('a'), makeTask('solo')], [makeEdge('a', 'solo')]);
    list.edges = [];
    list.tasks.push(makeTask('extra'));
    expect(connectedComponents(list)).toHaveLength(3);
  });

  it('extrahiert den Strang eines ToDos', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('d')],
      [makeEdge('a', 'b'), makeEdge('c', 'd')],
    );
    const strand = extractStrand(list, 'c');
    expect(strand.tasks.map((t) => t.id)).toEqual(['c', 'd']);
    expect(strand.edges).toHaveLength(1);
  });
});

describe('transitiveReduction', () => {
  it('blendet Umweg-Pfeile aus (A→C trotz A→B→C)', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c')],
      [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')],
    );
    const reduced = transitiveReduction(list);
    expect(reduced.map((e) => `${e.from}->${e.to}`).sort()).toEqual(['a->b', 'b->c']);
  });

  it('lässt echte Verzweigungen/Zusammenführungen unangetastet', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('d')],
      [makeEdge('a', 'c'), makeEdge('b', 'c'), makeEdge('c', 'd')],
    );
    expect(transitiveReduction(list)).toHaveLength(3);
  });
});

describe('validateGraph', () => {
  it('akzeptiert einen gültigen Graphen', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b')],
      [makeEdge('a', 'b')],
    );
    expect(validateGraph(list)).toHaveLength(0);
  });

  it('erkennt doppelte Pfeile, tote Referenzen und Zyklen', () => {
    const list = makeList(
      [makeTask('a'), makeTask('b')],
      [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'e3', from: 'a', to: 'ghost' },
      ],
    );
    const codes = validateGraph(list).map((i) => i.code);
    expect(codes).toContain('duplicate-edge');
    expect(codes).toContain('unknown-task');
  });
});
