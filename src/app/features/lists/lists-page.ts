import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { TITLE_MAX_LENGTH, type TimeboxMode, type TodoList } from '../../core/model';
import { availableTasks, progress, topologicalOrder } from '../../core/graph';
import { closeMenu } from '../../shared/menus';
import { listToTemplate, templateToList } from '../../core/templates';
import { modeSwitchOffer, withTimeboxMode } from '../../core/time';
import { BackupService } from '../../core/backup/backup.service';
import { ListsStore } from '../../core/state/lists.store';
import { SettingsStore } from '../../core/state/settings.store';
import { TourService } from '../../shared/tour/tour.service';
import { TemplatesStore } from '../../core/state/templates.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { ListDialog, type ListDialogResult } from './list-dialog';

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
  private readonly backup = inject(BackupService);
  private readonly templatesStore = inject(TemplatesStore);
  protected readonly settings = inject(SettingsStore);
  private readonly tour = inject(TourService);
  protected readonly templates = this.templatesStore.templates;

  protected readonly t = this.i18n.t;
  protected readonly maxTitle = TITLE_MAX_LENGTH;
  protected readonly showReminder = signal(false);

  constructor() {
    inject(PageTitleService).set('lists');
    void this.checkReminder();
    // Einmal pro Besuch der Übersicht, sobald die Zettel geladen sind.
    const archiveOnce = effect(() => {
      if (!this.store.ready()) return;
      untracked(() => this.handleCompleted());
      archiveOnce.destroy();
    });
  }

  private async checkReminder(): Promise<void> {
    const hasData = this.store.lists().length > 0 || this.store.archived().length > 0;
    this.showReminder.set(await this.backup.shouldShowReminder(new Date(), hasData));
  }

  protected async exportBackup(): Promise<void> {
    await this.backup.exportAndDownload();
    this.snackbar.show(this.t().backup.export);
    this.showReminder.set(false);
  }

  protected async dismissReminder(): Promise<void> {
    await this.backup.dismissReminder();
    this.showReminder.set(false);
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

  protected openCreate(fromTemplate = false): void {
    this.dialog().showCreate(fromTemplate);
  }

  protected openEdit(list: TodoList): void {
    this.dialog().showEdit(list);
  }

  protected onSaved(event: ListDialogResult): void {
    const template = this.templates().find((t) => t.id === event.templateId);
    if (event.id === null && template) {
      const list = templateToList(template);
      this.store.addNew(
        withTimeboxMode({ ...list, title: event.title }, event.timeboxMode, new Date()),
      );
    } else if (event.id === null) {
      this.store.create(event.title, event.timeboxMode);
    } else {
      const before = this.store.getList(event.id);
      this.store.update(event.id, { title: event.title, timeboxMode: event.timeboxMode });
      const offer = before ? modeSwitchOffer(before, event.timeboxMode) : null;
      if (offer === 'convert') this.snackbar.show(this.t().time.convertLater);
      if (offer === 'scheduleKept') this.snackbar.show(this.t().time.scheduleKept);
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

  protected saveAsTemplate(list: TodoList): void {
    const template = listToTemplate(list);
    const saved = this.templatesStore.add(template);
    this.snackbar.show(this.t().templates.savedSnack(saved.title));
  }

  protected readonly closeMenu = closeMenu;

  /** Titel aller ToDos in Ablauf-Reihenfolge (für archivierte Zettel). */
  protected taskTitles(list: TodoList): string[] {
    return topologicalOrder(list).map((task) => task.title);
  }

  /** Fertige Zettel wandern beim Betreten der Übersicht ins Archiv oder in den Papierkorb (mit Rückgängig). */
  private handleCompleted(): void {
    const action = this.settings.completedLists();
    // Den Übungszettel der laufenden Tour nicht wegräumen – an ihm wird noch geübt.
    const practice = this.tour.practiceId();
    const handled = this.store.handleCompleted(action, new Set(practice ? [practice] : []));
    if (handled.length === 0) return;
    const snack = this.t().snackbar;
    const one = action === 'delete' ? snack.autoDeletedOne : snack.autoArchivedOne;
    const many = action === 'delete' ? snack.autoDeletedMany : snack.autoArchivedMany;
    const message = handled.length === 1 ? one(handled[0]!.title) : many(handled.length);
    this.snackbar.show(message, { label: this.t().common.undo, run: () => this.store.undo() });
  }
}
