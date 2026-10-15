// Beschreibung eines ToDos als Freitext oder Checkliste: verlustarmes Umwandeln.
// Reine Funktionen, ohne Angular.
import { CHECKLIST_MAX_ITEMS, TITLE_MAX_LENGTH, type ChecklistItem } from './model';

/** Checkliste → Text: jeder Punkt als Stichpunkt „- Punkt" in einer eigenen Zeile. */
export function checklistToText(items: readonly ChecklistItem[]): string {
  return items.map((item) => `- ${item.text}\n`).join('');
}

/**
 * Text → Checkliste: jede nicht-leere Zeile wird ein offener Punkt; ein führendes
 * „-" bzw. „- " entfällt. `cut` meldet, ob Zeilen gekürzt oder weggelassen wurden
 * (höchstens 100 Punkte à 200 Zeichen).
 */
export function textToChecklist(
  text: string,
  newId: () => string = () => crypto.randomUUID(),
): { items: ChecklistItem[]; cut: boolean } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s?/, '').trim())
    .filter((line) => line !== '');
  const kept = lines.slice(0, CHECKLIST_MAX_ITEMS);
  const cut = lines.length > kept.length || kept.some((line) => line.length > TITLE_MAX_LENGTH);
  return {
    items: kept.map((line) => ({ id: newId(), text: line.slice(0, TITLE_MAX_LENGTH), done: false })),
    cut,
  };
}
