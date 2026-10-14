import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-meta';
import { I18nStore } from './core/i18n/i18n.store';
import { ListsStore } from './core/state/lists.store';
import { SettingsStore } from './core/state/settings.store';
import { TemplatesStore } from './core/state/templates.store';
import { Snackbar } from './shared/snackbar/snackbar';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Snackbar],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly lists = inject(ListsStore);
  private readonly settings = inject(SettingsStore);
  private readonly templates = inject(TemplatesStore);

  protected readonly appName = APP_NAME;
  protected readonly t = inject(I18nStore).t;

  constructor() {
    void this.settings.load();
    void this.lists.load();
    void this.templates.load();
  }
}
