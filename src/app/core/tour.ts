/**
 * Geführte Tour (ohne UI-Abhängigkeiten): Schritte, Ziele und wann ein Schritt
 * erledigt ist. Der TourService fragt `done` bei jeder Änderung ab.
 */
import type { TodoList } from './model';

export type TourStepId =
  | 'createList'
  | 'fill'
  | 'markDone'
  | 'undo'
  | 'insertAfter'
  | 'flow'
  | 'newStrand'
  | 'edit'
  | 'archive'
  | 'more'
  | 'branch'
  | 'links'
  | 'timing'
  | 'templates'
  | 'advanced'
  | 'cleanup';

/** Was der Schritt zum Weitergehen braucht: eine Aktion, „Weiter“, oder eigene Knöpfe. */
export type TourStepKind = 'action' | 'info' | 'more' | 'cleanup';

/** Zustand, gegen den `done` geprüft wird. */
export interface TourContext {
  /** Alle sichtbaren Zettel-IDs. */
  listIds: readonly string[];
  /** Der Übungszettel (sobald angelegt). */
  practice: TodoList | undefined;
  /** Ansicht des Übungszettels. */
  view: 'focus' | 'flow';
  /** Ein Dialog (Sheet) ist offen. */
  dialogOpen: boolean;
  /** In diesem Schritt war schon ein Dialog offen. */
  sawDialog: boolean;
  /** Stand zu Beginn des Schritts. */
  start: { listIds: readonly string[]; taskIds: readonly string[]; done: number };
}

export interface TourStep {
  id: TourStepId;
  kind: TourStepKind;
  /** CSS-Selektor der erklärten Elemente (alle Treffer werden hervorgehoben, der erste bekommt den Fokus). */
  target?: (ids: { practice: string | null; task: string | null }) => string;
  done?: (ctx: TourContext) => boolean;
}

const tasks = (ctx: TourContext) => ctx.practice?.tasks.length ?? 0;
/** In diesem Schritt ist ein ToDo dazugekommen (und das Sheet wieder zu). */
const added = (ctx: TourContext) => newTaskId(ctx) !== null && !ctx.dialogOpen;
const doneCount = (ctx: TourContext) => ctx.practice?.tasks.filter((t) => t.done).length ?? 0;

/** Grundlagen (passen zum einfachen Modus), danach „Mehr anzeigen“ mit den erweiterten Funktionen. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'createList',
    kind: 'action',
    target: () => '[data-tour="new-list"]',
    done: (ctx) => newListId(ctx) !== null,
  },
  {
    id: 'fill',
    kind: 'action',
    target: ({ practice }) => `[data-tour-list="${practice}"]`,
    done: (ctx) => tasks(ctx) >= 2 && !ctx.dialogOpen,
  },
  {
    id: 'markDone',
    kind: 'action',
    target: () => '.task-card__done',
    done: (ctx) => doneCount(ctx) > ctx.start.done,
  },
  {
    id: 'undo',
    kind: 'action',
    target: () => '[data-tour="undo"]',
    done: (ctx) => doneCount(ctx) < ctx.start.done,
  },
  {
    id: 'insertAfter',
    kind: 'action',
    target: () => '.task-card .menu summary',
    done: added,
  },
  {
    id: 'flow',
    kind: 'action',
    target: () => '[data-tour="view-flow"]',
    done: (ctx) => ctx.view === 'flow',
  },
  {
    id: 'newStrand',
    kind: 'action',
    target: () => '[data-tour="new-strand"]',
    done: added,
  },
  {
    id: 'edit',
    kind: 'action',
    // Die Karte des neuen Strangs aus dem vorigen Schritt (sonst irgendeine).
    target: ({ task }) => (task ? `[data-task-id="${task}"] .node__menu-btn` : '.flow__canvas .node__menu-btn'),
    done: (ctx) => ctx.sawDialog && !ctx.dialogOpen,
  },
  { id: 'archive', kind: 'info', target: () => '.flow__canvas .node__toggle' },
  { id: 'more', kind: 'more' },
  {
    id: 'branch',
    kind: 'action',
    target: () => '.flow__canvas .node__menu-btn',
    // Jede neue Nachfolge- oder Voraufgabe zählt – am Strang-Ende entsteht dabei keine Verzweigung.
    done: added,
  },
  { id: 'links', kind: 'info', target: () => '.flow__canvas .node__menu-btn' },
  { id: 'timing', kind: 'info', target: () => '[data-tour="list-menu"]' },
  { id: 'templates', kind: 'info', target: () => '[data-tour="nav-templates"]' },
  { id: 'advanced', kind: 'info', target: () => '[data-tour="nav-settings"]' },
  { id: 'cleanup', kind: 'cleanup' },
];

/** Index des ersten erweiterten Schritts (nach „Mehr anzeigen“). */
export const TOUR_ADVANCED_START = TOUR_STEPS.findIndex((s) => s.id === 'more') + 1;
export const TOUR_CLEANUP = TOUR_STEPS.findIndex((s) => s.id === 'cleanup');

/** Das in diesem Schritt neu angelegte ToDo im Übungszettel. */
export function newTaskId(ctx: TourContext): string | null {
  return ctx.practice?.tasks.find((t) => !ctx.start.taskIds.includes(t.id))?.id ?? null;
}

/** Der in diesem Schritt neu angelegte Zettel (für „Dein erster Zettel“). */
export function newListId(ctx: TourContext): string | null {
  return ctx.listIds.find((id) => !ctx.start.listIds.includes(id)) ?? null;
}
