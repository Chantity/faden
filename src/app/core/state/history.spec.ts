import { CommandHistory, History } from './history';

describe('History (Undo/Redo)', () => {
  it('macht Änderungen in umgekehrter Reihenfolge rückgängig und wieder her', () => {
    const history = new History<string>();
    history.push('a');
    history.push('b');
    expect(history.canUndo()).toBe(true);
    expect(history.undo('c')).toBe('b');
    expect(history.undo('b')).toBe('a');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(history.redo('a')).toBe('b');
  });

  it('verwirft Redo nach einer neuen Änderung', () => {
    const history = new History<string>();
    history.push('a');
    history.undo('b');
    expect(history.canRedo()).toBe(true);
    history.push('b');
    expect(history.canRedo()).toBe(false);
  });

  it('gibt undefined zurück, wenn nichts rückgängig zu machen ist', () => {
    const history = new History<string>();
    expect(history.undo('x')).toBeUndefined();
    expect(history.redo('x')).toBeUndefined();
  });

  it('hält die Obergrenze ein (älteste Schritte fallen heraus)', () => {
    const history = new History<number>(3);
    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);
    // Nur 2,3,4 bleiben: undo liefert 4,3,2 – danach nichts mehr.
    expect(history.undo(5)).toBe(4);
    expect(history.undo(4)).toBe(3);
    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBeUndefined();
  });
});

describe('CommandHistory', () => {
  it('führt undo/redo der Befehle in umgekehrter Reihenfolge aus und verwirft Redo', () => {
    const log: string[] = [];
    const history = new CommandHistory(2);
    const cmd = (name: string) => ({ undo: () => log.push(`-${name}`), redo: () => log.push(`+${name}`) });
    history.record(cmd('a'));
    history.record(cmd('b'));
    history.record(cmd('c')); // Grenze 2 → „a" fällt heraus
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(log).toEqual(['-c', '-b']);
    expect(history.redo()).toBe(true);
    expect(log).toEqual(['-c', '-b', '+b']);
    history.record(cmd('d'));
    expect(history.canRedo()).toBe(false);
  });
});
