import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { availableTasks, progress } from '../../core/graph';
import { ListsStore } from '../../core/state/lists.store';

@Component({
  selector: 'app-list-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="back" routerLink="/">← {{ t().nav.lists }}</a>

    @if (list(); as current) {
      <h1>{{ current.title }}</h1>
      <p class="muted">{{ progressLabel() }}</p>

      <h2>{{ t().lists.nowHeading }}</h2>
      @if (available().length > 0) {
        <ul class="stack plain">
          @for (task of available(); track task.id) {
            <li class="card preview">{{ task.title }}</li>
          }
        </ul>
      } @else {
        <p class="muted">{{ t().lists.allDone }}</p>
      }

      <p class="muted hint">{{ t().listDetail.placeholder }}</p>
    } @else {
      <h1>{{ t().lists.emptyTitle }}</h1>
      <p class="muted">{{ t().listDetail.notFound }}</p>
      <a class="btn btn--primary" routerLink="/">{{ t().nav.lists }}</a>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 720px;
    }

    .back {
      display: inline-block;
      margin-bottom: var(--space-3);
      text-decoration: none;
      color: var(--color-text-muted);
    }

    .plain {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-4);
    }

    .preview {
      padding: var(--space-4);
      font-weight: 600;
    }

    .hint {
      margin-top: var(--space-5);
      font-size: 0.9rem;
    }
  `,
})
export class ListDetailPage {
  private readonly store = inject(ListsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nStore);

  protected readonly t = this.i18n.t;

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: null },
  );

  constructor() {
    inject(PageTitleService).set('list');
  }

  protected readonly list = computed(() => {
    const id = this.id();
    if (!id) return undefined;
    return this.store.lists().find((l) => l.id === id) ?? this.store.archived().find((l) => l.id === id);
  });

  protected readonly available = computed(() => {
    const current = this.list();
    return current ? availableTasks(current) : [];
  });

  protected readonly progressLabel = computed(() => {
    const current = this.list();
    if (!current) return '';
    const { done, total } = progress(current);
    return this.t().lists.progress(done, total);
  });
}
