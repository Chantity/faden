import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SchemeEditorPage } from './scheme-editor-page';
import { SettingsStore } from '../../core/state/settings.store';
import { FadenDb } from '../../core/storage';

describe('SchemeEditorPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'einstellungen/fortgeschritten/farbschema/:id', component: SchemeEditorPage },
          { path: '**', children: [] },
        ]),
        { provide: FadenDb, useFactory: () => new FadenDb() },
      ],
    }).compileComponents();
  });

  afterEach(() => document.documentElement.removeAttribute('style'));

  async function openEditor() {
    const settings = TestBed.inject(SettingsStore);
    const copy = await settings.duplicateScheme(settings.defaultScheme().id);
    const router = TestBed.inject(Router);
    const { RouterTestingHarness } = await import('@angular/router/testing');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/einstellungen/fortgeschritten/farbschema/${copy.id}`);
    const root = harness.routeNativeElement!;
    return { settings, copy, router, harness, root };
  }

  it('zeigt die Farben live in der Vorschau, speichert erst mit „Speichern“ und aktiviert das Schema', async () => {
    const { settings, copy, harness, root } = await openEditor();
    const color = root.querySelector<HTMLInputElement>('input[type=color]')!;
    color.value = '#224466';
    color.dispatchEvent(new Event('input'));
    harness.detectChanges();

    const preview = root.querySelector<HTMLElement>('.previews')!;
    expect(preview.style.getPropertyValue('--color-primary')).toContain('#224466');
    expect(settings.schemes().find((s) => s.id === copy.id)!.primary.light).toBe('#4a6b57');

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    expect(settings.schemes().find((s) => s.id === copy.id)!.primary.light).toBe('#224466');
    expect(settings.activeScheme().id).toBe(copy.id);
  });

  it('sperrt Speichern bei vergebenem Namen und lehnt ungültige Hex-Werte ab', async () => {
    const { settings, copy, harness, root } = await openEditor();
    const name = root.querySelector<HTMLInputElement>('input[name=name]')!;
    name.value = 'Sage';
    name.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(root.querySelector('#scheme-name-hint')!.textContent).toContain('already taken');
    expect(root.querySelector('button[type=submit]')!.getAttribute('aria-disabled')).toBe('true');

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    expect(settings.schemes().find((s) => s.id === copy.id)!.name).toBe('Sage (2)');

    const hex = root.querySelector<HTMLInputElement>('.picker__hex')!;
    hex.value = 'grün';
    hex.dispatchEvent(new Event('change'));
    harness.detectChanges();
    expect(hex.value).toBe('#4a6b57');
    expect(root.textContent).toContain('#rrggbb');
  });
});
