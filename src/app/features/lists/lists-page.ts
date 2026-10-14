import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { TITLE_MAX_LENGTH, type TimeboxMode, type TodoList } from '../../core/model';
import { availableTasks, progress } from '../../core/graph';
import { ListsStore } from '../../core/state/lists.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { ListDialog } from './list-dialog';

@Component({
  selector: 'app-lists-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ListDialog],
  templateUrl: './lists-page.html',
  styleUrl: './lists-page.css',
})
export class ListsPage {
  protected readonly store = inject(ListsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = viewChild.required(ListDialog);
  private readonly i18n = inject(I18nStore);

  protected readonly t = this.i18n.t;
  protected readonly maxTitle = TITLE_MAX_LENGTH;

  constructor() {
    inject(PageTitleService).set('lists');
  }

  protected progressLabel(list: TodoList): string {
    const { done, total } = progress(list);
    return total === 0 ? this.t().lists.emptyList : this.t().lists.progress(done, total);
  }

  protected modeLabel(mode: TimeboxMode): string {
    return this.t().timebox.modes[mode];
  }

  protected hasTasks(list: TodoList): boolean {
    return list.tasks.length > 0;
  }

  protected nextAvailable(list: TodoList): string | null {
    return availableTasks(list)[0]?.title ?? null;
  }

  protected archivedCount(): string {
    return this.t().lists.archivedCount(this.store.archived().length);
  }

  protected openCreate(): void {
    this.dialog().showCreate();
  }

  protected openEdit(list: TodoList): void {
    this.dialog().showEdit(list);
  }

  protected onSaved(event: { id: string | null; title: string; timeboxMode: TimeboxMode }): void {
    if (event.id === null) {
      this.store.create(event.title, event.timeboxMode);
    } else {
      this.store.update(event.id, { title: event.title, timeboxMode: event.timeboxMode });
    }
  }

  protected duplicate(list: TodoList): void {
    this.store.duplicate(list.id);
    this.snackbar.show(this.t().snackbar.listDuplicated, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }

  protected archive(list: TodoList): void {
    this.store.archive(list.id);
    this.snackbar.show(this.t().snackbar.listArchived, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }

  protected restore(list: TodoList): void {
    this.store.restore(list.id);
    this.snackbar.show(this.t().snackbar.listRestored, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }

  protected remove(list: TodoList): void {
    this.store.remove(list.id);
    this.snackbar.show(this.t().snackbar.listDeleted, {
      label: this.t().common.undo,
      run: () => this.store.undo(),
    });
  }

  protected move(list: TodoList, direction: 'up' | 'down'): void {
    this.store.move(list.id, direction);
  }

  protected closeMenu(event: Event): void {
    (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
  }
}
