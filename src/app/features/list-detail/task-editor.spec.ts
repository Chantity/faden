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
