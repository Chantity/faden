import { TestBed } from '@angular/core/testing';
import { FlowView } from './flow-view';
import { ListsStore } from '../../core/state/lists.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, edgeId, type TodoList } from '../../core/model';

function chainList(): TodoList {
  const list = createList('Test');
  const a = createTask('Vorbereiten', 'a');
  const b = createTask('Ausführen', 'b');
  list.tasks = [a, b];
  list.edges = [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }];
  return list;
}

function branchList(): TodoList {
  const list = createList('Test');
  list.tasks = [createTask('A', 'a'), createTask('B', 'b'), createTask('C', 'c')];
  list.edges = [
    { id: edgeId('a', 'b'), from: 'a', to: 'b' },
    { id: edgeId('a', 'c'), from: 'a', to: 'c' },
  ];
  return list;
}

describe('FlowView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowView],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  it('rendert für jede Aufgabe eine Karte', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.node').length).toBe(2);
  });

  it('zeigt genau einen „+“ zwischen zwei verbundenen ToDos', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.plus--edge').length).toBe(1);
    expect(root.querySelectorAll('.plus--before').length).toBe(1);
    expect(root.querySelectorAll('.plus--after').length).toBe(1);
  });

  it('zeigt an einer Verzweigung ein Karten-„+“ und fügt einen Knoten ein, von dem alle Nachfolger abhängen', async () => {
    const list = branchList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // A hat zwei Nachfolger: Das Karten-„+" erscheint, und dank des größeren
    // Zeilenabstands bleibt auf jeder Kante das Kanten-„+" sichtbar.
    expect(root.querySelectorAll('.plus--after').length).toBe(3);
    expect(root.querySelectorAll('.plus--edge').length).toBe(2);

    (root.querySelector('.plus--after') as HTMLButtonElement).click();
    await fixture.whenStable();

    const input = root.querySelector('.insert input') as HTMLInputElement;
    input.value = 'D';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (root.querySelector('form.insert') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    const updated = store.getList(list.id)!;
    const d = updated.tasks.find((t) => t.title === 'D')!;
    const pairs = updated.edges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toEqual([`a->${d.id}`, `${d.id}->b`, `${d.id}->c`].sort());
  });

  it('hakt ein ToDo direkt auf der Karte ab und wieder auf', async () => {
    const list = chainList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.node__toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.done).toBe(true);

    fixture.componentRef.setInput('list', store.getList(list.id));
    await fixture.whenStable();
    (root.querySelector('.node__toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.done).toBe(false);
  });

  function tripleList(): TodoList {
    const list = createList('Test');
    list.tasks = [{ ...createTask('A', 'a'), done: true }, createTask('B', 'b'), createTask('C', 'c')];
    list.edges = [
      { id: edgeId('a', 'b'), from: 'a', to: 'b' },
      { id: edgeId('b', 'c'), from: 'b', to: 'c' },
    ];
    return list;
  }

  it('löscht im Ablauf wahlweise mit oder ohne Überbrücken', async () => {
    const store = TestBed.inject(ListsStore);
    for (const [label, edges] of [
      ['Delete', 1],
      ['Delete without reconnecting', 0],
    ] as const) {
      const list = tripleList();
      store.addExisting(list);
      const fixture = TestBed.createComponent(FlowView);
      fixture.componentRef.setInput('list', list);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      (root.querySelectorAll('.node__menu-btn')[1] as HTMLButtonElement).click();
      await fixture.whenStable();
      const button = [...root.querySelectorAll<HTMLButtonElement>('.popover button')].find(
        (b) => b.textContent?.trim() === label,
      )!;
      button.click();
      await fixture.whenStable();
      const after = store.getList(list.id)!;
      expect(after.tasks.map((t) => t.id)).toEqual(['a', 'c']);
      expect(after.edges.length).toBe(edges);
    }
  });
});
