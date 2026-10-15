import type { AppSettings, Template, TodoList } from '../model';

export const DB_NAME = 'faden';
export const DB_VERSION = 1;

export type StoreName = 'lists' | 'templates' | 'settings' | 'meta';

interface KeyValueRecord {
  key: string;
  value: unknown;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
  });
}

/**
 * Dünner, promise-basierter Wrapper um IndexedDB.
 * Bewusst ohne externe Bibliothek. Transaktionen werden erst nach dem
 * Öffnen erzeugt und dann synchron befüllt, um Auto-Commit zu vermeiden.
 */
export class FadenDb {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly name: string = DB_NAME,
    private readonly version: number = DB_VERSION,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.reject(new Error('IndexedDB ist in dieser Umgebung nicht verfügbar.'));
      return this.dbPromise;
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('lists')) db.createObjectStore('lists', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden'));
      request.onblocked = () =>
        reject(new Error('IndexedDB ist durch einen anderen Tab blockiert.'));
    });
    return this.dbPromise;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.open();
    const tx = db.transaction(store, 'readonly');
    return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.open();
    const tx = db.transaction(store, 'readonly');
    return requestToPromise(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
  }

  async put(store: StoreName, value: unknown): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await txDone(tx);
  }

  async putAll(store: StoreName, values: readonly unknown[]): Promise<void> {
    if (values.length === 0) return;
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    for (const value of values) objectStore.put(value);
    await txDone(tx);
  }

  async remove(store: StoreName, key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await txDone(tx);
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await txDone(tx);
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const record = await this.get<KeyValueRecord>('settings', 'app');
    return record?.value as AppSettings | undefined;
  }

  async putSettings(settings: AppSettings): Promise<void> {
    await this.put('settings', { key: 'app', value: settings } satisfies KeyValueRecord);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const record = await this.get<KeyValueRecord>('meta', key);
    return record?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.put('meta', { key, value } satisfies KeyValueRecord);
  }

  async getLists(): Promise<TodoList[]> {
    return this.getAll<TodoList>('lists');
  }

  async getTemplates(): Promise<Template[]> {
    return this.getAll<Template>('templates');
  }
}
