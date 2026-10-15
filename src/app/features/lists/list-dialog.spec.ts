import { TestBed } from '@angular/core/testing';
import { ListDialog } from './list-dialog';
import { ListsStore } from '../../core/state/lists.store';
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
    const button = () => root.querySelector('button[type=submit]') as HTMLButtonElement;
    const hint = () => root.querySelector('#list-title-hint')!.textContent!.trim();
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { button, hint, type };
  }

  it('leer und vergeben verhalten sich gleich: Knopf gesperrt, Hinweis unter dem Feld', async () => {
    const { button, hint, type } = await setup();
    expect(button().disabled).toBe(true);
    expect(hint()).toBe(''); // vor dem ersten Tippen kein Hinweis

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
