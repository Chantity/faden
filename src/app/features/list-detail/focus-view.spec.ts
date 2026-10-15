import { TestBed } from '@angular/core/testing';
import { FocusView } from './focus-view';
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

describe('FocusView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocusView],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  it('zeigt genau das verfügbare ToDo als Karte', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.task-card').length).toBe(1);
    expect(root.querySelector('.task-card__title')?.textContent).toContain('Vorbereiten');
  });

  it('hakt ein ToDo im Store ab', async () => {
    const list = chainList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.task-card__done') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.done).toBe(true);
  });

  async function renderWith(list: TodoList): Promise<{ root: HTMLElement; requests: CreateRequest[] }> {
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    const requests: CreateRequest[] = [];
    fixture.componentInstance.create.subscribe((r) => requests.push(r));
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, requests };
  }

  it('„Erst noch etwas anderes nötig …" öffnet das Sheet für eine Vorarbeit (Enter-Kette)', async () => {
    const { root, requests } = await renderWith(chainList());
    (root.querySelector('.task-card__need') as HTMLButtonElement).click();
    expect(requests).toEqual([{ position: { kind: 'before', anchor: 'a' }, chain: true }]);
  });

  it('der leere Zettel und „✚" legen ein eigenes ToDo an', async () => {
    const empty = await renderWith(createList('Leer'));
    (empty.root.querySelector('.empty .btn--primary') as HTMLButtonElement).click();
    expect(empty.requests).toEqual([{ position: { kind: 'standalone' }, chain: true }]);
  });

  it('„✚" legt ein eigenes ToDo ohne Abhängigkeit an', async () => {
    const { root, requests } = await renderWith(chainList());
    (root.querySelector('.focus__bar button') as HTMLButtonElement).click();
    expect(requests).toEqual([{ position: { kind: 'standalone' }, chain: true }]);
  });

  it('hakt Punkte einer Checkliste direkt auf der Karte ab, ohne das ToDo abzuhaken', async () => {
    const list = chainList();
    list.tasks[0]!.checklist = [
      { id: 'm', text: 'Milch', done: false },
      { id: 'b', text: 'Brot', done: false },
    ];
    const { root } = await renderWith(list);
    expect(root.querySelector('.task-card__checklist summary')?.textContent).toContain('0 of 2');

    (root.querySelector('.checklist input[type=checkbox]') as HTMLInputElement).click();

    const task = TestBed.inject(ListsStore).getList(list.id)!.tasks[0]!;
    expect(task.checklist?.map((i) => i.done)).toEqual([true, false]);
    expect(task.done).toBe(false);
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

  it('bietet „Löschen, ohne zu verbinden" nur in der Mitte einer Kette an', async () => {
    const list = tripleList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const option = [...root.querySelectorAll<HTMLButtonElement>('.menu__panel button')].find(
      (b) => b.textContent?.trim() === 'Delete without reconnecting',
    );
    expect(option).toBeDefined();

    option!.click();
    await fixture.whenStable();
    const after = store.getList(list.id)!;
    expect(after.tasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(after.edges.length).toBe(0);
  });

  it('zeigt die Option nicht, wenn es nichts zu verbinden gibt', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('Delete without reconnecting');
  });

  it('setzt nach „Erledigt“ den Fokus auf das nächste „Erledigt“ (Tastatur)', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const done = root.querySelector('.task-card__done') as HTMLButtonElement;
    done.focus();
    done.click();
    fixture.componentRef.setInput('list', TestBed.inject(ListsStore).getList(list.id));
    await fixture.whenStable();
    const next = root.querySelector('.task-card__done');
    expect(root.querySelector('.task-card__title')?.textContent).toContain('Ausführen');
    expect(document.activeElement).toBe(next);
    fixture.nativeElement.remove();
  });
});
