import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { APP_VERSION } from '../../app-meta';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { SUPPORTED_LOCALES, type Locale } from '../../core/model';
import { SettingsStore, type ThemeChoice } from '../../core/state/settings.store';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ t().nav.settings }}</h1>

    <section class="card block">
      <h2>{{ t().settings.themeHeading }}</h2>
      <div class="options">
        @for (option of themeOptions(); track option.value) {
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
      <h2>{{ t().settings.languageHeading }}</h2>
      <div class="options">
        @for (option of languageOptions(); track option.value) {
          <label class="option" [class.is-selected]="settings.language() === option.value">
            <input
              type="radio"
              name="language"
              [value]="option.value"
              [checked]="settings.language() === option.value"
              (change)="settings.setLanguage(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        }
      </div>
    </section>

    <section class="card block">
      <h2>{{ t().settings.storageHeading }}</h2>
      <p class="muted">{{ storageStatus() }}</p>
    </section>

    <section class="card block">
      <h2>{{ t().settings.versionHeading }}</h2>
      <p class="muted">{{ t().settings.versionLabel }}: {{ appVersion }}</p>
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
  private readonly i18n = inject(I18nStore);
  protected readonly t = this.i18n.t;
  protected readonly appVersion = APP_VERSION;

  protected readonly themeOptions = computed<{ value: ThemeChoice; label: string }[]>(() => {
    const s = this.t().settings;
    return [
      { value: 'system', label: s.themeSystem },
      { value: 'light', label: s.themeLight },
      { value: 'dark', label: s.themeDark },
    ];
  });

  protected readonly languageOptions = computed<{ value: Locale; label: string }[]>(() => {
    const s = this.t().settings;
    const labels: Record<Locale, string> = {
      en: s.languageEnglish,
      de: s.languageGerman,
    };
    return SUPPORTED_LOCALES.map((value) => ({ value, label: labels[value] }));
  });

  protected readonly storageStatus = signal<string>('');

  constructor() {
    inject(PageTitleService).set('settings');
    this.storageStatus.set(this.t().settings.storagePending);
    void this.checkStorage();
  }

  private async checkStorage(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
      this.storageStatus.set(this.t().settings.storageUnprotected);
      return;
    }
    const persisted = await navigator.storage.persisted();
    this.storageStatus.set(
      persisted ? this.t().settings.storagePersisted : this.t().settings.storageUnprotected,
    );
  }
}
