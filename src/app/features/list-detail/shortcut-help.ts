import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';

interface Shortcut {
  keys: string;
  label: string;
}

@Component({
  selector: 'app-shortcut-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <h2>{{ t().shortcuts.title }}</h2>
      <dl class="shortcuts">
        @for (shortcut of shortcuts(); track shortcut.label) {
          <div class="shortcuts__row">
            <dt><kbd>{{ shortcut.keys }}</kbd></dt>
            <dd>{{ shortcut.label }}</dd>
          </div>
        }
      </dl>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary" (click)="close()">{{ t().common.close }}</button>
      </div>
    </dialog>
  `,
  styles: `
    .sheet {
      width: min(520px, calc(100vw - 2 * var(--space-4)));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      padding: var(--space-5);
      box-shadow: var(--shadow);
    }

    .sheet::backdrop {
      background: rgba(20, 18, 15, 0.4);
    }

    h2 {
      margin-top: 0;
    }

    .shortcuts {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0 0 var(--space-4);
    }

    .shortcuts__row {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }

    dt {
      flex: 0 0 5.5rem;
    }

    dd {
      margin: 0;
    }

    kbd {
      display: inline-block;
      min-width: 1.6rem;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-border);
      border-bottom-width: 2px;
      border-radius: var(--radius-sm);
      background: var(--color-bg);
      font: inherit;
      font-size: 0.85rem;
      text-align: center;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class ShortcutHelp {
  private readonly i18n = inject(I18nStore);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly t = this.i18n.t;

  protected shortcuts(): Shortcut[] {
    const t = this.t();
    return [
      { keys: '⏎', label: t.shortcuts.done },
      { keys: 'v', label: t.shortcuts.needFirst },
      { keys: 'n', label: t.shortcuts.after },
      { keys: 'e', label: t.shortcuts.edit },
      { keys: '↑ ↓ ← →', label: t.shortcuts.flowNav },
      { keys: '⏎', label: t.shortcuts.flowEdit },
      { keys: '⌫', label: t.shortcuts.flowDelete },
      { keys: 'Ctrl+Z', label: t.shortcuts.undo },
      { keys: 'Ctrl+Shift+Z', label: t.shortcuts.redo },
      { keys: '?', label: t.shortcuts.help },
    ];
  }

  open(): void {
    this.dialogRef().nativeElement.showModal();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    // nichts aufzuräumen
  }
}
