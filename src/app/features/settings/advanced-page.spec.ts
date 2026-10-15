import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdvancedPage } from './advanced-page';
import { SettingsStore } from '../../core/state/settings.store';
import { FadenDb } from '../../core/storage';

describe('AdvancedPage – Tastenkürzel ändern', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvancedPage],
      providers: [provideRouter([]), { provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(AdvancedPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const settings = TestBed.inject(SettingsStore);
    const change = async (action: string) => {
      root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
      await fixture.whenStable();
    };
    const press = async (key: string, mods: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...mods });
      document.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    const status = () => root.querySelector('.status')!.textContent!.trim();
    const row = (action: string) =>
      root.querySelector(`[data-action="${action}"]`)!.closest('.keys__row')!.textContent!.replace(/\s+/g, ' ');
    return { root, settings, change, press, status, row };
  }

  it('nimmt eine neue Taste auf, speichert sie und zeigt „geändert“', async () => {
    const { settings, change, press, status, row } = await setup();
    await change('needFirst');
    expect(row('needFirst')).toContain('Press the new key');
    const event = await press('b');
    expect(event.defaultPrevented).toBe(true);
    expect(settings.keymap().needFirst).toEqual([{ key: 'b' }]);
    expect(status()).toBe('Something else has to come first: now B.');
    expect(row('needFirst')).toContain('changed');
  });

  it('Strg+Umschalt+K wird als Kombination gespeichert; Modifier allein wartet', async () => {
    const { settings, change, press } = await setup();
    await change('help');
    await press('Control', { ctrlKey: true });
    expect(settings.keymap().help).toEqual([{ key: '?' }]); // noch nichts gespeichert
    await press('K', { ctrlKey: true, shiftKey: true });
    expect(settings.keymap().help).toEqual([{ key: 'k', ctrl: true, shift: true }]);
  });

  it('lehnt belegte und reservierte Tasten ruhig ab; Esc bricht ab', async () => {
    const { settings, change, press, status } = await setup();
    await change('insertAfter');
    await press('e');
    expect(status()).toBe('This key is already used: Edit.');
    expect(settings.keymap().insertAfter).toEqual([{ key: 'n' }]);
    await press('Tab');
    expect(status()).toBe('Not changed.'); // Tab beendet die Aufnahme, bleibt aber Navigation

    await change('insertAfter');
    await press('Escape');
    expect(status()).toBe('Not changed.');
    expect(settings.keymap().insertAfter).toEqual([{ key: 'n' }]);
  });

  it('setzt einzeln und insgesamt auf Standard zurück', async () => {
    const { root, settings, change, press } = await setup();
    await change('edit');
    await press('x');
    await change('undo');
    await press('u', { ctrlKey: true });
    expect(settings.settings().keymap).toEqual({ edit: [{ key: 'x' }], undo: [{ key: 'u', ctrl: true }] });

    root.querySelector<HTMLButtonElement>('[aria-label="Edit: reset to default"]')!.click();
    expect(settings.keymap().edit).toEqual([{ key: 'e' }]);

    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Reset all to default')!.click();
    expect(settings.settings().keymap).toBeUndefined();
  });
});
