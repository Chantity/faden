import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { templatePreview, templateToList } from '../../core/templates';
import { TemplatesStore } from '../../core/state/templates.store';
import { ListsStore } from '../../core/state/lists.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { TITLE_MAX_LENGTH, type Template } from '../../core/model';
import { focusAfterRender } from '../../shared/focus';

@Component({
  selector: 'app-templates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <h1>{{ t().titles.templates }}</h1>

    @if (store.templates().length === 0) {
      <div class="card empty">
        <p class="muted">{{ t().templates.placeholder }}</p>
      </div>
    } @else {
      <ul class="stack plain">
        @for (template of store.templates(); track template.id) {
          <li class="card template">
            <div class="template__head">
              <h2>{{ template.title }}</h2>
              <span class="muted">{{ t().templates.taskCount(template.tasks.length) }}</span>
            </div>

            <details class="template__preview">
              <summary class="muted">{{ t().templates.preview }}</summary>
              <ol class="muted">
                @for (title of preview(template); track $index) {
                  <li>{{ title }}</li>
                }
              </ol>
            </details>

            <div class="template__actions">
              <button type="button" class="btn btn--primary" (click)="createList(template)">
                {{ t().templates.newList }}
              </button>
              <button type="button" class="btn" (click)="startRename(template)">
                {{ t().common.rename }}
              </button>
              <button type="button" class="btn danger" (click)="remove(template)">
                {{ t().common.delete }}
              </button>
            </div>
          </li>
        }
      </ul>
    }

    <dialog #renameDlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (ngSubmit)="submitRename()">
        <h2>{{ t().common.rename }}</h2>
        <label class="field">
          <span class="field__label">{{ t().templates.nameLabel }}</span>
          <input
            #renameInput
            type="text"
            [value]="renameValue()"
            [attr.maxlength]="maxTitle"
            (input)="renameValue.set($any($event.target).value); renameTouched.set(true)"
            (keydown.enter)="renameTouched.set(true)"
            aria-describedby="template-name-hint"
          />
        </label>
        <p class="field__hint" id="template-name-hint" role="status">{{ renameHint() }}</p>
        <div class="sheet__actions">
          <button type="button" class="btn" (click)="closeRename()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary" [disabled]="renameEmpty() || renameTaken()">
            {{ t().common.save }}
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .plain {
      list-style: none;
      padding: 0;
    }

    .empty {
      padding: var(--space-5);
    }

    .template {
      padding: var(--space-4);
    }

    .template__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .template__head h2 {
      margin: 0;
    }

    .template__preview {
      margin: var(--space-2) 0;
    }

    .template__preview summary {
      cursor: pointer;
    }

    .template__preview ol {
      margin: var(--space-2) 0 0;
      padding-left: var(--space-5);
    }

    .template__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

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

    .field input {
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class TemplatesPage {
  private readonly injector = inject(Injector);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('renameDlg');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly router = inject(Router);
  private readonly lists = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);

  protected readonly store = inject(TemplatesStore);
  protected readonly t = inject(I18nStore).t;
  protected readonly maxTitle = TITLE_MAX_LENGTH;

  protected readonly renameValue = signal('');
  protected readonly renameTouched = signal(false);
  private readonly renamingId = signal<string | null>(null);

  /** Wie bei Zetteln: Namen sind nie leer und eindeutig; beides sperrt „Speichern“. */
  protected readonly renameEmpty = computed(() => this.renameValue().trim() === '');
  protected readonly renameTaken = computed(
    () => !this.renameEmpty() && this.store.isTitleTaken(this.renameValue(), this.renamingId() ?? undefined),
  );
  protected readonly renameHint = computed(() => {
    if (this.renameTaken()) return this.t().templates.titleTaken;
    return this.renameEmpty() && this.renameTouched() ? this.t().errors.titleRequired : '';
  });
  private restoreFocusTo: HTMLElement | null = null;

  constructor() {
    inject(PageTitleService).set('templates');
  }

  protected preview(template: Template): string[] {
    return templatePreview(template);
  }

  protected createList(template: Template): void {
    const id = this.lists.addNew(templateToList(template));
    void this.router.navigate(['/zettel', id]);
  }

  protected startRename(template: Template): void {
    this.renamingId.set(template.id);
    this.renameValue.set(template.title);
    this.renameTouched.set(false);
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    this.dialogRef().nativeElement.showModal();
    focusAfterRender(this.injector, () => this.renameInput());
  }

  protected closeRename(): void {
    this.dialogRef().nativeElement.close();
  }

  protected submitRename(): void {
    const id = this.renamingId();
    if (!id || this.renameEmpty() || this.renameTaken()) return;
    void this.store.rename(id, this.renameValue().trim());
    this.closeRename();
  }

  protected async remove(template: Template): Promise<void> {
    const removed = await this.store.remove(template.id);
    if (!removed) return;
    this.snackbar.show(this.t().templates.deletedSnack(removed.title), {
      label: this.t().common.undo,
      run: () => void this.store.restore(removed),
    });
  }

  protected onClosed(): void {
    this.renamingId.set(null);
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }
}
