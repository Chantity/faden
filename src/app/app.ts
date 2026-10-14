import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-meta';
import { de } from './core/i18n/de';
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
  protected readonly nav = de.nav;

  constructor() {
    void this.settings.load();
    void this.lists.load();
    void this.templates.load();
  }
}
