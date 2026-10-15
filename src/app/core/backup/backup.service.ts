import { computed, inject, Injectable } from '@angular/core';
import {
  applyImport,
  createBackup,
  validateBackup,
  FadenDb,
  type BackupFile,
  findConflicts,
  type BackupIssue,
  type ConflictStrategy,
  type ImportCounts,
  type ImportMode,
} from '../storage';
import { ListsStore } from '../state/lists.store';
import { SettingsStore } from '../state/settings.store';
import { TemplatesStore } from '../state/templates.store';

export interface ImportOutcome {
  ok: boolean;
  errors: BackupIssue[];
  counts?: ImportCounts;
}

const REMINDER_KEY = 'backupReminderDismissedAt';
const REMINDER_AFTER_DAYS = 30;
const REMINDER_EVERY_DAYS = 7;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Sicherung/Import und Backup-Erinnerung.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(FadenDb);
  private readonly settings = inject(SettingsStore);
  private readonly lists = inject(ListsStore);
  private readonly templates = inject(TemplatesStore);

  readonly lastBackupAt = computed(() => this.settings.settings().lastBackupAt);

  /** Tage seit dem letzten Backup oder null, wenn noch nie gesichert. */
  daysSinceBackup(now: Date = new Date()): number | null {
    const iso = this.lastBackupAt();
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, daysBetween(date, now));
  }

  async exportAndDownload(): Promise<void> {
    const backup = this.buildBackup();
    await this.download(backup);
    await this.settings.markBackup(backup.exportedAt);
  }

  /** Automatische Sicherung vor „Alles ersetzen". */
  async autoBackup(): Promise<void> {
    await this.download(this.buildBackup());
  }

  canShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
  }

  async shareBackup(): Promise<boolean> {
    const backup = this.buildBackup();
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const file = new File([JSON.stringify(backup, null, 2)], this.fileName(backup), {
      type: 'application/json',
    });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], title: 'Faden' });
      await this.settings.markBackup(backup.exportedAt);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Liest und validiert eine Datei; wendet sie bei `mode` an. Gleichnamige
   * Zettel behandelt `strategy` (nur beim Zusammenführen).
   */
  async importFile(file: File, mode: ImportMode, strategy: ConflictStrategy = 'suffix'): Promise<ImportOutcome> {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return { ok: false, errors: [{ code: 'json' }] };
    }
    const validation = validateBackup(raw);
    if (!validation.ok) return { ok: false, errors: validation.errors };

    const local = this.lists.allItems();
    // Vor allem, was lokale Zettel ersetzt, eine Sicherung herunterladen.
    const replacesLocal =
      mode === 'replace' ||
      ((strategy === 'overwrite' || strategy === 'newer') && findConflicts(local, validation.value.lists).length > 0);
    if (replacesLocal) await this.autoBackup();

    const result = applyImport(validation.value, { lists: local, templates: this.templates.templates() }, mode, strategy);
    await this.lists.replaceAll(result.lists);
    await this.templates.replaceAll(result.templates);
    return { ok: true, errors: [], counts: result.counts };
  }

  /** Ob jetzt das wöchentliche Backup-Hinweisband gezeigt werden soll. */
  async shouldShowReminder(now: Date = new Date(), hasData: boolean): Promise<boolean> {
    if (!hasData) return false;
    const days = this.daysSinceBackup(now);
    if (days !== null && days <= REMINDER_AFTER_DAYS) return false;
    try {
      const dismissed = await this.db.getMeta<string>(REMINDER_KEY);
      if (typeof dismissed === 'string') {
        const date = new Date(dismissed);
        if (!Number.isNaN(date.getTime()) && daysBetween(date, now) < REMINDER_EVERY_DAYS) {
          return false;
        }
      }
    } catch {
      // Ohne IndexedDB immer zeigen.
    }
    return true;
  }

  async dismissReminder(now: Date = new Date()): Promise<void> {
    try {
      await this.db.setMeta(REMINDER_KEY, now.toISOString());
    } catch {
      // Ohne IndexedDB nur ignorieren.
    }
  }

  /**
   * Fordert beim ersten Start (nach der ersten Nutzerinteraktion) dauerhaften
   * Speicher an. Passiert höchstens einmal.
   */
  async requestPersistOnFirstInteraction(): Promise<void> {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.storage?.persist
    ) {
      return;
    }
    try {
      if (await this.db.getMeta<boolean>('persistRequested')) return;
      if (await navigator.storage.persisted()) return;
    } catch {
      // Ohne IndexedDB trotzdem versuchen.
    }
    const run = () => void this.doPersist();
    window.addEventListener('pointerdown', run, { once: true });
    window.addEventListener('keydown', run, { once: true });
  }

  private async doPersist(): Promise<void> {
    try {
      await navigator.storage.persist();
      await this.db.setMeta('persistRequested', true);
    } catch {
      // Ablehnung ist kein Fehler.
    }
  }

  private buildBackup(): BackupFile {
    return createBackup(this.settings.settings(), this.lists.allItems(), this.templates.templates());
  }

  private fileName(backup: BackupFile): string {
    return `faden-backup-${backup.exportedAt.slice(0, 10)}.json`;
  }

  private async download(backup: BackupFile): Promise<void> {
    if (typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName(backup);
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
