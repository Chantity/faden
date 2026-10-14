import { TestBed } from '@angular/core/testing';
import { FocusView } from './focus-view';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, type Task, type TodoList } from '../../core/model';

const FIXED_NOW = new Date('2026-03-12T13:15:00');
const TODAY = '2026-03-12';

function dayPlanList(reference: string, ...tasks: Task[]): TodoList {
  const list = createList('Tag', 'dayPlan');
  list.dayPlanReferenceDate = reference;
  list.tasks = tasks;
  return list;
}

function task(id: string, dayStart: string, dayEnd: string): Task {
  const created = createTask(`ToDo ${id}`, id);
  created.dayStart = dayStart;
  created.dayEnd = dayEnd;
  return created;
}

describe('FocusView – Zeiten (Timeboxing)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocusView],
      providers: [
        { provide: FadenDb, useFactory: () => new FadenDb() },
        { provide: NowStore, useValue: { now: () => FIXED_NOW } as unknown as NowStore },
      ],
    }).compileComponents();
  });

  it('zeigt ein laufendes ToDo mit Zeit-Badge und „Jetzt, bis …"', async () => {
    const list = dayPlanList(TODAY, task('a', '13:00', '13:30'));
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const badge = root.querySelector('.task-card__time');
    expect(badge).toBeTruthy();
    expect(badge?.classList.contains('is-running')).toBe(true);
    expect(badge?.textContent).toContain('13:30');
  });

  it('kennzeichnet ein überfälliges ToDo und erlaubt „Nachträglich abhaken"', async () => {
    const list = dayPlanList(TODAY, task('a', '11:00', '11:30'));
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const badge = root.querySelector('.task-card__time');
    expect(badge?.classList.contains('is-late')).toBe(true);

    const lateButton = root.querySelector('.task-card__late') as HTMLButtonElement;
    expect(lateButton).toBeTruthy();
    lateButton.click();
    await fixture.whenStable();

    expect(store.getList(list.id)?.tasks.find((t) => t.id === 'a')?.done).toBe(true);
  });

  it('zeigt den Tagesplan-Hinweis bei vergangenem Datum und setzt ihn auf heute', async () => {
    const list = dayPlanList('2026-03-01', task('a', '11:00', '11:30'));
    const store = TestBed.inject(ListsStore);
    store.addExisting(list);
    const fixture = TestBed.createComponent(FocusView);
    fixture.componentRef.setInput('list', list);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const banner = root.querySelector('.plan-banner');
    expect(banner).toBeTruthy();

    (banner?.querySelector('.btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(store.getList(list.id)?.dayPlanReferenceDate).toBe(TODAY);

    fixture.componentRef.setInput('list', store.getList(list.id));
    await fixture.whenStable();
    expect(root.querySelector('.plan-banner')).toBeNull();
  });
});
