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
import type { TodoList } from '../../core/model';
import { extractStrand, reachableIds, topologicalOrder } from '../../core/graph';
import {
  formatDayLabel,
  fromDatetimeLocal,
  planBounds,
  proposeTimes,
  shiftLeavesDay,
  shiftPlan,
  stretchPlan,
  taskSpan,
  toDatetimeLocal,
  toLocalIso,
  todayIso,
  transferDayTimesToList,
} from '../../core/time';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';

type ShiftUnit = 'minutes' | 'hours' | 'days';

const UNIT_MS: Record<ShiftUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

/**
 * „Zeitplan bearbeiten": Alles verschieben, auf einen Zeitraum
 * strecken, Zeiten aus Schätzungen vorschlagen und Tageszeiten auf ein Datum
 * übertragen.
 */
@Component({
  selector: 'app-plan-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <div class="sheet__form">
        <h2>
          @if (!strandOnly()) {
            {{ t().time.editPlanTitle }}
          } @else if (entry() === 'from') {
            {{ t().time.shiftFromHeading }}
          } @else {
            {{ t().time.shiftStrandHeading }}
          }
        </h2>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        @if (!convertOnly()) {
          <fieldset class="section">
            <legend class="field__label">{{ strandOnly() ? t().time.scopeLabel : t().time.shiftHeading }}</legend>
            @if (strandOnly()) {
              <label class="radio">
                <input type="radio" name="scope" [checked]="scope() === 'from'" (change)="scope.set('from')" />
                {{ t().time.scopeFrom }}
              </label>
              <label class="radio">
                <input type="radio" name="scope" [checked]="scope() === 'strand'" (change)="scope.set('strand')" />
                {{ t().time.scopeStrand }}
              </label>
              <label class="radio">
                <input type="radio" name="scope" [checked]="scope() === 'list'" (change)="scope.set('list')" />
                {{ t().time.scopeList }}
              </label>
            }
            <div class="row">
              <input
                type="number"
                class="input"
                [value]="shiftAmount()"
                (input)="onShiftAmount($event)"
              />
              <select class="input" [value]="shiftUnit()" (change)="onShiftUnit($event)">
                <option value="minutes">{{ t().time.unitMinutes }}</option>
                <option value="hours">{{ t().time.unitHours }}</option>
                @if (mode() === 'schedule') {
                  <option value="days">{{ t().time.unitDays }}</option>
                }
              </select>
              <button type="button" class="btn btn--primary" data-action="shift" (click)="applyShift()">
                {{ t().time.shiftApply }}
              </button>
            </div>
            @if (shiftPreview(); as preview) {
              <p class="hint muted" aria-live="polite">{{ preview }}</p>
            }
          </fieldset>

          <!-- Strecken und Vorschlagen wirken immer auf den ganzen Zettel. -->
          @if (!strandOnly()) {
          @if (mode() === 'schedule') {
            <fieldset class="section">
              <legend class="field__label">{{ t().time.stretchHeading }}</legend>
              <div class="row">
                <label class="field">
                  <span class="field__label">{{ t().time.stretchStart }}</span>
                  <input
                    type="datetime-local"
                    class="input"
                    [value]="stretchStart()"
                    (input)="stretchStart.set($any($event.target).value)"
                  />
                </label>
                <label class="field">
                  <span class="field__label">{{ t().time.stretchEnd }}</span>
                  <input
                    type="datetime-local"
                    class="input"
                    [value]="stretchEnd()"
                    (input)="stretchEnd.set($any($event.target).value)"
                  />
                </label>
                <button type="button" class="btn btn--primary" data-action="stretch" (click)="applyStretch()">
                  {{ t().time.stretchApply }}
                </button>
              </div>
            </fieldset>
          }

          <fieldset class="section">
            <legend class="field__label">{{ t().time.proposeHeading }}</legend>
            <div class="row">
              @if (mode() === 'schedule') {
                <input
                  type="datetime-local"
                  class="input"
                  [value]="proposeStart()"
                  (input)="proposeStart.set($any($event.target).value)"
                />
              } @else {
                <input
                  type="time"
                  class="input"
                  [value]="proposeStart()"
                  (input)="proposeStart.set($any($event.target).value)"
                />
              }
              <button type="button" class="btn btn--primary" data-action="propose" (click)="applyPropose()">
                {{ t().time.proposeApply }}
              </button>
            </div>
          </fieldset>
          }
        }

        @if ((mode() === 'dayPlan' && !strandOnly()) || convertOnly()) {
          <fieldset class="section">
            <legend class="field__label">{{ t().time.convertHeading }}</legend>
            @if (convertOnly()) {
              <p>{{ t().time.convertOffer }}</p>
            }
            <p class="hint muted">{{ t().time.convertHint }}</p>
            <div class="row">
              <label class="field">
                <span class="field__label">{{ t().time.convertDate }}</span>
                <input
                  type="date"
                  class="input"
                  [value]="convertDate()"
                  (input)="convertDate.set($any($event.target).value)"
                />
              </label>
              <button type="button" class="btn btn--primary" data-action="convert" (click)="applyConvert()">
                {{ t().time.convertApply }}
              </button>
            </div>
          </fieldset>
        }

        <div class="sheet__actions">
          <button type="button" class="btn" (click)="close()">
            {{ convertOnly() ? t().time.convertSkip : t().common.cancel }}
          </button>
        </div>
      </div>
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

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: var(--space-3);
      margin: 0;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .field__label {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-2);
    }

    .input {
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .input[type='number'] {
      width: 6rem;
    }

    .radio {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch-min);
    }

    .field__error {
      color: var(--color-danger);
      margin: 0;
    }

    .hint {
      margin: 0;
      font-size: 0.9rem;
    }

    .sheet__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class PlanEditor {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly store = inject(ListsStore);
  private readonly i18n = inject(I18nStore);
  private readonly nowStore = inject(NowStore);

  protected readonly t = this.i18n.t;

  private readonly listId = signal<string | null>(null);
  protected readonly mode = computed(() => {
    const id = this.listId();
    return id ? (this.store.getList(id)?.timeboxMode ?? 'none') : 'none';
  });

  protected readonly shiftAmount = signal(30);
  protected readonly shiftUnit = signal<ShiftUnit>('minutes');
  protected readonly stretchStart = signal('');
  protected readonly stretchEnd = signal('');
  protected readonly proposeStart = signal('');
  protected readonly convertDate = signal('');

  protected readonly error = signal('');
  /** Nur „Tageszeiten übertragen" zeigen (Angebot nach Moduswechsel). */
  protected readonly convertOnly = signal(false);

  /**
   * Gesetzt = „Ab hier / Strang verschieben …" aus dem Karten-Menü: nur Verschieben,
   * mit Bereich – ab dem ToDo (es und alles danach), sein Strang oder der ganze Zettel.
   */
  private readonly taskScopes = signal<Record<'from' | 'strand', ReadonlySet<string>> | null>(null);
  protected readonly strandOnly = computed(() => this.taskScopes() !== null);
  protected readonly entry = signal<'from' | 'strand'>('strand');
  protected readonly scope = signal<'from' | 'strand' | 'list'>('list');

  private scopeIds(): ReadonlySet<string> | undefined {
    const scope = this.scope();
    return scope === 'list' ? undefined : this.taskScopes()?.[scope];
  }

  private deltaMs(): number {
    return this.shiftAmount() * UNIT_MS[this.shiftUnit()];
  }

  /** Erste und letzte Zeit des Bereichs nach dem Verschieben. */
  protected readonly shiftPreview = computed(() => {
    const id = this.listId();
    const list = id ? this.store.getList(id) : undefined;
    if (!list) return '';
    const ids = this.scopeIds();
    const shifted = shiftPlan(list, this.deltaMs(), ids);
    let first = Infinity;
    let last = -Infinity;
    for (const task of shifted.tasks) {
      const span = (!ids || ids.has(task.id)) && taskSpan(shifted, task);
      if (!span) continue;
      first = Math.min(first, span.start);
      last = Math.max(last, span.end);
    }
    if (first === Infinity) return '';
    return this.t().time.shiftPreview(this.formatAt(list, first), this.formatAt(list, last));
  });

  private formatAt(list: TodoList, ms: number): string {
    const date = new Date(ms);
    const time = toLocalIso(date).slice(11);
    return list.timeboxMode === 'schedule' ? `${formatDayLabel(date, this.i18n.locale())} ${time}` : time;
  }

  private restoreFocusTo: HTMLElement | null = null;

  /** Bietet nach dem Wechsel Tagesplan → fester Zeitplan das Übertragen an. */
  openConvert(list: TodoList): void {
    this.open(list);
    this.convertOnly.set(true);
    this.convertDate.set(list.dayPlanReferenceDate ?? todayIso(this.nowStore.now()));
  }

  /** „Ab hier / Strang verschieben …" für `taskId`; der Bereich bleibt im Sheet wählbar. */
  openStrand(list: TodoList, taskId: string, entry: 'from' | 'strand' = 'strand'): void {
    this.open(list);
    this.taskScopes.set({
      from: new Set([taskId, ...reachableIds(list, taskId, 'out')]),
      strand: new Set(extractStrand(list, taskId).tasks.map((task) => task.id)),
    });
    this.entry.set(entry);
    this.scope.set(entry);
  }

  open(list: TodoList): void {
    this.convertOnly.set(false);
    this.taskScopes.set(null);
    this.scope.set('list');
    this.listId.set(list.id);
    this.error.set('');
    this.shiftAmount.set(30);
    this.shiftUnit.set('minutes');
    this.proposeStart.set(
      list.timeboxMode === 'schedule' ? toDatetimeLocal(todayIso(this.nowStore.now()) + 'T09:00') : '09:00',
    );
    this.convertDate.set(todayIso(this.nowStore.now()));
    const bounds = planBounds(list);
    this.stretchStart.set(bounds ? toDatetimeLocal(bounds.start) : '');
    this.stretchEnd.set(bounds ? toDatetimeLocal(bounds.end) : '');
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    this.dialogRef().nativeElement.showModal();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onShiftAmount(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.shiftAmount.set(Number.isFinite(value) ? value : 0);
  }

  protected onShiftUnit(event: Event): void {
    this.shiftUnit.set((event.target as HTMLSelectElement).value as ShiftUnit);
  }

  protected applyShift(): void {
    const id = this.listId();
    const list = id ? this.store.getList(id) : undefined;
    if (!id || !list) return;
    const ids = this.scopeIds();
    if (shiftLeavesDay(list, this.deltaMs(), ids)) {
      this.error.set(this.t().time.errorShiftDay);
      return;
    }
    this.store.editList(id, (current) => shiftPlan(current, this.deltaMs(), ids));
    this.close();
  }

  protected applyStretch(): void {
    const id = this.listId();
    if (!id) return;
    const list = this.store.getList(id);
    if (!list) return;
    const bounds = planBounds(list);
    const newStart = fromDatetimeLocal(this.stretchStart());
    const newEnd = fromDatetimeLocal(this.stretchEnd());
    if (!bounds || !newStart || !newEnd) {
      this.error.set(this.t().editor.errorTimeInvalid);
      return;
    }
    if (new Date(newEnd) <= new Date(newStart)) {
      this.error.set(this.t().editor.errorTimeOrder);
      return;
    }
    this.store.editList(id, (current) =>
      stretchPlan(current, {
        oldStart: bounds.start,
        oldEnd: bounds.end,
        newStart,
        newEnd,
      }),
    );
    this.close();
  }

  protected applyPropose(): void {
    const id = this.listId();
    if (!id) return;
    const list = this.store.getList(id);
    if (!list) return;
    let start = this.proposeStart();
    if (list.timeboxMode === 'schedule') {
      const normalized = fromDatetimeLocal(start);
      if (!normalized) {
        this.error.set(this.t().editor.errorTimeInvalid);
        return;
      }
      start = normalized;
    } else {
      if (!/^\d{2}:\d{2}$/.test(start)) {
        this.error.set(this.t().editor.errorTimeInvalid);
        return;
      }
      start = `${todayIso(this.nowStore.now())}T${start}`;
    }
    const order = topologicalOrder(list).map((task) => task.id);
    this.store.editList(id, (current) => proposeTimes(current, { startAt: start }, order));
    this.close();
  }

  protected applyConvert(): void {
    const id = this.listId();
    if (!id) return;
    const date = this.convertDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.error.set(this.t().editor.errorTimeInvalid);
      return;
    }
    this.store.editList(id, (current) => transferDayTimesToList(current, date));
    this.close();
  }

  protected onClosed(): void {
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }
}
