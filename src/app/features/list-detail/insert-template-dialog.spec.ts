import { TestBed } from '@angular/core/testing';
import { InsertTemplateDialog } from './insert-template-dialog';
import { ListsStore } from '../../core/state/lists.store';
import { TemplatesStore } from '../../core/state/templates.store';
import { FadenDb } from '../../core/storage';
import { connectedComponents } from '../../core/graph';
import { createList, createTask, edgeId } from '../../core/model';
import { listToTemplate } from '../../core/templates';

describe('InsertTemplateDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsertTemplateDialog],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  it('fügt die gewählte Vorlage als neuen Strang ein (rückgängig machbar)', async () => {
    const source = createList('Müll');
    source.tasks = [createTask('Einsammeln', 'x'), createTask('Rausbringen', 'y')];
    source.edges = [{ id: edgeId('x', 'y'), from: 'x', to: 'y' }];
    await TestBed.inject(TemplatesStore).add(listToTemplate(source));

    const target = createList('Küche');
    target.tasks = [{ ...createTask('Spülen', 'a'), done: true }];
    const store = TestBed.inject(ListsStore);
    store.addExisting(target);

    const fixture = TestBed.createComponent(InsertTemplateDialog);
    await fixture.whenStable();
    fixture.componentInstance.open(target.id);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ol')?.textContent).toContain('Einsammeln');

    (root.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const after = store.getList(target.id)!;
    expect(after.tasks.map((t) => t.title)).toEqual(['Spülen', 'Einsammeln', 'Rausbringen']);
    expect(after.tasks[0]?.done).toBe(true);
    expect(after.tasks.slice(1).every((t) => !t.done && t.id !== 'x' && t.id !== 'y')).toBe(true);
    expect(connectedComponents(after).length).toBe(2);

    store.undo();
    expect(store.getList(target.id)!.tasks.length).toBe(1);
  });
});
