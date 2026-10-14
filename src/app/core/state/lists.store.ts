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
import { CommandHistory, History } from './history';

const CHANNEL_NAME = 'faden';
const PERSIST_DELAY_MS = 300;
const UNDO_LIMIT = 100;

/**
 * Frist, nach der ein gelöschter Zettel endgültig aus IndexedDB verschwindet
 * (SPEC 5.5). Etwas länger als das Hinweisband mit „Rückgängig" (8 s).
 */
export const DELETE_GRACE_MS = 10_000;

/**
 * Zentraler Signal-Store für Zettel (SPEC 8). Schreibt entprellt nach
 * IndexedDB und synchronisiert mehrere Tabs über BroadcastChannel.
 *
 * Rückgängig/Wiederholen (SPEC 5.5):
 * - **pro Zettel** ein eigener Verlauf (Snapshots) für alles, was im Zettel
 *   passiert (`editList`);
 * - **Übersicht** mit eigenem Befehls-Verlauf (Anlegen, Duplizieren,
 *   Archivieren, Löschen, Verschieben, Umbenennen, Import). Ein Befehl kehrt nur
 *   seine eigene Wirkung um und lässt spätere Änderungen im Zettel stehen.
 */
@Injectable({ providedIn: 'root' })
export class ListsStore {
  private readonly db = inject(FadenDb);
  /** Alle Zettel inkl. archivierter und (noch) gelöschter. */
  private readonly all = signal<TodoList[]>([]);
  private readonly listHistories = new Map<string, History<TodoList>>();
  private readonly overviewHistory = new CommandHistory(UNDO_LIMIT);
  /** Zählt Verlaufsänderungen, damit `canUndo`/`canRedo` reaktiv sind. */
  private readonly historyTick = signal(0);

  private persistedIds = new Set<string>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private purgeTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private loaded = false;

  readonly saveError = signal(false);

  private readonly visible = computed(() => this.all().filter((l) => !l.deletedAt));

