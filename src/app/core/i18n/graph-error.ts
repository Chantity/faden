import { GraphError } from '../graph';
import type { TodoList } from '../model';
import type { Translations } from './types';

/** Übersetzt einen GraphError in einen freundlichen, lokalen Text (SPEC 4.1). */
export function describeGraphError(t: Translations, list: TodoList, error: unknown): string {
  if (!(error instanceof GraphError)) return t.snackbar.saveFailed;
  const nameOf = (id?: string): string => list.tasks.find((task) => task.id === id)?.title ?? '';
  switch (error.code) {
    case 'self-loop':
      return t.errors.selfLoop(nameOf(error.details.from));
    case 'cycle':
      return t.errors.cycle(nameOf(error.details.from), nameOf(error.details.to));
    case 'duplicate-edge':
      return t.errors.duplicateEdge;
    default:
      return t.snackbar.saveFailed;
  }
}
