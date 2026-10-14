import { computed, inject, Injectable, signal } from '@angular/core';
import {
  createList,
  edgeId,
  type Task,
  type TimeboxMode,
  type TodoList,
} from '../model';
import { FadenDb } from '../storage';
import { withTimeboxMode } from '../time';
import { History } from './history';

const CHANNEL_NAME = 'faden';
const PERSIST_DELAY_MS = 300;

/**
 * Zentraler Signal-Store für Zettel (SPEC 8). Schreibt entprellt nach
 * IndexedDB, hält Undo/Redo und synchronisiert mehrere Tabs über BroadcastChannel.
 */
@Injectable({ providedIn: 'root' })
export class ListsStore {
  private readonly db = inject(FadenDb);
  private readonly all = signal<TodoList[]>([]);
  private readonly history = new History<TodoList[]>(100);

  private persistedIds = new Set<string>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private loaded = false;

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly saveError = signal(false);

  readonly lists = computed(() =>
    this.all()
      .filter((l) => !l.archived)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  readonly archived = computed(() =>
    this.all()
      .filter((l) => l.archived)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  constructor() {
    this.installSync();
  }

  // --- Laden / Speichern ---------------------------------------------------

  async load(): Promise<void> {
    try {
      const stored = await this.db.getLists();
      // Ältere Tagespläne ohne Bezugstag: ab heute gültig (SPEC 7.3).
      const lists = stored.map((l) => withTimeboxMode(l, l.timeboxMode, new Date()));
      this.all.set(lists);
      this.persistedIds = new Set(stored.map((l) => l.id));
      if (lists.some((l, i) => l !== stored[i])) this.schedulePersist();
    } catch {
      // Ohne IndexedDB (z. B. Tests) startet der Store leer und ohne Persistenz.
      this.loaded = false;
      this.syncHistoryFlags();
      return;
    }
    this.loaded = true;
    this.history.clear();
    this.syncHistoryFlags();
  }

  private schedulePersist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.persistNow();
    }, PERSIST_DELAY_MS);
  }

  /** Sofort schreiben (z. B. bei visibilitychange/pagehide, SPEC 8.2). */
  async flush(): Promise<void> {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistNow();
  }

  private async persistNow(): Promise<void> {
    if (!this.loaded) return;
    const current = this.all();
    const currentIds = new Set(current.map((l) => l.id));
    try {
      for (const id of this.persistedIds) {
        if (!currentIds.has(id)) await this.db.remove('lists', id);
      }
      await this.db.putAll('lists', current);
      this.persistedIds = currentIds;
      this.saveError.set(false);
      this.postChange();
    } catch {
      this.saveError.set(true);
    }
  }

  // --- Mutationen ----------------------------------------------------------

  getList(id: string): TodoList | undefined {
    return this.all().find((l) => l.id === id);
  }

  /**
   * Wendet eine reine Graph-/Task-Änderung auf genau einen Zettel an (ein
   * Undo-Schritt). Wirft die Änderungsfunktion (z. B. GraphError), bleiben die
   * Daten unverändert.
   */
  editList(id: string, change: (list: TodoList) => TodoList): void {
    const current = this.getList(id);
    if (!current) return;
    const updated = change(current);
    const now = new Date().toISOString();
    this.commit((lists) => lists.map((l) => (l.id === id ? { ...updated, updatedAt: now } : l)));
  }

  private commit(mutator: (lists: TodoList[]) => TodoList[]): void {
    this.history.push(this.all());
    this.all.set(mutator(this.all()));
    this.syncHistoryFlags();
    this.schedulePersist();
  }

  create(title: string, timeboxMode: TimeboxMode = 'none'): string {
    const list = withTimeboxMode(createList(title), timeboxMode, new Date());
    list.sortOrder = this.nextSortOrder();
    this.commit((lists) => [...lists, list]);
    return list.id;
  }

  rename(id: string, title: string): void {
    this.commit((lists) =>
      lists.map((l) => (l.id === id ? { ...l, title, updatedAt: new Date().toISOString() } : l)),
    );
  }

  setTimeboxMode(id: string, timeboxMode: TimeboxMode): void {
    this.commit((lists) =>
      lists.map((l) =>
        l.id === id
          ? { ...withTimeboxMode(l, timeboxMode, new Date()), updatedAt: new Date().toISOString() }
          : l,
      ),
    );
  }

  /** Titel und Modus in einem Schritt (ein Undo-Schritt). */
  update(id: string, changes: { title: string; timeboxMode: TimeboxMode }): void {
    const now = new Date().toISOString();
    this.commit((lists) =>
      lists.map((l) =>
        l.id === id
          ? {
              ...withTimeboxMode(l, changes.timeboxMode, new Date()),
              title: changes.title,
              updatedAt: now,
            }
          : l,
      ),
    );
  }

  duplicate(id: string): string | undefined {
    const source = this.all().find((l) => l.id === id);
    if (!source) return undefined;
    const copy = this.cloneList(source);
    copy.title = `${source.title} (Kopie)`;
    copy.sortOrder = this.nextSortOrder();
    this.commit((lists) => [...lists, copy]);
    return copy.id;
  }

  archive(id: string): void {
    this.commit((lists) =>
      lists.map((l) =>
        l.id === id ? { ...l, archived: true, updatedAt: new Date().toISOString() } : l,
      ),
    );
  }

  restore(id: string): void {
    this.commit((lists) =>
      lists.map((l) =>
        l.id === id ? { ...l, archived: false, updatedAt: new Date().toISOString() } : l,
      ),
    );
  }

  remove(id: string): void {
    this.commit((lists) => lists.filter((l) => l.id !== id));
  }

  /** Fügt einen fertig aufgebauten neuen Zettel (z. B. aus einer Vorlage) unten an. */
  addNew(list: TodoList): string {
    const added = { ...list, sortOrder: this.nextSortOrder() };
    this.commit((lists) => [...lists, added]);
    return added.id;
  }

  /** Rückgängig-/Wiederholen-gerechte Wiederherstellung eines ganzen Zettels. */
  addExisting(list: TodoList): void {
    this.commit((lists) => [...lists, list]);
  }

  move(id: string, direction: 'up' | 'down'): void {
    const ordered = this.lists();
    const index = ordered.findIndex((l) => l.id === id);
    const other = direction === 'up' ? index - 1 : index + 1;
    const neighbor = ordered[other];
    const current = ordered[index];
    if (!current || !neighbor) return;
    this.commit((lists) =>
      lists.map((l) => {
        if (l.id === current.id) return { ...l, sortOrder: neighbor.sortOrder };
        if (l.id === neighbor.id) return { ...l, sortOrder: current.sortOrder };
        return l;
      }),
    );
  }

  // --- Undo / Redo ---------------------------------------------------------

  undo(): boolean {
    const previous = this.history.undo(this.all());
    if (previous === undefined) return false;
    this.all.set(previous);
    this.syncHistoryFlags();
    this.schedulePersist();
    return true;
  }

  redo(): boolean {
    const next = this.history.redo(this.all());
    if (next === undefined) return false;
    this.all.set(next);
    this.syncHistoryFlags();
    this.schedulePersist();
    return true;
  }

  // --- Import --------------------------------------------------------------

  /** Alle Zettel inkl. archivierter (für Export/Backup). */
  allItems(): TodoList[] {
    return this.all();
  }

  replaceAll(lists: readonly TodoList[]): void {
    this.history.push(this.all());
    this.all.set([...lists]);
    this.syncHistoryFlags();
    this.schedulePersist();
  }

  // --- Intern --------------------------------------------------------------

  private nextSortOrder(): number {
    return this.all().reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.history.canUndo());
    this.canRedo.set(this.history.canRedo());
  }

  private cloneList(source: TodoList): TodoList {
    const now = new Date().toISOString();
    const idMap = new Map<string, string>();
    const tasks: Task[] = source.tasks.map((t) => {
      const id = crypto.randomUUID();
      idMap.set(t.id, id);
      return { ...structuredClone(t), id };
    });
    const edges = source.edges.map((e) => {
      const from = idMap.get(e.from) ?? e.from;
      const to = idMap.get(e.to) ?? e.to;
      return { id: edgeId(from, to), from, to };
    });
    return {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      tasks,
      edges,
      createdAt: now,
      updatedAt: now,
    };
  }

  private installSync(): void {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent) => {
        if (event.data && (event.data as { type?: string }).type === 'lists-changed') {
          void this.reloadFromStorage();
        }
      };
    }

    const flush = () => void this.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush();
    });
    window.addEventListener('focus', () => void this.reloadFromStorage());
  }

  private postChange(): void {
    this.channel?.postMessage({ type: 'lists-changed', at: Date.now() });
  }

  private async reloadFromStorage(): Promise<void> {
    try {
      const lists = await this.db.getLists();
      if (maxUpdated(lists) !== maxUpdated(this.all())) {
        this.all.set(lists);
        this.persistedIds = new Set(lists.map((l) => l.id));
        this.syncHistoryFlags();
      }
    } catch {
      // Ohne IndexedDB (z. B. Tests) nichts zu tun.
    }
  }
}

function maxUpdated(lists: readonly TodoList[]): string {
  return lists.reduce((max, l) => (l.updatedAt > max ? l.updatedAt : max), '');
}
