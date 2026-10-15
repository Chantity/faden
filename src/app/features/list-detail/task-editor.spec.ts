import { TestBed } from '@angular/core/testing';
import { TaskEditor } from './task-editor';
import { ListsStore } from '../../core/state/lists.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, type TodoList } from '../../core/model';

function estimateList(): TodoList {
  const list = createList('Schätzung', 'estimate');
  const task = createTask('Aufgabe', 'a');
  task.estimateMinutes = 30;
  list.tasks = [task];
  return list;
}

describe('TaskEditor – Schätzung', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskEditor],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  it('zeigt die Schätzung und übernimmt einen Chip-Wert beim Speichern', async () => {
    const list = estimateList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(TaskEditor);
    fixture.componentInstance.open(list.id, 'a');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const active = root.querySelector('.chip--button.is-active');
    expect(active?.textContent).toContain('30');

    const chip15 = Array.from(root.querySelectorAll('.chip--button')).find((button) =>
      button.textContent?.includes('15'),
    ) as HTMLButtonElement;
    chip15.click();
    await fixture.whenStable();

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.estimateMinutes).toBe(15);
  });

  it('übernimmt eigene Minuten aus dem Zahlenfeld', async () => {
    const list = estimateList();
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(TaskEditor);
    fixture.componentInstance.open(list.id, 'a');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const numberInput = root.querySelector('input[type="number"]') as HTMLInputElement;
    numberInput.value = '75';
    numberInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.estimateMinutes).toBe(75);
  });
});

describe('TaskEditor – Anlegen und Checkliste', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskEditor],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  function setup(list: TodoList) {
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(TaskEditor);
    const root = fixture.nativeElement as HTMLElement;
    const titleInput = () => root.querySelector('input[name=title]') as HTMLInputElement;
    const dialog = () => root.querySelector('dialog') as HTMLDialogElement;
    const type = async (text: string) => {
      titleInput().value = text;
      titleInput().dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const enter = async () => {
      titleInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      await fixture.whenStable();
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    const titles = () => store.getList(list.id)!.tasks.map((t) => t.title);
    return { store, fixture, root, titleInput, dialog, type, enter, submit, titles };
  }

  const single = () => {
    const list = createList('Küche');
    list.tasks = [createTask('Spülmaschine einräumen', 'a')];
    return list;
  };

  it('Enter-Kette: jede Vorarbeit kommt vor die vorige, das Sheet bleibt offen und leer', async () => {
    const list = single();
    const { fixture, type, enter, titleInput, dialog, store } = setup(list);
    fixture.componentInstance.create(list.id, { kind: 'before', anchor: 'a' }, true);
    await fixture.whenStable();

    await type('Geschirr einsammeln');
    await enter();
    expect(dialog().open).toBe(true);
    expect(titleInput().value).toBe('');
    await type('Bioabfall in die Tonne');
    await enter();

    const l = store.getList(list.id)!;
    const id = (title: string) => l.tasks.find((t) => t.title === title)!.id;
    expect(l.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(
      [`${id('Bioabfall in die Tonne')}->${id('Geschirr einsammeln')}`, `${id('Geschirr einsammeln')}->a`].sort(),
    );
  });

  it('ohne Kette: Anlegen legt an und schließt; leerer Titel wird nicht angelegt', async () => {
    const list = single();
    const { fixture, type, submit, dialog, titles, root } = setup(list);
    fixture.componentInstance.create(list.id, { kind: 'after', anchor: 'a' });
    await fixture.whenStable();

    await submit();
    expect(root.querySelector('[role=alert]')).toBeTruthy();
    expect(titles()).toEqual(['Spülmaschine einräumen']);

    await type('Ausräumen');
    await submit();
    expect(dialog().open).toBe(false);
    expect(titles()).toEqual(['Spülmaschine einräumen', 'Ausräumen']);
  });

  it('„Fertig" mit leerem Feld beendet eine Kette ohne Fehler', async () => {
    const list = single();
    const { fixture, submit, dialog, titles } = setup(list);
    fixture.componentInstance.create(list.id, { kind: 'standalone' }, true);
    await fixture.whenStable();
    await submit();
    expect(dialog().open).toBe(false);
    expect(titles()).toEqual(['Spülmaschine einräumen']);
  });

  it('mehrzeilig eingefügter Text wird zu einer Kette', async () => {
    const list = createList('Leer');
    const { fixture, titleInput, store } = setup(list);
    fixture.componentInstance.create(list.id, { kind: 'standalone' });
    await fixture.whenStable();

    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'Eins\nZwei\n\nDrei' } });
    titleInput().dispatchEvent(paste);
    await fixture.whenStable();

    const l = store.getList(list.id)!;
    const byTitle = (t: string) => l.tasks.find((x) => x.title === t)!.id;
    expect(l.tasks.map((t) => t.title)).toEqual(['Eins', 'Zwei', 'Drei']);
    expect(l.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(
      [`${byTitle('Eins')}->${byTitle('Zwei')}`, `${byTitle('Zwei')}->${byTitle('Drei')}`].sort(),
    );
  });

  it('wandelt Text in eine Checkliste und zurück und speichert nur eine Form', async () => {
    const list = single();
    list.tasks[0]!.notes = '- Milch\nBrot';
    const { fixture, root, submit, store } = setup(list);
    fixture.componentInstance.open(list.id, 'a');
    await fixture.whenStable();
    const radio = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('.segmented button')].find((b) => b.textContent?.trim() === label)!;

    radio('Checklist').click();
    await fixture.whenStable();
    const items = [...root.querySelectorAll<HTMLInputElement>('.checklist-edit__text')].map((i) => i.value);
    expect(items).toEqual(['Milch', 'Brot']);

    await submit();
    const task = store.getList(list.id)!.tasks[0]!;
    expect(task.checklist?.map((i) => i.text)).toEqual(['Milch', 'Brot']);
    expect(task.notes).toBeUndefined();

    fixture.componentInstance.open(list.id, 'a');
    await fixture.whenStable();
    radio('Text').click();
    await fixture.whenStable();
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe('- Milch\n- Brot\n');
  });
});
