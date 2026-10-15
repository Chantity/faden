import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-meta';
import { BackupService } from './core/backup/backup.service';
import { I18nStore } from './core/i18n/i18n.store';
import { PwaService } from './core/pwa/pwa.service';
import { ListsStore } from './core/state/lists.store';
import { SettingsStore } from './core/state/settings.store';
import { TemplatesStore } from './core/state/templates.store';
import { ViewStore } from './core/state/view.store';
import { FirstRun } from './shared/first-run/first-run';
import { InstallBanner } from './shared/install-banner/install-banner';
import { closeMenusOnClick, closeMenusOnEscape } from './shared/menus';
import { Snackbar } from './shared/snackbar/snackbar';
import { TourOverlay } from './shared/tour/tour-overlay';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstallBanner, Snackbar, FirstRun, TourOverlay],
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class App {
  protected readonly onDocumentClick = closeMenusOnClick;
  protected readonly onEscape = closeMenusOnEscape;
  private readonly lists = inject(ListsStore);
  protected readonly settings = inject(SettingsStore);
  private readonly templates = inject(TemplatesStore);
  private readonly view = inject(ViewStore);
  private readonly backup = inject(BackupService);

  protected readonly appName = APP_NAME;
  protected readonly t = inject(I18nStore).t;

  constructor() {
    void this.settings.load();
    void this.lists.load();
    void this.templates.load();
    void this.view.load();
    void this.backup.requestPersistOnFirstInteraction();
    inject(PwaService).init();
  }
}
