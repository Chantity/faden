import {
  afterNextRender,
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
import {
  CHECKLIST_MAX_ITEMS,
  createTask,
  NOTES_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type ChecklistItem,
  type Task,
  type TodoList,
} from '../../core/model';
import { checklistToText, textToChecklist } from '../../core/checklist';
import {
  connect,
  disconnect,
  insertAt,
  nextInChain,
  predecessors,
  successors,
  type InsertPosition,
} from '../../core/graph';
import { formatDuration, fromDatetimeLocal, toDatetimeLocal, validateDayTimes } from '../../core/time';
import { describeGraphError } from '../../core/i18n/graph-error';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { focusAfterRender } from '../../shared/focus';

type DescKind = 'text' | 'checklist';

/** Anfrage einer Ansicht, ein ToDo anzulegen (öffnet das Sheet im Anlege-Modus). */
export interface CreateRequest {
  position: InsertPosition;
  chain: boolean;
}

/** Lässt `undefined`-Felder weg, damit gespeicherte ToDos schlank bleiben. */
function withoutEmpty(task: Task): Task {
  return Object.fromEntries(Object.entries(task).filter(([, v]) => v !== undefined)) as unknown as Task;
}

@Component({
  selector: 'app-task-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <form class="sheet__form" (ngSubmit)="submit()">
        <h2>{{ heading() }}</h2>

        <label class="field">
          <span class="field__label">{{ t().editor.titleLabel }}</span>
          <input
            #titleInput
            type="text"
            name="title"
            [attr.maxlength]="maxTitle"
            [placeholder]="placeholder()"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
            (keydown.enter)="onTitleEnter($event)"
            (paste)="onTitlePaste($event)"
          />
        </label>
        @if (creating()?.chain) {
          <p class="muted sheet__hint">{{ t().editor.chainHint }}</p>
        }

        <div class="field">
          <div class="desc-head">
            <span class="field__label" id="desc-label">{{ t().editor.notesLabel }}</span>
            <div class="segmented" role="radiogroup" aria-labelledby="desc-label">
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="kind() === 'text'"
                (click)="setKind('text')"
              >
                {{ t().editor.descText }}
              </button>
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="kind() === 'checklist'"
                (click)="setKind('checklist')"
              >
                {{ t().editor.descChecklist }}
              </button>
            </div>
          </div>
          @if (kind() === 'text') {
            <textarea
              name="notes"
              rows="3"
              aria-labelledby="desc-label"
              [attr.maxlength]="maxNotes"
              [value]="notes()"
              (input)="notes.set($any($event.target).value)"
            ></textarea>
          } @else {
            <ul class="checklist-edit">
              @for (item of checklist(); track item.id; let i = $index) {
                <li>
                  <label class="checklist-edit__check">
                    <input
                      type="checkbox"
                      [checked]="item.done"
                      [attr.aria-label]="t().editor.checklistItem(i + 1)"
                      (change)="updateItem(i, { done: $any($event.target).checked })"
                    />
                  </label>
                  <input
                    type="text"
                    class="checklist-edit__text"
                    [attr.maxlength]="maxTitle"
                    [attr.aria-label]="t().editor.checklistItem(i + 1)"
                    [value]="item.text"
                    (input)="updateItem(i, { text: $any($event.target).value })"
                    (keydown.enter)="onItemEnter($event, i)"
                  />
                  <button
                    type="button"
                    class="icon-btn"
                    [attr.aria-label]="t().editor.checklistRemove(i + 1)"
                    (click)="removeItem(i)"
                  >
                    ✕
                  </button>
                </li>
              }
            </ul>
            @if (checklist().length < maxItems) {
              <button type="button" class="btn checklist-edit__add" (click)="addItem(checklist().length)">
                + {{ t().editor.checklistAdd }}
              </button>
            }
          }
        </div>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        @if (mode() === 'dayPlan') {
          <label class="field">
            <span class="field__label">{{ t().editor.dayStartLabel }}</span>
            <input
              type="time"
              [value]="dayStart()"
              (input)="dayStart.set($any($event.target).value)"
            />
          </label>
        }

        @if (mode() === 'schedule') {
          <label class="field">
            <span class="field__label">{{ t().editor.startAtLabel }}</span>
            <input
              type="datetime-local"
              [value]="startAt()"
              (input)="startAt.set($any($event.target).value)"
            />
          </label>
        }

        @if (mode() !== 'none') {
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
                [attr.max]="maxMinutes()"
                [value]="estimate() ?? ''"
                (input)="onEstimateInput($event)"
              />
            </label>
            @if (estimate() !== null) {
              <p class="muted">{{ formattedEstimate() }}</p>
            }
          </div>
        }

        @if (!creating()) {
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
        }

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
          <button type="submit" class="btn btn--primary">{{ submitLabel() }}</button>
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

  protected readonly maxItems = CHECKLIST_MAX_ITEMS;

  /** Gesetzt = Anlegen (statt Bearbeiten): wo, und ob Enter eine Kette fortsetzt. */
  protected readonly creating = signal<{ position: InsertPosition; chain: boolean } | null>(null);

  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly kind = signal<DescKind>('text');
  protected readonly checklist = signal<ChecklistItem[]>([]);
  protected readonly error = signal('');

  protected readonly heading = computed(() => {
    const creating = this.creating();
    if (!creating) return this.t().editor.title;
    return creating.position.kind === 'before' ? this.t().focus.newWorkLabel : this.t().focus.newTodoLabel;
  });

  protected readonly placeholder = computed(() =>
    this.creating()?.position.kind === 'before' ? this.t().focus.newWorkPlaceholder : this.t().focus.addPlaceholder,
  );

  protected readonly submitLabel = computed(() => {
    const creating = this.creating();
    if (!creating) return this.t().common.save;
    return creating.chain ? this.t().focus.finish : this.t().listDialog.create;
  });

  protected readonly estimate = signal<number | null>(null);
  protected readonly dayStart = signal('');
  protected readonly startAt = signal('');

  protected readonly estimateChips = [5, 10, 15, 30, 45, 60, 90];

  protected readonly mode = computed(() => this.list()?.timeboxMode ?? 'none');
  /** Im festen Zeitplan darf ein ToDo mehrere Tage dauern (bis 14 Tage). */
  protected readonly maxMinutes = computed(() => (this.mode() === 'schedule' ? 14 * 1440 : 1440));

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

  /** Bearbeiten eines vorhandenen ToDos. */
  open(listId: string, taskId: string): void {
    const list = this.store.getList(listId);
    const task = list?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    this.listId.set(listId);
    this.taskId.set(taskId);
    this.creating.set(null);
    this.resetFields();
    this.title.set(task.title);
    this.notes.set(task.notes ?? '');
    this.kind.set(task.checklist ? 'checklist' : 'text');
    this.checklist.set(task.checklist ?? []);
    this.estimate.set(task.estimateMinutes ?? null);
    this.dayStart.set(task.dayStart ?? '');
    this.startAt.set(toDatetimeLocal(task.startAt));
    this.show();
  }

  /**
   * Anlegen an `position`. Mit `chain` legt Enter im Titel an und öffnet sofort
   * das nächste leere Sheet (Vorarbeiten reihen sich davor, sonst danach).
   */
  create(listId: string, position: InsertPosition, chain = false): void {
    if (!this.store.getList(listId)) return;
    this.listId.set(listId);
    this.taskId.set(null);
    this.creating.set({ position, chain });
    this.resetFields();
    this.show();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    this.listId.set(null);
    this.taskId.set(null);
    this.creating.set(null);
    // War der Auslöser eine Karte, die es nicht mehr gibt (z. B. die neue Vorarbeit
    // hat sie aus „Jetzt dran" verdrängt), landet der Fokus beim nächsten „Erledigt".
    afterNextRender(
      () => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        document.querySelector<HTMLElement>('[data-task-id] .task-card__done')?.focus();
      },
      { injector: this.injector },
    );
  }

  protected submit(): void {
    if (this.creating()) {
      this.commitCreate(false);
      return;
    }
    const list = this.list();
    const id = this.taskId();
    if (!list || !id) return;
    const title = this.title().trim();
    if (title.length === 0) {
      this.error.set(this.t().errors.titleRequired);
      return;
    }
    const time = this.timeFields(list);
    if (!time) return;
    const description = this.description();
    this.store.editList(list.id, (l) => ({
      ...l,
      tasks: l.tasks.map((t) => (t.id === id ? { ...t, title, ...description, ...time } : t)),
    }));
    this.close();
  }

  /** Enter im Titel: beim Anlegen sofort anlegen (in einer Kette gleich das nächste). */
  protected onTitleEnter(event: Event): void {
    if (!this.creating()) return; // Bearbeiten: normales Absenden des Formulars
    event.preventDefault();
    this.commitCreate(true);
  }

  /** Mehrzeilig eingefügter Text wird beim Anlegen zu einer Kette: eine Zeile, ein ToDo. */
  protected onTitlePaste(event: ClipboardEvent): void {
    const creating = this.creating();
    const text = event.clipboardData?.getData('text') ?? '';
    if (!creating || !/\r?\n/.test(text)) return;
    event.preventDefault();
    this.creating.set({ ...creating, chain: true });
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.title.set(line);
      this.commitCreate(true);
    }
  }

  private commitCreate(next: boolean): void {
    const list = this.list();
    const creating = this.creating();
    if (!list || !creating) return;
    const title = this.title().trim();
    if (!title) {
      // „Fertig" mit leerem Feld beendet die Kette einfach.
      if (creating.chain && !next) this.close();
      else this.error.set(this.t().errors.titleRequired);
      return;
    }
    const time = this.timeFields(list);
    if (!time) return;
    const task: Task = withoutEmpty({ ...createTask(title), ...this.description(), ...time });
    try {
      this.store.editList(list.id, (l) => insertAt(l, creating.position, task));
    } catch (error) {
      this.error.set(describeGraphError(this.t(), list, error));
      return;
    }
    if (next && creating.chain) {
      this.creating.set({ position: nextInChain(creating.position, task.id), chain: true });
      this.resetFields();
      focusAfterRender(this.injector, () => this.titleInput());
    } else {
      this.close();
    }
  }

  /** Beschreibung je nach Art: Freitext oder Checkliste (leere Punkte entfallen). */
  private description(): Pick<Task, 'notes' | 'checklist'> {
    if (this.kind() === 'text') {
      return { notes: this.notes().trim() || undefined, checklist: undefined };
    }
    const items = this.checklist()
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text !== '');
    return { notes: undefined, checklist: items.length > 0 ? items : undefined };
  }

  /** Zeitfelder je Modus; `null` = ungültig (Fehler ist gesetzt). */
  private timeFields(list: TodoList): Partial<Task> | null {
    if (list.timeboxMode === 'none') return {};
    const minutes = this.estimate() ?? undefined;
    if (minutes !== undefined && (minutes < 1 || minutes > this.maxMinutes())) {
      this.error.set(this.t().editor.errorTimeInvalid);
      return null;
    }
    const fields: Partial<Task> = { estimateMinutes: minutes };
    if (list.timeboxMode === 'dayPlan') {
      const check = validateDayTimes(this.dayStart(), minutes);
      if (!check.ok) {
        this.error.set(
          check.message === 'order' ? this.t().editor.errorTimeOrder : this.t().editor.errorTimeInvalid,
        );
        return null;
      }
      fields.dayStart = this.dayStart() || undefined;
    } else if (list.timeboxMode === 'schedule') {
      fields.startAt = fromDatetimeLocal(this.startAt());
    }
    return fields;
  }

  private resetFields(): void {
    this.title.set('');
    this.notes.set('');
    this.kind.set('text');
    this.checklist.set([]);
    this.estimate.set(null);
    this.dayStart.set('');
    this.startAt.set('');
    this.error.set('');
  }

  private show(): void {
    const dialog = this.dialogRef().nativeElement;
    if (!dialog.open) dialog.showModal();
    focusAfterRender(this.injector, () => this.titleInput());
  }

  // --- Checkliste -----------------------------------------------------------

  /** Umschalten ohne Inhaltsverlust: Punkte ↔ Stichpunkt-Zeilen (Haken entfallen). */
  protected setKind(kind: DescKind): void {
    if (kind === this.kind()) return;
    if (kind === 'checklist') {
      const { items, cut } = textToChecklist(this.notes());
      this.checklist.set(items);
      this.notes.set('');
      this.error.set(cut ? this.t().editor.checklistCut : '');
    } else {
      this.notes.set(checklistToText(this.checklist()).slice(0, NOTES_MAX_LENGTH));
      this.checklist.set([]);
    }
    this.kind.set(kind);
  }

  protected updateItem(index: number, change: Partial<ChecklistItem>): void {
    this.checklist.update((items) => items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  }

  protected addItem(at: number): void {
    if (this.checklist().length >= CHECKLIST_MAX_ITEMS) return;
    const item: ChecklistItem = { id: crypto.randomUUID(), text: '', done: false };
    this.checklist.update((items) => [...items.slice(0, at), item, ...items.slice(at)]);
    afterNextRender(
      () => this.dialogRef().nativeElement.querySelectorAll<HTMLInputElement>('.checklist-edit__text')[at]?.focus(),
      { injector: this.injector },
    );
  }

  /** Enter in einem Punkt legt direkt darunter einen neuen an. */
  protected onItemEnter(event: Event, index: number): void {
    event.preventDefault();
    this.addItem(index + 1);
  }

  protected removeItem(index: number): void {
    this.checklist.update((items) => items.filter((_, i) => i !== index));
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
