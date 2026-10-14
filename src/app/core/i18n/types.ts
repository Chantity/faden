// Der Aufbau der deutschen Sprachdatei ist die verbindliche Vorlage.
// Jede weitere Sprache muss diesen Typ erfüllen (`satisfies Translations`),
// so wird beim Übersetzen kein Schlüssel vergessen.
import type { de } from './de';

export type Translations = typeof de;
