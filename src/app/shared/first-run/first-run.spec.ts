import { TestBed } from '@angular/core/testing';
import { FadenDb } from '../../core/storage';
import { FirstRun } from './first-run';
import { FirstRunStore, GUIDE_OFFERED_KEY, STORAGE_NOTICE_KEY } from './first-run.store';

describe('FirstRun', () => {
  beforeEach(async () => {
    localStorage.removeItem(STORAGE_NOTICE_KEY);
    localStorage.removeItem(GUIDE_OFFERED_KEY);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '<h2>English</h2><p>Hi</p>' })));
    await TestBed.configureTestingModule({
      imports: [FirstRun],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_NOTICE_KEY);
    localStorage.removeItem(GUIDE_OFFERED_KEY);
    vi.unstubAllGlobals();
  });

  async function render() {
    const fixture = TestBed.createComponent(FirstRun);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const open = () => [...root.querySelectorAll('dialog')].filter((d) => d.open).map((d) => d.querySelector('h2')!.textContent);
    const click = async (label: string) => {
      [...root.querySelectorAll<HTMLButtonElement>('dialog[open] button')].find((b) => b.textContent?.trim() === label)!.click();
      await fixture.whenStable();
    };
    return { fixture, root, open, click };
  }

  it('erst der Speicher-Hinweis (nicht per Esc schließbar), dann das Anleitungs-Angebot', async () => {
    const { root, open, click } = await render();
    expect(open()).toEqual(['Your data stays with you']);

    const storage = root.querySelector('dialog[open]') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true });
    storage.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    // Schließt der Browser ihn trotzdem, kommt er sofort wieder.
    storage.close();
    expect(storage.open).toBe(true);
    expect(TestBed.inject(FirstRunStore).done()).toBe(false);

    await click('Got it');
    expect(localStorage.getItem(STORAGE_NOTICE_KEY)).toBe('1');
    expect(open()).toEqual(['Read the guide?']);

    await click('Ignore');
    expect(open()).toEqual([]);
    expect(localStorage.getItem(GUIDE_OFFERED_KEY)).toBe('1');
    expect(TestBed.inject(FirstRunStore).done()).toBe(true);
  });

  it('„Anleitung lesen" öffnet die Anleitung und merkt sich das Angebot', async () => {
    localStorage.setItem(STORAGE_NOTICE_KEY, '1');
    const { fixture, root, open, click } = await render();
    expect(open()).toEqual(['Read the guide?']);
    await click('Read the guide');
    await vi.waitFor(() => expect(root.querySelector('.guide__content')).not.toBeNull());
    await fixture.whenStable();
    expect(open()).toEqual(['Guide']);
    expect(localStorage.getItem(GUIDE_OFFERED_KEY)).toBe('1');
  });

  it('zeigt nichts, wenn beides erledigt ist', async () => {
    localStorage.setItem(STORAGE_NOTICE_KEY, '1');
    localStorage.setItem(GUIDE_OFFERED_KEY, '1');
    const { open } = await render();
    expect(open()).toEqual([]);
  });
});
