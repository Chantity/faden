import { TestBed } from '@angular/core/testing';
import { PlanEditor } from './plan-editor';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, type Task, type TodoList } from '../../core/model';

const FIXED_NOW = new Date('2026-03-12T08:00:00');

function scheduleList(...tasks: Task[]): TodoList {
  const list = createList('Plan', 'schedule');
  list.tasks = tasks;
  return list;
}

describe('PlanEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanEditor],
      providers: [
        { provide: FadenDb, useFactory: () => new FadenDb() },
        { provide: NowStore, useValue: { now: () => FIXED_NOW } as unknown as NowStore },
      ],
    }).compileComponents();
  });

  it('verschiebt alle geplanten Zeiten (shift)', async () => {
    const task = createTask('A', 'a');
    task.startAt = '2026-03-12T10:00';
    task.estimateMinutes = 30;
    const list = scheduleList(task);
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.open(list);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector(
      '[data-action="shift"]',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    const updated = store.getList(list.id)?.tasks.find((t) => t.id === 'a');
    expect(updated?.startAt).toBe('2026-03-12T10:30');
    expect(updated?.estimateMinutes).toBe(30);
  });

  it('schlägt Zeiten aus Schätzungen vor (propose)', async () => {
    const task = createTask('A', 'a');
    task.estimateMinutes = 30;
    const list = scheduleList(task);
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.open(list);
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    input.value = '2026-03-12T09:00';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (
      fixture.nativeElement.querySelector('[data-action="propose"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    const updated = store.getList(list.id)?.tasks.find((t) => t.id === 'a');
    expect(updated?.startAt).toBe('2026-03-12T09:00');
    expect(updated?.estimateMinutes).toBe(30);
  });

  it('überträgt Tageszeiten auf ein Datum (convert)', async () => {
    const list = createList('Tag', 'dayPlan');
    list.dayPlanReferenceDate = '2026-03-01';
    const task = createTask('A', 'a');
    task.dayStart = '10:00';
    task.estimateMinutes = 30;
    list.tasks = [task];
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.open(list);
    await fixture.whenStable();

    const dateInput = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    dateInput.value = '2026-03-12';
    dateInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (
      fixture.nativeElement.querySelector('[data-action="convert"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    const updated = store.getList(list.id)?.tasks.find((t) => t.id === 'a');
    expect(updated?.startAt).toBe('2026-03-12T10:00');
    expect(updated?.estimateMinutes).toBe(30);
  });

  it('bietet nach dem Moduswechsel nur das Übertragen an, Datum = Bezugstag', async () => {
    const task = createTask('A', 'a');
    task.dayStart = '09:00';
    task.estimateMinutes = 60;
    const list = { ...scheduleList(task), dayPlanReferenceDate: '2026-03-10' };
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.openConvert(list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-action="shift"]')).toBeNull();
    expect(root.querySelector('[data-action="propose"]')).toBeNull();
    expect((root.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-03-10');

    (root.querySelector('[data-action="convert"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const after = store.getList(list.id)!.tasks[0]!;
    expect(after.startAt).toBe('2026-03-10T09:00');
    expect(after.estimateMinutes).toBe(60);
    expect(after.dayStart).toBe('09:00');
  });
});
