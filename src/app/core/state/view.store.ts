import { inject, Injectable, signal } from '@angular/core';
import { FadenDb } from '../storage';

export type ListView = 'focus' | 'flow';

/**
 * Merkt sich pro Zettel die zuletzt gewählte Ansicht „Jetzt dran“ / „Ablauf“
 * (SPEC 5.1). Persistenz über den meta-Store, best-effort.
 */
@Injectable({ providedIn: 'root' })
export class ViewStore {
  private readonly db = inject(FadenDb);
  private readonly all = signal<Record<string, ListView>>({});
  private loaded = false;

  async load(): Promise<void> {
    try {
      const stored = await this.db.getMeta<Record<string, ListView>>('listView');
      if (stored) this.all.set(stored);
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleibt die Auswahl sitzungsbezogen.
    }
    this.loaded = true;
  }

  view(listId: string): ListView {
    return this.all()[listId] ?? 'focus';
  }

  set(listId: string, view: ListView): void {
    this.all.update((map) => ({ ...map, [listId]: view }));
    if (!this.loaded) return;
    void this.db.setMeta('listView', this.all()).catch(() => undefined);
  }
}
