/**
 * Generischer Rückgängig/Wiederholen-Verlauf mit fester Obergrenze (SPEC 5.5).
 * Speichert Snapshots (immutable Werte). Redo wird bei einer neuen Änderung verworfen.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 100) {}

  /** Merkt sich den vorherigen Zustand vor einer Änderung. */
  push(previous: T): void {
    this.past.push(previous);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: T): T | undefined {
    const previous = this.past.pop();
    if (previous === undefined) return undefined;
    this.future.push(current);
    if (this.future.length > this.limit) this.future.shift();
    return previous;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    if (this.past.length > this.limit) this.past.shift();
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}

/** Eine rückgängig machbare Änderung, die nur genau ihre eigene Wirkung umkehrt. */
export interface Command {
  undo(): void;
  redo(): void;
}

/**
 * Rückgängig/Wiederholen als Befehle statt Snapshots (SPEC 5.5). Für die
 * Zettel-Übersicht: Ein Schritt dort (z. B. Archivieren) soll beim Rückgängig-
 * machen nicht nebenbei spätere Änderungen in einem Zettel verwerfen.
 */
export class CommandHistory {
  private past: Command[] = [];
  private future: Command[] = [];

  constructor(private readonly limit = 100) {}

  /** Merkt sich eine bereits ausgeführte Änderung. */
  record(command: Command): void {
    this.past.push(command);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(): boolean {
    const command = this.past.pop();
    if (!command) return false;
    command.undo();
    this.future.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.future.pop();
    if (!command) return false;
    command.redo();
    this.past.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
