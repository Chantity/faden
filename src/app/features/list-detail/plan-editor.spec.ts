import { TestBed } from '@angular/core/testing';
import { PlanEditor } from './plan-editor';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, edgeId, type Task, type TodoList } from '../../core/model';

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

  it('„Strang verschieben" verschiebt nur den Strang der Karte, mit Vorschau', async () => {
    const a = { ...createTask('A', 'a'), startAt: '2026-03-12T10:00', estimateMinutes: 30 };
    const b = { ...createTask('B', 'b'), startAt: '2026-03-12T11:00', estimateMinutes: 30 };
    const other = { ...createTask('C', 'c'), startAt: '2026-03-12T12:00' };
    const list = scheduleList(a, b, other);
    list.edges = [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }];
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.openStrand(list, 'b');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-action="propose"]')).toBeNull();
    expect(root.textContent).toContain('10:30 to');

    (root.querySelector('[data-action="shift"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.getList(list.id)!.tasks.map((t) => t.startAt)).toEqual([
      '2026-03-12T10:30',
      '2026-03-12T11:30',
      '2026-03-12T12:00',
    ]);
  });

  it('„Ab hier verschieben" bewegt nur das ToDo und seine Nachfolger, nicht Vorgänger oder Geschwister', async () => {
    // A → B → D und A → C: ab B verschieben lässt A und C stehen.
    const a = { ...createTask('A', 'a'), startAt: '2026-03-12T09:00', estimateMinutes: 30 };
    const b = { ...createTask('B', 'b'), startAt: '2026-03-12T10:00', estimateMinutes: 30 };
    const c = { ...createTask('C', 'c'), startAt: '2026-03-12T10:00', estimateMinutes: 30 };
    const d = { ...createTask('D', 'd'), startAt: '2026-03-12T11:00', estimateMinutes: 30 };
    const list = scheduleList(a, b, c, d);
    list.edges = [
      { id: edgeId('a', 'b'), from: 'a', to: 'b' },
      { id: edgeId('a', 'c'), from: 'a', to: 'c' },
      { id: edgeId('b', 'd'), from: 'b', to: 'd' },
    ];
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.openStrand(list, 'b', 'from');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Shift from here');

    (root.querySelector('[data-action="shift"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.getList(list.id)!.tasks.map((t) => t.startAt)).toEqual([
      '2026-03-12T09:00',
      '2026-03-12T10:30',
      '2026-03-12T10:00',
      '2026-03-12T11:30',
    ]);
  });

  it('Tagesplan: Verschieben über Mitternacht wird abgelehnt', async () => {
    const list = createList('Tag', 'dayPlan');
    list.dayPlanReferenceDate = '2026-03-12';
    list.tasks = [{ ...createTask('A', 'a'), dayStart: '23:45' }];
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);

    const fixture = TestBed.createComponent(PlanEditor);
    fixture.componentInstance.open(list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-action="shift"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(root.querySelector('[role=alert]')).toBeTruthy();
    expect(store.getList(list.id)!.tasks[0]!.dayStart).toBe('23:45');
  });
});
