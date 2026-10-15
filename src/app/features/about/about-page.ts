import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { APP_REPO_URL, APP_VERSION } from '../../app-meta';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { PwaService } from '../../core/pwa/pwa.service';
import { SettingsStore } from '../../core/state/settings.store';
import { GuideDialog } from '../../shared/guide/guide-dialog';
import { TourService } from '../../shared/tour/tour.service';
import { formatBytes } from '../../core/time';

/** „Über“: Version, Hilfe und Speicher – was man liest, statt es einzustellen. */
@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideDialog],
  template: `
    <h1>{{ t().nav.about }}</h1>

    <section class="card block">
      <h2>{{ t().settings.versionHeading }}</h2>
      <p class="muted">{{ t().settings.versionLabel }}: {{ appVersion }}</p>
      <div class="actions">
        <button type="button" class="btn" (click)="guide.open('changelog')">{{ t().settings.changelogOpen }}</button>
      </div>
      @if (pwa.offline() === 'ready') {
        <p class="muted">{{ t().settings.updateHint }}</p>
        @switch (pwa.update()) {
          @case ('available') {
            <div class="update-banner" role="status">
              <p>{{ t().settings.updateAvailable(pwa.updateVersion() ?? '') }}</p>
              <div class="actions">
                <button type="button" class="btn btn--primary" (click)="pwa.applyUpdate()">
                  {{ t().settings.updateApply }}
                </button>
                <button type="button" class="btn" (click)="pwa.update.set('idle')">
                  {{ t().settings.updateLater }}
                </button>
              </div>
            </div>
          }
          @case ('checking') {
            <p role="status">{{ t().settings.updateChecking }}</p>
          }
          @case ('applying') {
            <p role="status">{{ t().settings.updateApplying }}</p>
          }
          @default {
            @if (updateMessage(); as message) {
              <p role="status">{{ message }}</p>
            }
            <button type="button" class="btn" (click)="pwa.checkForUpdate()">
              {{ t().settings.updateCheck }}
            </button>
          }
        }
      }
    </section>

    <section class="card block">
      <h2>{{ t().settings.helpHeading }}</h2>
      <div class="actions">
        <button type="button" class="btn btn--primary" (click)="tour.startTour()">{{ t().tour.start }}</button>
        <button type="button" class="btn" (click)="guide.open()">{{ t().settings.guideOpen }}</button>
        <a class="btn" [href]="repoUrl" target="_blank" rel="noopener">{{ t().settings.repoLink }}</a>
      </div>
      <app-guide-dialog #guide />
    </section>

    <section class="card block">
      <h2>{{ t().settings.storageHeading }}</h2>
      <p class="muted">{{ storageStatus() }}</p>
      @if (storageUsage(); as usage) {
        <p class="muted">{{ usage }}</p>
      }
      @if (canPersist()) {
        <button type="button" class="btn" (click)="requestPersist()">
          {{ t().settings.persistAction }}
        </button>
      }
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

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .update-banner {
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-primary);
      border-radius: var(--radius);
      background: var(--color-accent-soft);
    }

    .update-banner p {
      margin-top: 0;
    }
  `,
})
export class AboutPage {
  private readonly settings = inject(SettingsStore);
  protected readonly t = inject(I18nStore).t;
  protected readonly pwa = inject(PwaService);
  protected readonly tour = inject(TourService);
  protected readonly appVersion = APP_VERSION;
  protected readonly repoUrl = APP_REPO_URL;

  protected readonly updateMessage = computed(() => {
    const s = this.t().settings;
    switch (this.pwa.update()) {
      case 'current':
        return s.updateCurrent;
      case 'unreachable':
        return s.updateUnreachable;
      case 'failed':
        return s.updateFailed;
      default:
        return null;
    }
  });

  protected readonly storageStatus = signal<string>('');
  protected readonly canPersist = signal(false);
  private readonly storageEstimate = signal<{ usage: number; quota: number } | null>(null);
  /** `navigator.storage.estimate()` als Info. */
  protected readonly storageUsage = computed(() => {
    const estimate = this.storageEstimate();
    if (!estimate) return null;
    const locale = this.settings.language();
    return this.t().settings.storageUsage(formatBytes(estimate.usage, locale), formatBytes(estimate.quota, locale));
  });

  constructor() {
    inject(PageTitleService).set('about');
    this.storageStatus.set(this.t().settings.storagePending);
    void this.checkStorage();
    void this.checkEstimate();
  }

  protected async requestPersist(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      this.storageStatus.set(granted ? this.t().settings.persistGranted : this.t().settings.persistDenied);
      this.canPersist.set(!granted);
    } catch {
      // Ignoriert: Status bleibt wie zuvor.
    }
  }

  private async checkEstimate(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
    try {
      const { usage, quota } = await navigator.storage.estimate();
      if (typeof usage === 'number' && typeof quota === 'number' && quota > 0) {
        this.storageEstimate.set({ usage, quota });
      }
    } catch {
      // Nur eine Info – fehlt sie, wird nichts angezeigt.
    }
  }

  private async checkStorage(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
      this.storageStatus.set(this.t().settings.storageUnprotected);
      return;
    }
    const persisted = await navigator.storage.persisted();
    this.storageStatus.set(persisted ? this.t().settings.storagePersisted : this.t().settings.storageUnprotected);
    this.canPersist.set(!persisted && typeof navigator.storage.persist === 'function');
  }
}
