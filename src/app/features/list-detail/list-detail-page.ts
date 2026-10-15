import {
  ChangeDetectionStrategy,
  Component,
  computed,
  afterRenderEffect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import type { TimeboxMode, TodoList } from '../../core/model';
import { progress } from '../../core/graph';
import { listToTemplate } from '../../core/templates';
import { estimateSums, formatDuration, modeSwitchOffer, withTimeboxMode } from '../../core/time';
import { ListsStore } from '../../core/state/lists.store';
import { SettingsStore } from '../../core/state/settings.store';
import { actionFor } from '../../core/keymap';
import { TemplatesStore } from '../../core/state/templates.store';
import { ViewStore, type ListView } from '../../core/state/view.store';
import { closeMenu } from '../../shared/menus';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { ListDialog } from '../lists/list-dialog';
import { FocusView } from './focus-view';
import { FlowView } from './flow-view';
import { TaskEditor, type CreateRequest } from './task-editor';
import { ShortcutHelp } from './shortcut-help';
import { PlanEditor } from './plan-editor';
import { ListsSidebar } from './lists-sidebar';
import { InsertTemplateDialog } from './insert-template-dialog';

@Component({
  selector: 'app-list-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ListDialog, FocusView, FlowView, TaskEditor, ShortcutHelp, PlanEditor, InsertTemplateDialog, ListsSidebar],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <app-lists-sidebar class="lists-side" [currentId]="id()" />
    <div class="detail-main">
      <a class="back" routerLink="/">← {{ t().nav.lists }}</a>

      @if (list(); as current) {
        <header class="detail-head">
          <div class="detail-head__title">
            <h1>{{ current.title }}</h1>
            <p class="muted">{{ progressLabel() }}</p>
            @if (estimateLabel(); as sums) {
              <p class="muted">{{ sums }}</p>
            }
            <span class="badge">{{ t().timebox.modes[current.timeboxMode] }}</span>
          </div>
          <div class="detail-head__actions">
            <button
              type="button"
              class="icon-btn"
              [disabled]="!store.canUndo(current.id)"
              [attr.aria-label]="t().common.undo"
              (click)="undo()"
            >
              ↶
            </button>
            <button
              type="button"
              class="icon-btn"
              [disabled]="!store.canRedo(current.id)"
              [attr.aria-label]="t().common.redo"
              (click)="redo()"
            >
              ↷
            </button>
            <button
              type="button"
              class="icon-btn"
              [attr.aria-label]="t().shortcuts.title"
              (click)="help().open()"
            >
              ?
            </button>
            <details class="menu">
              <summary class="icon-btn" [attr.aria-label]="t().a11y.actionsFor(current.title)">⋯</summary>
              <div class="menu__panel" role="menu">
                <button type="button" (click)="editList(current); closeMenu($event)">
                  {{ t().common.rename }}
                </button>
                @if (planEditable()) {
                  <button type="button" (click)="openPlanEditor(current); closeMenu($event)">
                    {{ t().time.editPlan }}
                  </button>
                }
                <button type="button" (click)="saveAsTemplate(current); closeMenu($event)">
                  {{ t().templates.saveList }}
                </button>
                @if (templates.templates().length > 0) {
                  <button type="button" (click)="insertDialog().open(current.id); closeMenu($event)">
                    {{ t().templates.insert }}
                  </button>
                }
                <button type="button" (click)="archive(current); closeMenu($event)">
                  {{ t().common.archive }}
                </button>
                <button type="button" class="danger" (click)="remove(current); closeMenu($event)">
                  {{ t().common.delete }}
                </button>
              </div>
            </details>
          </div>
        </header>

        <div class="view-toggle" role="group" [attr.aria-label]="t().titles.list">
          <button
            type="button"
            class="view-toggle__btn"
            [class.is-active]="view() === 'focus'"
            [attr.aria-pressed]="view() === 'focus'"
            (click)="setView('focus')"
          >
            {{ t().focus.tabFocus }}
          </button>
          <button
            type="button"
            class="view-toggle__btn"
            [class.is-active]="view() === 'flow'"
            [attr.aria-pressed]="view() === 'flow'"
            (click)="setView('flow')"
          >
            {{ t().focus.tabFlow }}
          </button>
        </div>

        @if (view() === 'focus') {
          <app-focus-view
            [list]="current"
            (edit)="openEditor($event)"
            (create)="openCreate($event)"
          />
        } @else {
          <app-flow-view
            [list]="current"
            (edit)="openEditor($event)"
            (create)="openCreate($event)"
            (shiftStrand)="planEditor.openStrand(current, $event)"
          />
        }
      } @else {
        <h1>{{ t().lists.emptyTitle }}</h1>
        <p class="muted">{{ t().listDetail.notFound }}</p>
        <a class="btn btn--primary" routerLink="/">{{ t().nav.lists }}</a>
      }

      <app-task-editor />
      <app-shortcut-help />
      <app-plan-editor #planEditor />
      <app-insert-template-dialog />
      <app-list-dialog (saved)="onListSaved($event)" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 960px;
    }

    /* > 1024 px: links die Zettel-Liste, rechts der Zettel. */
    @media (min-width: 1025px) {
      :host {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: var(--space-5);
        max-width: none;
      }
    }

    .back {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-min);
      margin-bottom: var(--space-3);
      text-decoration: none;
      color: var(--color-text-muted);
    }

    .detail-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .detail-head__title {
      flex: 1 1 12rem;
      min-width: 0;
    }

    .detail-head__title h1 {
      margin: 0;
    }

    .detail-head__title p {
      margin: var(--space-1) 0 0;
    }

    .detail-head__title .badge {
      display: inline-block;
      margin-top: var(--space-2);
    }

    .detail-head__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .detail-head__actions .icon-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .view-toggle {
      display: inline-flex;
      margin: var(--space-4) 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .view-toggle__btn {
      min-height: var(--touch-min);
      padding: 0 var(--space-4);
      border: none;
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }

    .view-toggle__btn.is-active {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
  `,
})
export class ListDetailPage {
  protected readonly store = inject(ListsStore);
  private readonly viewStore = inject(ViewStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(I18nStore);
  private readonly settings = inject(SettingsStore);
  protected readonly templates = inject(TemplatesStore);

  private readonly editor = viewChild.required(TaskEditor);
  private readonly help = viewChild.required(ShortcutHelp);
  private readonly listDialog = viewChild.required(ListDialog);
  private readonly planEditor = viewChild.required(PlanEditor);
  protected readonly insertDialog = viewChild.required(InsertTemplateDialog);

  protected readonly t = this.i18n.t;

  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null,
  });

  /** Zettel, für den das Anlege-Sheet schon von selbst aufging (nur einmal je Öffnen). */
  private autoCreatedFor: string | null = null;

  constructor() {
    inject(PageTitleService).set('list');
    // Ein leerer Zettel startet gleich mit „Neues ToDo“ – nicht, wenn man später das letzte löscht.
    afterRenderEffect(() => {
      const current = this.list();
      if (!current || current.id === this.autoCreatedFor) return;
      this.autoCreatedFor = current.id;
      if (current.tasks.length === 0 && !current.archived) {
        untracked(() => this.editor().create(current.id, { kind: 'standalone' }, true));
      }
    });
  }

  protected readonly list = computed(() => {
    const id = this.id();
    if (!id) return undefined;
    return (
      this.store.lists().find((l) => l.id === id) ??
      this.store.archived().find((l) => l.id === id)
    );
  });

  protected readonly view = computed<ListView>(() => {
    const id = this.id();
    return id ? this.viewStore.view(id) : 'focus';
  });

  protected readonly progressLabel = computed(() => {
    const current = this.list();
    if (!current) return '';
    const { done, total } = progress(current);
    return total === 0 ? this.t().lists.emptyList : this.t().lists.progress(done, total);
  });

  protected readonly estimateLabel = computed(() => {
    const current = this.list();
    if (!current || current.timeboxMode !== 'estimate') return null;
    const sums = estimateSums(current);
    const parts = [
      this.t().time.openSum(formatDuration(sums.openMinutes, this.i18n.locale())),
      this.t().time.totalSum(formatDuration(sums.totalMinutes, this.i18n.locale())),
      this.t().time.doneSum(formatDuration(sums.doneMinutes, this.i18n.locale())),
    ];
    if (sums.openWithoutEstimate > 0) {
      parts.push(this.t().time.withoutEstimate(sums.openWithoutEstimate));
    }
    return parts.join(' · ');
  });

  /** Ob für diese Liste ein Zeitplan bearbeitet werden kann (dayPlan/schedule). */
  protected readonly planEditable = computed(() => {
    const mode = this.list()?.timeboxMode;
    return mode === 'dayPlan' || mode === 'schedule';
  });

  protected setView(view: ListView): void {
    const id = this.id();
    if (id) this.viewStore.set(id, view);
  }

  protected openEditor(taskId: string): void {
    const id = this.id();
    if (id) this.editor().open(id, taskId);
  }

  protected openCreate(request: CreateRequest): void {
    const id = this.id();
    if (id) this.editor().create(id, request.position, request.chain);
  }

  protected editList(current: TodoList): void {
    this.listDialog().showEdit(current);
  }

  protected openPlanEditor(current: TodoList): void {
    this.planEditor().open(current);
  }

  protected saveAsTemplate(current: TodoList): void {
    const template = listToTemplate(current);
    const saved = this.templates.add(template);
    this.snackbar.show(this.t().templates.savedSnack(saved.title));
  }

  protected onListSaved(event: { id: string | null; title: string; timeboxMode: TimeboxMode }): void {
    const before = event.id ? this.store.getList(event.id) : undefined;
    if (!before) return;
    // Im Zettel geändert → ein Schritt im Verlauf dieses Zettels.
    this.store.editList(before.id, (l) => ({
      ...withTimeboxMode(l, event.timeboxMode, new Date()),
      title: event.title,
    }));
    const offer = modeSwitchOffer(before, event.timeboxMode);
    const updated = this.store.getList(before.id);
    if (offer === 'convert' && updated) this.planEditor().openConvert(updated);
    if (offer === 'scheduleKept') this.snackbar.show(this.t().time.scheduleKept);
  }

  protected undo(): void {
    const id = this.list()?.id;
    if (id) this.store.undo(id);
  }

  protected redo(): void {
    const id = this.list()?.id;
    if (id) this.store.redo(id);
  }

  protected archive(current: TodoList): void {
    this.store.archive(current.id);
    this.snackbar.show(this.t().snackbar.listArchived, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
    void this.router.navigate(['/']);
  }

  protected remove(current: TodoList): void {
    this.store.remove(current.id);
    this.snackbar.show(this.t().snackbar.listDeleted, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
    void this.router.navigate(['/']);
  }

  protected readonly closeMenu = closeMenu;

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    // In Feldern gilt das Rückgängig des Browsers; in Dialogen nichts dahinter auslösen.
    if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
    const action = actionFor(event, this.settings.keymap(), ['global']);
    if (!action) return;
    event.preventDefault();
    if (action === 'undo') this.undo();
    else if (action === 'redo') this.redo();
    else this.help().open();
  }
}
