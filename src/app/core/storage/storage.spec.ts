import {
  edgeId,
  SCHEMA_VERSION,
  type AppSettings,
  type Task,
  type Template,
  type TodoList,
} from '../model';
import { applyImport, createBackup, validateBackup, type BackupFile } from './backup';
import { migrate } from './migrations';

const NOW = '2026-01-01T00:00:00.000Z';

const settings: AppSettings = { theme: 'system', language: 'en', schemaVersion: SCHEMA_VERSION };

function task(id: string): Task {
  return { id, title: `ToDo ${id}`, done: false };
}

function list(id: string, taskIds: string[], links: [string, string][]): TodoList {
  return {
    id,
    title: `Zettel ${id}`,
    timeboxMode: 'none',
    tasks: taskIds.map(task),
    edges: links.map(([from, to]) => ({ id: edgeId(from, to), from, to })),
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    sortOrder: 0,
  };
}

describe('createBackup / validateBackup', () => {
  it('Export → Import Roundtrip ist verlustfrei', () => {
    const lists = [list('l1', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c']])];
    const backup = createBackup(settings, lists, [], NOW);
    const result = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lists).toEqual(lists);
      expect(result.value.app).toBe('faden');
      expect(result.value.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it('lehnt fremde Dateien ab', () => {
    const result = validateBackup({ app: 'etwas-anderes', schemaVersion: 1, lists: [], templates: [] });
    expect(result.ok).toBe(false);
  });

  it('lehnt zyklische Graphen ab', () => {
    const bad = {
      app: 'faden',
      schemaVersion: 1,
      exportedAt: NOW,
      settings,
      templates: [],
      lists: [
        {
          ...list('l1', ['a', 'b'], []),
          edges: [
            { id: 'e1', from: 'a', to: 'b' },
            { id: 'e2', from: 'b', to: 'a' },
          ],
        },
      ],
    };
    const result = validateBackup(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: 'graph',
        at: { kind: 'list', index: 1 },
        graph: 'cycle',
      });
    }
  });

  it('lehnt Pfeile auf nicht existierende ToDos ab', () => {
    const bad = {
      app: 'faden',
      schemaVersion: 1,
      exportedAt: NOW,
      settings,
      templates: [],
      lists: [
        {
          ...list('l1', ['a'], []),
          edges: [{ id: 'e1', from: 'a', to: 'ghost' }],
        },
      ],
    };
    const result = validateBackup(bad);
    expect(result.ok).toBe(false);
  });

  it('lehnt zu neue Schema-Versionen ab', () => {
    const result = validateBackup({ app: 'faden', schemaVersion: 999, lists: [], templates: [] });
    expect(result.ok).toBe(false);
  });
});

describe('applyImport', () => {
  const existing: { lists: TodoList[]; templates: Template[] } = {
    lists: [list('l1', ['a'], [])],
    templates: [],
  };

  it('replace ersetzt alles', () => {
    const backup: BackupFile = createBackup(settings, [list('l1', ['x'], [])], [], NOW);
    const result = applyImport(backup, { lists: [list('l1', ['a'], [])], templates: [] }, 'replace');
    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]?.tasks[0]?.id).toBe('x');
  });

  it('merge behält Bestehendes und vergibt neue IDs bei Kollision', () => {
    const backup = createBackup(settings, [list('l1', ['x'], []), list('l2', ['y'], [])], [], NOW);
    const result = applyImport(backup, existing, 'merge');
    expect(result.lists).toHaveLength(3);
    // l1 kollidiert → neue ID, l2 bleibt.
    const ids = result.lists.map((l) => l.id);
    expect(ids).toContain('l2');
    expect(new Set(ids).size).toBe(3);
    // Inhalt des kollidierenden Zettels bleibt erhalten.
    const imported = result.lists.find((l) => l.tasks.some((t) => t.id === 'x'));
    expect(imported).toBeDefined();
  });
});

describe('migrate', () => {
  it('bringt Alt-Daten (v1) auf die aktuelle Version und ergänzt die Sprache', () => {
    const data = { schemaVersion: 1, settings: { theme: 'dark' }, lists: [], templates: [] };
    const result = migrate(data);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect((result.settings as Record<string, unknown>)['language']).toBe('en');
    expect((result.settings as Record<string, unknown>)['theme']).toBe('dark');
  });

  it('ist für die aktuelle Version die Identität', () => {
    const data = { schemaVersion: SCHEMA_VERSION, lists: [], templates: [] };
    expect(migrate(data)).toEqual(data);
  });

  it('wirft bei zukünftiger Version', () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow();
  });
});
