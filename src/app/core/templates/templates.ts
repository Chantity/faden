// Vorlagen (SPEC 5.6): Zettel/Strang → Vorlage und Vorlage → Zettel/Strang.
// Reine Funktionen, ohne Angular.
import {
  createList,
  edgeId,
  type Edge,
  type Task,
  type Template,
  type TodoList,
} from '../model';
import { extractStrand, topologicalOrder } from '../graph';
import { withTimeboxMode } from '../time';

/** Minuten zwischen zwei lokalen ISO-Zeitpunkten (oder null). */
function durationMinutes(startAt: string | undefined, endAt: string | undefined): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const minutes = Math.round((end - start) / 60_000);
  return minutes > 0 ? minutes : null;
}

/**
 * Bereitet eine Task für die Vorlage auf: Erledigt-Status entfällt, absolute
 * Zeiten (`startAt`/`endAt`) werden verworfen – falls sinnvoll, wird daraus eine
 * Schätzung abgeleitet. Tageszeiten (`dayStart`/`dayEnd`) bleiben erhalten.
 */
function toTemplateTask(task: Task): Omit<Task, 'done' | 'doneAt'> {
  const { done: _done, doneAt: _doneAt, startAt, endAt, ...rest } = task;
  if (rest.estimateMinutes === undefined) {
    const derived = durationMinutes(startAt, endAt);
    if (derived !== null) rest.estimateMinutes = derived;
  }
  return rest;
}

function buildTemplate(
  title: string,
  tasks: readonly Task[],
  edges: readonly Edge[],
  timeboxMode: Template['timeboxMode'],
  now: string,
): Template {
  return {
    id: crypto.randomUUID(),
    title,
    tasks: tasks.map(toTemplateTask),
    edges: edges.map((edge) => ({ ...edge })),
    timeboxMode,
    createdAt: now,
  };
}

/** „Als Vorlage speichern" für den ganzen Zettel (SPEC 5.6). */
export function listToTemplate(list: TodoList, title: string = list.title): Template {
  return buildTemplate(title, list.tasks, list.edges, list.timeboxMode, new Date().toISOString());
}

/** „Als Vorlage speichern" für einen Strang (SPEC 5.6). */
export function strandToTemplate(list: TodoList, taskId: string, title?: string): Template | null {
  const strand = extractStrand(list, taskId);
  if (strand.tasks.length === 0) return null;
  const anchor = strand.tasks[0];
  return buildTemplate(
    title ?? anchor?.title ?? list.title,
    strand.tasks,
    strand.edges,
    list.timeboxMode,
    new Date().toISOString(),
  );
}

/** Erzeugt einen frischen Zettel aus einer Vorlage (neue IDs, nichts erledigt). */
export function templateToList(template: Template): TodoList {
  const list = withTimeboxMode(createList(template.title), template.timeboxMode, new Date());
  const idMap = new Map<string, string>();
  for (const task of template.tasks) idMap.set(task.id, crypto.randomUUID());
  list.tasks = template.tasks.map((task) => ({
    ...task,
    id: idMap.get(task.id) as string,
    done: false,
  }));
  list.edges = template.edges.map((edge) => ({
    id: edgeId(idMap.get(edge.from) as string, idMap.get(edge.to) as string),
    from: idMap.get(edge.from) as string,
    to: idMap.get(edge.to) as string,
  }));
  return list;
}

/**
 * Fügt eine Vorlage als neuen Strang in einen bestehenden Zettel ein (SPEC 5.6,
 * optional). Erzeugt ausschließlich neue IDs; es entstehen keine Verbindungen zu
 * vorhandenen ToDos.
 */
export function insertTemplate(list: TodoList, template: Template): TodoList {
  const idMap = new Map<string, string>();
  for (const task of template.tasks) idMap.set(task.id, crypto.randomUUID());
  const newTasks: Task[] = template.tasks.map((task) => ({
    ...task,
    id: idMap.get(task.id) as string,
    done: false,
  }));
  const newEdges: Edge[] = template.edges.map((edge) => ({
    id: edgeId(idMap.get(edge.from) as string, idMap.get(edge.to) as string),
    from: idMap.get(edge.from) as string,
    to: idMap.get(edge.to) as string,
  }));
  return {
    ...list,
    tasks: [...list.tasks, ...newTasks],
    edges: [...list.edges, ...newEdges],
  };
}

/** Titel-Liste einer Vorlage in topologischer Reihenfolge (Vorschau, SPEC 5.6). */
export function templatePreview(template: Template): string[] {
  const asList: TodoList = {
    id: template.id,
    title: template.title,
    timeboxMode: template.timeboxMode,
    tasks: template.tasks.map((task) => ({ ...task, done: false })),
    edges: template.edges,
    archived: false,
    createdAt: template.createdAt,
    updatedAt: template.createdAt,
    sortOrder: 0,
  };
  return topologicalOrder(asList).map((task) => task.title);
}
