import { inject, Injectable, signal } from '@angular/core';
import { titleKey, uniqueTitle, type Template } from '../model';
import { FadenDb, upgradeList, upgradeLists } from '../storage';

/** Signal-Store für Vorlagen. Namen sind eindeutig wie bei Zetteln. */
@Injectable({ providedIn: 'root' })
export class TemplatesStore {
  private readonly db = inject(FadenDb);

  readonly templates = signal<Template[]>([]);

  async load(): Promise<void> {
    try {
      const raw = await this.db.getTemplates();
      // Schema anheben und doppelte Namen (aus älteren Versionen) eindeutig machen.
      const stored = upgradeLists(raw.map(upgradeList));
      const upgraded = stored.filter((t, i) => t !== raw[i]);
      // Vor dem Ende des Ladens gespeicherte Vorlagen nicht überschreiben.
      const ids = new Set(stored.map((t) => t.id));
      this.templates.update((early) => [...early.filter((t) => !ids.has(t.id)), ...stored]);
      // Auf das aktuelle Schema angehobene Vorlagen gleich so speichern.
      if (upgraded.length > 0) await this.db.putAll('templates', upgraded);
    } catch {
      // Ohne IndexedDB (z. B. Tests) bleibt die Liste leer.
    }
  }

  async replaceAll(templates: readonly Template[]): Promise<void> {
    const unique = upgradeLists([...templates]);
    this.templates.set(unique);
    try {
      await this.db.clear('templates');
      await this.db.putAll('templates', unique);
    } catch {
      // Ohne IndexedDB (Tests) nur im Speicher ersetzen.
    }
  }

  /** Eindeutiger Name: bei Bedarf „Name (2)“, „Name (3)“ … */
  uniqueTitle(title: string, exceptId?: string): string {
    return uniqueTitle(title, this.others(exceptId).map((t) => t.title));
  }

  isTitleTaken(title: string, exceptId?: string): boolean {
    const key = titleKey(title);
    return this.others(exceptId).some((t) => titleKey(t.title) === key);
  }

  /** Fügt eine neue Vorlage hinzu (oben einsortiert) und liefert sie mit ihrem eindeutigen Namen. */
  add(template: Template): Template {
    const added = { ...template, title: this.uniqueTitle(template.title) };
    this.templates.update((list) => [added, ...list]);
    void this.persist(added);
    return added;
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

  /** Stellt eine zuvor entfernte Vorlage wieder her (inzwischen vergebener Name → „(2)“). */
  async restore(template: Template): Promise<void> {
    const restored = { ...template, title: this.uniqueTitle(template.title, template.id) };
    this.templates.update((list) => [restored, ...list.filter((t) => t.id !== template.id)]);
    await this.persist(restored);
  }

  private others(exceptId?: string): Template[] {
    return this.templates().filter((t) => t.id !== exceptId);
  }

  private async persist(template: Template): Promise<void> {
    try {
      await this.db.put('templates', template);
    } catch {
      // Ohne IndexedDB (Tests) nur im Speicher halten.
    }
  }
}
