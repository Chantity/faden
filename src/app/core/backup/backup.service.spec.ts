import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { FadenDb } from '../storage';
import { SettingsStore } from '../state/settings.store';
import { ListsStore } from '../state/lists.store';
import { TemplatesStore } from '../state/templates.store';
import {
  SCHEMA_VERSION,
  createList,
  createTask,
  type AppSettings,
  type Template,
  type TodoList,
} from '../model';

class FakeDb {
  private settings: AppSettings | undefined;
  private readonly meta = new Map<string, unknown>();

  async getSettings(): Promise<AppSettings | undefined> {
    return this.settings;
  }
  async putSettings(value: AppSettings): Promise<void> {
    this.settings = value;
  }
  async getMeta<T>(key: string): Promise<T | undefined> {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta(key: string, value: unknown): Promise<void> {
    this.meta.set(key, value);
  }
  async getAll<T>(): Promise<T[]> {
    return [];
  }
}

function backupJson(lists: TodoList[], templates: Template[] = []): string {
  return JSON.stringify({
    app: 'faden',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-03-12T09:00:00.000Z',
    settings: { theme: 'system', language: 'en', schemaVersion: SCHEMA_VERSION },
    lists,
    templates,
  });
}

function file(json: string): File {
  return new File([json], 'faden-backup.json', { type: 'application/json' });
}

describe('BackupService', () => {
  beforeEach(() => {
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = () => 'blob:test';
      URL.revokeObjectURL = () => undefined;
    }
    TestBed.configureTestingModule({
      providers: [{ provide: FadenDb, useValue: new FakeDb() as unknown as FadenDb }],
    });
  });

  it('meldet zunächst kein Backup und berechnet Tage seit dem Backup', async () => {
    const backup = TestBed.inject(BackupService);
    expect(backup.daysSinceBackup(new Date('2026-03-12T12:00:00Z'))).toBeNull();

    await TestBed.inject(SettingsStore).markBackup('2026-03-01T00:00:00.000Z');
    expect(backup.daysSinceBackup(new Date('2026-03-12T12:00:00Z'))).toBe(11);
  });

  it('schlägt das Hinweisband ohne Daten nicht vor', async () => {
    const backup = TestBed.inject(BackupService);
    expect(await backup.shouldShowReminder(new Date(), false)).toBe(false);
  });

  it('zeigt das Hinweisband ohne Backup bei vorhandenen Daten', async () => {
    const backup = TestBed.inject(BackupService);
    expect(await backup.shouldShowReminder(new Date('2026-03-12T12:00:00Z'), true)).toBe(true);
  });

  it('blendet das Hinweisband nach dem Wegklicken eine Woche aus', async () => {
    const backup = TestBed.inject(BackupService);
    const now = new Date('2026-03-12T12:00:00Z');
    await backup.dismissReminder(now);
    expect(await backup.shouldShowReminder(now, true)).toBe(false);
    expect(await backup.shouldShowReminder(new Date('2026-03-15T12:00:00Z'), true)).toBe(false);
    expect(await backup.shouldShowReminder(new Date('2026-03-20T12:00:00Z'), true)).toBe(true);
  });

  it('führt beim Import zusammen, ohne bestehende Daten zu verlieren', async () => {
    const lists = TestBed.inject(ListsStore);
    lists.addExisting(createList('Vorhanden', 'none'));

    const imported = createList('Importiert', 'none');
    imported.tasks = [createTask('Neu', 't1')];

    const outcome = await TestBed.inject(BackupService).importFile(
      file(backupJson([imported])),
      'merge',
    );

    expect(outcome.ok).toBe(true);
    expect(lists.allItems().map((l) => l.title).sort()).toEqual(['Importiert', 'Vorhanden']);
  });

  it('ersetzt beim Import alle vorhandenen Daten', async () => {
    const lists = TestBed.inject(ListsStore);
    lists.addExisting(createList('Alt', 'none'));

    const imported = createList('Neu', 'none');
    const outcome = await TestBed.inject(BackupService).importFile(
      file(backupJson([imported])),
      'replace',
    );

    expect(outcome.ok).toBe(true);
    expect(lists.allItems().map((l) => l.title)).toEqual(['Neu']);
  });

  it('lehnt fehlerhaftes JSON ab', async () => {
    const outcome = await TestBed.inject(BackupService).importFile(file('kein json'), 'merge');
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toContainEqual({ code: 'json' });
  });

  it('lehnt eine fremde Datei ab', async () => {
    const outcome = await TestBed.inject(BackupService).importFile(
      file(JSON.stringify({ app: 'other' })),
      'merge',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.length).toBeGreaterThan(0);
  });
});
