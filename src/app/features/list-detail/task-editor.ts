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
import { FormsModule } from '@angular/forms';
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH, type Task, type TodoList } from '../../core/model';
import { connect, disconnect, predecessors, successors } from '../../core/graph';
import { formatDuration, fromDatetimeLocal, toDatetimeLocal, validateDayTimes } from '../../core/time';
import { describeGraphError } from '../../core/i18n/graph-error';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { focusAfterRender } from '../../shared/focus';

@Component({
  selector: 'app-task-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (ngSubmit)="submit()">
        <h2>{{ t().editor.title }}</h2>

        <label class="field">
          <span class="field__label">{{ t().editor.titleLabel }}</span>
          <input
            #titleInput
            type="text"
            name="title"
            [attr.maxlength]="maxTitle"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
            required
          />
        </label>

        <label class="field">
          <span class="field__label">{{ t().editor.notesLabel }}</span>
          <textarea
            name="notes"
            rows="3"
            [attr.maxlength]="maxNotes"
            [value]="notes()"
            (input)="notes.set($any($event.target).value)"
          ></textarea>
        </label>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        @if (mode() === 'estimate') {
          <div class="field">
            <span class="field__label">{{ t().editor.estimateLabel }}</span>
            <div class="chips">
              @for (minutes of estimateChips; track minutes) {
                <button
                  type="button"
                  class="chip chip--button"
                  [class.is-active]="estimate() === minutes"
                  (click)="estimate.set(minutes)"
                >
                  {{ minutes }} {{ t().editor.minutesSuffix }}
                </button>
              }
            </div>
            <label class="field field--inline">
              <span class="field__label">{{ t().editor.estimateCustom }}</span>
              <input
                type="number"
                min="1"
                max="1440"
                [value]="estimate() ?? ''"
                (input)="onEstimateInput($event)"
              />
            </label>
            @if (estimate() !== null) {
              <p class="muted">{{ formattedEstimate() }}</p>
            }
          </div>
        }

        @if (mode() === 'dayPlan') {
          <div class="field-row">
            <label class="field">
              <span class="field__label">{{ t().editor.dayStartLabel }}</span>
              <input
                type="time"
                [value]="dayStart()"
                (input)="dayStart.set($any($event.target).value)"
              />
            </label>
            <label class="field">
              <span class="field__label">{{ t().editor.dayEndLabel }}</span>
              <input
                type="time"
                [value]="dayEnd()"
                (input)="dayEnd.set($any($event.target).value)"
              />
            </label>
          </div>
        }

        @if (mode() === 'schedule') {
          <div class="field-row">
            <label class="field">
              <span class="field__label">{{ t().editor.startAtLabel }}</span>
              <input
                type="datetime-local"
                [value]="startAt()"
                (input)="startAt.set($any($event.target).value)"
              />
            </label>
            <label class="field">
              <span class="field__label">{{ t().editor.endAtLabel }}</span>
              <input
                type="datetime-local"
                [value]="endAt()"
                (input)="endAt.set($any($event.target).value)"
              />
            </label>
          </div>
        }

        <div class="links">
          <section class="links__group">
            <h3>{{ t().editor.predecessors }}</h3>
            <ul class="chips">
              @for (task of prevs(); track task.id) {
                <li class="chip">
                  <span>{{ task.title }}</span>
                  <button
                    type="button"
                    class="chip__x"
                    [attr.aria-label]="t().editor.removeLink(task.title)"
                    (click)="removePrev(task.id)"
                  >
                    ×
                  </button>
                </li>
              }
            </ul>
            <label class="add-link">
              <span class="sr-only">{{ t().editor.addLink }}</span>
              <select (change)="addPrev($event)">
                <option value="" selected>{{ t().editor.addLink }}</option>
                @for (candidate of prevCandidates(); track candidate.id) {
                  <option [value]="candidate.id">{{ candidate.title }}</option>
                }
              </select>
            </label>
          </section>

          <section class="links__group">
            <h3>{{ t().editor.successors }}</h3>
            <ul class="chips">
              @for (task of succs(); track task.id) {
                <li class="chip">
                  <span>{{ task.title }}</span>
                  <button
                    type="button"
                    class="chip__x"
                    [attr.aria-label]="t().editor.removeLink(task.title)"
                    (click)="removeSucc(task.id)"
                  >
                    ×
                  </button>
                </li>
              }
            </ul>
            <label class="add-link">
              <span class="sr-only">{{ t().editor.addLink }}</span>
              <select (change)="addSucc($event)">
                <option value="" selected>{{ t().editor.addLink }}</option>
                @for (candidate of succCandidates(); track candidate.id) {
                  <option [value]="candidate.id">{{ candidate.title }}</option>
                }
              </select>
            </label>
          </section>
        </div>

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary">{{ t().common.save }}</button>
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
    .field textarea {
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .field input[type='text'] {
      min-height: var(--touch-min);
    }

    .field__error {
      color: var(--color-danger);
      margin: 0;
    }

    .field-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .field-row .field {
      flex: 1 1 180px;
    }

    .field--inline {
      flex-direction: row;
      align-items: center;
      gap: var(--space-3);
    }

    .field--inline input[type='number'] {
      width: 7rem;
    }

    .field input[type='time'],
    .field input[type='datetime-local'],
    .field input[type='number'] {
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .chip--button {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
    }

    .chip--button.is-active {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .links {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .links__group h3 {
      margin: 0 0 var(--space-2);
      font-size: 0.95rem;
    }

    .chips {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0 0 var(--space-2);
      padding: 0;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      background: var(--color-accent-soft);
      border-radius: var(--radius-sm);
    }

    .chip__x {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
    }

    .add-link select {
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
export class TaskEditor {
  private readonly injector = inject(Injector);
  private readonly store = inject(ListsStore);
  private readonly i18n = inject(I18nStore);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly t = this.i18n.t;
  protected readonly maxTitle = TITLE_MAX_LENGTH;
  protected readonly maxNotes = NOTES_MAX_LENGTH;

  private readonly listId = signal<string | null>(null);
  private readonly taskId = signal<string | null>(null);

  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly error = signal('');

  protected readonly estimate = signal<number | null>(null);
  protected readonly dayStart = signal('');
  protected readonly dayEnd = signal('');
  protected readonly startAt = signal('');
  protected readonly endAt = signal('');

  protected readonly estimateChips = [5, 10, 15, 30, 45, 60, 90];

  protected readonly mode = computed(() => this.list()?.timeboxMode ?? 'none');

  protected readonly formattedEstimate = computed(() => {
    const minutes = this.estimate();
    return minutes !== null ? formatDuration(minutes, this.i18n.locale()) : '';
  });

  protected readonly list = computed<TodoList | undefined>(() => {
    const id = this.listId();
    return id ? this.store.getList(id) : undefined;
  });

  protected readonly task = computed<Task | undefined>(() => {
    const list = this.list();
    const id = this.taskId();
    return list && id ? list.tasks.find((t) => t.id === id) : undefined;
  });

  protected readonly prevs = computed<Task[]>(() => {
    const list = this.list();
    const id = this.taskId();
    return list && id ? predecessors(list, id) : [];
  });

  protected readonly succs = computed<Task[]>(() => {
    const list = this.list();
    const id = this.taskId();
    return list && id ? successors(list, id) : [];
  });

  protected readonly prevCandidates = computed<Task[]>(() =>
    this.candidates((t) => !this.succs().some((s) => s.id === t.id)),
  );

  protected readonly succCandidates = computed<Task[]>(() =>
    this.candidates((t) => !this.prevs().some((s) => s.id === t.id)),
  );

  private candidates(extra: (task: Task) => boolean): Task[] {
    const list = this.list();
    const id = this.taskId();
    if (!list || !id) return [];
    return list.tasks.filter((t) => t.id !== id && extra(t));
  }

  open(listId: string, taskId: string): void {
    const list = this.store.getList(listId);
    const task = list?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    this.listId.set(listId);
    this.taskId.set(taskId);
    this.title.set(task.title);
    this.notes.set(task.notes ?? '');
    this.estimate.set(task.estimateMinutes ?? null);
    this.dayStart.set(task.dayStart ?? '');
    this.dayEnd.set(task.dayEnd ?? '');
    this.startAt.set(toDatetimeLocal(task.startAt));
    this.endAt.set(toDatetimeLocal(task.endAt));
    this.error.set('');
    this.dialogRef().nativeElement.showModal();
    focusAfterRender(this.injector, () => this.titleInput());
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    this.listId.set(null);
    this.taskId.set(null);
  }

  protected submit(): void {
    const list = this.list();
    const id = this.taskId();
    if (!list || !id) return;
    const title = this.title().trim();
    if (title.length === 0) {
      this.error.set(this.t().errors.titleRequired);
      return;
    }
    const notes = this.notes().trim();

    let timeFields: Partial<Task> = {};
    if (list.timeboxMode === 'estimate') {
      const minutes = this.estimate();
      if (minutes !== null && (minutes < 1 || minutes > 1440)) {
        this.error.set(this.t().editor.errorTimeInvalid);
        return;
      }
      timeFields = { estimateMinutes: minutes ?? undefined };
    } else if (list.timeboxMode === 'dayPlan') {
      const check = validateDayTimes(this.dayStart(), this.dayEnd());
      if (!check.ok) {
        this.error.set(
          check.message === 'order' ? this.t().editor.errorTimeOrder : this.t().editor.errorTimeInvalid,
        );
        return;
      }
      timeFields = {
        dayStart: this.dayStart() || undefined,
        dayEnd: this.dayEnd() || undefined,
      };
    } else if (list.timeboxMode === 'schedule') {
      const start = this.startAt();
      const end = this.endAt();
      if (start && end && new Date(end) <= new Date(start)) {
        this.error.set(this.t().editor.errorTimeOrder);
        return;
      }
      timeFields = {
        startAt: start ? fromDatetimeLocal(start) : undefined,
        endAt: end ? fromDatetimeLocal(end) : undefined,
      };
    }

    this.store.editList(list.id, (l) => ({
      ...l,
      tasks: l.tasks.map((t) =>
        t.id === id ? { ...t, title, notes: notes || undefined, ...timeFields } : t,
      ),
    }));
    this.close();
  }

  protected onEstimateInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.estimate.set(null);
      return;
    }
    const value = Number(raw);
    this.estimate.set(Number.isFinite(value) ? Math.round(value) : null);
  }

  protected addPrev(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resetSelect(event);
    if (value) this.connect(value, this.taskId(), 'before');
  }

  protected addSucc(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resetSelect(event);
    if (value) this.connect(this.taskId(), value, 'after');
  }

  protected removePrev(prevId: string): void {
    this.disconnectPair(prevId, this.taskId());
  }

  protected removeSucc(succId: string): void {
    this.disconnectPair(this.taskId(), succId);
  }

  private connect(from: string | null, to: string | null, _direction: 'before' | 'after'): void {
    const list = this.list();
    if (!list || !from || !to) return;
    try {
      this.store.editList(list.id, (l) => connect(l, from, to));
      this.error.set('');
    } catch (error) {
      this.error.set(describeGraphError(this.t(), list, error));
    }
  }

  private disconnectPair(from: string | null, to: string | null): void {
    const list = this.list();
    if (!list || !from || !to) return;
    const edge = list.edges.find((e) => e.from === from && e.to === to);
    if (!edge) return;
    this.store.editList(list.id, (l) => disconnect(l, edge.id));
  }

  private resetSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    select.value = '';
  }
}
