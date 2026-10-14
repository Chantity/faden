import { edgeId, type Task, type TodoList } from '../model';
import { layoutList } from './layout';

function task(id: string): Task {
  return { id, title: `ToDo ${id}`, done: false };
}

function list(taskIds: string[], links: [string, string][]): TodoList {
  return {
    id: 'l',
    title: 'Zettel',
    timeboxMode: 'none',
    tasks: taskIds.map(task),
    edges: links.map(([from, to]) => ({ id: edgeId(from, to), from, to })),
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
  };
}

describe('layoutList', () => {
  it('liefert nichts für einen leeren Zettel', () => {
    const layout = layoutList(list([], []));
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });

  it('legt eine Kette untereinander in aufsteigenden Schichten', () => {
    const layout = layoutList(list(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]));
    const a = layout.nodes.find((n) => n.id === 'a');
    const b = layout.nodes.find((n) => n.id === 'b');
    const c = layout.nodes.find((n) => n.id === 'c');
    expect(a?.layer).toBe(0);
    expect(b?.layer).toBe(1);
    expect(c?.layer).toBe(2);
    expect(a?.x).toBe(b?.x);
    expect(b?.x).toBe(c?.x);
    expect((b?.y ?? 0)).toBeGreaterThan(a?.y ?? 0);
  });

  it('legt Verzweigungen in derselben Schicht nebeneinander', () => {
    const layout = layoutList(list(['a', 'b', 'c'], [['a', 'b'], ['a', 'c']]));
    const b = layout.nodes.find((n) => n.id === 'b');
    const c = layout.nodes.find((n) => n.id === 'c');
    expect(b?.layer).toBe(1);
    expect(c?.layer).toBe(1);
    expect(b?.y).toBe(c?.y);
    expect(b?.x).not.toBe(c?.x);
  });

  it('legt eine Zusammenführung unter beide Vorgänger', () => {
    const layout = layoutList(list(['a', 'b', 'c'], [['a', 'c'], ['b', 'c']]));
    const c = layout.nodes.find((n) => n.id === 'c');
    const a = layout.nodes.find((n) => n.id === 'a');
    const b = layout.nodes.find((n) => n.id === 'b');
    expect(a?.layer).toBe(0);
    expect(b?.layer).toBe(0);
    expect(c?.layer).toBe(1);
    expect((c?.y ?? 0)).toBeGreaterThan(a?.y ?? 0);
  });

  it('trennt unabhängige Stränge nebeneinander', () => {
    const layout = layoutList(list(['a', 'b'], []));
    const a = layout.nodes.find((n) => n.id === 'a');
    const b = layout.nodes.find((n) => n.id === 'b');
    expect(a?.layer).toBe(0);
    expect(b?.layer).toBe(0);
    expect(a?.x).not.toBe(b?.x);
  });

  it('berechnet je Pfeil einen Pfad mit Mittelpunkt', () => {
    const layout = layoutList(list(['a', 'b'], [['a', 'b']]));
    expect(layout.edges).toHaveLength(1);
    const edge = layout.edges[0];
    expect(edge?.path).toContain('M ');
    expect(Number.isFinite(edge?.midX)).toBe(true);
    expect(Number.isFinite(edge?.midY)).toBe(true);
  });

  it('ist deterministisch (gleiche Eingabe → gleiche Positionen)', () => {
    const input = list(['a', 'b', 'c', 'd'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']]);
    expect(layoutList(input)).toEqual(layoutList(input));
  });

  it('macht Karten mit langem Titel höher und schiebt Folgekarten nach unten', () => {
    const shortLayout = layoutList(list(['a', 'b'], [['a', 'b']]));
    const shortB = shortLayout.nodes.find((n) => n.id === 'b');

    const longInput = list(['a', 'b'], [['a', 'b']]);
    const first = longInput.tasks.find((t) => t.id === 'a');
    if (first) first.title = 'Ein deutlich längerer Titel, der über mehrere Zeilen umgebrochen wird';
    const longLayout = layoutList(longInput);
    const longA = longLayout.nodes.find((n) => n.id === 'a');
    const longB = longLayout.nodes.find((n) => n.id === 'b');

    expect(longA?.lines).toBeGreaterThan(1);
    expect(longA?.height).toBeGreaterThan(shortLayout.nodes.find((n) => n.id === 'a')?.height ?? 0);
    expect(longB?.y).toBeGreaterThan(shortB?.y ?? 0);
  });

  it('begrenzt lange Titel auf die maximale Zeilenzahl', () => {
    const input = list(['a'], []);
    const task = input.tasks[0];
    if (task) task.title = 'x'.repeat(500);
    const layout = layoutList(input);
    expect(layout.nodes[0]?.lines).toBe(3);
  });

  it('liefert die Stränge mit Position und hält paddingTop ein', () => {
    const layout = layoutList(list(['a', 'b', 'c'], [['a', 'b']]), { padding: 20, paddingTop: 90 });
    expect(layout.strands.map((s) => s.taskIds)).toEqual([['a', 'b'], ['c']]);
    expect(layout.strands[0]?.x).toBe(20);
    expect(layout.strands[1]!.x).toBeGreaterThan(layout.strands[0]!.x + layout.strands[0]!.width);
    expect(Math.min(...layout.nodes.map((n) => n.y))).toBe(90);
    expect(layout.nodes.find((n) => n.id === 'c')?.x).toBe(layout.strands[1]?.x);
  });
});
