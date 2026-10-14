import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_LOCALE, type Locale } from '../model';
import { dictionaryFor } from './dictionaries';
import type { Translations } from './types';

/**
 * Reaktiver Zugriff auf die aktuelle Sprache. Komponenten lesen `t()` in
 * Templates; beim Umschalten zeichnet Angular dank Signals sofort neu.
 * Hält zusätzlich das `lang`-Attribut am <html>-Element aktuell (A11y).
 */
@Injectable({ providedIn: 'root' })
export class I18nStore {
  private readonly doc = inject(DOCUMENT);

  readonly locale = signal<Locale>(DEFAULT_LOCALE);
  readonly t = computed<Translations>(() => dictionaryFor(this.locale()));

  constructor() {
    effect(() => {
      const lang = this.locale();
      this.doc.documentElement?.setAttribute('lang', lang);
    });
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
  }
}
