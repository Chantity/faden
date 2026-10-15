import { checklistToText, textToChecklist } from './checklist';
import { CHECKLIST_MAX_ITEMS, TITLE_MAX_LENGTH } from './model';

let n = 0;
const ids = () => `i${++n}`;

describe('Checkliste ↔ Text', () => {
  beforeEach(() => (n = 0));

  it('Checkliste → Text: jeder Punkt als „- Punkt" mit Zeilenumbruch, Haken entfallen', () => {
    const text = checklistToText([
      { id: '1', text: 'Milch', done: true },
      { id: '2', text: 'Brot', done: false },
    ]);
    expect(text).toBe('- Milch\n- Brot\n');
  });

  it('Text → Checkliste: jede Zeile ein Punkt, „-" und „- " am Anfang entfallen, Leerzeilen nicht', () => {
    const { items, cut } = textToChecklist('- Milch\n-Brot\n\n  Käse  \nEier – frisch\n', ids);
    expect(items.map((i) => i.text)).toEqual(['Milch', 'Brot', 'Käse', 'Eier – frisch']);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
    expect(cut).toBe(false);
  });

  it('Roundtrip Text → Checkliste → Text ergibt Stichpunkte', () => {
    const { items } = textToChecklist('Milch\nBrot', ids);
    expect(checklistToText(items)).toBe('- Milch\n- Brot\n');
    expect(textToChecklist(checklistToText(items), ids).items.map((i) => i.text)).toEqual(['Milch', 'Brot']);
  });

  it('kürzt zu lange Zeilen und zu viele Punkte und meldet das', () => {
    const long = textToChecklist('x'.repeat(TITLE_MAX_LENGTH + 5), ids);
    expect(long.items[0]!.text.length).toBe(TITLE_MAX_LENGTH);
    expect(long.cut).toBe(true);

    const many = textToChecklist(Array.from({ length: CHECKLIST_MAX_ITEMS + 3 }, (_, i) => `P${i}`).join('\n'), ids);
    expect(many.items).toHaveLength(CHECKLIST_MAX_ITEMS);
    expect(many.cut).toBe(true);
  });

  it('nur Striche oder Leerzeichen ergeben keine Punkte', () => {
    expect(textToChecklist('-\n - \n   ', ids).items).toEqual([]);
  });
});
