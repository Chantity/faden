import type { ShortcutAction } from '../core/keymap';
import type { Translations } from '../core/i18n/types';

/** Beschriftung einer Tastenkürzel-Aktion (Hilfe und „Für Fortgeschrittene“). */
export function shortcutLabel(t: Translations, action: ShortcutAction): string {
  const labels: Record<ShortcutAction, string> = {
    needFirst: t.shortcuts.needFirst,
    insertAfter: t.shortcuts.after,
    edit: t.shortcuts.edit,
    flowUp: t.shortcuts.flowUp,
    flowDown: t.shortcuts.flowDown,
    flowLeft: t.shortcuts.flowLeft,
    flowRight: t.shortcuts.flowRight,
    flowEdit: t.shortcuts.flowEdit,
    flowDelete: t.shortcuts.flowDelete,
    undo: t.shortcuts.undo,
    redo: t.shortcuts.redo,
    help: t.shortcuts.help,
  };
  return labels[action];
}
