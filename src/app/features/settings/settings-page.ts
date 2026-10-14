import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { APP_VERSION } from '../../app-meta';
import { de } from '../../core/i18n/de';
import { SettingsStore, type ThemeChoice } from '../../core/state/settings.store';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ t.nav.settings }}</h1>

    <section class="card block">
      <h2>{{ t.settings.themeHeading }}</h2>
      <div class="options">
        @for (option of themeOptions; track option.value) {
          <label class="option" [class.is-selected]="settings.theme() === option.value">
            <input
              type="radio"
              name="theme"
              [value]="option.value"
              [checked]="settings.theme() === option.value"
              (change)="settings.setTheme(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        }
      </div>
    </section>

    <section class="card block">
      <h2>{{ t.settings.storageHeading }}</h2>
      <p class="muted">{{ storageStatus() }}</p>
    </section>

    <section class="card block">
      <h2>{{ t.settings.versionHeading }}</h2>
      <p class="muted">{{ t.settings.versionLabel }}: {{ appVersion }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 720px;
    }

    .block {
      padding: var(--space-4) var(--space-5);
      margin-bottom: var(--space-4);
    }

    .block h2 {
      margin-top: 0;
    }

    .options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .option {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      cursor: pointer;
      min-height: var(--touch-min);
    }

    .option.is-selected {
      border-color: var(--color-primary);
      background: var(--color-accent-soft);
    }
  `,
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  protected readonly t = de;
  protected readonly appVersion = APP_VERSION;

  protected readonly themeOptions: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: de.settings.themeSystem },
    { value: 'light', label: de.settings.themeLight },
    { value: 'dark', label: de.settings.themeDark },
  ];

  protected readonly storageStatus = signal<string>(de.settings.storagePending);

  constructor() {
    void this.checkStorage();
  }

  private async checkStorage(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
      this.storageStatus.set(de.settings.storageUnprotected);
      return;
    }
    const persisted = await navigator.storage.persisted();
    this.storageStatus.set(
      persisted ? de.settings.storagePersisted : de.settings.storageUnprotected,
    );
  }
}
