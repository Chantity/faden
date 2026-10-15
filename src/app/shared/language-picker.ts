import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nStore } from '../core/i18n/i18n.store';
import { SUPPORTED_LOCALES, type Locale } from '../core/model';
import { SettingsStore } from '../core/state/settings.store';

/** Sprachwahl als Kacheln – in den Einstellungen und im Start-Dialog. */
@Component({
  selector: 'app-language-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="options" role="radiogroup" [attr.aria-labelledby]="labelledBy()">
      @for (option of options(); track option.value) {
        <label class="option" [class.is-selected]="settings.language() === option.value">
          <input
            type="radio"
            [name]="name()"
            [value]="option.value"
            [checked]="settings.language() === option.value"
            (change)="settings.setLanguage(option.value)"
          />
          <span>{{ option.label }}</span>
        </label>
      }
    </div>
  `,
})
export class LanguagePicker {
  /** Eigener Name je Einsatzort, damit zwei Gruppen im DOM sich nicht stören. */
  readonly name = input('language');
  readonly labelledBy = input<string | null>(null);

  protected readonly settings = inject(SettingsStore);
  private readonly t = inject(I18nStore).t;

  protected readonly options = computed<{ value: Locale; label: string }[]>(() => {
    const s = this.t().settings;
    const labels: Record<Locale, string> = { en: s.languageEnglish, de: s.languageGerman };
    return SUPPORTED_LOCALES.map((value) => ({ value, label: labels[value] }));
  });
}
