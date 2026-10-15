import { TestBed } from '@angular/core/testing';
import { FlowView } from './flow-view';
import { ListsStore } from '../../core/state/lists.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, edgeId, type TodoList } from '../../core/model';
import type { CreateRequest } from './task-editor';

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

  it('passt beim Zettelwechsel neu ein, statt den Zoom des vorigen Zettels zu behalten', async () => {
    const store = TestBed.inject(ListsStore);
    const first = chainList();
    const second = branchList();
    store.addExisting(first);
    store.addExisting(second);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', first);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    // jsdom hat kein Layout: der Rahmen ist groß genug für 100 %.
    const wrap = root.querySelector('.flow__wrap')!;
    Object.defineProperty(wrap, 'clientWidth', { value: 2000 });
    Object.defineProperty(wrap, 'clientHeight', { value: 2000 });
    const zoomOut = root.querySelectorAll<HTMLButtonElement>('.flow__zoom button')[1]!;
    zoomOut.click();
    zoomOut.click();
    await fixture.whenStable();
    const transform = () => (root.querySelector('.flow__canvas') as HTMLElement).style.transform;
    expect(transform()).not.toContain('scale(1)');

    fixture.componentRef.setInput('list', { ...first, tasks: [...first.tasks] }); // gleiche ID: kein Zurücksetzen
    await fixture.whenStable();
    expect(transform()).not.toContain('scale(1)');

    fixture.componentRef.setInput('list', second);
    await fixture.whenStable();
    expect(transform()).toContain('scale(1)');
  });

  it('zeigt die Pause am Pfeil nur, wenn sie > 0 ist, und nennt sie im Pfeil-Label', async () => {
    const list = { ...chainList(), timeboxMode: 'dayPlan' as const, dayPlanReferenceDate: '2026-03-12' };
    list.tasks = [
      { ...list.tasks[0]!, dayStart: '09:00', estimateMinutes: 30 },
      { ...list.tasks[1]!, dayStart: '09:45' },
    ];
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.edge-pause')?.textContent?.trim()).toBe('Break 15 min');
    expect(root.querySelector('.plus--edge')?.getAttribute('aria-label')).toContain('15 min');

    fixture.componentRef.setInput('list', { ...list, tasks: [list.tasks[0]!, { ...list.tasks[1]!, dayStart: '09:30' }] });
    await fixture.whenStable();
    expect(root.querySelector('.edge-pause')).toBeNull();
  });

  it('„Strang verschieben …" im Karten-Menü nur mit Uhrzeiten', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    const shifted: string[] = [];
    fixture.componentInstance.shiftStrand.subscribe((id) => shifted.push(id));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const menuItem = () => [...root.querySelectorAll<HTMLButtonElement>('.popover button')].find((b) => b.textContent?.includes('Shift strand'));

    root.querySelector<HTMLButtonElement>('[data-task-id="b"] .node__menu-btn')!.click();
    await fixture.whenStable();
    expect(menuItem()).toBeUndefined();

    fixture.componentRef.setInput('list', { ...list, timeboxMode: 'schedule' });
    root.querySelector<HTMLButtonElement>('[data-task-id="b"] .node__menu-btn')!.click();
    await fixture.whenStable();
    menuItem()!.click();
    expect(shifted).toEqual(['b']);
  });

  it('Enter bearbeitet nur auf der Karte selbst – auf einem Knopf darin bleibt Enter beim Knopf', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    const edited: string[] = [];
    fixture.componentInstance.edit.subscribe((id) => edited.push(id));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const enter = (el: Element) =>
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    enter(root.querySelector('[data-task-id="a"] .node__toggle')!);
    expect(edited).toEqual([]);
    enter(root.querySelector('[data-task-id="a"]')!);
    expect(edited).toEqual(['a']);
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

  it('zeigt an einer Verzweigung ein Karten-„+“, das hinter der Verzweigung einfügen lässt', async () => {
    const list = branchList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    const requests: CreateRequest[] = [];
    fixture.componentInstance.create.subscribe((r) => requests.push(r));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    // A hat zwei Nachfolger: Das Karten-„+" erscheint, und dank des größeren
    // Zeilenabstands bleibt auf jeder Kante das Kanten-„+" sichtbar.
    expect(root.querySelectorAll('.plus--after').length).toBe(3);
    expect(root.querySelectorAll('.plus--edge').length).toBe(2);

    (root.querySelector('.plus--after') as HTMLButtonElement).click();
    (root.querySelector('.plus--edge') as HTMLButtonElement).click();

    // Das Einfügen selbst (alle Nachfolger hängen danach am neuen ToDo) prüft graph.spec (insertAt).
    expect(requests).toEqual([
      { position: { kind: 'after', anchor: 'a' }, chain: false },
      { position: { kind: 'between', edgeId: edgeId('a', 'b') }, chain: false },
    ]);
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

  it('zeigt im Modus Zeitschätzung je Strang eine Teilsumme (nur bei mehreren Strängen)', async () => {
    const store = TestBed.inject(ListsStore);
    const list = createList('Test', 'estimate');
    list.tasks = [
      { ...createTask('A', 'a'), estimateMinutes: 30 },
      { ...createTask('B', 'b'), estimateMinutes: 15 },
      createTask('C', 'c'),
    ];
    list.edges = [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }];
    store.addExisting(list);
    const fixture = TestBed.createComponent(FlowView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const labels = [...root.querySelectorAll('.strand-sum')].map((e) => e.textContent?.trim());
    expect(labels).toEqual(['Σ 45 min open', 'Σ 0 min open · 1 without estimate']);

    fixture.componentRef.setInput('list', { ...list, tasks: list.tasks.slice(0, 2) });
    await fixture.whenStable();
    expect(root.querySelectorAll('.strand-sum').length).toBe(0);
  });
});
