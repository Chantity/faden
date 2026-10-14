import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ListsPage } from './lists-page';
import { ListsStore } from '../../core/state/lists.store';
import { TemplatesStore } from '../../core/state/templates.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, edgeId } from '../../core/model';

describe('ListsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListsPage],
      providers: [provideRouter([]), { provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const list = createList('Küche');
    list.tasks = [createTask('Spülen', 'a'), createTask('Abtrocknen', 'b')];
    list.edges = [{ id: edgeId('a', 'b'), from: 'a', to: 'b' }];
    TestBed.inject(ListsStore).addExisting(list);
    const fixture = TestBed.createComponent(ListsPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function menuButton(root: HTMLElement, label: string): HTMLButtonElement {
    const button = [...root.querySelectorAll<HTMLButtonElement>('.menu__panel button')].find(
      (b) => b.textContent?.trim() === label,
    );
    if (!button) throw new Error(`Menüeintrag „${label}“ fehlt`);
    return button;
  }

  it('speichert einen Zettel über das ⋯-Menü als Vorlage', async () => {
    const root = await render();
    const menu = root.querySelector<HTMLDetailsElement>('details.menu')!;
    menu.setAttribute('open', '');

    menuButton(root, 'Save list as template').click();

    const templates = TestBed.inject(TemplatesStore).templates();
    expect(templates.length).toBe(1);
    expect(templates[0]?.title).toBe('Küche');
    expect(templates[0]?.tasks.length).toBe(2);
    expect(templates[0]?.edges.length).toBe(1);
    expect(menu.hasAttribute('open')).toBe(false);
  });

  it('schließt das ⋯-Menü bei einem Klick außerhalb', async () => {
    const root = await render();
    const menu = root.querySelector<HTMLDetailsElement>('details.menu')!;
    menu.setAttribute('open', '');

    document.body.click();

    expect(menu.hasAttribute('open')).toBe(false);
  });

  it('lässt das ⋯-Menü bei einem Klick in den Menüinhalt offen', async () => {
    const root = await render();
    const menu = root.querySelector<HTMLDetailsElement>('details.menu')!;
    menu.setAttribute('open', '');

    root.querySelector<HTMLElement>('.menu__panel')!.click();

    expect(menu.hasAttribute('open')).toBe(true);
  });
});
