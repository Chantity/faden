import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { APP_REPO_URL, APP_VERSION } from '../../app-meta';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { SUPPORTED_LOCALES, type Locale } from '../../core/model';
import { BackupService } from '../../core/backup/backup.service';
import { PwaService, type OfflineState } from '../../core/pwa/pwa.service';
import { findConflicts, validateBackup, type BackupIssue, type ConflictStrategy } from '../../core/storage';
import { ListsStore } from '../../core/state/lists.store';
import { describeBackupIssue } from '../../core/i18n/backup-error';
import { SettingsStore, type ThemeChoice } from '../../core/state/settings.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { GuideDialog } from '../../shared/guide/guide-dialog';
import { RouterLink } from '@angular/router';
import { formatBytes } from '../../core/time';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideDialog, RouterLink],
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
      @if (storageUsage(); as usage) {
        <p class="muted">{{ usage }}</p>
      }
      @if (canPersist()) {
        <button type="button" class="btn" (click)="requestPersist()">
          {{ t().settings.persistAction }}
        </button>
      }
    </section>

    <section class="card block">
      <h2>{{ t().settings.installHeading }}</h2>
      <p class="muted" role="status">{{ offlineLabel() }}</p>
      @if (pwa.installed()) {
        <p>{{ t().settings.installDone }}</p>
      } @else {
        @if (pwa.canPrompt()) {
          <button type="button" class="btn btn--primary" (click)="install()">
            {{ t().settings.installAction }}
          </button>
        }
        @if (pwa.isIos()) {
          <p>{{ t().settings.installIosSteps }}</p>
          <p class="muted">{{ t().settings.installIosHint }}</p>
        } @else if (!pwa.canPrompt()) {
          <p class="muted">{{ t().settings.installManual }}</p>
        }
      }
    </section>

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
        <button type="button" class="btn" (click)="guide.open()">{{ t().settings.guideOpen }}</button>
        <a class="btn" [href]="repoUrl" target="_blank" rel="noopener">{{ t().settings.repoLink }}</a>
      </div>
      <app-guide-dialog #guide />
    </section>

    <section class="card block">
      <h2>{{ t().settings.advancedHeading }}</h2>
      <p class="muted">{{ t().settings.advancedHint }}</p>
      <div class="actions">
        <a class="btn" routerLink="/einstellungen/fortgeschritten">{{ t().settings.advancedOpen }} →</a>
      </div>
    </section>

    <section class="card block">
      <h2>{{ t().backup.heading }}</h2>
      <p class="muted">{{ backup.lastBackupAt() ? lastBackupLabel() : t().backup.lastBackupNever }}</p>
      <div class="actions">
        <button type="button" class="btn btn--primary" (click)="exportBackup()">
          {{ t().backup.export }}
        </button>
        @if (canShare()) {
          <button type="button" class="btn" (click)="shareBackup()">
            {{ t().backup.share }}
          </button>
        }
        <button type="button" class="btn" (click)="pickImport()">
          {{ t().backup.importHeading }}
        </button>
      </div>
      <input
        #fileInput
        type="file"
        accept="application/json,.json"
        class="visually-hidden"
        (change)="onFileChosen($event)"
      />
    </section>

    <dialog #importDlg class="sheet" (close)="onClosed()">
      <div class="sheet__form">
        <h2>{{ t().backup.importTitle }}</h2>
        @if (importErrors().length > 0) {
          <p class="field__error" role="alert">{{ t().backup.invalid }}</p>
          <ul class="muted errors">
            @for (error of importErrorTexts(); track $index) {
              <li>{{ error }}</li>
            }
          </ul>
        } @else if (choosingStrategy()) {
          <p>{{ t().backup.conflictsHeading(conflicts().length) }}</p>
          <ul class="conflicts">
            @for (title of conflicts(); track $index) {
              <li>{{ title }}</li>
            }
          </ul>
          <fieldset class="strategies">
            <legend class="field__label">{{ t().backup.conflictChoice }}</legend>
            @for (option of strategyOptions; track option) {
              <label class="radio">
                <input
                  type="radio"
                  name="strategy"
                  [checked]="strategy() === option"
                  (change)="strategy.set(option)"
                />
                {{ t().backup.strategies[option] }}
              </label>
            }
          </fieldset>
          @if (strategy() === 'overwrite' || strategy() === 'newer') {
            <p class="muted">{{ t().backup.conflictBackupHint }}</p>
          }
          <div class="actions">
            <button type="button" class="btn btn--primary" (click)="doImport('merge')">
              {{ t().backup.importApply }}
            </button>
            <button type="button" class="btn" (click)="choosingStrategy.set(false)">
              {{ t().backup.back }}
            </button>
          </div>
        } @else {
          <p>{{ t().backup.importChosen(pendingFileName()) }}</p>
          <p class="muted">{{ t().backup.modesHint }}</p>
          <div class="actions">
            <button type="button" class="btn" (click)="merge()">
              {{ t().backup.merge }}
            </button>
            <button type="button" class="btn" (click)="doImport('replace')">
              {{ t().backup.replace }}
            </button>
          </div>
        }
        <div class="actions">
          <button type="button" class="btn" (click)="closeImport()">
            {{ t().common.cancel }}
          </button>
        </div>
      </div>
    </dialog>
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

    .conflicts {
      margin: 0;
      max-height: 10rem;
      overflow-y: auto;
    }

    .strategies {
      display: flex;
      flex-direction: column;
      border: none;
      margin: 0;
      padding: 0;
    }

    .radio {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch-min);
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

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
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

    .errors {
      margin: var(--space-2) 0;
      padding-left: var(--space-5);
    }

    .sheet {
      width: min(480px, calc(100vw - 2 * var(--space-4)));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      padding: 0;
      box-shadow: var(--shadow);
    }

    .sheet::backdrop {
      background: rgba(20, 18, 15, 0.4);
    }

    .sheet__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
    }

    .field__error {
      color: var(--color-danger);
      margin: 0;
    }
  `,
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  private readonly i18n = inject(I18nStore);
  protected readonly t = this.i18n.t;
  protected readonly appVersion = APP_VERSION;
  protected readonly repoUrl = APP_REPO_URL;

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

  protected readonly pwa = inject(PwaService);
  protected readonly offlineLabel = computed(() => {
    const s = this.t().settings;
    const labels: Record<OfflineState, string> = {
      ready: s.offlineReady,
      pending: s.offlinePending,
      unsupported: s.offlineUnsupported,
    };
    return labels[this.pwa.offline()];
  });

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
    return this.t().settings.storageUsage(
      formatBytes(estimate.usage, locale),
      formatBytes(estimate.quota, locale),
    );
  });
  protected readonly canShare = signal(false);
  protected readonly importErrors = signal<BackupIssue[]>([]);
  protected readonly importErrorTexts = computed(() =>
    this.importErrors().map((issue) => describeBackupIssue(this.t(), issue)),
  );

  /** Gleichnamige Zettel der gewählten Datei und die eine Wahl für alle. */
  protected readonly conflicts = signal<string[]>([]);
  protected readonly choosingStrategy = signal(false);
  protected readonly strategy = signal<ConflictStrategy>('suffix');
  protected readonly strategyOptions: readonly ConflictStrategy[] = ['suffix', 'overwrite', 'skip', 'newer'];

  private readonly lists = inject(ListsStore);
  private readonly backup = inject(BackupService);
  private readonly snackbar = inject(SnackbarService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly importDlg = viewChild.required<ElementRef<HTMLDialogElement>>('importDlg');

  private pendingFile: File | null = null;
  protected readonly pendingFileName = signal('');
  private restoreFocusTo: HTMLElement | null = null;

  protected readonly lastBackupLabel = computed(() => {
    const days = this.backup.daysSinceBackup();
    return days === null ? this.t().backup.lastBackupNever : this.t().backup.lastBackupDays(days);
  });

  constructor() {
    inject(PageTitleService).set('settings');
    this.storageStatus.set(this.t().settings.storagePending);
    this.canShare.set(this.backup.canShare());
    void this.checkStorage();
    void this.checkEstimate();
  }

  protected async requestPersist(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      this.storageStatus.set(
        granted ? this.t().settings.persistGranted : this.t().settings.persistDenied,
      );
      this.canPersist.set(!granted);
    } catch {
      // Ignoriert: Status bleibt wie zuvor.
    }
  }

  protected async install(): Promise<void> {
    await this.pwa.install();
  }

  protected async exportBackup(): Promise<void> {
    await this.backup.exportAndDownload();
    this.snackbar.show(this.t().backup.export);
  }

  protected async shareBackup(): Promise<void> {
    await this.backup.shareBackup();
  }

  protected pickImport(): void {
    this.importErrors.set([]);
    this.fileInput().nativeElement.value = '';
    this.fileInput().nativeElement.click();
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingFile = file;
    this.pendingFileName.set(file.name);
    // Erstmalig nur validieren, ohne Daten anzutasten.
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.importErrors.set([{ code: 'json' }]);
      this.openImport();
      return;
    }
    const validation = validateBackup(raw);
    this.importErrors.set(validation.ok ? [] : validation.errors);
    this.conflicts.set(validation.ok ? findConflicts(this.lists.allItems(), validation.value.lists) : []);
    this.choosingStrategy.set(false);
    this.strategy.set('suffix');
    this.openImport();
  }

  /** Zusammenführen: Gibt es gleichnamige Zettel, erst fragen, was mit ihnen passiert. */
  protected merge(): void {
    if (this.conflicts().length > 0) this.choosingStrategy.set(true);
    else void this.doImport('merge');
  }

  protected async doImport(mode: 'merge' | 'replace'): Promise<void> {
    const file = this.pendingFile;
    if (!file) return;
    const outcome = await this.backup.importFile(file, mode, this.strategy());
    if (outcome.ok) {
      const counts = outcome.counts;
      this.snackbar.show(
        mode === 'merge' && counts
          ? this.t().backup.importResult(counts.imported, counts.skipped, counts.overwritten)
          : this.t().backup.importSuccess,
      );
      this.pendingFile = null;
      this.closeImport();
    } else {
      this.importErrors.set(outcome.errors);
    }
  }

  protected closeImport(): void {
    this.importDlg().nativeElement.close();
  }

  protected onClosed(): void {
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  private openImport(): void {
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    this.importDlg().nativeElement.showModal();
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
    this.storageStatus.set(
      persisted ? this.t().settings.storagePersisted : this.t().settings.storageUnprotected,
    );
    this.canPersist.set(!persisted && typeof navigator.storage.persist === 'function');
  }
}
