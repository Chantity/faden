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
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  addParallelAfter,
  addParallelBefore,
  addStandalone,
  deleteBridges,
  deleteTask,
  type DeleteMode,
  disconnect,
  insertAfter,
  insertBefore,
  insertBetween,
  isAvailable,
  isBlocked,
  connectedComponents,
  layoutList,
  transitiveReduction,
  type Layout,
  type LayoutEdge,
} from '../../core/graph';
import { createTask, type Task, type TodoList } from '../../core/model';
import { describeGraphError } from '../../core/i18n/graph-error';
import { I18nStore } from '../../core/i18n/i18n.store';
import { strandToTemplate } from '../../core/templates';
import {
  estimateSums,
  formatDuration,
  plannedTimeParts,
  timeStatus,
  type TimeStatus,
} from '../../core/time';
import { ListsStore } from '../../core/state/lists.store';
import { NowStore } from '../../core/state/now.store';
import { TemplatesStore } from '../../core/state/templates.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { focusAfterRender } from '../../shared/focus';

type InsertMode = 'before' | 'after' | 'between' | 'standalone';

interface PendingInsert {
  mode: InsertMode;
  anchor: string | null;
  edgeId: string | null;
  x: number;
  y: number;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 2;

@Component({
  selector: 'app-flow-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="flow" (wheel)="onWheel($event)">
      <div class="flow__zoom">
        <button type="button" class="icon-btn" [attr.aria-label]="t().flow.zoomIn" (click)="zoomBy(1.2)">
          +
        </button>
        <button type="button" class="icon-btn" [attr.aria-label]="t().flow.zoomOut" (click)="zoomBy(1 / 1.2)">
          −
        </button>
        <button type="button" class="icon-btn" [attr.aria-label]="t().flow.fit" (click)="fit()">⤢</button>
        <button
          type="button"
          class="icon-btn"
          [attr.aria-label]="t().flow.centerCurrent"
          (click)="centerCurrent()"
        >
          ◎
        </button>
        <button
          type="button"
          class="icon-btn"
          [attr.aria-label]="t().flow.newStrand"
          (click)="startInsert('standalone', {})"
        >
          ✚
        </button>
      </div>

      @if (list().tasks.length === 0) {
        <p class="flow__empty muted">{{ t().flow.empty }}</p>
      }

      @if (!showPluses() && list().tasks.length > 0) {
        <p class="flow__hint muted">{{ t().flow.zoomHint }}</p>
      }

        <div
          #wrap
          class="flow__wrap"
          (click)="closeMenus()"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerUp($event)"
          (pointerleave)="onPointerUp($event)"
        >
          <div
            class="flow__canvas"
            [style.width.px]="layout().width"
            [style.height.px]="layout().height"
            [style.transform]="transform()"
          >
          <svg
            class="flow__edges"
            [attr.width]="layout().width"
            [attr.height]="layout().height"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="faden-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path class="arrow-head" d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            @for (edge of layout().edges; track edge.id) {
              <path class="edge" [attr.d]="edge.path" marker-end="url(#faden-arrow)" />
              <path
                class="edge__hit"
                [attr.d]="edge.path"
                (click)="openEdgeMenu(edge.id, edge.midX, edge.midY, $event)"
                (keydown.enter)="openEdgeMenu(edge.id, edge.midX, edge.midY, $event)"
                tabindex="0"
                role="button"
                [attr.aria-label]="t().flow.insertBetween"
              />
            }
          </svg>

          @for (sum of strandSums(); track sum.x) {
            <span
              class="strand-sum"
              [style.left.px]="sum.x"
              [style.top.px]="strandSumTop"
              [attr.title]="t().flow.strandSumLabel"
            >
              {{ sum.text }}
            </span>
          }

          @for (node of layout().nodes; track node.id) {
            @if (taskById(node.id); as task) {
              <article
                class="node"
                tabindex="0"
                [class.is-done]="task.done"
                [class.is-now]="isNow(task)"
                [class.is-waiting]="isWaiting(task)"
                [style.left.px]="node.x"
                [style.top.px]="node.y"
                [style.width.px]="node.width"
                [style.height.px]="node.height"
                [attr.data-task-id]="task.id"
              >
                <div class="node__head">
                  <button
                    type="button"
                    class="node__toggle"
                    [class.is-on]="task.done"
                    [attr.aria-pressed]="task.done"
                    [attr.aria-label]="task.done ? t().flow.uncheck : t().flow.check"
                    (click)="toggleDone(task)"
                  >
                    <span aria-hidden="true">✓</span>
                  </button>
                  <span class="node__state">
                    @if (task.done) {
                      <span aria-hidden="true">✓</span> {{ t().flow.stateDone }}
                    } @else if (isNow(task)) {
                      <span aria-hidden="true">▸</span> {{ t().flow.stateNow }}
                    } @else {
                      <span aria-hidden="true">🔒</span> {{ t().flow.stateWaiting }}
                    }
                  </span>
                  @if (timeLabel(task); as tl) {
                    <span
                      class="node__time"
                      [class.is-running]="statusOf(task) === 'running'"
                      [class.is-late]="statusOf(task) === 'late'"
                    >
                      ◷ {{ tl }}
                    </span>
                  }
                </div>
                <span class="node__title" [attr.data-lines]="node.lines">{{ task.title }}</span>
                <button
                  type="button"
                  class="node__menu-btn"
                  [attr.aria-label]="t().flow.menuLabel(task.title)"
                  (click)="openNodeMenu(task.id, $event)"
                >
                  ⋯
                </button>
              </article>

              @if (showPluses()) {
                @if (!hasPredecessor(node.id)) {
                  <button
                    type="button"
                    class="plus plus--before"
                    [style.left.px]="node.x + node.width / 2 - plusSize / 2"
                    [style.top.px]="node.y - plusSize - 6"
                    [attr.aria-label]="t().flow.insertBefore"
                    (click)="startInsert('before', { anchor: node.id, x: node.x, y: node.y })"
                  >
                    +
                  </button>
                }
                @if (showsAfterPlus(node.id)) {
                  <button
                    type="button"
                    class="plus plus--after"
                    [style.left.px]="node.x + node.width / 2 - plusSize / 2"
                    [style.top.px]="node.y + node.height + 4"
                    [attr.aria-label]="t().flow.insertAfter"
                    (click)="startInsert('after', { anchor: node.id, x: node.x, y: node.y })"
                  >
                    +
                  </button>
                }
              }
            }
          }

          @if (showPluses()) {
            @for (edge of layout().edges; track edge.id) {
              @if (!edgePlusHidden(edge)) {
                <button
                  type="button"
                  class="plus plus--edge"
                  [style.left.px]="edge.midX - edgePlusSize / 2"
                  [style.top.px]="edge.midY - edgePlusSize / 2"
                  [attr.aria-label]="t().flow.insertBetween"
                  (click)="menuInsertBetween(edge.id, edge.midX, edge.midY)"
                >
                  +
                </button>
              }
            }
          }

          @if (pending(); as p) {
            <form
              class="insert"
              [style.left.px]="p.x"
              [style.top.px]="p.y"
              (ngSubmit)="submitInsert()"
              (keydown.escape)="cancelInsert($event)"
            >
              <input
                #insertInput
                type="text"
                [value]="draft()"
                (input)="draft.set($any($event.target).value)"
                [placeholder]="t().focus.addPlaceholder"
              />
              <div class="insert__actions">
                <button type="submit" class="btn btn--primary">{{ t().common.add }}</button>
                <button type="button" class="btn" (click)="cancelInsert($event)">
                  {{ t().common.cancel }}
                </button>
              </div>
            </form>
          }

          @if (nodeMenu(); as menu) {
            <div class="popover" [style.left.px]="menu.x" [style.top.px]="menu.y" role="menu">
              <button type="button" (click)="menuEdit(menu.id)">{{ t().focus.menu.edit }}</button>
              <button type="button" (click)="menuSplit(menu.id)">{{ t().focus.menu.splitAfter }}</button>
              <button type="button" (click)="menuJoin(menu.id)">{{ t().focus.menu.join }}</button>
              <button type="button" (click)="menuConnect(menu.id)">{{ t().focus.menu.connect }}</button>
              <button type="button" (click)="menuSaveStrand(menu.id)">
                {{ t().templates.saveStrand }}
              </button>
              <button type="button" class="danger" (click)="menuDelete(menu.id)">
                {{ t().focus.menu.delete }}
              </button>
              @if (deleteBridges(list(), menu.id)) {
                <button type="button" class="danger" (click)="menuDelete(menu.id, 'remove-only')">
                  {{ t().focus.menu.deleteOnly }}
                </button>
              }
            </div>
          }

          @if (edgeMenu(); as menu) {
            <div class="popover" [style.left.px]="menu.x" [style.top.px]="menu.y" role="menu">
              <button type="button" (click)="menuInsertBetween(menu.edgeId, menu.x, menu.y)">
                {{ t().flow.insertBetween }}
              </button>
              <button type="button" class="danger" (click)="menuRemoveEdge(menu.edgeId)">
                {{ t().flow.removeEdge }}
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .flow {
      position: relative;
    }

    .flow__zoom {
      position: absolute;
      right: var(--space-2);
      top: var(--space-2);
      z-index: 5;
      display: flex;
      gap: var(--space-1);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: var(--space-1);
    }

    .flow__empty {
      padding: var(--space-4);
    }

    .flow__wrap {
      position: relative;
      overflow: hidden;
      width: 100%;
      height: min(70vh, 640px);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      touch-action: none;
      cursor: grab;
    }

    .flow__canvas {
      position: relative;
      transform-origin: 0 0;
    }

    .flow__edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: visible;
    }

    .edge {
      fill: none;
      stroke: var(--color-border-strong);
      stroke-width: 2;
    }

    .arrow-head {
      fill: var(--color-border-strong);
    }

    .edge__hit {
      fill: none;
      stroke: transparent;
      stroke-width: 20;
      pointer-events: stroke;
      cursor: pointer;
    }

    .node {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3);
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .node.is-now {
      border-color: var(--color-primary);
      background: var(--color-accent-soft);
    }

    .node.is-done {
      opacity: 0.65;
    }

    .node.is-waiting {
      opacity: 0.8;
    }

    .node__head {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      height: 20px;
      padding-right: 34px;
    }

    .node__state,
    .node__time {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .node__state {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node__time {
      flex: none;
      font-size: 0.72rem;
    }

    .node__time.is-running {
      color: var(--color-primary);
    }

    .node__time.is-late {
      color: var(--color-warning, #8a6d1b);
    }

    .node__toggle {
      flex: none;
      width: 20px;
      height: 20px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border-strong);
      border-radius: 50%;
      background: transparent;
      color: transparent;
      font-size: 0.7rem;
      line-height: 1;
      cursor: pointer;
    }

    .node__toggle.is-on {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }

    .node__title {
      font-weight: 600;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .node__title[data-lines='1'] {
      -webkit-line-clamp: 1;
    }

    .node__title[data-lines='2'] {
      -webkit-line-clamp: 2;
    }

    .node__title[data-lines='3'] {
      -webkit-line-clamp: 3;
    }

    .node__menu-btn {
      position: absolute;
      right: var(--space-1);
      top: var(--space-1);
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
    }

    .plus {
      position: absolute;
      z-index: 3;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
    }

    /* Unsichtbare, transparente Fläche vergrößert Treffer-/Tippfläche auf 44 px. */
    .plus::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
    }

    .plus--edge {
      width: 30px;
      height: 30px;
      font-size: 0.95rem;
      opacity: 0.85;
    }

    .plus--edge::after {
      inset: -7px;
    }

    .flow__hint {
      margin: var(--space-2) 0;
      font-size: 0.9rem;
    }

    .insert {
      position: absolute;
      z-index: 6;
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .insert input {
      min-height: var(--touch-min);
      padding: 0 var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .insert__actions {
      display: flex;
      gap: var(--space-2);
    }

    .popover {
      position: absolute;
      z-index: 7;
      display: flex;
      flex-direction: column;
      min-width: 200px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: var(--space-1);
    }

    .popover button {
      text-align: left;
      padding: var(--space-2) var(--space-3);
      border: none;
      background: transparent;
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
      border-radius: var(--radius-sm);
    }

    .popover button:hover {
      background: var(--color-accent-soft);
    }

    .popover button.danger {
      color: var(--color-danger);
    }
  `,
})
export class FlowView {
  private readonly injector = inject(Injector);
  private readonly store = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(I18nStore);
  private readonly nowStore = inject(NowStore);
  private readonly templates = inject(TemplatesStore);
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');
  private readonly insertInput = viewChild<ElementRef<HTMLInputElement>>('insertInput');

  readonly list = input.required<TodoList>();
  readonly edit = output<string>();
  readonly connectRequest = output<string>();

  protected readonly t = this.i18n.t;
  protected readonly now = this.nowStore.now;

  // Sichtbarer Kreis klein (38/30 px), Trefferfläche 44 px über `::after` (CSS).
  protected readonly plusSize = 38;
  protected readonly edgePlusSize = 30;

  private readonly displayList = computed<TodoList>(() => {
    const list = this.list();
    return { ...list, edges: transitiveReduction(list) };
  });

  /**
   * Teilsummen je Strang (optional): nur im Modus „Zeitschätzung" und
   * nur bei mehreren Strängen – bei einem Strang steht die Summe schon im Kopf.
   */
  private readonly showStrandSums = computed(
    () => this.list().timeboxMode === 'estimate' && connectedComponents(this.list()).length > 1,
  );

  protected readonly layout = computed<Layout>(() =>
    layoutList(this.displayList(), {
      vGap: 128,
      padding: 56,
      paddingTop: this.showStrandSums() ? 96 : 56,
    }),
  );

  protected readonly strandSumTop = 12;

  protected readonly strandSums = computed(() => {
    if (!this.showStrandSums()) return [];
    const list = this.list();
    const locale = this.i18n.locale();
    const t = this.t();
    return this.layout().strands.flatMap((strand) => {
      const ids = new Set(strand.taskIds);
      const sums = estimateSums({ ...list, tasks: list.tasks.filter((task) => ids.has(task.id)) });
      if (sums.openMinutes === 0 && sums.openWithoutEstimate === 0) return [];
      const parts = [t.flow.strandSum(formatDuration(sums.openMinutes, locale))];
      if (sums.openWithoutEstimate > 0) parts.push(t.time.withoutEstimate(sums.openWithoutEstimate));
      return [{ x: strand.x, text: parts.join(' · ') }];
    });
  });

  protected readonly scale = signal(1);
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);
  protected readonly transform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`,
  );

  protected readonly showPluses = computed(() => this.scale() >= 0.6);

  protected readonly pending = signal<PendingInsert | null>(null);
  protected readonly draft = signal('');
  protected readonly nodeMenu = signal<{ id: string; x: number; y: number } | null>(null);
  protected readonly edgeMenu = signal<{ edgeId: string; x: number; y: number } | null>(null);

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private panStart: { x: number; y: number; tx: number; ty: number } | null = null;
  private pinchStart: { distance: number; scale: number } | null = null;

  constructor() {
    afterNextRender(() => this.fit());
  }

  protected taskById(id: string): Task | undefined {
    return this.list().tasks.find((task) => task.id === id);
  }

  protected isNow(task: Task): boolean {
    return isAvailable(this.list(), task.id);
  }

  protected isWaiting(task: Task): boolean {
    return isBlocked(this.list(), task.id);
  }

  /** Zeitstatus für das Badge. */
  protected statusOf(task: Task): TimeStatus | undefined {
    return timeStatus(this.list(), task, this.now());
  }

  /** Kurzes Zeit-Label („13:00–13:30") für den Kasten, sonst null. */
  protected timeLabel(task: Task): string | null {
    const status = this.statusOf(task);
    if (!status) return null;
    const parts = plannedTimeParts(this.list(), task);
    if (parts.start && parts.end) return `${parts.start}–${parts.end}`;
    return parts.start ?? parts.end ?? null;
  }

  protected hasPredecessor(id: string): boolean {
    return this.displayList().edges.some((edge) => edge.to === id);
  }

  private outdegree(id: string): number {
    return this.displayList().edges.filter((edge) => edge.from === id).length;
  }

  /**
   * „+" unter der Karte am Strang-Ende (0 Nachfolger) und an einer Verzweigung
   * (≥2 Nachfolger). Bei genau einem Nachfolger erledigt das Kanten-„+" dasselbe.
   */
  protected showsAfterPlus(id: string): boolean {
    return this.outdegree(id) !== 1;
  }

  /**
   * Blendet das Kanten-„+" aus, wenn es sich mit dem Karten-„+" einer
   * Verzweigung (≥2 Nachfolger) überlagern würde – dort ersetzt das Karten-„+"
   * die einzelnen Kanten-„+" (es fügt einen Knoten ein, von dem alle Nachfolger
   * abhängen).
   */
  protected edgePlusHidden(edge: LayoutEdge): boolean {
    if (this.outdegree(edge.from) < 2) return false;
    const source = this.layout().nodes.find((node) => node.id === edge.from);
    if (!source) return false;
    const underX = source.x + source.width / 2;
    const underY = source.y + source.height + 4 + this.plusSize / 2;
    const reach = (this.plusSize + this.edgePlusSize) / 2 + 4;
    return Math.abs(edge.midX - underX) < reach && Math.abs(edge.midY - underY) < reach;
  }

  // --- Pan / Zoom ----------------------------------------------------------

  protected onWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    }
  }

  protected zoomBy(factor: number): void {
    this.scale.set(clamp(this.scale() * factor, MIN_SCALE, MAX_SCALE));
  }

  protected onPointerDown(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.panStart = { x: event.clientX, y: event.clientY, tx: this.tx(), ty: this.ty() };
    } else if (this.pointers.size === 2) {
      this.panStart = null;
      this.pinchStart = { distance: this.pointerDistance(), scale: this.scale() };
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2 && this.pinchStart) {
      const factor = this.pointerDistance() / this.pinchStart.distance;
      this.scale.set(clamp(this.pinchStart.scale * factor, MIN_SCALE, MAX_SCALE));
      return;
    }
    if (this.panStart) {
      this.tx.set(this.panStart.tx + (event.clientX - this.panStart.x));
      this.ty.set(this.panStart.ty + (event.clientY - this.panStart.y));
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) this.panStart = null;
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 1;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  protected fit(): void {
    const wrap = this.wrap()?.nativeElement;
    if (!wrap || wrap.clientWidth === 0 || wrap.clientHeight === 0) return;
    const layout = this.layout();
    const scale = clamp(
      Math.min(wrap.clientWidth / layout.width, wrap.clientHeight / layout.height),
      MIN_SCALE,
      1,
    );
    this.scale.set(scale);
    this.tx.set(0);
    this.ty.set(0);
  }

  protected centerCurrent(): void {
    const wrap = this.wrap()?.nativeElement;
    const node = this.layout().nodes.find((n) => isAvailable(this.list(), n.id));
    if (!wrap || !node) {
      this.fit();
      return;
    }
    this.tx.set(wrap.clientWidth / 2 - (node.x + node.width / 2) * this.scale());
    this.ty.set(wrap.clientHeight / 2 - (node.y + node.height / 2) * this.scale());
  }

  // --- Einfügen ------------------------------------------------------------

  protected startInsert(mode: InsertMode, opts: { anchor?: string; x?: number; y?: number }): void {
    const anchor = opts.anchor ?? null;
    this.pending.set({
      mode,
      anchor,
      edgeId: null,
      x: opts.x ?? 24,
      y: opts.y ?? 24,
    });
    this.draft.set('');
    focusAfterRender(this.injector, () => this.insertInput());
  }

  protected submitInsert(): void {
    const p = this.pending();
    const text = this.draft().trim();
    if (!p || !text) return;
    const list = this.list();
    const task = createTask(text);
    try {
      this.store.editList(list.id, (l) => {
        switch (p.mode) {
          case 'before':
            return insertBefore(l, p.anchor as string, task);
          case 'after':
            return insertAfter(l, p.anchor as string, task);
          case 'between':
            return insertBetween(l, p.edgeId as string, task);
          default:
            return addStandalone(l, task);
        }
      });
      this.pending.set(null);
      this.draft.set('');
    } catch (error) {
      this.snackbar.show(describeGraphError(this.t(), list, error));
    }
  }

  protected cancelInsert(event: Event): void {
    event.preventDefault();
    this.pending.set(null);
    this.draft.set('');
  }

  // --- Menüs ---------------------------------------------------------------

  protected openNodeMenu(id: string, event: Event): void {
    event.stopPropagation();
    const node = this.layout().nodes.find((n) => n.id === id);
    this.edgeMenu.set(null);
    if (node) this.nodeMenu.set({ id, x: node.x + node.width - 200, y: node.y + 12 });
  }

  protected openEdgeMenu(edgeId: string, midX: number, midY: number, event: Event): void {
    event.stopPropagation();
    this.nodeMenu.set(null);
    this.edgeMenu.set({ edgeId, x: midX - 100, y: midY + 12 });
  }

  /** Klick auf die freie Fläche schließt ein offenes Menü, ohne eine Auswahl zu treffen. */
  protected closeMenus(): void {
    this.nodeMenu.set(null);
    this.edgeMenu.set(null);
  }

  protected toggleDone(task: Task): void {
    const list = this.list();
    const nowDone = !task.done;
    this.store.editList(list.id, (l) => ({
      ...l,
      tasks: l.tasks.map((t) =>
        t.id === task.id
          ? nowDone
            ? { ...t, done: true, doneAt: new Date().toISOString() }
            : { ...t, done: false, doneAt: undefined }
          : t,
      ),
    }));
    this.snackbar.show(nowDone ? this.t().flow.check : this.t().flow.uncheck, {
      label: this.t().common.undo,
      run: () => this.store.undo(list.id),
    });
  }

  protected menuEdit(id: string): void {
    this.nodeMenu.set(null);
    this.edit.emit(id);
  }

  protected menuSplit(id: string): void {
    this.nodeMenu.set(null);
    const list = this.list();
    const task = createTask('');
    this.store.editList(list.id, (l) => addParallelAfter(l, id, task));
    this.edit.emit(task.id);
  }

  protected menuJoin(id: string): void {
    this.nodeMenu.set(null);
    const list = this.list();
    const task = createTask('');
    this.store.editList(list.id, (l) => addParallelBefore(l, id, task));
    this.edit.emit(task.id);
  }

  protected menuConnect(id: string): void {
    this.nodeMenu.set(null);
    this.connectRequest.emit(id);
  }

  protected readonly deleteBridges = deleteBridges;

  protected menuDelete(id: string, mode: DeleteMode = 'bridge'): void {
    this.nodeMenu.set(null);
    const list = this.list();
    this.store.editList(list.id, (l) => deleteTask(l, id, mode));
    this.snackbar.show(this.t().common.delete, {
      label: this.t().common.undo,
      run: () => this.store.undo(list.id),
    });
  }

  protected menuSaveStrand(id: string): void {
    this.nodeMenu.set(null);
    const template = strandToTemplate(this.list(), id);
    if (!template) {
      this.snackbar.show(this.t().templates.incomplete);
      return;
    }
    void this.templates.add(template);
    this.snackbar.show(this.t().templates.savedSnack(template.title));
  }

  protected menuInsertBetween(edgeId: string, x: number, y: number): void {
    this.edgeMenu.set(null);
    this.pending.set({ mode: 'between', anchor: null, edgeId, x: x - 120, y: y + 12 });
    this.draft.set('');
    focusAfterRender(this.injector, () => this.insertInput());
  }

  protected menuRemoveEdge(edgeId: string): void {
    this.edgeMenu.set(null);
    const list = this.list();
    this.store.editList(list.id, (l) => disconnect(l, edgeId));
    this.snackbar.show(this.t().flow.removeEdge, {
      label: this.t().common.undo,
      run: () => this.store.undo(list.id),
    });
  }

  private promptThen(run: () => void): boolean {
    run();
    return true;
  }

  // --- Tastatur -------------------------------------------------

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    const card = target?.closest('[data-task-id]') as HTMLElement | null;
    const id = card?.dataset['taskId'];
    if (!id) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.edit.emit(id);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      const list = this.list();
      this.store.editList(list.id, (l) => deleteTask(l, id, 'bridge'));
      this.snackbar.show(this.t().common.delete, {
        label: this.t().common.undo,
        run: () => this.store.undo(list.id),
      });
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      this.moveFocus(id, event.key);
    }
  }

  private moveFocus(fromId: string, key: string): void {
    const nodes = this.layout().nodes;
    const current = nodes.find((n) => n.id === fromId);
    if (!current) return;
    const candidates = nodes.filter((n) => n.id !== fromId);
    const score = (n: (typeof nodes)[number]): number => {
      const dx = n.x - current.x;
      const dy = n.y - current.y;
      const inDirection =
        (key === 'ArrowDown' && dy > 0) ||
        (key === 'ArrowUp' && dy < 0) ||
        (key === 'ArrowRight' && dx > 0) ||
        (key === 'ArrowLeft' && dx < 0);
      if (!inDirection) return Number.POSITIVE_INFINITY;
      return Math.abs(dx) + Math.abs(dy);
    };
    let best: (typeof nodes)[number] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const n of candidates) {
      const s = score(n);
      if (s < bestScore) {
        bestScore = s;
        best = n;
      }
    }
    if (best) {
      const el = this.wrap()?.nativeElement.querySelector<HTMLElement>(
        `[data-task-id="${best.id}"]`,
      );
      el?.focus();
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
