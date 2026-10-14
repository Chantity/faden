import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import type { TimeboxMode, TodoList } from '../../core/model';
import { progress } from '../../core/graph';
import { ListsStore } from '../../core/state/lists.store';
import { ViewStore, type ListView } from '../../core/state/view.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { ListDialog } from '../lists/list-dialog';
import { FocusView } from './focus-view';
import { FlowView } from './flow-view';
import { TaskEditor } from './task-editor';
import { ConnectDialog } from './connect-dialog';
import { ShortcutHelp } from './shortcut-help';

@Component({
  selector: 'app-list-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ListDialog, FocusView, FlowView, TaskEditor, ConnectDialog, ShortcutHelp],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a class="back" routerLink="/">← {{ t().nav.lists }}</a>

    @if (list(); as current) {
      <header class="detail-head">
        <div class="detail-head__title">
          <h1>{{ current.title }}</h1>
          <p class="muted">{{ progressLabel() }}</p>
        </div>
        <div class="detail-head__actions">
          <button
            type="button"
            class="icon-btn"
            [disabled]="!store.canUndo()"
            [attr.aria-label]="t().common.undo"
            (click)="undo()"
          >
            ↶
          </button>
          <button
            type="button"
            class="icon-btn"
            [disabled]="!store.canRedo()"
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
          (connectRequest)="openConnect($event)"
        />
      } @else {
        <app-flow-view
          [list]="current"
          (edit)="openEditor($event)"
          (connectRequest)="openConnect($event)"
        />
      }
    } @else {
      <h1>{{ t().lists.emptyTitle }}</h1>
      <p class="muted">{{ t().listDetail.notFound }}</p>
      <a class="btn btn--primary" routerLink="/">{{ t().nav.lists }}</a>
    }

    <app-task-editor />
    <app-connect-dialog />
    <app-shortcut-help />
    <app-list-dialog (saved)="onListSaved($event)" />
  `,
  styles: `
    :host {
      display: block;
      max-width: 960px;
    }

    .back {
      display: inline-block;
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

    .detail-head__title h1 {
      margin: 0;
    }

    .detail-head__title p {
      margin: var(--space-1) 0 0;
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

  private readonly editor = viewChild.required(TaskEditor);
  private readonly connectDialog = viewChild.required(ConnectDialog);
  private readonly help = viewChild.required(ShortcutHelp);
  private readonly listDialog = viewChild.required(ListDialog);

  protected readonly t = this.i18n.t;

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null,
  });

  constructor() {
    inject(PageTitleService).set('list');
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

  protected setView(view: ListView): void {
    const id = this.id();
    if (id) this.viewStore.set(id, view);
  }

  protected openEditor(taskId: string): void {
    const id = this.id();
    if (id) this.editor().open(id, taskId);
  }

  protected openConnect(taskId: string): void {
    const id = this.id();
    if (id) this.connectDialog().open(id, taskId);
  }

  protected editList(current: TodoList): void {
    this.listDialog().showEdit(current);
  }

  protected onListSaved(event: { id: string | null; title: string; timeboxMode: TimeboxMode }): void {
    if (event.id) this.store.update(event.id, { title: event.title, timeboxMode: event.timeboxMode });
  }

  protected undo(): void {
    this.store.undo();
  }

  protected redo(): void {
    this.store.redo();
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

  protected closeMenu(event: Event): void {
    (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const inField = Boolean(target?.closest('input, textarea, select, [contenteditable]'));
    const mod = event.ctrlKey || event.metaKey;
    if (mod) {
      if (inField) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
      } else if (key === 'y') {
        event.preventDefault();
        this.redo();
      }
      return;
    }
    if (event.key === '?' && !inField) {
      event.preventDefault();
      this.help().open();
    }
  }
}
