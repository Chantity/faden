import { createList, createTask, edgeId, type TodoList } from '../model';
import {
  insertTemplate,
  listToTemplate,
  strandToTemplate,
  templatePreview,
  templateToList,
} from './templates';

function chainList(): TodoList {
  const list = createList('Mein Zettel', 'dayPlan');
  const a = createTask('Vorbereiten', 'a');
  a.done = true;
  a.doneAt = '2026-03-01T08:00';
  a.estimateMinutes = 30;
  a.dayStart = '09:00';
  a.checklist = [{ id: 'x', text: 'Milch', done: true }];
  const b = createTask('Ausführen', 'b');
  b.startAt = '2026-03-12T10:00';
  b.estimateMinutes = 45;
  const c = createTask('Nachbereiten', 'c');
  const d = createTask('Einkaufen', 'd');
  list.tasks = [a, b, c, d];
  list.edges = [
    { id: edgeId('a', 'b'), from: 'a', to: 'b' },
    { id: edgeId('b', 'c'), from: 'b', to: 'c' },
  ];
  return list;
}

describe('listToTemplate / strandToTemplate', () => {
  it('verwirft Erledigt-Status (auch in Checklisten) und das Datum, behält Dauer und Tageszeit', () => {
    const template = listToTemplate(chainList());
    expect(template.tasks).toHaveLength(4);

    const a = template.tasks.find((t) => t.id === 'a') as Record<string, unknown> | undefined;
    expect(a?.['done']).toBeUndefined();
    expect(a?.['doneAt']).toBeUndefined();
    expect(a?.['estimateMinutes']).toBe(30);
    expect(a?.['dayStart']).toBe('09:00');
    expect(a?.['checklist']).toEqual([{ id: 'x', text: 'Milch', done: false }]);

    const b = template.tasks.find((t) => t.id === 'b') as Record<string, unknown> | undefined;
    expect(b?.['startAt']).toBeUndefined();
    expect(b?.['estimateMinutes']).toBe(45);
  });

  it('nimmt nur den Strang des gewählten ToDos', () => {
    const template = strandToTemplate(chainList(), 'b');
    expect(template?.tasks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('liefert null für unbekannte ToDos', () => {
    expect(strandToTemplate(chainList(), 'x')).toBeNull();
  });
});

describe('templateToList', () => {
  it('erzeugt neue IDs, nichts erledigt, konsistente Kanten', () => {
    const template = listToTemplate(chainList());
    const list = templateToList(template);

    expect(list.tasks).toHaveLength(4);
    expect(list.tasks.every((t) => t.done === false)).toBe(true);

    const oldIds = new Set(template.tasks.map((t) => t.id));
    const newIds = new Set(list.tasks.map((t) => t.id));
    for (const id of newIds) expect(oldIds.has(id)).toBe(false);

    expect(list.edges).toHaveLength(2);
    for (const edge of list.edges) {
      expect(newIds.has(edge.from)).toBe(true);
      expect(newIds.has(edge.to)).toBe(true);
      expect(edge.id).toBe(edgeId(edge.from, edge.to));
    }
    expect(list.timeboxMode).toBe('dayPlan');
  });
});

describe('insertTemplate', () => {
  it('hängt die Vorlage als neuen Strang an, ohne bestehende zu verändern', () => {
    const target = chainList();
    const template = listToTemplate(chainList());
    const merged = insertTemplate(target, template);

    expect(merged.tasks).toHaveLength(8);
    expect(merged.tasks.slice(0, 4).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(merged.edges).toHaveLength(4);
  });
});

describe('templatePreview', () => {
  it('listet Titel in topologischer Reihenfolge', () => {
    const template = listToTemplate(chainList());
    expect(templatePreview(template)).toEqual([
      'Vorbereiten',
      'Ausführen',
      'Nachbereiten',
      'Einkaufen',
    ]);
  });
});
