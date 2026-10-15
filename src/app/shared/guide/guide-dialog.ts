import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injectable,
  Injector,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';

/** Vom Build erzeugt (scripts/guide.mjs) und vorab gecacht – also auch offline da. */
const GUIDE_URL = 'guide/guide.html';

/**
 * Lädt die Anleitung einmal pro Sitzung (geteilt von allen Dialogen); nach einem
 * Fehler beim nächsten Öffnen erneut. Als Service statt Modul-Variable, damit
 * jeder Test frisch beginnt (Vitest isoliert Testdateien hier nicht).
 */
@Injectable({ providedIn: 'root' })
export class GuideLoader {
  private loading: Promise<string> | null = null;

  load(): Promise<string> {
    this.loading ??= fetch(GUIDE_URL)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .catch((error: unknown) => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }
}

/** Wie der Konverter: GitHub-Anker (Angulars Sanitizer entfernt die `id`s, sie werden hier neu gesetzt). */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * Anleitung (docs/USER-GUIDE.md) im Vollbild-Dialog, gescrollt zum Teil der
 * eingestellten Sprache.
 */
@Component({
  selector: 'app-guide-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Der eingesetzte Inhalt hat keine Angular-Attribute; die Klassen sind daher eindeutig benannt.
  encapsulation: ViewEncapsulation.None,
  template: `
    <dialog #dlg class="sheet guide" aria-labelledby="guide-title" (close)="onClosed()">
      <div class="guide__head">
        <h2 id="guide-title">{{ t().guide.title }}</h2>
        <button type="button" class="btn" (click)="close()">{{ t().guide.close }}</button>
      </div>
      <div #body class="guide__body" tabindex="-1" (click)="onBodyClick($event)">
        @if (html(); as content) {
          <article class="guide__content" [innerHTML]="content"></article>
        } @else if (failed()) {
          <p role="alert">{{ t().guide.loadError }}</p>
        } @else {
          <p class="muted">{{ t().guide.loading }}</p>
        }
      </div>
    </dialog>
  `,
  styles: `
    dialog.guide[open] {
      display: flex;
      flex-direction: column;
      width: min(900px, calc(100vw - 2 * var(--space-4)));
      height: calc(100dvh - 2 * var(--space-4));
      max-height: none;
    }

    @media (max-width: 600px) {
      dialog.guide[open] {
        width: 100%;
        max-width: 100%;
        height: 100dvh;
        max-height: 100dvh;
        margin: 0;
        border-radius: 0;
      }
    }

    .guide__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }

    .guide__head h2 {
      margin: 0;
    }

    .guide__body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: var(--space-4) var(--space-5) var(--space-6, 2rem);
      line-height: 1.6;
    }

    .guide__content {
      max-width: 70ch;
    }

    .guide__content h1 {
      font-size: 1.4rem;
    }

    .guide__content table {
      display: block;
      overflow-x: auto;
      border-collapse: collapse;
    }

    .guide__content th,
    .guide__content td {
      border: 1px solid var(--color-border);
      padding: var(--space-2);
      text-align: left;
      vertical-align: top;
    }

    .guide__content img {
      max-width: 100%;
      height: auto;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
    }

    .guide__content a {
      color: var(--color-primary);
    }

    /* Kästen „Am PC“ / „Auf dem Handy“ */
    .guide__content blockquote {
      margin: var(--space-3) 0;
      padding: var(--space-2) var(--space-4);
      border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
    }

    .guide__content blockquote > :first-child {
      margin-top: 0;
    }

    .guide__content blockquote > :last-child {
      margin-bottom: 0;
    }
  `,
})
export class GuideDialog {
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nStore);
  private readonly loader = inject(GuideLoader);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly bodyRef = viewChild.required<ElementRef<HTMLElement>>('body');

  protected readonly t = this.i18n.t;
  protected readonly html = signal<string | null>(null);
  protected readonly failed = signal(false);

  private restoreFocusTo: HTMLElement | null = null;

  async open(): Promise<void> {
    this.restoreFocusTo = document.activeElement as HTMLElement | null;
    this.failed.set(false);
    const dialog = this.dialogRef().nativeElement;
    if (!dialog.open) dialog.showModal();
    try {
      this.html.set(await this.loader.load());
    } catch {
      this.failed.set(true);
      return;
    }
    afterNextRender(() => this.prepare(), { injector: this.injector });
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onClosed(): void {
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  /** Anker setzen und zum Teil der eingestellten Sprache springen. */
  private prepare(): void {
    const body = this.bodyRef().nativeElement;
    for (const heading of body.querySelectorAll<HTMLElement>('h1, h2, h3, h4')) {
      heading.id = slug(heading.textContent ?? '');
    }
    this.scrollTo(this.i18n.locale() === 'de' ? 'deutsch' : 'english');
  }

  /** Links auf Anker scrollen im Dialog, statt die (Hash-)Route zu wechseln. */
  protected onBodyClick(event: MouseEvent): void {
    const href = (event.target as HTMLElement).closest('a')?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    event.preventDefault();
    this.scrollTo(href.slice(1));
  }

  private scrollTo(id: string): void {
    const headings = this.bodyRef().nativeElement.querySelectorAll<HTMLElement>('[id]');
    [...headings].find((heading) => heading.id === id)?.scrollIntoView({ block: 'start' });
  }
}
