// Tastenkürzel: Standardbelegung, eigene Belegung, Abgleich mit Tastendrücken.
// Reine Funktionen, ohne Angular.

/** Wo ein Kürzel wirkt: „Jetzt dran“, Ablauf oder überall im Zettel. */
export type ShortcutScope = 'focus' | 'flow' | 'global';

export const SHORTCUT_SCOPES = {
  needFirst: 'focus',
  insertAfter: 'focus',
  edit: 'focus',
  flowUp: 'flow',
  flowDown: 'flow',
  flowLeft: 'flow',
  flowRight: 'flow',
  flowEdit: 'flow',
  flowDelete: 'flow',
  undo: 'global',
  redo: 'global',
  help: 'global',
} as const satisfies Record<string, ShortcutScope>;

export type ShortcutAction = keyof typeof SHORTCUT_SCOPES;
export const SHORTCUT_ACTIONS = Object.keys(SHORTCUT_SCOPES) as ShortcutAction[];

/** Eine Tastenkombination. `ctrl` steht für Strg **oder** Cmd (Mac). */
export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type Keymap = Record<ShortcutAction, KeyCombo[]>;
/** Gespeichert wird nur, was der Nutzer geändert hat. */
export type CustomKeymap = Partial<Keymap>;

export const DEFAULT_KEYMAP: Keymap = {
  needFirst: [{ key: 'v' }],
  insertAfter: [{ key: 'n' }],
  edit: [{ key: 'e' }],
  flowUp: [{ key: 'ArrowUp' }],
  flowDown: [{ key: 'ArrowDown' }],
  flowLeft: [{ key: 'ArrowLeft' }],
  flowRight: [{ key: 'ArrowRight' }],
  flowEdit: [{ key: 'Enter' }],
  flowDelete: [{ key: 'Delete' }, { key: 'Backspace' }],
  undo: [{ key: 'z', ctrl: true }],
  redo: [{ key: 'z', ctrl: true, shift: true }, { key: 'y', ctrl: true }],
  help: [{ key: '?' }],
};

/** Für die Bedienung reserviert: Tab (Fokus) und Esc (schließen). */
const RESERVED_KEYS = new Set(['Tab', 'Escape']);
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS']);

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/** Zeichen ohne Groß-/Kleinschreibung („?“, „1“, „ “): Umschalt gehört dort zum Zeichen selbst. */
function isSymbol(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase();
}

/** Ein Tastendruck als Kombination (Buchstaben klein, Umschalt nur wo es unterscheidet). */
export function comboFromEvent(event: KeyEventLike): KeyCombo {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const combo: KeyCombo = { key };
  if (event.ctrlKey || event.metaKey) combo.ctrl = true;
  if (event.shiftKey && !isSymbol(key)) combo.shift = true;
  if (event.altKey) combo.alt = true;
  return combo;
}

export function sameCombo(a: KeyCombo, b: KeyCombo): boolean {
  return a.key === b.key && !!a.ctrl === !!b.ctrl && !!a.shift === !!b.shift && !!a.alt === !!b.alt;
}

/** Standardbelegung, überschrieben durch die eigene Belegung. */
export function resolveKeymap(custom: CustomKeymap | undefined): Keymap {
  return { ...DEFAULT_KEYMAP, ...custom };
}

/** Welche Aktion (in den genannten Bereichen) dieser Tastendruck auslöst, sonst `null`. */
export function actionFor(event: KeyEventLike, keymap: Keymap, scopes: readonly ShortcutScope[]): ShortcutAction | null {
  const pressed = comboFromEvent(event);
  return (
    SHORTCUT_ACTIONS.find(
      (action) => scopes.includes(SHORTCUT_SCOPES[action]) && keymap[action].some((c) => sameCombo(c, pressed)),
    ) ?? null
  );
}

/** Warum eine Kombination nicht belegbar ist, sonst `null`. */
export function comboProblem(combo: KeyCombo): 'reserved' | 'modifier' | null {
  if (MODIFIER_KEYS.has(combo.key)) return 'modifier';
  if (RESERVED_KEYS.has(combo.key)) return 'reserved';
  return null;
}

/** Bereiche, die gleichzeitig aktiv sein können: „überall“ mit allen, sonst nur gleiche. */
function overlaps(a: ShortcutScope, b: ShortcutScope): boolean {
  return a === b || a === 'global' || b === 'global';
}

/** Andere Aktion, die `combo` schon belegt und zugleich aktiv sein kann, sonst `null`. */
export function conflictFor(keymap: Keymap, action: ShortcutAction, combo: KeyCombo): ShortcutAction | null {
  return (
    SHORTCUT_ACTIONS.find(
      (other) =>
        other !== action &&
        overlaps(SHORTCUT_SCOPES[action], SHORTCUT_SCOPES[other]) &&
        keymap[other].some((c) => sameCombo(c, combo)),
    ) ?? null
  );
}

/** Beschriftungen für Modifier und benannte Tasten in der Sprache der Oberfläche. */
export interface KeyNames {
  ctrl: string;
  shift: string;
  alt: string;
  named: Record<string, string>;
}

/** „Strg+Umschalt+Z“ bzw. „Ctrl+Shift+Z“; Buchstaben groß, benannte Tasten übersetzt. */
export function formatCombo(combo: KeyCombo, names: KeyNames): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push(names.ctrl);
  if (combo.alt) parts.push(names.alt);
  if (combo.shift) parts.push(names.shift);
  parts.push(names.named[combo.key] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key));
  return parts.join('+');
}

/** Prüft eine gespeicherte eigene Belegung (Einstellungen, Backup); Unbekanntes entfällt. */
export function parseKeymap(raw: unknown): CustomKeymap | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const custom: CustomKeymap = {};
  for (const action of SHORTCUT_ACTIONS) {
    const combos = (raw as Record<string, unknown>)[action];
    if (!Array.isArray(combos) || combos.length === 0) continue;
    const valid = combos.filter(
      (c): c is KeyCombo =>
        typeof c === 'object' && c !== null && typeof (c as KeyCombo).key === 'string' && (c as KeyCombo).key !== '',
    );
    if (valid.length === combos.length && valid.every((c) => comboProblem(c) === null)) {
      custom[action] = valid.map(({ key, ctrl, shift, alt }) => ({
        key,
        ...(ctrl ? { ctrl: true } : {}),
        ...(shift ? { shift: true } : {}),
        ...(alt ? { alt: true } : {}),
      }));
    }
  }
  return Object.keys(custom).length > 0 ? custom : undefined;
}
