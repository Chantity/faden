// Vorlagen: Zettel/Strang → Vorlage und Vorlage → Zettel/Strang.
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

/**
 * Bereitet eine Task für die Vorlage auf: Erledigt-Status (auch in der
 * Checkliste) entfällt, das absolute Datum (`startAt`) wird verworfen. Dauer und
 * Tageszeit (`dayStart`) bleiben erhalten.
 */
function toTemplateTask(task: Task): Omit<Task, 'done' | 'doneAt'> {
  const { done: _done, doneAt: _doneAt, startAt: _startAt, ...rest } = task;
  if (rest.checklist) rest.checklist = rest.checklist.map((item) => ({ ...item, done: false }));
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

/** „Als Vorlage speichern" für den ganzen Zettel. */
export function listToTemplate(list: TodoList, title: string = list.title): Template {
  return buildTemplate(title, list.tasks, list.edges, list.timeboxMode, new Date().toISOString());
}

/** „Als Vorlage speichern" für einen Strang. */
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
 * Fügt eine Vorlage als neuen Strang in einen bestehenden Zettel ein
 * (optional). Erzeugt ausschließlich neue IDs; es entstehen keine Verbindungen zu
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

/** Titel-Liste einer Vorlage in topologischer Reihenfolge (Vorschau). */
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
