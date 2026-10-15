import { TestBed } from '@angular/core/testing';
import { SettingsStore } from './settings.store';
import { FadenDb } from '../storage';
import { createList, SCHEMA_VERSION, type AppSettings } from '../model';

/** Kleiner Ersatz für IndexedDB: nur, was SettingsStore.load() braucht. */
function fakeDb(stored: { settings?: AppSettings; lists?: number }) {
  return {
    getSettings: async () => stored.settings,
    getLists: async () => Array.from({ length: stored.lists ?? 0 }, (_, i) => createList(`Z${i}`)),
    getTemplates: async () => [],
    putSettings: async () => undefined,
  };
}

function setup(stored: { settings?: AppSettings; lists?: number } = {}): SettingsStore {
  TestBed.configureTestingModule({ providers: [{ provide: FadenDb, useValue: fakeDb(stored) }] });
  return TestBed.inject(SettingsStore);
}

describe('SettingsStore – einfacher Modus', () => {
  it('ist bei einer neuen Installation an', async () => {
    const store = setup();
    await store.load();
    expect(store.simpleEnabled()).toBe(true);
    expect(store.simple()('flowMenu')).toBe(true);
  });

  it('ist bei bestehenden Daten aus (Zettel oder gespeicherte Einstellungen)', async () => {
    const withLists = setup({ lists: 2 });
    await withLists.load();
    expect(withLists.simpleEnabled()).toBe(false);

    TestBed.resetTestingModule();
    const withSettings = setup({ settings: { theme: 'dark', language: 'de', schemaVersion: SCHEMA_VERSION } });
    await withSettings.load();
    expect(withSettings.simpleEnabled()).toBe(false);
  });

  it('blendet einzelne Funktionen trotz einfachem Modus wieder ein', async () => {
    const store = setup();
    await store.load();
    await store.setSimpleShow('templatesTab', true);
    expect(store.simple()('templatesTab')).toBe(false);
    expect(store.simple()('listMenu')).toBe(true);

    await store.setSimpleEnabled(false);
    expect(store.simple()('listMenu')).toBe(false);
    await store.setSimpleEnabled(true);
    expect(store.simple()('templatesTab')).toBe(false); // Auswahl bleibt erhalten
  });
});

describe('SettingsStore – Farbschemata', () => {
  afterEach(() => document.documentElement.removeAttribute('style'));

  it('dupliziert das Standardschema, wendet ein eigenes an und fällt nach dem Löschen zurück', async () => {
    const store = setup();
    const copy = await store.duplicateScheme(store.defaultScheme().id);
    expect(copy.name).toBe('Sage (2)');
    expect(store.schemes()).toHaveLength(2);

    await store.saveScheme({ ...copy, primary: { light: '#123456', dark: '#abcdef' } });
    await store.setActiveScheme(copy.id);
    TestBed.tick();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toContain('#123456');

    await store.deleteScheme(copy.id);
    TestBed.tick();
    expect(store.activeScheme().id).toBe(store.defaultScheme().id);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('kennt vergebene Namen, auch den des Standardschemas', () => {
    const store = setup();
    expect(store.isSchemeNameTaken(' sage ')).toBe(true);
    expect(store.isSchemeNameTaken('Meer')).toBe(false);
  });
});
