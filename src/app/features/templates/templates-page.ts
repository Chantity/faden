import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { topologicalOrder } from '../../core/graph';
import { TemplatesStore } from '../../core/state/templates.store';
import type { Template } from '../../core/model';

@Component({
  selector: 'app-templates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ t().nav.templates }}</h1>

    @if (store.templates().length === 0) {
      <div class="card empty">
        <p class="muted">
          {{ t().templates.placeholder }}
        </p>
      </div>
    } @else {
      <ul class="stack plain">
        @for (template of store.templates(); track template.id) {
          <li class="card template">
            <h2>{{ template.title }}</h2>
            <ol class="muted">
              @for (task of ordered(template); track task.id) {
                <li>{{ task.title }}</li>
              }
            </ol>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .plain {
      list-style: none;
      padding: 0;
    }

    .empty {
      padding: var(--space-5);
    }

    .template {
      padding: var(--space-4);
    }

    .template h2 {
      margin-top: 0;
    }
  `,
})
export class TemplatesPage {
  protected readonly store = inject(TemplatesStore);
  protected readonly t = inject(I18nStore).t;

  constructor() {
    inject(PageTitleService).set('templates');
  }

  protected ordered(template: Template): { id: string; title: string }[] {
    return topologicalOrder({
      id: template.id,
      title: template.title,
      timeboxMode: template.timeboxMode,
      tasks: template.tasks.map((task) => ({ ...task, done: false })),
      edges: template.edges,
      archived: false,
      createdAt: template.createdAt,
      updatedAt: template.createdAt,
      sortOrder: 0,
    });
  }
}
