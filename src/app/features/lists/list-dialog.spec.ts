import { TestBed } from '@angular/core/testing';
import { ListDialog } from './list-dialog';
import { ListsStore } from '../../core/state/lists.store';
import { SettingsStore } from '../../core/state/settings.store';
import { TemplatesStore } from '../../core/state/templates.store';
import { FadenDb } from '../../core/storage';
import { createList } from '../../core/model';

describe('ListDialog – Namen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListDialog],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  async function setup() {
    TestBed.inject(ListsStore).addExisting(createList('Küche'));
    const fixture = TestBed.createComponent(ListDialog);
    fixture.componentInstance.showCreate();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input[name=title]') as HTMLInputElement;
    const submit = () => root.querySelector('button[type=submit]') as HTMLButtonElement;
    const button = () => ({ disabled: submit().getAttribute('aria-disabled') === 'true' });
    const hint = () => root.querySelector('#list-title-hint')!.textContent!.trim();
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { fixture, submit, button, hint, type };
  }

  it('leer und vergeben verhalten sich gleich: Knopf gesperrt, Hinweis unter dem Feld', async () => {
    const { fixture, submit, button, hint, type } = await setup();
    const saved: unknown[] = [];
    fixture.componentInstance.saved.subscribe((r) => saved.push(r));
    expect(button().disabled).toBe(true);
    expect(hint()).toBe(''); // vor dem ersten Tippen kein Hinweis
    submit().click(); // gesperrt, aber erreichbar: zeigt den Hinweis, legt nichts an
    await fixture.whenStable();
    expect(hint()).toBe('Please enter a title.');
    expect(saved).toEqual([]);

    await type('KÜCHE ');
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('There is already a list with this name.');

    await type('   ');
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('Please enter a title.');

    await type('Bad');
    expect(button().disabled).toBe(false);
    expect(hint()).toBe('');
  });
});

describe('ListDialog – einfacher Modus', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListDialog],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
    await TestBed.inject(SettingsStore).setSimpleEnabled(true);
  });

  it('bietet weiter die Vorlagen-Wahl, aber nur „Keine Zeitplanung“ und „Zeitschätzung“', async () => {
    TestBed.inject(TemplatesStore).add({
      id: 't',
      title: 'Morgen',
      timeboxMode: 'none',
      createdAt: '2026-01-01T00:00:00.000Z',
      tasks: [],
      edges: [],
    });
    const fixture = TestBed.createComponent(ListDialog);
    fixture.componentInstance.showCreate();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('select[name=template]')).not.toBeNull();
    expect(root.querySelectorAll('input[type=radio]')).toHaveLength(2);
  });
});
