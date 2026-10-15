import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import {
  availableTasks,
  blockedTasks,
  blockingTasks,
  deleteBridges,
  deleteTask,
  type DeleteMode,
  openPredecessors,
  successors,
  topologicalOrder,
} from '../../core/graph';
import type { ChecklistItem, Task, TodoList } from '../../core/model';
import {
  formatDayLabel,
  fromIsoDate,
  plannedTimeParts,
  referenceRelation,
  sortPlannedFirst,
  timeStatus,
  todayIso,
  type TimeStatus,
} from '../../core/time';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { SettingsStore } from '../../core/state/settings.store';
import { actionFor } from '../../core/keymap';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { closeMenu } from '../../shared/menus';
import type { CreateRequest } from './task-editor';

@Component({
  selector: 'app-focus-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    @if (list().tasks.length === 0) {
      <div class="empty card">
        <h2>{{ t().focus.emptyHeading }}</h2>
        <button type="button" class="btn btn--primary btn--large" (click)="startStandalone()">
          {{ t().focus.add }}
        </button>
      </div>
    } @else {
      <div class="focus__bar">
        <button
          type="button"
          class="icon-btn"
          [attr.aria-label]="t().focus.newTodo"
          (click)="startStandalone()"
        >
          ✚
        </button>
      </div>

      @if (showDayPlanBanner()) {
        <div class="plan-banner" role="status">
          <p class="plan-banner__text">{{ t().time.dayPlanPast(dayPlanReferenceLabel()) }}</p>
          <div class="plan-banner__actions">
            <button type="button" class="btn btn--primary" (click)="transferDayPlanToToday()">
              {{ t().time.dayPlanTransfer }}
            </button>
            <button type="button" class="btn" (click)="dismissDayPlanBanner()">
              {{ t().time.dayPlanKeep }}
            </button>
          </div>
        </div>
      }

      @if (available().length > 0) {
        <ul class="cards">
          @for (task of available(); track task.id) {
            <li class="card task-card" [attr.data-task-id]="task.id">
              <article>
                <h2 class="task-card__title">{{ task.title }}</h2>
                @if (task.notes) {
                  <p class="task-card__notes muted">{{ task.notes }}</p>
                }
                @if (task.checklist; as items) {
                  <details class="task-card__checklist" open>
                    <summary>
                      {{
                        checkedCount(items) === items.length
                          ? t().editor.checklistAllDone
                          : t().editor.checklistProgress(checkedCount(items), items.length)
                      }}
                    </summary>
                    <ul class="checklist">
                      @for (item of items; track item.id) {
                        <li>
                          <label>
                            <input
                              type="checkbox"
                              [checked]="item.done"
                              (change)="toggleItem(task, item.id)"
                            />
                            <span [class.is-done]="item.done">{{ item.text }}</span>
                          </label>
                        </li>
                      }
                    </ul>
                  </details>
                }
                @if (thenLabel(task); as then) {
                  <p class="task-card__then muted">{{ then }}</p>
                }
                @if (joinLabel(task); as join) {
                  <p class="task-card__join muted">{{ join }}</p>
                }
                @if (statusLabel(task); as timeLabel) {
                  <p
                    class="task-card__time"
                    [class.is-running]="statusOf(task) === 'running'"
                    [class.is-late]="statusOf(task) === 'late'"
                  >
                    <span aria-hidden="true">◷</span> {{ timeLabel }}
                  </p>
                }

                <button
                  type="button"
                  class="btn btn--primary btn--large task-card__done"
                  (click)="markDone(task)"
                >
                  ✓ {{ t().focus.markDone }}
                </button>
                @if (statusOf(task) === 'late') {
                  <button type="button" class="btn task-card__late" (click)="markDone(task)">
                    {{ t().time.markLateDone }}
                  </button>
                }
                <button type="button" class="btn task-card__need" (click)="startBefore(task)">
                  {{ t().focus.needFirst }}
                </button>

                <details class="menu">
                  <summary class="icon-btn" [attr.aria-label]="t().a11y.actionsFor(task.title)">⋯</summary>
                  <div class="menu__panel" role="menu">
                    <button type="button" (click)="emitEdit(task); closeMenu($event)">
                      {{ t().focus.menu.edit }}
                    </button>
                    <button type="button" (click)="startAfter(task); closeMenu($event)">
                      {{ t().focus.menu.addAfter }}
                    </button>
                    @if (!settings.simple()('focusMenu')) {
                      <button type="button" (click)="startSplit(task); closeMenu($event)">
                        {{ t().focus.menu.splitAfter }}
                      </button>
                    }
                    <button type="button" class="danger" (click)="remove(task); closeMenu($event)">
                      {{ t().focus.menu.delete }}
                    </button>
                    @if (deleteBridges(list(), task.id) && !settings.simple()('deleteOnly')) {
                      <button
                        type="button"
                        class="danger"
                        (click)="remove(task, 'remove-only'); closeMenu($event)"
                      >
                        {{ t().focus.menu.deleteOnly }}
                      </button>
                    }
                  </div>
                </details>
              </article>
            </li>
          }
        </ul>
      } @else {
        <div class="empty card">
          <p class="all-done">{{ t().focus.allDoneHeading }}</p>
          <button type="button" class="btn" (click)="archive()">{{ t().focus.archiveList }}</button>
        </div>
      }
    }

    @if (blocked().length > 0) {
      <details class="later">
        <summary>{{ t().focus.laterHeading(blocked().length) }}</summary>
        <ul class="later__list">
          @for (task of blocked(); track task.id) {
            <li>
              <button type="button" class="later__item" (click)="emitEdit(task)">
                {{ task.title }}
              </button>
              <span class="muted">— {{ waitsFor(task) }}</span>
            </li>
          }
        </ul>
      </details>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .focus__bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: var(--space-2);
    }

    .cards {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: 0;
      margin: 0;
    }

    .task-card {
      padding: var(--space-4);
    }

    .task-card__title {
      margin: 0 0 var(--space-2);
      font-size: 1.3rem;
    }

    .task-card__notes {
      margin: 0 0 var(--space-2);
      white-space: pre-wrap;
    }

    .task-card__then,
    .task-card__join {
      margin: 0 0 var(--space-2);
      font-size: 0.9rem;
    }

    .task-card__time {
      margin: 0 0 var(--space-2);
      font-size: 0.95rem;
      font-weight: 600;
    }

    .task-card__time.is-running {
      color: var(--color-primary);
    }

    .task-card__time.is-late {
      color: var(--color-warning, #8a6d1b);
    }

    .task-card__late {
      width: 100%;
      margin-bottom: var(--space-2);
    }

    .plan-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      border: 1px solid var(--color-border);
      border-left: 4px solid var(--color-warning, #8a6d1b);
      border-radius: var(--radius);
      background: var(--color-surface);
    }

    .plan-banner__text {
      margin: 0;
    }

    .plan-banner__actions {
      display: flex;
      gap: var(--space-2);
    }

    .task-card__done {
      width: 100%;
      min-height: 56px;
      font-size: 1.05rem;
      margin-bottom: var(--space-2);
    }

    .empty {
      padding: var(--space-5);
      text-align: center;
    }

    .all-done {
      font-size: 1.15rem;
      margin-top: 0;
    }

    .task-card__checklist {
      margin: 0 0 var(--space-2);
    }

    .task-card__checklist > summary {
      cursor: pointer;
      color: var(--color-text-muted);
    }

    .later {
      margin-top: var(--space-5);
    }

    .later__list {
      list-style: none;
      padding: 0;
      margin: var(--space-2) 0 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .later__list li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4em;
    }

    .later__item {
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--color-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      padding: 0;
    }

    .later__item:hover {
      text-decoration: underline;
    }
  `,
})
export class FocusView {
  private readonly injector = inject(Injector);
  private readonly store = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(I18nStore);
  protected readonly settings = inject(SettingsStore);
  private readonly nowStore = inject(NowStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly list = input.required<TodoList>();
  readonly edit = output<string>();
  readonly create = output<CreateRequest>();

  protected readonly t = this.i18n.t;
  protected readonly now = this.nowStore.now;
  protected readonly planBannerDismissed = signal(false);

  protected readonly available = computed(() =>
    sortPlannedFirst(this.list(), availableTasks(this.list()), this.now()),
  );
  protected readonly blocked = computed(() => {
    const list = this.list();
    const blockedIds = new Set(blockedTasks(list).map((task) => task.id));
    return topologicalOrder(list).filter((task) => blockedIds.has(task.id));
  });

  // --- Zeitstatus -------------------------------------------

  protected showDayPlanBanner(): boolean {
    const list = this.list();
    return (
      list.timeboxMode === 'dayPlan' &&
      !this.planBannerDismissed() &&
      referenceRelation(list, this.now()) === 'past'
    );
  }

  protected dayPlanReferenceLabel(): string {
    const date = fromIsoDate(this.list().dayPlanReferenceDate ?? '');
    return date ? formatDayLabel(date, this.i18n.locale()) : '';
  }

  protected transferDayPlanToToday(): void {
    const list = this.list();
    const today = todayIso(this.now());
    this.store.editList(list.id, (l) => ({ ...l, dayPlanReferenceDate: today }));
    this.planBannerDismissed.set(false);
  }

  protected dismissDayPlanBanner(): void {
    this.planBannerDismissed.set(true);
  }

  protected statusOf(task: Task): TimeStatus | undefined {
    return timeStatus(this.list(), task, this.now());
  }

  protected statusLabel(task: Task): string | null {
    const status = this.statusOf(task);
    if (!status) return null;
    const parts = plannedTimeParts(this.list(), task);
    switch (status) {
      case 'running':
        return parts.end ? this.t().time.running(parts.end) : this.t().time.running(parts.start ?? '');
      case 'next':
        return this.t().time.nextAt(parts.start ?? '');
      case 'late': {
        const range =
          parts.start && parts.end ? `${parts.start}–${parts.end}` : (parts.start ?? parts.end ?? '');
        return range ? this.t().time.lateWas(range) : this.t().time.late;
      }
      case 'planned': {
        const range =
          parts.start && parts.end ? `${parts.start}–${parts.end}` : (parts.start ?? parts.end ?? '');
        return range ? this.t().time.planned(range) : null;
      }
      default:
        return null;
    }
  }

  protected thenLabel(task: Task): string | null {
    const list = this.list();
    const succ = successors(list, task.id);
    if (succ.length === 0) return null;
    const names = succ
      .slice(0, 2)
      .map((s) => s.title)
      .join(', ');
    const label = this.t().focus.then(names);
    return succ.length > 2 ? `${label} ${this.t().focus.thenMore(succ.length - 2)}` : label;
  }

  protected joinLabel(task: Task): string | null {
    const list = this.list();
    const names = new Set<string>();
    for (const succ of successors(list, task.id)) {
      for (const pred of openPredecessors(list, succ.id)) {
        if (pred.id !== task.id) names.add(pred.title);
      }
    }
    if (names.size === 0) return null;
    return `${this.t().focus.joinNote} ${[...names].join(', ')}`;
  }

  protected waitsFor(task: Task): string {
    const names = blockingTasks(this.list(), task.id).map((p) => p.title);
    return this.t().focus.waitsFor(names.join(', '));
  }

  // --- Aktionen ------------------------------------------------------------

  protected markDone(task: Task): void {
    const list = this.list();
    this.store.editList(list.id, (l) => ({
      ...l,
      tasks: l.tasks.map((t) =>
        t.id === task.id ? { ...t, done: true, doneAt: new Date().toISOString() } : t,
      ),
    }));
    this.snackbar.show(this.t().focus.markDone, {
      label: this.t().common.undo,
      run: () => this.store.undo(list.id),
    });
    this.keepFocus();
  }

  /**
   * Verschwindet das fokussierte Element (abgehakte Karte, beendete Eingabe),
   * landet der Fokus beim nächsten „Erledigt" – bzw. bei „Zettel archivieren",
   * wenn alles erledigt ist. Sonst müssten Tastaturnutzer von vorn tabben.
   */
  private keepFocus(preferTaskId?: string | null): void {
    afterNextRender(
      () => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        const root = this.host.nativeElement;
        const target =
          (preferTaskId
            ? root.querySelector<HTMLElement>(`[data-task-id="${preferTaskId}"] .task-card__done`)
            : null) ??
          root.querySelector<HTMLElement>('.task-card__done') ??
          root.querySelector<HTMLElement>('.empty button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected emitEdit(task: Task): void {
    this.edit.emit(task.id);
  }

  protected readonly deleteBridges = deleteBridges;

  protected remove(task: Task, mode: DeleteMode = 'bridge'): void {
    const list = this.list();
    this.store.editList(list.id, (l) => deleteTask(l, task.id, mode));
    this.snackbar.show(this.t().common.delete, {
      label: this.t().common.undo,
      run: () => this.store.undo(list.id),
    });
  }

  protected archive(): void {
    this.store.archive(this.list().id);
  }

  // --- Anlegen (im ToDo-Sheet, immer als Enter-Kette) ----------------------

  protected startStandalone(): void {
    this.create.emit({ position: { kind: 'standalone' }, chain: true });
  }

  protected startBefore(task: Task): void {
    this.create.emit({ position: { kind: 'before', anchor: task.id }, chain: true });
  }

  protected startAfter(task: Task): void {
    this.create.emit({ position: { kind: 'after', anchor: task.id }, chain: true });
  }

  protected startSplit(task: Task): void {
    this.create.emit({ position: { kind: 'split', anchor: task.id }, chain: true });
  }

  // --- Checkliste auf der Karte --------------------------------------------

  protected checkedCount(items: readonly ChecklistItem[]): number {
    return items.filter((item) => item.done).length;
  }

  /** Einen Punkt ab- oder aufhaken (ein Rückgängig-Schritt); das ToDo selbst bleibt offen. */
  protected toggleItem(task: Task, itemId: string): void {
    this.store.editList(this.list().id, (l) => ({
      ...l,
      tasks: l.tasks.map((t) =>
        t.id === task.id && t.checklist
          ? { ...t, checklist: t.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : t,
      ),
    }));
  }

  protected readonly closeMenu = closeMenu;

  // --- Tastatur -------------------------------------------------

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
    const action = actionFor(event, this.settings.keymap(), ['focus']);
    if (!action) return;
    const card = target?.closest('[data-task-id]') as HTMLElement | null;
    const id = card?.dataset['taskId'];
    const task = id ? this.available().find((t) => t.id === id) : this.available()[0];
    if (!task) return;
    event.preventDefault();
    if (action === 'needFirst') this.startBefore(task);
    else if (action === 'insertAfter') this.startAfter(task);
    else this.emitEdit(task);
  }
}
