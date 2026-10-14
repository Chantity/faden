import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PwaService } from '../../core/pwa/pwa.service';

/** localStorage-Schlüssel: Nutzer hat das Banner mit „Ignorieren“ geschlossen. */
export const INSTALL_BANNER_DISMISSED_KEY = 'faden.installBannerDismissed';

/**
 * Hinweis „Als App installieren“ (SPEC 9.5) – nur im Browser-Tab, nicht in der
 * installierten App, und nur, solange der Nutzer es nicht ignoriert hat.
 * Chrome/Edge/Android: „Installieren“ öffnet die native Aufforderung.
 * iOS: „Installieren“ klappt die Anleitung „Teilen → Zum Home-Bildschirm“ auf.
 */
@Component({
  selector: 'app-install-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="install-banner card" role="region" [attr.aria-label]="t().installBanner.heading">
        <div class="install-banner__text">
          <strong>{{ t().installBanner.heading }}</strong>
          <p class="muted">{{ t().installBanner.body }}</p>
          @if (iosSteps()) {
            <p>{{ t().settings.installIosSteps }}</p>
            <p class="muted">{{ t().settings.installIosHint }}</p>
          }
        </div>
        <div class="install-banner__actions">
          @if (!iosSteps()) {
            <button type="button" class="btn btn--primary" (click)="install()">
              {{ t().installBanner.install }}
            </button>
          }
          <button type="button" class="btn" (click)="dismiss()">
            {{ t().installBanner.dismiss }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .install-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      border-left: 4px solid var(--color-primary);
    }

    .install-banner__text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .install-banner__text p {
      margin: 0;
    }

    .install-banner__actions {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
  `,
})
export class InstallBanner {
  private readonly pwa = inject(PwaService);
  protected readonly t = inject(I18nStore).t;

  private readonly dismissed = signal(readDismissed());
  protected readonly iosSteps = signal(false);

  protected readonly visible = computed(
    () =>
      !this.dismissed() && !this.pwa.installed() && (this.pwa.canPrompt() || this.pwa.isIos()),
  );

  protected async install(): Promise<void> {
    if (this.pwa.isIos()) {
      this.iosSteps.set(true);
      return;
    }
    await this.pwa.install();
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
    } catch {
      // Ohne Speicher (z. B. privates Fenster) gilt „Ignorieren“ nur für diese Sitzung.
    }
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
