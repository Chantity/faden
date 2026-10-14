// Formatierung von Dauern, Uhrzeiten und Tagen (SPEC 7).
// Reine Funktionen, ohne Angular.

/** Bytes lesbar formatieren (z. B. „1,2 MB" / „1.2 MB"), Basis 1024. */
export function formatBytes(bytes: number, locale: 'de' | 'en' = 'de'): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  return `${text} ${units[unit]}`;
}

/** Liefert die Minutenzahl, sofern der Eingabewert eine gültige „HH:mm"-Uhrzeit ist. */
export function parseHhMm(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const [, h, m] = match;
  return Number(h) * 60 + Number(m);
}

/** Prüft, ob der Wert eine gültige „HH:mm"-Uhrzeit ist. */
export function isValidHhMm(value: string | undefined): boolean {
  return parseHhMm(value) !== null;
}

/**
 * Formatiert Minuten als Dauer (SPEC 7.2). Deutsche Ausgabe „1 Std 25 Min“,
 * englische Ausgabe „1 h 25 min“. Negative Werte werden auf 0 gerundet.
 */
export function formatDuration(minutes: number, locale: 'de' | 'en' = 'de'): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (locale === 'en') {
    if (hours > 0 && rest > 0) return `${hours} h ${rest} min`;
    if (hours > 0) return `${hours} h`;
    return `${rest} min`;
  }
  if (hours > 0 && rest > 0) return `${hours} Std ${rest} Min`;
  if (hours > 0) return `${hours} Std`;
  return `${rest} Min`;
}

/** „09:05“ aus Minuten seit Mitternacht; normalisiert auch Werte ≥ 24 Std. */
export function minutesToHhMm(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formatiert ein lokales Datum (SPEC 7.4): „Do., 14.03.“ bzw. „Thu 14 Mar“. */
export function formatDayLabel(date: Date, locale: 'de' | 'en' = 'de'): string {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  }
  const days = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const day = days[date.getDay()];
  const d = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day} ${d}.${month}.`;
}

/** Formatiert ein Datum als „YYYY-MM-DD“ (lokal). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Liest „YYYY-MM-DD“ als lokales Datum (00:00). */
export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Formatiert einen ISO-Timestamp „YYYY-MM-DDTHH:mm“ (lokale Zeit) für ein
 * `datetime-local`-Feld. Ungültige Eingaben liefern ''.
 */
export function toDatetimeLocal(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}T${h}:${min}`;
}

/** Baut aus einem `datetime-local`-Wert einen ISO-Timestamp (lokale Zeit). */
export function fromDatetimeLocal(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return toDatetimeLocal(value);
}

/** Rundet eine Uhrzeit auf 5-Minuten-Schritte (SPEC 7.4, Strecken). */
export function roundToFiveMinutes(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}
