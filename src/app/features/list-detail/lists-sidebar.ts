import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { progress } from '../../core/graph';
import { I18nStore } from '../../core/i18n/i18n.store';
import type { TodoList } from '../../core/model';
import { ListsStore } from '../../core/state/lists.store';
import { ViewStore } from '../../core/state/view.store';

/**
 * Zettel-Liste links neben dem geöffneten Zettel – nur auf breiten
 * Bildschirmen (> 1024 px) und einklappbar. Auf kleineren
 * Bildschirmen ausgeblendet; dort führt „← Zettel" zur Übersicht.
 */
@Component({
  selector: 'app-lists-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="side" [class.is-collapsed]="view.sidebarCollapsed()" [attr.aria-label]="t().nav.lists">
      <button
        type="button"
        class="icon-btn side__toggle"
        aria-controls="lists-side-list"
        [attr.aria-expanded]="!view.sidebarCollapsed()"
        [attr.aria-label]="view.sidebarCollapsed() ? t().listDetail.sidebarExpand : t().listDetail.sidebarCollapse"
        (click)="view.setSidebarCollapsed(!view.sidebarCollapsed())"
      >
        <span aria-hidden="true">{{ view.sidebarCollapsed() ? '»' : '«' }}</span>
      </button>
      @if (!view.sidebarCollapsed()) {
        <ul id="lists-side-list" class="side__list">
          @for (list of store.lists(); track list.id) {
            <li>
              <a
                class="side__link"
                [routerLink]="['/zettel', list.id]"
                [class.is-current]="list.id === currentId()"
                [attr.aria-current]="list.id === currentId() ? 'page' : null"
              >
                <span class="side__title clamp-2">{{ list.title }}</span>
                <span class="side__progress muted">{{ progressLabel(list) }}</span>
                <span class="badge">{{ t().timebox.modes[list.timeboxMode] }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </nav>
  `,
  styles: `
    :host {
      display: none;
    }

    @media (min-width: 1025px) {
      :host {
        display: block;
      }
    }

    .side {
      position: sticky;
      top: var(--space-4);
      width: 15rem;
    }

    .side.is-collapsed {
      width: auto;
    }

    .side__list {
      list-style: none;
      margin: var(--space-2) 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .side__link {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: var(--touch-min);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius);
      text-decoration: none;
      color: var(--color-text);
    }

    .side__link:hover {
      background: var(--color-surface-2);
    }

    .side__link.is-current {
      background: var(--color-accent-soft);
      font-weight: 600;
    }

    .side__progress {
      font-size: 0.85rem;
      font-weight: 400;
    }

    .side__link .badge {
      margin-top: var(--space-1);
      font-weight: 400;
    }
  `,
})
export class ListsSidebar {
  readonly currentId = input<string | null>(null);

  protected readonly store = inject(ListsStore);
  protected readonly view = inject(ViewStore);
  protected readonly t = inject(I18nStore).t;

  protected progressLabel(list: TodoList): string {
    const { done, total } = progress(list);
    return total === 0 ? this.t().lists.emptyList : this.t().lists.progress(done, total);
  }
}
