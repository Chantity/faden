/**
 * Farbschemata: ändern nur die Akzentfarben (Primär, Auswahl, Fokus), je für
 * hell und dunkel. Hintergrund, Text, Warn- und Gefahrfarben bleiben fest.
 * Das Standardschema „Salbei" lebt nur im Code (styles.css) und wird nie gespeichert.
 */
import { TITLE_MAX_LENGTH, uniqueTitle } from './model';

export interface SchemeColor {
  /** `#rrggbb` */
  light: string;
  dark: string;
}

export type SchemeRole = 'primary' | 'control' | 'focus';
export const SCHEME_ROLES: readonly SchemeRole[] = ['primary', 'control', 'focus'];

export interface ColorScheme {
  id: string;
  name: string;
  primary: SchemeColor;
  /** Radio-Kreise und Kästchen; `null` = Browser-Standard. */
  control: SchemeColor | null;
  focus: SchemeColor;
}

export const DEFAULT_SCHEME_ID = 'salbei';

/** Spiegelt die Werte aus styles.css – nur als Vorlage für Duplikate. Name kommt aus i18n. */
export const DEFAULT_SCHEME: ColorScheme = {
  id: DEFAULT_SCHEME_ID,
  name: '',
  primary: { light: '#4a6b57', dark: '#8fb69b' },
  control: null,
  focus: { light: '#3c5847', dark: '#a7c8b1' },
};

/** Flächen aus styles.css, gegen die Kontraste geprüft werden. */
const SURFACE = { light: '#fffdf9', dark: '#262320' };
const INK = { light: '#ffffff', dark: '#16201a' };

const HEX = /^#[0-9a-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG-Kontrastverhältnis zweier `#rrggbb`-Farben (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Schrift auf Primärflächen: Weiß oder Fast-Schwarz, je nachdem, was besser lesbar ist. */
export function onColor(background: string): string {
  return contrastRatio(INK.light, background) >= contrastRatio(INK.dark, background) ? INK.light : INK.dark;
}

export interface ContrastIssue {
  mode: 'light' | 'dark';
  kind: 'primary' | 'onPrimary';
}

/** Ruhige Hinweise: Primär gegen Fläche < 3:1, Schrift auf Primär < 4.5:1. */
export function contrastIssues(scheme: ColorScheme): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const mode of ['light', 'dark'] as const) {
    const primary = scheme.primary[mode];
    if (contrastRatio(primary, SURFACE[mode]) < 3) issues.push({ mode, kind: 'primary' });
    if (contrastRatio(primary, onColor(primary)) < 4.5) issues.push({ mode, kind: 'onPrimary' });
  }
  return issues;
}

const pair = (c: SchemeColor) => `light-dark(${c.light}, ${c.dark})`;

/** CSS-Variablen für `<html style>`; abgeleitete Töne wie in styles.css. */
export function schemeProperties(scheme: ColorScheme): Record<string, string> {
  const { light, dark } = scheme.primary;
  return {
    '--color-primary': pair(scheme.primary),
    '--color-primary-strong': `light-dark(color-mix(in srgb, ${light} 80%, black), color-mix(in srgb, ${dark} 80%, white))`,
    '--color-on-primary': pair({ light: onColor(light), dark: onColor(dark) }),
    '--color-accent-soft': 'color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))',
    '--color-accent-inverse': `light-dark(color-mix(in srgb, ${light} 40%, white), color-mix(in srgb, ${dark} 80%, white))`,
    '--color-focus': pair(scheme.focus),
    '--color-control': scheme.control ? pair(scheme.control) : 'auto',
  };
}

export const SCHEME_PROPERTIES = Object.keys(schemeProperties(DEFAULT_SCHEME));

function parseColor(raw: unknown): SchemeColor | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { light, dark } = raw as Record<string, unknown>;
  return isHexColor(light) && isHexColor(dark) ? { light, dark } : undefined;
}

/**
 * Gültige eigene Schemata (eindeutige Namen und IDs); Ungültiges fällt weg.
 * `reservedNames`: Namen des Standardschemas in allen Sprachen.
 */
export function parseColorSchemes(raw: unknown, reservedNames: readonly string[]): ColorScheme[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: ColorScheme[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const primary = parseColor(r['primary']);
    const focus = parseColor(r['focus']);
    const control = r['control'] === null ? null : parseColor(r['control']);
    const id = r['id'];
    const name = typeof r['name'] === 'string' ? r['name'].trim().slice(0, TITLE_MAX_LENGTH) : '';
    if (typeof id !== 'string' || id === '' || id === DEFAULT_SCHEME_ID || !name || !primary || !focus) continue;
    if (control === undefined || result.some((s) => s.id === id)) continue;
    const taken = [...reservedNames, ...result.map((s) => s.name)];
    result.push({ id, name: uniqueTitle(name, taken), primary, control, focus });
  }
  return result.length > 0 ? result : undefined;
}
