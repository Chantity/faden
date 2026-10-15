import {
  actionFor,
  comboFromEvent,
  comboProblem,
  conflictFor,
  DEFAULT_KEYMAP,
  formatCombo,
  parseKeymap,
  resolveKeymap,
  type KeyNames,
} from './keymap';

const key = (k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

const names: KeyNames = { ctrl: 'Strg', shift: 'Umschalt', alt: 'Alt', named: { Delete: 'Entf', ArrowUp: '↑' } };

describe('Tastenkürzel', () => {
  it('erkennt die Standardbelegung je Bereich', () => {
    const keymap = DEFAULT_KEYMAP;
    expect(actionFor(key('v'), keymap, ['focus'])).toBe('needFirst');
    expect(actionFor(key('v'), keymap, ['flow'])).toBeNull();
    expect(actionFor(key('Z', { ctrlKey: true, shiftKey: true }), keymap, ['global'])).toBe('redo');
    expect(actionFor(key('z', { metaKey: true }), keymap, ['global'])).toBe('undo'); // Cmd = Strg
    expect(actionFor(key('y', { ctrlKey: true }), keymap, ['global'])).toBe('redo');
    expect(actionFor(key('Backspace'), keymap, ['flow'])).toBe('flowDelete');
  });

  it('Umschalt zählt bei Buchstaben, nicht bei Zeichen wie „?“', () => {
    expect(comboFromEvent(key('?', { shiftKey: true }))).toEqual({ key: '?' });
    expect(actionFor(key('?', { shiftKey: true }), DEFAULT_KEYMAP, ['global'])).toBe('help');
    expect(actionFor(key('V', { shiftKey: true }), DEFAULT_KEYMAP, ['focus'])).toBeNull();
    expect(comboFromEvent(key('V'))).toEqual({ key: 'v' }); // Feststelltaste
  });

  it('eigene Belegung ersetzt die Standardbelegung der Aktion', () => {
    const keymap = resolveKeymap({ needFirst: [{ key: 'b' }] });
    expect(actionFor(key('b'), keymap, ['focus'])).toBe('needFirst');
    expect(actionFor(key('v'), keymap, ['focus'])).toBeNull();
    expect(keymap.edit).toEqual([{ key: 'e' }]);
  });

  it('Konflikte: gleicher Bereich und „überall“ kollidieren, „Jetzt dran“ und Ablauf nicht', () => {
    expect(conflictFor(DEFAULT_KEYMAP, 'insertAfter', { key: 'e' })).toBe('edit');
    expect(conflictFor(DEFAULT_KEYMAP, 'flowEdit', { key: 'e' })).toBeNull();
    expect(conflictFor(DEFAULT_KEYMAP, 'flowEdit', { key: '?' })).toBe('help');
    expect(conflictFor(DEFAULT_KEYMAP, 'edit', { key: 'e' })).toBeNull(); // die eigene Belegung
  });

  it('Tab, Esc und reine Modifier sind nicht belegbar', () => {
    expect(comboProblem({ key: 'Tab' })).toBe('reserved');
    expect(comboProblem({ key: 'Escape' })).toBe('reserved');
    expect(comboProblem({ key: 'Shift', shift: true })).toBe('modifier');
    expect(comboProblem({ key: 'k', ctrl: true })).toBeNull();
  });

  it('formatiert Kombinationen in der Sprache der Oberfläche', () => {
    expect(formatCombo({ key: 'z', ctrl: true, shift: true }, names)).toBe('Strg+Umschalt+Z');
    expect(formatCombo({ key: 'Delete' }, names)).toBe('Entf');
    expect(formatCombo({ key: 'ArrowUp' }, names)).toBe('↑');
    expect(formatCombo({ key: 'PageDown' }, names)).toBe('PageDown');
  });

  it('prüft gespeicherte Belegungen und verwirft Ungültiges', () => {
    expect(parseKeymap({ needFirst: [{ key: 'b', ctrl: true, extra: 1 }], unbekannt: [{ key: 'x' }] })).toEqual({
      needFirst: [{ key: 'b', ctrl: true }],
    });
    expect(parseKeymap({ edit: [{ key: 'Tab' }] })).toBeUndefined();
    expect(parseKeymap({ edit: [] })).toBeUndefined();
    expect(parseKeymap('kaputt')).toBeUndefined();
  });
});
