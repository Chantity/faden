import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_GRACE_MS, ListsStore } from './lists.store';
import { FadenDb } from '../storage';
import { createList, createTask, type TodoList } from '../model';

/** IndexedDB-Ersatz, der festhält, was gespeichert ist. */
class FakeDb {
  readonly rows = new Map<string, TodoList>();
  constructor(initial: TodoList[] = []) {
    for (const l of initial) this.rows.set(l.id, l);
  }
  async getLists(): Promise<TodoList[]> {
    return [...this.rows.values()];
  }
  async putAll(_store: string, values: readonly TodoList[]): Promise<void> {
    for (const v of values) this.rows.set(v.id, v);
  }
  async remove(_store: string, id: string): Promise<void> {
    this.rows.delete(id);
  }
}

function setup(initial: TodoList[] = []): { store: ListsStore; db: FakeDb } {
  const db = new FakeDb(initial);
  TestBed.configureTestingModule({
    providers: [{ provide: FadenDb, useValue: db as unknown as FadenDb }],
  });
  return { store: TestBed.inject(ListsStore), db };
}

const addTask = (title: string) => (l: TodoList): TodoList => ({
  ...l,
  tasks: [...l.tasks, createTask(title, title)],
});

describe('ListsStore – Verlauf pro Zettel', () => {
  it('macht nur Änderungen des jeweiligen Zettels rückgängig', async () => {
    const { store } = setup();
    await store.load();
    const a = store.create('A');
    const b = store.create('B');
    store.editList(a, addTask('a1'));
    store.editList(b, addTask('b1'));
    store.editList(a, addTask('a2'));

    expect(store.undo(b)).toBe(true);
    expect(store.getList(b)!.tasks).toHaveLength(0);
    expect(store.getList(a)!.tasks.map((t) => t.title)).toEqual(['a1', 'a2']);
    expect(store.canUndo(b)).toBe(false);
    expect(store.canRedo(b)).toBe(true);

    store.undo(a);
    expect(store.getList(a)!.tasks.map((t) => t.title)).toEqual(['a1']);
    store.redo(a);
    expect(store.getList(a)!.tasks.map((t) => t.title)).toEqual(['a1', 'a2']);
  });

  it('behält beim Rückgängigmachen im Zettel Archiv-Status und Reihenfolge', async () => {
    const { store } = setup();
    await store.load();
    const a = store.create('A');
    store.create('B');
    store.editList(a, addTask('a1'));
    store.archive(a);
    store.undo(a);
    expect(store.getList(a)!.tasks).toHaveLength(0);
    expect(store.getList(a)!.archived).toBe(true);
  });

  it('hält mindestens 100 Schritte pro Zettel', async () => {
    const { store } = setup();
    await store.load();
    const a = store.create('A');
    for (let i = 0; i < 105; i++) store.editList(a, addTask(`t${i}`));
    let steps = 0;
    while (store.undo(a)) steps++;
    expect(steps).toBe(100);
  });
});

describe('ListsStore – Laden', () => {
  it('behält Zettel, die vor dem Ende des Ladens angelegt wurden', async () => {
    const stored: TodoList = {
      id: 'alt',
      title: 'Gespeichert',
      timeboxMode: 'none',
      tasks: [],
      edges: [],
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sortOrder: 0,
    };
    const { store, db } = setup([stored]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const original = db.getLists.bind(db);
    db.getLists = async () => {
      await gate;
      return original();
    };
    const loading = store.load();
    const early = store.create('Schnell angelegt');
    release();
    await loading;
    expect(store.lists().map((l) => l.title)).toEqual(['Gespeichert', 'Schnell angelegt']);
    expect(store.getList(early)).toBeDefined();
    expect(store.canUndo()).toBe(true);
  });
});

describe('ListsStore – Verlauf der Übersicht', () => {
  it('macht Archivieren rückgängig, ohne spätere Änderungen im Zettel zu verwerfen', async () => {
    const { store } = setup();
    await store.load();
    const a = store.create('A');
    store.archive(a);
    store.editList(a, addTask('nachher'));

    store.undo();
    expect(store.getList(a)!.archived).toBe(false);
    expect(store.getList(a)!.tasks.map((t) => t.title)).toEqual(['nachher']);
  });

  it('macht Anlegen, Verschieben und Umbenennen schrittweise rückgängig', async () => {
    const { store } = setup();
    await store.load();
    const a = store.create('A');
    const b = store.create('B');
    store.move(b, 'up');
    expect(store.lists().map((l) => l.title)).toEqual(['B', 'A']);
    store.update(a, { title: 'A2', timeboxMode: 'estimate' });

    store.undo();
    expect(store.getList(a)).toMatchObject({ title: 'A', timeboxMode: 'none' });
    store.undo();
    expect(store.lists().map((l) => l.title)).toEqual(['A', 'B']);
    store.undo();
    expect(store.getList(b)).toBeUndefined();
    store.redo();
    expect(store.getList(b)?.title).toBe('B');
  });
});

describe('ListsStore – Löschen mit Frist (Soft-Delete)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speichert erst als gelöscht markiert und entfernt nach Ablauf der Frist endgültig', async () => {
    const { store, db } = setup();
    await store.load();
    const a = store.create('A');
    await vi.advanceTimersByTimeAsync(500);
    expect(db.rows.has(a)).toBe(true);

    store.remove(a);
    expect(store.getList(a)).toBeUndefined();
    expect(store.lists()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(db.rows.get(a)?.deletedAt).toBeDefined();

    await vi.advanceTimersByTimeAsync(DELETE_GRACE_MS);
    expect(db.rows.has(a)).toBe(false);
  });

  it('stellt innerhalb der Frist ohne Datenverlust wieder her', async () => {
    const { store, db } = setup();
    await store.load();
    const a = store.create('A');
    store.editList(a, addTask('x'));
    store.remove(a);
    store.undo();
    await vi.advanceTimersByTimeAsync(DELETE_GRACE_MS + 500);
    expect(store.getList(a)!.tasks.map((t) => t.title)).toEqual(['x']);
    expect(db.rows.get(a)?.deletedAt).toBeUndefined();
  });

  it('stellt auch nach Ablauf der Frist über „Rückgängig" wieder her', async () => {
    const { store, db } = setup();
    await store.load();
    const a = store.create('A');
    store.remove(a);
    await vi.advanceTimersByTimeAsync(DELETE_GRACE_MS + 500);
    expect(db.rows.has(a)).toBe(false);
    store.undo();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getList(a)?.title).toBe('A');
    expect(db.rows.has(a)).toBe(true);
  });

  it('räumt beim Start gelöschte Zettel einer früheren Sitzung auf', async () => {
    const old: TodoList = {
      id: 'old',
      title: 'Alt',
      timeboxMode: 'none',
      tasks: [],
      edges: [],
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sortOrder: 0,
      deletedAt: '2026-01-01T00:00:01.000Z',
    };
    const { store, db } = setup([old]);
    await store.load();
    expect(store.allItems()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(db.rows.has('old')).toBe(false);
  });
});

