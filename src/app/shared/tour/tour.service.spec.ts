import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TourService } from './tour.service';
import { ListsStore } from '../../core/state/lists.store';
import { SettingsStore } from '../../core/state/settings.store';
import { ViewStore } from '../../core/state/view.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, edgeId, type TodoList } from '../../core/model';
import { TOUR_ACTIVE_KEY } from '../first-run/first-run.store';

describe('TourService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FadenDb, useFactory: () => new FadenDb() }],
    });
  });

  afterEach(() => localStorage.removeItem(TOUR_ACTIVE_KEY));

  function setup() {
    const tour = TestBed.inject(TourService);
    const lists = TestBed.inject(ListsStore);
    const step = () => {
      TestBed.tick();
      return tour.step()?.id ?? null;
    };
    const edit = (change: (l: TodoList) => TodoList) => lists.editList(tour.practiceId()!, change);
    return { tour, lists, step, edit };
  }

  it('geht mit echten Aktionen durch die Grundlagen und räumt den Übungszettel auf Wunsch weg', async () => {
    await TestBed.inject(SettingsStore).setSimpleEnabled(true);
    const { tour, lists, step, edit } = setup();
    tour.startTour();
    expect(step()).toBe('createList');
    expect(tour.suggestedListTitle()).toBe('Practice list');

    lists.addExisting({ ...createList('Practice list'), id: 'p' });
    expect(step()).toBe('fill');
    expect(tour.practiceId()).toBe('p');

    edit((l) => ({
      ...l,
      tasks: [createTask('A', 'a'), createTask('B', 'b')],
      edges: [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }],
    }));
    expect(step()).toBe('markDone');

    edit((l) => ({ ...l, tasks: l.tasks.map((t) => (t.id === 'a' ? { ...t, done: true } : t)) }));
    expect(step()).toBe('undo');

    lists.undo('p');
    expect(step()).toBe('insertAfter');

    // Solange das Sheet offen ist, wartet die Tour.
    tour.setDialogOpen(true);
    edit((l) => ({ ...l, tasks: [...l.tasks, createTask('C', 'c')] }));
    expect(step()).toBe('insertAfter');
    tour.setDialogOpen(false);
    expect(step()).toBe('flow');

    TestBed.inject(ViewStore).set('p', 'flow');
    expect(step()).toBe('newStrand');

    edit((l) => ({ ...l, tasks: [...l.tasks, createTask('D', 'd')] }));
    expect(step()).toBe('edit');
    expect(tour.taskId()).toBe('d'); // der nächste Hinweis zeigt auf die neue Karte

    tour.setDialogOpen(true);
    tour.setDialogOpen(false);
    expect(step()).toBe('archive');
    tour.next();
    expect(step()).toBe('more');
    expect(tour.simpleAtStart()).toBe(true);

    tour.finishBasics();
    expect(step()).toBe('cleanup');
    tour.deletePractice();
    expect(tour.active()).toBe(false);
    expect(lists.getList('p')).toBeUndefined();
    expect(localStorage.getItem(TOUR_ACTIVE_KEY)).toBeNull();
  });

  it('„Mehr anzeigen“ schaltet den einfachen Modus aus und zeigt die erweiterten Schritte', async () => {
    const settings = TestBed.inject(SettingsStore);
    await settings.setSimpleEnabled(true);
    const { tour, step } = setup();
    tour.startTour();
    TestBed.inject(ListsStore).addExisting({ ...createList('Practice list'), id: 'p', tasks: [createTask('A', 'a')] });
    TestBed.tick();
    tour.index.set(9); // „Das sind die Grundlagen“
    expect(step()).toBe('more');
    tour.more();
    expect(step()).toBe('branch');
    expect(settings.simpleEnabled()).toBe(false);
    expect(tour.counter()).toEqual({ n: 11, total: 15 });

    // Auch wenn der Übungszettel inzwischen archiviert ist, bleibt er der Übungszettel.
    TestBed.inject(ListsStore).archive('p');
    TestBed.tick();
    expect(tour.practice()?.id).toBe('p');

    // Nachfolgeaufgabe am Strang-Ende: keine Verzweigung, zählt trotzdem.
    TestBed.inject(ListsStore).editList(tour.practiceId()!, (l) => ({
      ...l,
      tasks: [...l.tasks, createTask('B', 'b')],
      edges: [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }],
    }));
    expect(step()).toBe('links');
  });

  it('endet ohne Aufräum-Frage, wenn es keinen Übungszettel (mehr) gibt', () => {
    const { tour, step } = setup();
    tour.startTour();
    tour.finishBasics();
    expect(step()).toBeNull();
  });
});
