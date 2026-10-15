import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DEFAULT_SCHEME_ID, type ColorScheme } from '../../core/color-scheme';
import { I18nStore } from '../../core/i18n/i18n.store';
import { SettingsStore } from '../../core/state/settings.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';

/** Abschnitt „Farbschema“ auf „Für Fortgeschrittene“: wählen, duplizieren, bearbeiten, löschen. */
@Component({
  selector: 'app-scheme-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="card block" aria-labelledby="schemes-heading">
      <h2 id="schemes-heading">{{ t().schemes.heading }}</h2>
      <p class="muted">{{ t().schemes.hint }}</p>
      <ul class="schemes">
        @for (scheme of settings.schemes(); track scheme.id) {
          <li class="scheme">
            <label class="option scheme__pick" [class.is-selected]="settings.activeScheme().id === scheme.id">
              <input
                type="radio"
                name="scheme"
                [checked]="settings.activeScheme().id === scheme.id"
                (change)="settings.setActiveScheme(scheme.id)"
              />
              <span class="swatches" aria-hidden="true">
                <span class="swatch" [style.background]="scheme.primary.light"></span>
                <span class="swatch" [style.background]="scheme.primary.dark"></span>
              </span>
              <span class="scheme__name">{{ scheme.name }}</span>
              @if (scheme.id === defaultId) {
                <span class="badge">{{ t().schemes.defaultBadge }}</span>
              }
            </label>
            <span class="scheme__actions">
              @if (scheme.id !== defaultId) {
                <a
                  class="btn"
                  [routerLink]="['/einstellungen/fortgeschritten/farbschema', scheme.id]"
                  [attr.aria-label]="t().schemes.editLabel(scheme.name)"
                >
                  {{ t().schemes.edit }}
                </a>
              }
              <button
                type="button"
                class="btn"
                [attr.aria-label]="t().schemes.duplicateLabel(scheme.name)"
                (click)="duplicate(scheme)"
              >
                {{ t().schemes.duplicate }}
              </button>
              @if (scheme.id !== defaultId) {
                <button
                  type="button"
                  class="btn btn--ghost danger"
                  [attr.aria-label]="t().schemes.deleteLabel(scheme.name)"
                  (click)="remove(scheme)"
                >
                  {{ t().schemes.delete }}
                </button>
              }
            </span>
          </li>
        }
      </ul>
      <button type="button" class="btn" (click)="duplicate(settings.defaultScheme())">
        + {{ t().schemes.newScheme }}
      </button>
    </section>
  `,
  styles: `
    .block {
      padding: var(--space-4) var(--space-5);
      margin-bottom: var(--space-4);
    }

    .block h2 {
      margin-top: 0;
    }

    .schemes {
      list-style: none;
      margin: 0 0 var(--space-3);
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .scheme {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .scheme__pick {
      flex: 1 1 14rem;
      min-width: 0;
    }

    .scheme__name {
      min-width: 0;
    }

    .scheme__actions {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .swatches {
      display: inline-flex;
      flex: none;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .swatch {
      width: 18px;
      height: 24px;
    }
  `,
})
export class SchemeSection {
  protected readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  protected readonly t = inject(I18nStore).t;
  protected readonly defaultId = DEFAULT_SCHEME_ID;

  /** Kopie anlegen und gleich bearbeiten – dafür dupliziert man. */
  protected async duplicate(scheme: ColorScheme): Promise<void> {
    const copy = await this.settings.duplicateScheme(scheme.id);
    void this.router.navigate(['/einstellungen/fortgeschritten/farbschema', copy.id]);
  }

  protected async remove(scheme: ColorScheme): Promise<void> {
    const index = (this.settings.settings().colorSchemes ?? []).findIndex((s) => s.id === scheme.id);
    const active = this.settings.activeScheme().id === scheme.id;
    await this.settings.deleteScheme(scheme.id);
    this.snackbar.show(this.t().schemes.deleted(scheme.name), {
      label: this.t().common.undo,
      run: () => void this.settings.restoreScheme(scheme, index, active),
    });
  }
}