describe('ListsStore – Fensterwechsel', () => {
  it('überschreibt einen noch nicht gespeicherten Stand nicht mit dem älteren aus IndexedDB', async () => {
    const list: TodoList = { ...createList('Küche'), id: 'k', updatedAt: '2026-01-01T00:00:00.000Z' };
    const { store, db } = setup([list]);
    await store.load();

    store.editList('k', addTask('Spülen')); // erst nach 300 ms gespeichert
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getList('k')?.tasks.map((t) => t.title)).toEqual(['Spülen']);
    expect(db.rows.get('k')?.tasks).toHaveLength(0);
  });
});

describe('ListsStore – Archiv und Namen', () => {
  const finished = (id: string, title: string, sortOrder = 0): TodoList => ({
    ...createList(title),
    id,
    sortOrder,
    tasks: [{ ...createTask('A', `${id}-a`), done: true, doneAt: '2026-01-01T00:00:00.000Z' }],
  });

  it('archiviert fertige Zettel in einem Rückgängig-Schritt, leere und offene nicht', () => {
    const { store } = setup();
    store.addExisting(finished('a', 'Fertig A'));
    store.addExisting(finished('b', 'Fertig B', 1));
    store.addExisting({ ...createList('Leer'), id: 'c', sortOrder: 2 });
    store.addExisting({ ...createList('Offen'), id: 'd', sortOrder: 3, tasks: [createTask('X', 'x')] });

    expect(store.handleCompleted('archive').map((l) => l.id)).toEqual(['a', 'b']);
    expect(store.lists().map((l) => l.id)).toEqual(['c', 'd']);

    store.undo();
    expect(store.archived()).toHaveLength(0);
  });

  it('löscht fertige Zettel auf Wunsch in einem Rückgängig-Schritt oder lässt sie stehen', () => {
    const { store } = setup();
    store.addExisting(finished('a', 'Fertig A'));
    store.addExisting(finished('b', 'Fertig B', 1));

    expect(store.handleCompleted('keep')).toEqual([]);
    expect(store.handleCompleted('archive', new Set(['a', 'b']))).toEqual([]); // z. B. Übungszettel der Tour
    expect(store.handleCompleted('delete').map((l) => l.id)).toEqual(['a', 'b']);
    expect(store.lists()).toHaveLength(0);
    expect(store.archived()).toHaveLength(0);

    store.undo();
    expect(store.lists().map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('dupliziert archivierte Zettel frisch, nicht archiviert und mit eindeutigem Namen', () => {
    const { store } = setup();
    const source = { ...finished('a', 'Einkauf'), archived: true };
    source.tasks[0]!.checklist = [{ id: 'm', text: 'Milch', done: true }];
    store.addExisting(source);

    const id = store.duplicate('a')!;
    const copy = store.getList(id)!;
    expect(copy.title).toBe('Einkauf (2)');
    expect(copy.archived).toBe(false);
    expect(copy.tasks[0]).toMatchObject({ done: false, checklist: [{ text: 'Milch', done: false }] });
    expect(copy.tasks[0]!.doneAt).toBeUndefined();
  });

  it('macht Namen neuer Zettel eindeutig und erkennt vergebene Namen', () => {
    const { store } = setup();
    store.create('Einkauf');
    const second = store.create(' einkauf ');
    expect(store.getList(second)?.title).toBe('einkauf (2)');
    expect(store.isTitleTaken('EINKAUF')).toBe(true);
    expect(store.isTitleTaken('Einkauf', store.lists()[0]!.id)).toBe(false);
  });
});
