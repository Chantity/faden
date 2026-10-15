import { TestBed } from '@angular/core/testing';
import { TemplatesStore } from './templates.store';
import { FadenDb } from '../storage';
import type { Template } from '../model';

const template = (id: string, title: string, createdAt = '2026-01-01T00:00:00.000Z'): Template => ({
  id,
  title,
  timeboxMode: 'none',
  createdAt,
  tasks: [{ id: `${id}-t`, title: 'ToDo' }],
  edges: [],
});

describe('TemplatesStore – eindeutige Namen', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FadenDb, useFactory: () => new FadenDb() }] });
  });

  it('macht neue Vorlagen mit vergebenem Namen eindeutig und meldet vergebene Namen', () => {
    const store = TestBed.inject(TemplatesStore);
    store.add(template('a', 'Einkauf'));
    const second = store.add(template('b', 'einkauf'));
    expect(second.title).toBe('einkauf (2)');
    expect(store.isTitleTaken(' EINKAUF ')).toBe(true);
    expect(store.isTitleTaken('Einkauf', 'a')).toBe(false); // der eigene Name zählt nicht
  });

  it('bereinigt Duplikate beim Ersetzen (Import); die ältere Vorlage behält den Namen', async () => {
    const store = TestBed.inject(TemplatesStore);
    await store.replaceAll([
      template('neu', 'Morgen', '2026-03-01T00:00:00.000Z'),
      template('alt', 'Morgen', '2026-01-01T00:00:00.000Z'),
    ]);
    expect(store.templates().map((t) => [t.id, t.title])).toEqual([
      ['neu', 'Morgen (2)'],
      ['alt', 'Morgen'],
    ]);
  });

  it('Wiederherstellen nach dem Löschen nimmt einen inzwischen vergebenen Namen nicht doppelt', async () => {
    const store = TestBed.inject(TemplatesStore);
    store.add(template('a', 'Einkauf'));
    const removed = (await store.remove('a'))!;
    store.add(template('b', 'Einkauf'));
    await store.restore(removed);
    expect(store.templates().map((t) => t.title).sort()).toEqual(['Einkauf', 'Einkauf (2)']);
  });
});
