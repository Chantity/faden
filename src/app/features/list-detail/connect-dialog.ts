import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { connect } from '../../core/graph';
import { describeGraphError } from '../../core/i18n/graph-error';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';

/**
 * „Mit anderem ToDo verbinden": Ziel-Auswahl als kleiner Dialog. Barrierefrei
 * über eine Auswahlliste bedienbar (SPEC 5.4, Alternative zum Ziehen).
 */
@Component({
  selector: 'app-connect-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (ngSubmit)="confirm()">
        <h2>{{ t().focus.menu.connect }}</h2>
        <p class="muted">{{ t().flow.insertAfter }}</p>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        <label class="field">
          <span class="field__label">{{ t().editor.chooseTask }}</span>
          <select #choose>
            @for (task of candidates(); track task.id) {
              <option [value]="task.id">{{ task.title }}</option>
            }
          </select>
        </label>

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary" [disabled]="candidates().length === 0">
            {{ t().common.save }}
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

    .field__error {
      color: var(--color-danger);
      margin: 0;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class ConnectDialog {
  private readonly store = inject(ListsStore);
  private readonly i18n = inject(I18nStore);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly t = this.i18n.t;

  private readonly listId = signal<string | null>(null);
  private readonly sourceId = signal<string | null>(null);
  protected readonly error = signal('');

  protected readonly candidates = computed(() => {
    const id = this.listId();
    const list = id ? this.store.getList(id) : undefined;
    const source = this.sourceId();
    if (!list || !source) return [];
    return list.tasks.filter((task) => task.id !== source);
  });

  open(listId: string, sourceId: string): void {
    this.listId.set(listId);
    this.sourceId.set(sourceId);
    this.error.set('');
    this.dialogRef().nativeElement.showModal();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    this.listId.set(null);
    this.sourceId.set(null);
  }

  protected confirm(): void {
    const listId = this.listId();
    const source = this.sourceId();
    if (!listId || !source) return;
    const select = this.dialogRef().nativeElement.querySelector('select');
    const target = select && select.value ? select.value : this.candidates()[0]?.id;
    if (!target) return;
    const list = this.store.getList(listId);
    if (!list) return;
    try {
      this.store.editList(listId, (l) => connect(l, source, target));
      this.close();
    } catch (error) {
      this.error.set(describeGraphError(this.t(), list, error));
    }
  }
}
