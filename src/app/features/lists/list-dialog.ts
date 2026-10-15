import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TemplatesStore } from '../../core/state/templates.store';
import {
  TIMEBOX_MODES,
  TITLE_MAX_LENGTH,
  type TimeboxMode,
  type TodoList,
} from '../../core/model';
import { focusAfterRender } from '../../shared/focus';

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

        @if (!editing() && templates().length > 0) {
          <label class="field">
            <span class="field__label">{{ t().listDialog.templateLabel }}</span>
            <select
              #templateSelect
              name="template"
              [ngModel]="templateId()"
              (ngModelChange)="onTemplateChange($event)"
            >
              <option [ngValue]="null">{{ t().listDialog.noTemplate }}</option>
              @for (template of templates(); track template.id) {
                <option [ngValue]="template.id">{{ template.title }}</option>
              }
            </select>
          </label>
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

    .field input[type='text'],
    .field select {
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
  private readonly injector = inject(Injector);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly templateSelect = viewChild<ElementRef<HTMLSelectElement>>('templateSelect');
  private readonly i18n = inject(I18nStore);
  protected readonly templates = inject(TemplatesStore).templates;

  protected readonly t = this.i18n.t;
  protected readonly modes = TIMEBOX_MODES;
  protected readonly maxTitle = TITLE_MAX_LENGTH;

  protected readonly title = signal('');
  protected readonly timeboxMode = signal<TimeboxMode>('none');
  protected readonly editing = signal(false);
  protected readonly error = signal('');
  protected readonly templateId = signal<string | null>(null);

  private editingId: string | null = null;
  private restoreFocusTo: HTMLElement | null = null;

  readonly saved = output<ListDialogResult>();

  /** Neuer Zettel; mit `fromTemplate` ist die erste Vorlage vorausgewählt. */
  showCreate(fromTemplate = false): void {
    this.editing.set(false);
    this.editingId = null;
    this.title.set('');
    this.timeboxMode.set('none');
    this.templateId.set(null);
    this.error.set('');
    const first = fromTemplate ? this.templates()[0] : undefined;
    if (first) this.onTemplateChange(first.id);
    this.open(first ? 'template' : 'title');
  }

  showEdit(list: TodoList): void {
    this.editing.set(true);
    this.editingId = list.id;
    this.title.set(list.title);
    this.timeboxMode.set(list.timeboxMode);
    this.templateId.set(null);
    this.error.set('');
    this.open('title');
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onTitleChange(value: string): void {
    this.title.set(value);
    if (this.error()) this.error.set('');
  }

  /** Vorlage gewählt: Titel (falls noch leer bzw. von der vorigen Vorlage) und Modus übernehmen. */
  protected onTemplateChange(id: string | null): void {
    const previous = this.templates().find((t) => t.id === this.templateId());
    const next = this.templates().find((t) => t.id === id);
    this.templateId.set(next ? next.id : null);
    if (!next) return;
    if (this.title().trim() === '' || this.title() === previous?.title) this.title.set(next.title);
    this.timeboxMode.set(next.timeboxMode);
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
    this.saved.emit({
      id: this.editingId,
      title,
      timeboxMode: this.timeboxMode(),
      templateId: this.editing() ? null : this.templateId(),
    });
    this.close();
  }

  protected onClosed(): void {
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  private open(focus: 'title' | 'template'): void {
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    const dialog = this.dialogRef().nativeElement;
    dialog.showModal();
    focusAfterRender(this.injector, () =>
      focus === 'template' ? this.templateSelect() : this.titleInput(),
    );
  }
}

export interface ListDialogResult {
  /** `null` = neuer Zettel. */
  id: string | null;
  title: string;
  timeboxMode: TimeboxMode;
  /** Nur beim Anlegen: Vorlage, aus der der Zettel entsteht. */
  templateId: string | null;
}
