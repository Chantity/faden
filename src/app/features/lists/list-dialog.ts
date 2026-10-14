import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nStore } from '../../core/i18n/i18n.store';
import {
  TIMEBOX_MODES,
  TITLE_MAX_LENGTH,
  type TimeboxMode,
  type TodoList,
} from '../../core/model';

@Component({
  selector: 'app-list-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (ngSubmit)="submit()">
        <h2>{{ editing() ? t().listDialog.editTitle : t().listDialog.newTitle }}</h2>

        <label class="field">
          <span class="field__label">{{ t().listDialog.nameLabel }}</span>
          <input
            #titleInput
            type="text"
            name="title"
            [placeholder]="t().listDialog.namePlaceholder"
            [maxlength]="maxTitle"
            [ngModel]="title()"
            (ngModelChange)="onTitleChange($event)"
            required
          />
        </label>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        <fieldset class="modes">
          <legend class="field__label">{{ t().listDialog.timeboxLabel }}</legend>
          @for (mode of modes; track mode) {
            <label class="mode" [class.is-selected]="timeboxMode() === mode">
              <input
                type="radio"
                name="mode"
                [value]="mode"
                [ngModel]="timeboxMode()"
                (ngModelChange)="timeboxMode.set($event)"
              />
              <span class="mode__text">
                <span class="mode__title">{{ t().timebox.modes[mode] }}</span>
                <span class="mode__hint muted">{{ t().timebox.modeDescriptions[mode] }}</span>
              </span>
            </label>
          }
        </fieldset>

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary">
            {{ editing() ? t().common.save : t().listDialog.create }}
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .sheet {
      width: min(560px, calc(100vw - 2 * var(--space-4)));
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

    .field input[type='text'] {
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

    .modes {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      border: none;
      margin: 0;
      padding: 0;
    }

    .mode {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      cursor: pointer;
    }

    .mode.is-selected {
      border-color: var(--color-primary);
      background: var(--color-accent-soft);
    }

    .mode input {
      margin-top: 4px;
    }

    .mode__text {
      display: flex;
      flex-direction: column;
    }

    .mode__title {
      font-weight: 600;
    }

    .mode__hint {
      font-size: 0.85rem;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class ListDialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly i18n = inject(I18nStore);

  protected readonly t = this.i18n.t;
  protected readonly modes = TIMEBOX_MODES;
  protected readonly maxTitle = TITLE_MAX_LENGTH;

  protected readonly title = signal('');
  protected readonly timeboxMode = signal<TimeboxMode>('none');
  protected readonly editing = signal(false);
  protected readonly error = signal('');

  private editingId: string | null = null;
  private restoreFocusTo: HTMLElement | null = null;

  readonly saved = output<{ id: string | null; title: string; timeboxMode: TimeboxMode }>();

  showCreate(): void {
    this.editing.set(false);
    this.editingId = null;
    this.title.set('');
    this.timeboxMode.set('none');
    this.error.set('');
    this.open();
  }

  showEdit(list: TodoList): void {
    this.editing.set(true);
    this.editingId = list.id;
    this.title.set(list.title);
    this.timeboxMode.set(list.timeboxMode);
    this.error.set('');
    this.open();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onTitleChange(value: string): void {
    this.title.set(value);
    if (this.error()) this.error.set('');
  }

  protected submit(): void {
    const title = this.title().trim();
    if (title.length === 0) {
      this.error.set(this.i18n.t().errors.titleRequired);
      return;
    }
    if (title.length > TITLE_MAX_LENGTH) {
      this.error.set(this.i18n.t().errors.titleTooLong(TITLE_MAX_LENGTH));
      return;
    }
    this.saved.emit({ id: this.editingId, title, timeboxMode: this.timeboxMode() });
    this.close();
  }

  protected onClosed(): void {
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  private open(): void {
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    const dialog = this.dialogRef().nativeElement;
    dialog.showModal();
    queueMicrotask(() => this.titleInput()?.nativeElement.focus());
  }
}
