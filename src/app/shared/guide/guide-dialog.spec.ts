import { TestBed } from '@angular/core/testing';
import { FadenDb } from '../../core/storage';
import { GuideDialog } from './guide-dialog';

const GUIDE = '<p><a href="#deutsch">Deutsch</a></p><h2 id="english">English</h2><p>Hi</p><h2 id="deutsch">Deutsch</h2><p>Hallo</p>';

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

  it('zeigt die Anleitung, setzt Anker und scrollt bei Anker-Links im Dialog statt die Route zu wechseln', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => GUIDE })));
    const scrolled: string[] = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.id);
    };
    const fixture = TestBed.createComponent(GuideDialog);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect([...root.querySelectorAll('h2[id]')].map((h) => h.id)).toEqual(['guide-title', 'english', 'deutsch']);
    expect(scrolled).toEqual(['english']); // Sprache der Tests: Englisch

    const hash = location.hash;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    root.querySelector<HTMLAnchorElement>('.guide__content a')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(location.hash).toBe(hash);
    expect(scrolled).toEqual(['english', 'deutsch']);
  });
});
