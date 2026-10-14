import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { TemplatesStore } from '../../core/state/templates.store';
import { insertTemplate, templatePreview } from '../../core/templates';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';

/**
 * „Vorlage in Zettel einfügen" (SPEC 5.6): fügt eine Vorlage als neuen,
 * unabhängigen Strang in den geöffneten Zettel ein. Ein Undo-Schritt.
 */
@Component({
  selector: 'app-insert-template-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (submit)="confirm($event)">
        <h2>{{ t().templates.insert }}</h2>
        <p class="muted">{{ t().templates.insertHint }}</p>

        <label class="field">
          <span class="field__label">{{ t().listDialog.templateLabel }}</span>
          <select #choose [value]="selectedId()" (change)="selectedId.set($any($event.target).value)">
            @for (template of templates(); track template.id) {
              <option [value]="template.id">{{ template.title }}</option>
            }
          </select>
        </label>

        @if (preview().length > 0) {
          <ol class="preview muted" [attr.aria-label]="t().templates.preview">
            @for (title of preview(); track $index) {
              <li>{{ title }}</li>
            }
          </ol>
        }

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary" [disabled]="!selectedId()">
            {{ t().templates.insertApply }}
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .sheet {
      width: min(480px, calc(100vw - 2 * var(--space-4)));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      padding: 0;
      box-shadow: var(--shadow);
    }

    .sheet::backdrop {
      background: rgba(20, 18, 15, 0.4);
    }

    .sheet__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .field__label {
      font-weight: 600;
      font-size: 0.95rem;
    }

    select {
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .preview {
      margin: 0;
      padding-left: var(--space-5);
      max-height: 12rem;
      overflow-y: auto;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class InsertTemplateDialog {
  private readonly store = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly choose = viewChild<ElementRef<HTMLSelectElement>>('choose');

  protected readonly t = inject(I18nStore).t;
  protected readonly templates = inject(TemplatesStore).templates;

  private readonly listId = signal<string | null>(null);
  protected readonly selectedId = signal('');
  private restoreFocusTo: HTMLElement | null = null;

  protected readonly preview = computed(() => {
    const template = this.templates().find((t) => t.id === this.selectedId());
    return template ? templatePreview(template) : [];
  });

  open(listId: string): void {
    this.listId.set(listId);
    this.selectedId.set(this.templates()[0]?.id ?? '');
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    this.dialogRef().nativeElement.showModal();
    queueMicrotask(() => this.choose()?.nativeElement.focus());
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    this.listId.set(null);
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  protected confirm(event: Event): void {
    event.preventDefault();
    const listId = this.listId();
    const template = this.templates().find((t) => t.id === this.selectedId());
    if (!listId || !template) return;
    this.store.editList(listId, (list) => insertTemplate(list, template));
    this.close();
    this.snackbar.show(this.t().templates.insertedSnack(template.title), {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }
}
