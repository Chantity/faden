import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  addParallelAfter,
  addStandalone,
  availableTasks,
  blockedTasks,
  blockingTasks,
  deleteBridges,
  deleteTask,
  type DeleteMode,
  insertAfter,
  insertBefore,
  openPredecessors,
  successors,
  topologicalOrder,
} from '../../core/graph';
import { createTask, type Task, type TodoList } from '../../core/model';
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
import { describeGraphError } from '../../core/i18n/graph-error';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';

type ChainMode = 'before' | 'after' | 'split' | 'standalone';

interface Chain {
  anchor: string | null;
  mode: ChainMode;
}

@Component({
  selector: 'app-focus-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    @if (list().tasks.length === 0) {
      <div class="empty card">
        <h2>{{ t().focus.emptyHeading }}</h2>
        @if (chain()) {
          <form class="chain" (ngSubmit)="submitDraft()" (keydown.escape)="endChain($event)">
            <label class="field">
              <span class="field__label">{{ t().focus.newWorkLabel }}</span>
              <input
                #chainInput
                type="text"
                [value]="draft()"
                (input)="onDraftInput($event)"
                (keydown.enter)="submitDraft($event)"
                [placeholder]="placeholder()"
              />
            </label>
            <p class="hint muted">{{ t().focus.chainHint }}</p>
            <div class="chain__actions">
              <button type="button" class="btn btn--primary" (click)="finishChain()">
                {{ t().focus.finish }}
              </button>
              <button type="button" class="btn" (click)="endChain($event)">
                {{ t().common.cancel }}
              </button>
            </div>
          </form>
        } @else {
          <button type="button" class="btn btn--primary btn--large" (click)="startStandalone()">
            {{ t().focus.add }}
          </button>
        }
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

      @if (chainIsStandalone()) {
        <form class="chain" (ngSubmit)="submitDraft()" (keydown.escape)="endChain($event)">
          <label class="field">
            <span class="field__label">{{ t().focus.newTodoLabel }}</span>
            <input
              #chainInput
              type="text"
              [value]="draft()"
              (input)="onDraftInput($event)"
              (keydown.enter)="submitDraft($event)"
              [placeholder]="placeholder()"
            />
          </label>
          <p class="hint muted">{{ t().focus.chainHint }}</p>
          <div class="chain__actions">
            <button type="button" class="btn btn--primary" (click)="finishChain()">
              {{ t().focus.finish }}
            </button>
            <button type="button" class="btn" (click)="endChain($event)">
              {{ t().common.cancel }}
            </button>
          </div>
        </form>
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
                    <button type="button" (click)="startSplit(task); closeMenu($event)">
                      {{ t().focus.menu.splitAfter }}
                    </button>
                    <button type="button" (click)="connect(task); closeMenu($event)">
                      {{ t().focus.menu.connect }}
                    </button>
                    <button type="button" class="danger" (click)="remove(task); closeMenu($event)">
                      {{ t().focus.menu.delete }}
                    </button>
                    @if (deleteBridges(list(), task.id)) {
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

              @if (chainAnchorHere(task.id)) {
                <form class="chain" (ngSubmit)="submitDraft()" (keydown.escape)="endChain($event)">
                  <label class="field">
                    <span class="field__label">{{ t().focus.newWorkLabel }}</span>
                    <input
                      #chainInput
                      type="text"
                      [value]="draft()"
                      (input)="onDraftInput($event)"
                      (keydown.enter)="submitDraft($event)"
                      [placeholder]="placeholder()"
                    />
                  </label>
                  <p class="hint muted">{{ t().focus.chainHint }}</p>
                  <div class="chain__actions">
                    <button type="button" class="btn btn--primary" (click)="finishChain()">
                      {{ t().focus.finish }}
                    </button>
                    <button type="button" class="btn" (click)="endChain($event)">
                      {{ t().common.cancel }}
                    </button>
                  </div>
                </form>
              }
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

    .chain {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: var(--color-accent-soft);
      border-radius: var(--radius);
    }

    .chain__actions {
      display: flex;
      gap: var(--space-2);
    }

    .chain .field input {
      min-height: var(--touch-min);
      width: 100%;
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
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
  private readonly store = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(I18nStore);
  private readonly nowStore = inject(NowStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly chainInput = viewChild<ElementRef<HTMLInputElement>>('chainInput');

  readonly list = input.required<TodoList>();
  readonly edit = output<string>();
  readonly connectRequest = output<string>();

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

  // --- Zeitstatus (SPEC 7.3/7.4) -------------------------------------------

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

  protected readonly chain = signal<Chain | null>(null);
  protected readonly draft = signal('');

  protected chainAnchorHere(taskId: string): boolean {
    return this.chain()?.anchor === taskId;
  }

  protected chainIsStandalone(): boolean {
    return this.chain()?.anchor === null;
  }

  protected placeholder(): string {
    return this.chain()?.mode === 'before'
      ? this.t().focus.newWorkPlaceholder
      : this.t().focus.addPlaceholder;
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
      run: () => this.store.undo(),
    });
  }

  protected emitEdit(task: Task): void {
    this.edit.emit(task.id);
  }

  protected connect(task: Task): void {
    this.connectRequest.emit(task.id);
  }

  protected readonly deleteBridges = deleteBridges;

  protected remove(task: Task, mode: DeleteMode = 'bridge'): void {
    const list = this.list();
    this.store.editList(list.id, (l) => deleteTask(l, task.id, mode));
    this.snackbar.show(this.t().common.delete, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }

  protected archive(): void {
    this.store.archive(this.list().id);
  }

  // --- Ketten-Eingabe ------------------------------------------------------

  protected startStandalone(): void {
    this.chain.set({ anchor: null, mode: 'standalone' });
    this.draft.set('');
    this.focusInput();
  }

  protected startBefore(task: Task): void {
    this.chain.set({ anchor: task.id, mode: 'before' });
    this.draft.set('');
    this.focusInput();
  }

  protected startAfter(task: Task): void {
    this.chain.set({ anchor: task.id, mode: 'after' });
    this.draft.set('');
    this.focusInput();
  }

  protected startSplit(task: Task): void {
    this.chain.set({ anchor: task.id, mode: 'split' });
    this.draft.set('');
    this.focusInput();
  }

  protected onDraftInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value.includes('\n')) {
      for (const line of value.split('\n')) {
        if (line.trim()) this.commitOne(line);
      }
      this.draft.set('');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.draft.set(value);
  }

  protected submitDraft(event?: Event): void {
    event?.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.commitOne(text);
    this.draft.set('');
    this.focusInput();
  }

  /** „Fertig": die aktuelle Eingabe übernehmen (falls vorhanden) und die Kette beenden. */
  protected finishChain(): void {
    const text = this.draft().trim();
    if (text) this.commitOne(text);
    this.chain.set(null);
    this.draft.set('');
  }

  protected endChain(event: Event): void {
    event.preventDefault();
    this.chain.set(null);
    this.draft.set('');
  }

  /** Schließt ein offenes ⋯-Menü bei Klick außerhalb (z. B. auf dem Handy). */
  protected onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    const inMenu = target?.closest('details.menu') as HTMLDetailsElement | null;
    const inPanel = target !== null && target.closest('.menu__panel') !== null;
    const onMenuSelf = inMenu !== null && inMenu.hasAttribute('open') && !inPanel;

    // Klick auf das offene Menü selbst (Zusammenfassung oder Elementfläche).
    // Ohne preventDefault würde die native Kippbewegung es sofort wieder öffnen.
    if (onMenuSelf) event.preventDefault();

    for (const menu of this.host.nativeElement.querySelectorAll<HTMLDetailsElement>('details.menu[open]')) {
      if (menu === inMenu && inPanel) continue;
      menu.removeAttribute('open');
    }
  }

  private commitOne(text: string): void {
    const list = this.list();
    const chain = this.chain();
    if (!chain) return;
    const task = createTask(text);
    try {
      this.store.editList(list.id, (l) => {
        switch (chain.mode) {
          case 'before':
            return insertBefore(l, chain.anchor as string, task);
          case 'after':
            return insertAfter(l, chain.anchor as string, task);
          case 'split':
            return addParallelAfter(l, chain.anchor as string, task);
          default:
            return chain.anchor === null ? addStandalone(l, task) : insertAfter(l, chain.anchor, task);
        }
      });
      const nextMode: ChainMode = chain.mode === 'before' ? 'before' : 'after';
      this.chain.set({ anchor: task.id, mode: nextMode });
    } catch (error) {
      this.snackbar.show(describeGraphError(this.t(), list, error));
    }
  }

  private focusInput(): void {
    queueMicrotask(() => this.chainInput()?.nativeElement.focus());
  }

  protected closeMenu(event: Event): void {
    (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
  }

  // --- Tastatur (SPEC 5.7) -------------------------------------------------

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    const card = target?.closest('[data-task-id]') as HTMLElement | null;
    const id = card?.dataset['taskId'];
    const task = id ? this.available().find((t) => t.id === id) : this.available()[0];
    if (!task) return;
    switch (event.key.toLowerCase()) {
      case 'v':
        event.preventDefault();
        this.startBefore(task);
        break;
      case 'n':
        event.preventDefault();
        this.startAfter(task);
        break;
      case 'e':
        event.preventDefault();
        this.emitEdit(task);
        break;
    }
  }
}
