import { TestBed } from '@angular/core/testing';
import { SettingsPage } from './settings-page';
import { BackupService } from '../../core/backup/backup.service';
import { ListsStore } from '../../core/state/lists.store';
import { FadenDb } from '../../core/storage';
import { createList, createTask, SCHEMA_VERSION } from '../../core/model';

describe('SettingsPage – Konflikte beim Zusammenführen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }],
    }).compileComponents();
  });

  it('fragt bei gleichnamigen Zetteln nach einer Wahl für alle und importiert damit', async () => {
    const store = TestBed.inject(ListsStore);
    store.addExisting(createList('Einkauf', 'none'));
    const backup = TestBed.inject(BackupService);
    vi.spyOn(backup, 'autoBackup').mockResolvedValue();
    const incoming = [
      { ...createList('einkauf', 'none'), tasks: [createTask('Milch', 'm')] },
      createList('Garten', 'none'),
    ];
    const json = JSON.stringify({
      app: 'faden',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-03-12T09:00:00.000Z',
      settings: { theme: 'system', language: 'en', schemaVersion: SCHEMA_VERSION },
      lists: incoming,
      templates: [],
    });

    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([json], 'b.json')] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(root.querySelector('dialog')!.open).toBe(true));
    await fixture.whenStable();

    const button = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent?.trim() === label)!;
    button('Merge').click();
    await fixture.whenStable();
    expect(root.querySelector('dialog')!.textContent).toContain('This list already exists:');
    expect(root.querySelector('.conflicts')!.textContent).toContain('einkauf');
    const radios = root.querySelectorAll<HTMLInputElement>('input[name=strategy]');
    expect(radios).toHaveLength(4);
    expect(radios[0]!.checked).toBe(true);

    radios[2]!.click(); // Nicht importieren
    await fixture.whenStable();
    button('Import').click();
    await vi.waitFor(() => expect(store.allItems()).toHaveLength(2));
    expect(store.allItems().map((l) => l.title)).toEqual(['Einkauf', 'Garten']);
    expect(store.allItems()[0]!.tasks).toEqual([]);
  });
});
