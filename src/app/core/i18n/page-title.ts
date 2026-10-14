import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { I18nStore } from './i18n.store';
import type { Translations } from './types';

export type TitleKey = keyof Translations['titles'];

/**
 * Setzt den Dokumenttitel lokalisiert. Seitenkomponenten melden ihren
 * Titel-Schlüssel an; der Effekt aktualisiert bei Sprachwechsel automatisch neu.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private readonly i18n = inject(I18nStore);
  private readonly title = inject(Title);

  readonly key = signal<TitleKey | null>(null);

  constructor() {
    effect(() => {
      const t = this.i18n.t();
      const key = this.key();
      this.title.setTitle(key ? `${t.app.name} – ${t.titles[key]}` : t.app.name);
    });
  }

  set(key: TitleKey | null): void {
    this.key.set(key);
  }
}
