import { DEFAULT_LOCALE, type Locale } from '../model';
import { de } from './de';
import { en } from './en';
import type { Translations } from './types';

/** Alle gebündelten Wörterbücher. Kein Laufzeit-Download – alles im Build enthalten. */
export const DICTIONARIES: Record<Locale, Translations> = { en, de };

/** Liefert das Wörterbuch zu einer Sprache; fällt immer auf Englisch zurück. */
export function dictionaryFor(locale: Locale): Translations {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}
