import { inject, Injectable, signal } from '@angular/core';
import type { Template } from '../model';
import { FadenDb } from '../storage';

/** Signal-Store für Vorlagen (SPEC 5.6). Ausbau erfolgt in Phase 3. */
@Injectable({ providedIn: 'root' })
export class TemplatesStore {
  private readonly db = inject(FadenDb);

  readonly templates = signal<Template[]>([]);

  async load(): Promise<void> {
    try {
      this.templates.set(await this.db.getTemplates());
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleibt die Liste leer.
    }
  }

  async replaceAll(templates: readonly Template[]): Promise<void> {
    this.templates.set([...templates]);
    await this.db.clear('templates');
    await this.db.putAll('templates', templates);
  }
}
