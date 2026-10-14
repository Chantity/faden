import { TestBed } from '@angular/core/testing';
import { FocusView } from './focus-view';
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

  it('öffnet bei „Erst noch etwas anderes nötig“ ein Eingabefeld', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.task-card__need') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(root.querySelector('.chain input')).toBeTruthy();
  });

  it('bricht die Ketten-Eingabe über den Abbrechen-Button ab (ohne Esc)', async () => {
    const list = chainList();
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.task-card__need') as HTMLButtonElement).click();
    await fixture.whenStable();
    const cancel = root.querySelector('.chain__actions button:not(.btn--primary)') as HTMLButtonElement;
    cancel.click();
    await fixture.whenStable();

    expect(root.querySelector('.chain input')).toBeNull();
  });

  it('legt über das leere Eingabefeld ein ToDo an (Submit)', async () => {
    const list = createList('Leer');
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.empty .btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();

    const input = root.querySelector('.chain input') as HTMLInputElement;
    input.value = 'Neues ToDo';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const form = root.querySelector('form.chain') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(store.getList(list.id)?.tasks.map((t) => t.title)).toEqual(['Neues ToDo']);
  });

  it('legt über „+“ ein ToDo ohne Abhängigkeit an', async () => {
    const list = chainList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.focus__bar button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const input = root.querySelector('.chain input') as HTMLInputElement;
    input.value = 'Einkaufen';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (root.querySelector('form.chain') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    const tasks = store.getList(list.id)?.tasks ?? [];
    expect(tasks.map((t) => t.title)).toContain('Einkaufen');
    expect(store.getList(list.id)?.edges.length).toBe(1);
  });

  describe('⋯-Menü schließen', () => {
    async function withOpenMenu(): Promise<{ root: HTMLElement; menu: HTMLDetailsElement; summary: HTMLElement }> {
      const list = chainList();
      TestBed.inject(ListsStore).addExisting(list);
      const fixture = TestBed.createComponent(FocusView);
      fixture.componentRef.setInput('list', list);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const menu = root.querySelector('details.menu') as HTMLDetailsElement;
      const summary = menu.querySelector('summary') as HTMLElement;
      summary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      expect(menu.hasAttribute('open')).toBe(true);
      return { root, menu, summary };
    }

    it('schließt sich beim Klick auf das details-Element selbst', async () => {
      const { menu } = await withOpenMenu();

      menu.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(menu.hasAttribute('open')).toBe(false);
    });

    it('schließt sich beim Klick auf die Zusammenfassung (⋯)', async () => {
      const { menu, summary } = await withOpenMenu();

      summary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(menu.hasAttribute('open')).toBe(false);
    });

    it('schließt sich beim Klick außerhalb', async () => {
      const { root, menu } = await withOpenMenu();

      root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(menu.hasAttribute('open')).toBe(false);
    });

    it('bleibt offen bei Klick im Menüinhalt', async () => {
      const { menu } = await withOpenMenu();

      (menu.querySelector('.menu__panel') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

      expect(menu.hasAttribute('open')).toBe(true);
    });
  });
});
