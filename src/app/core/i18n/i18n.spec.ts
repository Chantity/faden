import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../model';
import { DICTIONARIES, dictionaryFor } from './dictionaries';
import { describeBackupIssue } from './backup-error';

describe('i18n dictionaries', () => {
  it('Standardsprache ist Englisch', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('de');
  });

  it('enthält für jede unterstützte Sprache ein vollständiges Wörterbuch', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale]).toBeDefined();
    }
    // Gleiche Schlüsselstruktur (de als Referenz).
    expect(Object.keys(DICTIONARIES.en).sort()).toEqual(Object.keys(DICTIONARIES.de).sort());
    expect(Object.keys(DICTIONARIES.en.lists).sort()).toEqual(
      Object.keys(DICTIONARIES.de.lists).sort(),
    );
    expect(Object.keys(DICTIONARIES.en.titles).sort()).toEqual(
      Object.keys(DICTIONARIES.de.titles).sort(),
    );
  });

  it('fällt bei unbekannter Sprache auf Englisch zurück', () => {
    expect(dictionaryFor('xx' as never)).toBe(DICTIONARIES.en);
  });

  it('liefert das jeweilige Wörterbuch', () => {
    expect(dictionaryFor('de')).toBe(DICTIONARIES.de);
    expect(dictionaryFor('en')).toBe(DICTIONARIES.en);
  });
});

describe('describeBackupIssue', () => {
  it('übersetzt Befunde samt Fundstelle in beide Sprachen', () => {
    const issue = {
      code: 'task-no-title',
      at: { kind: 'list', index: 2, part: { kind: 'task', index: 3 } },
    } as const;
    expect(describeBackupIssue(DICTIONARIES.de, issue)).toBe('Zettel 2 / ToDo 3: ToDo ohne Titel.');
    expect(describeBackupIssue(DICTIONARIES.en, issue)).toBe('List 2 / Todo 3: Todo without a title.');
    expect(describeBackupIssue(DICTIONARIES.en, { code: 'json' })).toBe('The file is not readable JSON.');
    expect(
      describeBackupIssue(DICTIONARIES.de, {
        code: 'graph',
        graph: 'cycle',
        at: { kind: 'template', index: 1 },
      }),
    ).toContain('Vorlage 1: Die Pfeile bilden einen Kreis');
  });
});
