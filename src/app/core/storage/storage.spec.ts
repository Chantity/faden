import {
  CHECKLIST_MAX_ITEMS,
  edgeId,
  SCHEMA_VERSION,
  TITLE_MAX_LENGTH,
  uniqueTitle,
  type AppSettings,
  type Task,
  type Template,
  type TodoList,
} from '../model';
import {
  applyImport,
  createBackup,
  findConflicts,
  resolveConflicts,
  validateBackup,
  type BackupFile,
} from './backup';
import { migrate, upgradeList, upgradeLists } from './migrations';
import manualTestData from '../../../../docs/manual-test-data.json';

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

describe('resolveConflicts', () => {
  const named = (id: string, title: string, updatedAt = NOW, sortOrder = 0): TodoList => ({
    ...list(id, [`${id}-t`], []),
    title,
    updatedAt,
    sortOrder,
  });
  const local = [named('l1', 'Einkauf', '2026-02-01T00:00:00.000Z', 0), named('l2', 'Bad', NOW, 1)];
  const incoming = [
    named('i1', 'einkauf ', '2026-03-01T00:00:00.000Z'), // neuer, nur andere Schreibweise
    named('l2', 'Bad', NOW), // gleicher Stand, gleiche ID
    named('i3', 'Garten'),
  ];

  it('findet Konflikte ohne Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(findConflicts(local, incoming)).toEqual(['einkauf ', 'Bad']);
  });

  it('suffix: alle dazu, eindeutige Namen und IDs', () => {
    const { lists, counts } = resolveConflicts(local, incoming, 'suffix');
    expect(lists.map((l) => l.title)).toEqual(['Einkauf', 'Bad', 'einkauf (2)', 'Bad (2)', 'Garten']);
    expect(new Set(lists.map((l) => l.id)).size).toBe(5);
    expect(counts).toEqual({ imported: 3, skipped: 0, overwritten: 0 });
  });

  it('overwrite: Inhalt ersetzt, ID und Position des lokalen Zettels bleiben', () => {
    const { lists, counts } = resolveConflicts(local, incoming, 'overwrite');
    expect(lists).toHaveLength(3);
    expect(lists[0]).toMatchObject({ id: 'l1', sortOrder: 0, title: 'einkauf ' });
    expect(lists[0]!.tasks[0]!.id).toBe('i1-t');
    expect(lists[1]).toMatchObject({ id: 'l2', sortOrder: 1 });
    expect(lists[2]).toMatchObject({ id: 'i3', title: 'Garten', sortOrder: 2 });
    expect(counts).toEqual({ imported: 1, skipped: 0, overwritten: 2 });
  });

  it('skip: gleichnamige werden übersprungen, lokale bleiben unverändert', () => {
    const { lists, counts } = resolveConflicts(local, incoming, 'skip');
    expect(lists.slice(0, 2)).toEqual(local);
    expect(lists.map((l) => l.title)).toEqual(['Einkauf', 'Bad', 'Garten']);
    expect(counts).toEqual({ imported: 1, skipped: 2, overwritten: 0 });
  });

  it('newer: ersetzt nur bei neuerem updatedAt; Gleichstand wird übersprungen', () => {
    const { lists, counts } = resolveConflicts(local, incoming, 'newer');
    expect(lists[0]!.tasks[0]!.id).toBe('i1-t');
    expect(lists[1]).toEqual(local[1]);
    expect(counts).toEqual({ imported: 1, skipped: 1, overwritten: 1 });
  });

  it('ersetzt einen lokalen Zettel höchstens einmal', () => {
    const twice = [named('a', 'Einkauf', '2026-05-01T00:00:00.000Z'), named('b', 'EINKAUF', '2026-06-01T00:00:00.000Z')];
    const { lists, counts } = resolveConflicts(local, twice, 'overwrite');
    expect(lists.map((l) => l.title)).toEqual(['Einkauf', 'Bad', 'EINKAUF (2)']);
    expect(counts).toEqual({ imported: 1, skipped: 0, overwritten: 1 });
  });

  it('Roundtrip: eigenes Backup mit „Nicht importieren" zusammenführen ändert nichts', () => {
    const backup = createBackup(settings, local, [], NOW);
    const result = applyImport(JSON.parse(JSON.stringify(backup)), { lists: local, templates: [] }, 'merge', 'skip');
    expect(result.lists).toEqual(local);
    expect(result.counts).toEqual({ imported: 0, skipped: 2, overwritten: 0 });
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

describe('Migration auf Schema 3 (Ende → Dauer, eindeutige Namen)', () => {
  function oldTask(fields: Record<string, unknown>): Record<string, unknown> {
    return { id: 't', title: 'T', done: false, ...fields };
  }
  function oldList(mode: string, tasks: Record<string, unknown>[]): Record<string, unknown> {
    return { ...list('l', [], []), timeboxMode: mode, tasks };
  }
  function migratedTask(mode: string, fields: Record<string, unknown>): Record<string, unknown> {
    const out = upgradeList(oldList(mode, [oldTask(fields)]));
    return (out['tasks'] as Record<string, unknown>[])[0]!;
  }

  it('Tagesplan: Dauer = Bis − Von, Bis entfällt', () => {
    const task = migratedTask('dayPlan', { dayStart: '09:00', dayEnd: '10:30' });
    expect(task).toEqual(oldTask({ dayStart: '09:00', estimateMinutes: 90 }));
  });

  it('fester Zeitplan: Dauer auch über Mitternacht und mehrere Tage', () => {
    const task = migratedTask('schedule', { startAt: '2026-03-12T23:00', endAt: '2026-03-14T01:00' });
    expect(task).toEqual(oldTask({ startAt: '2026-03-12T23:00', estimateMinutes: 26 * 60 }));
  });

  it('der Plan des aktiven Modus gewinnt gegen eine abweichende Schätzung', () => {
    const fields = { estimateMinutes: 10, dayStart: '09:00', dayEnd: '09:45' };
    expect(migratedTask('dayPlan', fields)['estimateMinutes']).toBe(45);
    // Im Modus „Zeitschätzung" bleibt die Schätzung.
    expect(migratedTask('estimate', fields)['estimateMinutes']).toBe(10);
  });

  it('nur ein Ende: Start = Ende − Schätzung (sonst 15 Min)', () => {
    expect(migratedTask('dayPlan', { dayEnd: '10:00', estimateMinutes: 30 })).toEqual(
      oldTask({ dayStart: '09:30', estimateMinutes: 30 }),
    );
    expect(migratedTask('schedule', { endAt: '2026-03-12T10:00' })).toEqual(
      oldTask({ startAt: '2026-03-12T09:45', estimateMinutes: 15 }),
    );
  });

  it('ungültige Spanne (Bis ≤ Von) liefert keine Dauer', () => {
    expect(migratedTask('dayPlan', { dayStart: '10:00', dayEnd: '09:00' })).toEqual(
      oldTask({ dayStart: '10:00' }),
    );
  });

  it('ist idempotent und lässt aktuelle Daten unverändert (gleiche Objekte)', () => {
    const current = oldList('dayPlan', [oldTask({ dayStart: '09:00', estimateMinutes: 30 })]);
    expect(upgradeList(current)).toBe(current);
  });

  it('macht doppelte Namen eindeutig; der ältere Zettel behält den Namen', () => {
    const older = { ...list('a', [], []), title: 'Einkauf', createdAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...list('b', [], []), title: 'einkauf ', createdAt: '2026-02-01T00:00:00.000Z' };
    const deleted = { ...list('c', [], []), title: 'Einkauf', deletedAt: NOW };
    const out = upgradeLists([newer, older, deleted]);
    expect(out.map((l) => l.title)).toEqual(['einkauf (2)', 'Einkauf', 'Einkauf']);
  });

  it('migrate() hebt Backups älterer Schemata an', () => {
    const data = {
      schemaVersion: 2,
      lists: [oldList('dayPlan', [oldTask({ dayStart: '09:00', dayEnd: '09:30' })])],
      templates: [oldList('dayPlan', [oldTask({ dayStart: '08:00', dayEnd: '08:15' })])],
    };
    const result = migrate(data) as { lists: Record<string, unknown>[]; templates: Record<string, unknown>[] };
    expect((result.lists[0]!['tasks'] as Task[])[0]!.estimateMinutes).toBe(30);
    expect((result.templates[0]!['tasks'] as Task[])[0]!.estimateMinutes).toBe(15);
  });
});

describe('uniqueTitle', () => {
  it('lässt freie Namen unverändert und zählt sonst hoch', () => {
    expect(uniqueTitle('Einkauf', ['Putzen'])).toBe('Einkauf');
    expect(uniqueTitle('Einkauf', ['einkauf'])).toBe('Einkauf (2)');
    expect(uniqueTitle('Einkauf', ['Einkauf', 'Einkauf (2)'])).toBe('Einkauf (3)');
    expect(uniqueTitle('Einkauf (2)', ['Einkauf', 'Einkauf (2)'])).toBe('Einkauf (3)');
  });

  it('bleibt innerhalb der Titel-Höchstlänge', () => {
    const long = 'x'.repeat(TITLE_MAX_LENGTH);
    const result = uniqueTitle(long, [long]);
    expect(result.length).toBe(TITLE_MAX_LENGTH);
    expect(result.endsWith(' (2)')).toBe(true);
  });
});

describe('docs/manual-test-data.json', () => {
  it('ist ein gültiges, aktuelles Backup (sonst ist die manuelle Testsuite veraltet)', () => {
    const result = validateBackup(manualTestData);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    expect(result.value.lists).toHaveLength(manualTestData.lists.length);
    expect(result.value.templates).toHaveLength(manualTestData.templates.length);
    // Absichtlich doppelter Name (⑨): wird beim Laden eindeutig gemacht.
    expect(upgradeLists(result.value.lists).map((l) => l.title)).toContain('⑨ doppelter name (2)');
  });
});

describe('validateBackup – Checkliste', () => {
  function withChecklist(checklist: unknown): unknown {
    const l = list('l1', ['a'], []);
    return createBackupLike([{ ...l, tasks: [{ ...l.tasks[0]!, checklist }] }]);
  }
  function createBackupLike(lists: unknown[]): unknown {
    return { app: 'faden', schemaVersion: SCHEMA_VERSION, exportedAt: NOW, settings, lists, templates: [] };
  }

  it('übernimmt gültige Checklisten', () => {
    const result = validateBackup(withChecklist([{ id: '1', text: 'Milch', done: true }]));
    expect(result.ok && result.value.lists[0]!.tasks[0]!.checklist).toEqual([
      { id: '1', text: 'Milch', done: true },
    ]);
  });

  it('lehnt leere Punkte und zu lange Listen ab', () => {
    for (const bad of [
      [{ id: '1', text: '  ', done: false }],
      Array.from({ length: CHECKLIST_MAX_ITEMS + 1 }, (_, i) => ({ id: `${i}`, text: 'x', done: false })),
      'keine Liste',
    ]) {
      const result = validateBackup(withChecklist(bad));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]?.code).toBe('checklist-invalid');
    }
  });
});
