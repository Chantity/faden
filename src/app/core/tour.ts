/**
 * Geführte Tour (ohne UI-Abhängigkeiten): Schritte, Ziele und wann ein Schritt
 * erledigt ist. Der TourService fragt `done` bei jeder Änderung ab.
 */
import { isJoin, isSplit } from './graph';
import type { TodoList } from './model';

export type TourStepId =
  | 'createList'
  | 'fill'
  | 'markDone'
  | 'undo'
  | 'insertAfter'
  | 'flow'
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
  start: { listIds: readonly string[]; tasks: number; done: number };
}

export interface TourStep {
  id: TourStepId;
  kind: TourStepKind;
  /** CSS-Selektor des erklärten Elements (wird hervorgehoben). */
  target?: (practiceId: string | null) => string;
  done?: (ctx: TourContext) => boolean;
}

const tasks = (ctx: TourContext) => ctx.practice?.tasks.length ?? 0;
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
    target: (id) => `[data-tour-list="${id}"]`,
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
    done: (ctx) => tasks(ctx) > ctx.start.tasks && !ctx.dialogOpen,
  },
  {
    id: 'flow',
    kind: 'action',
    target: () => '[data-tour="view-flow"]',
    done: (ctx) => ctx.view === 'flow',
  },
  {
    id: 'edit',
    kind: 'action',
    target: () => '.flow__canvas .node__menu-btn',
    done: (ctx) => ctx.sawDialog && !ctx.dialogOpen,
  },
  { id: 'archive', kind: 'info', target: () => '[data-tour="nav-lists"]' },
  { id: 'more', kind: 'more' },
  {
    id: 'branch',
    kind: 'action',
    target: () => '.flow__canvas .node__menu-btn',
    done: (ctx) =>
      !ctx.dialogOpen && !!ctx.practice?.tasks.some((t) => isSplit(ctx.practice!, t.id) || isJoin(ctx.practice!, t.id)),
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

/** Der in diesem Schritt neu angelegte Zettel (für „Dein erster Zettel“). */
export function newListId(ctx: TourContext): string | null {
  return ctx.listIds.find((id) => !ctx.start.listIds.includes(id)) ?? null;
}
