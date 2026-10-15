import { TestBed } from '@angular/core/testing';
import { PwaService } from '../../core/pwa/pwa.service';
import { FadenDb } from '../../core/storage';
import { INSTALL_BANNER_DISMISSED_KEY, InstallBanner } from './install-banner';
import { FirstRunStore, GUIDE_OFFERED_KEY, STORAGE_NOTICE_KEY } from '../first-run/first-run.store';

describe('InstallBanner', () => {
  let pwa: PwaService;

  beforeEach(async () => {
    localStorage.removeItem(INSTALL_BANNER_DISMISSED_KEY);
    // Die Erst-Start-Popups sind hier schon erledigt (eigener Test unten).
    localStorage.setItem(STORAGE_NOTICE_KEY, '1');
    localStorage.setItem(GUIDE_OFFERED_KEY, '1');
    await TestBed.configureTestingModule({
      imports: [InstallBanner],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
    pwa = TestBed.inject(PwaService);
  });

  afterEach(() => {
    for (const key of [INSTALL_BANNER_DISMISSED_KEY, STORAGE_NOTICE_KEY, GUIDE_OFFERED_KEY]) localStorage.removeItem(key);
  });

  it('wartet, bis die Erst-Start-Popups erledigt sind', async () => {
    const firstRun = TestBed.inject(FirstRunStore);
    firstRun.guideOffered.set(false);
    pwa.canPrompt.set(true);
    const fixture = TestBed.createComponent(InstallBanner);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.install-banner')).toBeNull();

    firstRun.markGuideOffered();
    await fixture.whenStable();
    expect(root.querySelector('.install-banner')).not.toBeNull();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(InstallBanner);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(root: HTMLElement): string[] {
    return [...root.querySelectorAll('button')].map((b) => b.textContent!.trim());
  }

  it('erscheint, sobald der Browser die Installation anbietet', async () => {
    pwa.canPrompt.set(true);
    const root = await render();
    expect(root.querySelector('.install-banner')).not.toBeNull();
    expect(buttons(root)).toEqual(['Install', 'Ignore']);
  });

  it('erscheint nicht in der installierten App', async () => {
    pwa.canPrompt.set(true);
    pwa.installed.set(true);
    const root = await render();
    expect(root.querySelector('.install-banner')).toBeNull();
  });

  it('erscheint nicht, wenn keine Installation möglich ist', async () => {
    const root = await render();
    expect(root.querySelector('.install-banner')).toBeNull();
  });

  it('„Installieren“ öffnet die native Aufforderung', async () => {
    pwa.canPrompt.set(true);
    const install = vi.spyOn(pwa, 'install').mockResolvedValue(true);
    const root = await render();
    (root.querySelector('.btn--primary') as HTMLButtonElement).click();
    expect(install).toHaveBeenCalledOnce();
  });

  it('auf iOS klappt „Installieren“ die Anleitung auf', async () => {
    pwa.isIos.set(true);
    const fixture = TestBed.createComponent(InstallBanner);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Add to Home Screen');
    expect(buttons(root)).toEqual(['Ignore']);
  });

  it('„Ignorieren“ blendet aus und bleibt beim nächsten Öffnen gespeichert', async () => {
    pwa.canPrompt.set(true);
    const root = await render();
    (root.querySelectorAll('button')[1] as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r));
    expect(localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY)).toBe('1');

    const again = await render();
    expect(again.querySelector('.install-banner')).toBeNull();
  });
});
