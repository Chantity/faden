import { TestBed } from '@angular/core/testing';
import { FadenDb } from '../../core/storage';
import { GuideDialog } from './guide-dialog';
import { I18nStore } from '../../core/i18n/i18n.store';

const GUIDE = '<p><a href="#2-lists">Lists</a></p><h3>1. Start</h3><p>Hi</p><h3>2. Lists</h3><p>More</p>';

describe('GuideDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideDialog],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  // Testdateien teilen sich hier den Worker (keine Isolation): nichts Globales zurücklassen.
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  afterEach(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });

  it('meldet ruhig, wenn die Anleitung nicht geladen werden kann', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    const fixture = TestBed.createComponent(GuideDialog);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();
  });

  it('zeigt die Anleitung in der eingestellten Sprache, setzt Anker und scrollt bei Anker-Links im Dialog', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => GUIDE }));
    vi.stubGlobal('fetch', fetchMock);
    const scrolled: string[] = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.id);
    };
    const fixture = TestBed.createComponent(GuideDialog);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(fetchMock).toHaveBeenCalledWith('guide/guide.en.html'); // Sprache der Tests: Englisch
    expect([...root.querySelectorAll('.guide__content h3[id]')].map((h) => h.id)).toEqual(['1-start', '2-lists']);

    const hash = location.hash;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    root.querySelector<HTMLAnchorElement>('.guide__content a')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(location.hash).toBe(hash);
    expect(scrolled).toEqual(['2-lists']);
  });

  it('lädt bei offenem Dialog die andere Sprache, wenn sie wechselt', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, text: async () => `<p>${url}</p>` }));
    vi.stubGlobal('fetch', fetchMock);
    const fixture = TestBed.createComponent(GuideDialog);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    TestBed.inject(I18nStore).setLocale('de');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.guide__content')?.textContent).toBe('guide/guide.de.html');
    TestBed.inject(I18nStore).setLocale('en');
  });

  it('öffnet auch das Änderungsprotokoll („Was ist neu?“) aus eigener Datei', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, text: async () => `<h3>2.2.0</h3><p>${url}</p>` }));
    vi.stubGlobal('fetch', fetchMock);
    const fixture = TestBed.createComponent(GuideDialog);
    await fixture.componentInstance.open('changelog');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('dialog h2')?.textContent).toBe('What’s new?');
    expect(root.querySelector('.guide__content')?.textContent).toContain('guide/changelog.en.html');
    expect(fetchMock).toHaveBeenCalledWith('guide/changelog.en.html');
  });
});