  readonly lists = computed(() =>
    this.visible()
      .filter((l) => !l.archived)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  readonly archived = computed(() =>
    this.visible()
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
      // Gelöschte Zettel aus einer früheren Sitzung: Ihre Frist ist vorbei (der
      // Rückgängig-Verlauf existiert nicht mehr) → jetzt endgültig entfernen.
      // Ältere Tagespläne ohne Bezugstag: ab heute gültig (SPEC 7.3).
      const lists = stored
        .filter((l) => !l.deletedAt)
        .map((l) => withTimeboxMode(l, l.timeboxMode, new Date()));
      // Was schon vor dem Ende des Ladens angelegt wurde (schnelle Nutzer, langsames
      // erstes Öffnen der Datenbank), bleibt erhalten – samt Rückgängig-Verlauf.
      const storedIds = new Set(stored.map((l) => l.id));
      const early = this.all().filter((l) => !storedIds.has(l.id));
      this.all.set([...lists, ...early]);
      this.persistedIds = storedIds;
      this.loaded = true;
      if (early.length === 0) this.clearHistories();
      if (early.length > 0 || lists.length !== stored.length || lists.some((l, i) => l !== stored[i])) {
        this.schedulePersist();
      }
    } catch {
      // Ohne IndexedDB (z. B. Tests) startet der Store leer und ohne Persistenz.
      this.loaded = false;
      this.touchHistory();
    }
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

  // --- Lesen ---------------------------------------------------------------

  /** Ein sichtbarer (nicht gelöschter) Zettel. */
  getList(id: string): TodoList | undefined {
    return this.visible().find((l) => l.id === id);
  }

  /** Alle sichtbaren Zettel inkl. archivierter (für Export/Backup). */
  allItems(): TodoList[] {
    return this.visible();
  }

  // --- Änderungen in einem Zettel (Verlauf pro Zettel) ---------------------

  /**
   * Wendet eine reine Graph-/Task-Änderung auf genau einen Zettel an (ein
   * Undo-Schritt in dessen Verlauf). Wirft die Änderungsfunktion (z. B.
   * GraphError), bleiben die Daten unverändert.
   */
  editList(id: string, change: (list: TodoList) => TodoList): void {
    const current = this.getList(id);
    if (!current) return;
    const updated = change(current);
    this.historyOf(id).push(current);
    this.replace(id, () => ({ ...updated, updatedAt: new Date().toISOString() }));
    this.touchHistory();
  }

  rename(id: string, title: string): void {
    this.editList(id, (l) => ({ ...l, title }));
  }

  setTimeboxMode(id: string, timeboxMode: TimeboxMode): void {
    this.editList(id, (l) => withTimeboxMode(l, timeboxMode, new Date()));
  }

  // --- Änderungen in der Übersicht (Befehls-Verlauf) ------------------------

  create(title: string, timeboxMode: TimeboxMode = 'none'): string {
    return this.addNew(withTimeboxMode(createList(title), timeboxMode, new Date()));
  }

  /** Fügt einen fertig aufgebauten neuen Zettel (z. B. aus einer Vorlage) unten an. */
  addNew(list: TodoList): string {
    const added = { ...list, sortOrder: this.nextSortOrder() };
    this.insertListCommand(added);
    return added.id;
  }

  duplicate(id: string): string | undefined {
    const source = this.getList(id);
    if (!source) return undefined;
    const copy = this.cloneList(source);
    copy.title = `${source.title} (Kopie)`;
    copy.sortOrder = this.nextSortOrder();
    this.insertListCommand(copy);
    return copy.id;
  }

  /** Titel und Modus in einem Schritt (aus der Übersicht; ein Undo-Schritt dort). */
  update(id: string, changes: { title: string; timeboxMode: TimeboxMode }): void {
    const before = this.getList(id);
    if (!before) return;
    const old = listFields(before);
    const next = listFields({
      ...withTimeboxMode(before, changes.timeboxMode, new Date()),
      title: changes.title,
    });
    const apply = (values: ListFields) => () =>
      this.replace(id, (l) => ({ ...l, ...values, updatedAt: new Date().toISOString() }));
    this.run({ undo: apply(old), redo: apply(next) });
  }

  archive(id: string): void {
    this.setArchivedCommand(id, true);
  }

  restore(id: string): void {
    this.setArchivedCommand(id, false);
  }

  /**
   * Löschen mit Rückgängig (SPEC 5.5): Der Zettel wird zunächst nur als gelöscht
   * markiert (und so gespeichert) und erst nach `DELETE_GRACE_MS` endgültig
   * entfernt. Auch danach stellt „Rückgängig" in der Übersicht ihn wieder her.
   */
  remove(id: string): void {
    if (!this.getList(id)) return;
    let snapshot: TodoList | undefined;
    const softDelete = () => {
      snapshot = this.getList(id) ?? snapshot;
      this.replace(id, (l) => ({ ...l, deletedAt: new Date().toISOString() }));
      this.schedulePurge();
    };
    const bringBack = () => {
      if (this.all().some((l) => l.id === id)) {
        this.replace(id, ({ deletedAt: _deletedAt, ...l }) => l);
      } else if (snapshot) {
        this.setAll([...this.all(), snapshot]);
      }
    };
    this.run({ undo: bringBack, redo: softDelete });
  }

  move(id: string, direction: 'up' | 'down'): void {
    const ordered = this.lists();
    const index = ordered.findIndex((l) => l.id === id);
    const current = ordered[index];
    const neighbor = ordered[direction === 'up' ? index - 1 : index + 1];
    if (!current || !neighbor) return;
    const orders = (a: number, b: number) => () =>
      this.setAll(
        this.all().map((l) => {
          if (l.id === current.id) return { ...l, sortOrder: a };
          if (l.id === neighbor.id) return { ...l, sortOrder: b };
          return l;
        }),
      );
    this.run({
      undo: orders(current.sortOrder, neighbor.sortOrder),
      redo: orders(neighbor.sortOrder, current.sortOrder),
    });
  }

  /** Fügt einen Zettel ohne Verlaufseintrag hinzu (Testaufbau, Wiederherstellung). */
  addExisting(list: TodoList): void {
    this.setAll([...this.all().filter((l) => l.id !== list.id), list]);
  }

  /** Import (SPEC 8.5): ersetzt alle Zettel; in der Übersicht rückgängig machbar. */
  replaceAll(lists: readonly TodoList[]): void {
    const before = this.all();
    const after = [...lists];
    const apply = (value: TodoList[]) => () => {
      this.listHistories.clear();
      this.setAll(value);
    };
    this.run({ undo: apply(before), redo: apply(after) });
  }

  // --- Rückgängig / Wiederholen --------------------------------------------

  /** Mit `listId`: Verlauf dieses Zettels; ohne: Verlauf der Übersicht. */
  canUndo(listId?: string): boolean {
    this.historyTick();
    return listId
      ? (this.listHistories.get(listId)?.canUndo() ?? false)
      : this.overviewHistory.canUndo();
  }

  canRedo(listId?: string): boolean {
    this.historyTick();
    return listId
      ? (this.listHistories.get(listId)?.canRedo() ?? false)
      : this.overviewHistory.canRedo();
  }

  undo(listId?: string): boolean {
    const done = listId ? this.stepList(listId, 'undo') : this.overviewHistory.undo();
    this.touchHistory();
    return done;
  }

  redo(listId?: string): boolean {
    const done = listId ? this.stepList(listId, 'redo') : this.overviewHistory.redo();
    this.touchHistory();
    return done;
  }

  // --- Intern --------------------------------------------------------------

  private stepList(id: string, direction: 'undo' | 'redo'): boolean {
    const current = this.getList(id);
    const history = this.listHistories.get(id);
    if (!current || !history) return false;
    const target = direction === 'undo' ? history.undo(current) : history.redo(current);
    if (target === undefined) return false;
    // Archiv-Status und Reihenfolge gehören der Übersicht und bleiben, wie sie sind.
    this.replace(id, (l) => ({ ...target, archived: l.archived, sortOrder: l.sortOrder }));
    return true;
  }

  private historyOf(id: string): History<TodoList> {
    let history = this.listHistories.get(id);
    if (!history) {
      history = new History<TodoList>(UNDO_LIMIT);
      this.listHistories.set(id, history);
    }
    return history;
  }

  /** Führt einen Befehl aus und merkt ihn sich im Verlauf der Übersicht. */
  private run(command: { undo: () => void; redo: () => void }): void {
    command.redo();
    this.overviewHistory.record(command);
    this.touchHistory();
  }

  private insertListCommand(list: TodoList): void {
    let latest = list;
    this.run({
      undo: () => {
        latest = this.all().find((l) => l.id === list.id) ?? latest;
        this.setAll(this.all().filter((l) => l.id !== list.id));
      },
      redo: () => this.setAll([...this.all().filter((l) => l.id !== list.id), latest]),
    });
  }

  private setArchivedCommand(id: string, archived: boolean): void {
    if (!this.getList(id)) return;
    const apply = (value: boolean) => () =>
      this.replace(id, (l) => ({ ...l, archived: value, updatedAt: new Date().toISOString() }));
    this.run({ undo: apply(!archived), redo: apply(archived) });
  }

  private replace(id: string, change: (list: TodoList) => TodoList): void {
    this.setAll(this.all().map((l) => (l.id === id ? change(l) : l)));
  }

  private setAll(lists: TodoList[]): void {
    this.all.set(lists);
    this.schedulePersist();
  }

  private touchHistory(): void {
    this.historyTick.update((n) => n + 1);
  }

  private clearHistories(): void {
    this.listHistories.clear();
    this.overviewHistory.clear();
    this.touchHistory();
  }

  /** Entfernt gelöschte Zettel endgültig, sobald ihre Frist abgelaufen ist. */
  private schedulePurge(): void {
    if (this.purgeTimer !== null) clearTimeout(this.purgeTimer);
    this.purgeTimer = setTimeout(() => {
      this.purgeTimer = null;
      this.purgeExpired(Date.now());
    }, DELETE_GRACE_MS);
  }

  private purgeExpired(now: number): void {
    const expired = (l: TodoList) =>
      l.deletedAt !== undefined && now - new Date(l.deletedAt).getTime() >= DELETE_GRACE_MS;
    if (this.all().some(expired)) this.setAll(this.all().filter((l) => !expired(l)));
    // Später gelöschte Zettel bekommen eine weitere Runde.
    if (this.all().some((l) => l.deletedAt)) this.schedulePurge();
  }

  private nextSortOrder(): number {
    return this.all().reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
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
        // Ein anderer Tab hat geändert: alte Verläufe würden dessen Stand überschreiben.
        this.clearHistories();
      }
    } catch {
      // Ohne IndexedDB (z. B. Tests) nichts zu tun.
    }
  }
}

type ListFields = Pick<TodoList, 'title' | 'timeboxMode' | 'dayPlanReferenceDate'>;

function listFields(list: TodoList): ListFields {
  return {
    title: list.title,
    timeboxMode: list.timeboxMode,
    dayPlanReferenceDate: list.dayPlanReferenceDate,
  };
}

function maxUpdated(lists: readonly TodoList[]): string {
  return lists.reduce((max, l) => (l.updatedAt > max ? l.updatedAt : max), '');
}
