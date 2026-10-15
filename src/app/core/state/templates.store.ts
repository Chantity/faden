import { inject, Injectable, signal } from '@angular/core';
import type { Template } from '../model';
import { FadenDb } from '../storage';

/** Signal-Store für Vorlagen. */
@Injectable({ providedIn: 'root' })
export class TemplatesStore {
  private readonly db = inject(FadenDb);

  readonly templates = signal<Template[]>([]);

  async load(): Promise<void> {
    try {
      const stored = await this.db.getTemplates();
      // Vor dem Ende des Ladens gespeicherte Vorlagen nicht überschreiben.
      const ids = new Set(stored.map((t) => t.id));
      this.templates.update((early) => [...early.filter((t) => !ids.has(t.id)), ...stored]);
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleibt die Liste leer.
    }
  }

  async replaceAll(templates: readonly Template[]): Promise<void> {
    this.templates.set([...templates]);
    try {
      await this.db.clear('templates');
      await this.db.putAll('templates', templates);
    } catch {
      // Ohne IndexedDB (Tests) nur im Speicher ersetzen.
    }
  }

  /** Fügt eine neue Vorlage hinzu (oben einsortiert). */
  async add(template: Template): Promise<void> {
    this.templates.update((list) => [template, ...list]);
    await this.persist(template);
  }

  async rename(id: string, title: string): Promise<void> {
    const updated = this.templates().map((t) => (t.id === id ? { ...t, title } : t));
    this.templates.set(updated);
    const template = updated.find((t) => t.id === id);
    if (template) await this.persist(template);
  }

  /** Entfernt eine Vorlage und liefert sie für „Rückgängig" zurück. */
  async remove(id: string): Promise<Template | undefined> {
    const template = this.templates().find((t) => t.id === id);
    if (!template) return undefined;
    this.templates.update((list) => list.filter((t) => t.id !== id));
    try {
      await this.db.remove('templates', id);
    } catch {
      // Ohne IndexedDB (Tests) nur im Speicher entfernen.
    }
    return template;
  }

  /** Stellt eine zuvor entfernte Vorlage wieder her. */
  async restore(template: Template): Promise<void> {
    this.templates.update((list) => [template, ...list.filter((t) => t.id !== template.id)]);
    await this.persist(template);
  }

  private async persist(template: Template): Promise<void> {
    try {
      await this.db.put('templates', template);
    } catch {
      // Ohne IndexedDB (Tests) nur im Speicher halten.
    }
  }
}
