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
import { topologicalOrder } from '../../core/graph';
import {
  fromDatetimeLocal,
  planBounds,
  proposeTimes,
  shiftPlan,
  stretchPlan,
  toDatetimeLocal,
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
 * „Zeitplan bearbeiten" (SPEC 7.4/7.5): Alles verschieben, auf einen Zeitraum
 * strecken, Zeiten aus Schätzungen vorschlagen und Tageszeiten auf ein Datum
 * übertragen.
 */
@Component({
  selector: 'app-plan-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="sheet" (close)="onClosed()">
      <div class="sheet__form">
        <h2>{{ t().time.editPlanTitle }}</h2>

        @if (error()) {
          <p class="field__error" role="alert">{{ error() }}</p>
        }

        <fieldset class="section">
          <legend class="field__label">{{ t().time.shiftHeading }}</legend>
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
        </fieldset>

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

        @if (mode() === 'dayPlan') {
          <fieldset class="section">
            <legend class="field__label">{{ t().time.convertHeading }}</legend>
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
          <button type="button" class="btn" (click)="close()">{{ t().common.cancel }}</button>
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

  private restoreFocusTo: HTMLElement | null = null;

  open(list: TodoList): void {
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
    if (!id) return;
    const deltaMs = this.shiftAmount() * UNIT_MS[this.shiftUnit()];
    this.store.editList(id, (list) => shiftPlan(list, deltaMs));
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
