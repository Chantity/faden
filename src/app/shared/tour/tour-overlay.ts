import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { SnackbarService } from '../snackbar/snackbar.service';
import { TourService } from './tour.service';

const TARGET_CLASS = 'tour-target';

/**
 * Hinweise der geführten Tour: unten am Rand, nicht modal (die App bleibt
 * bedienbar), mit hervorgehobenem Ziel. Solange ein Dialog offen ist, wartet der Hinweis.
 */
@Component({
  selector: 'app-tour-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tour.step(); as step) {
      @if (!tour.dialogOpen()) {
        @if (!tour.collapsed()) {
          <section
            #panel
            class="tour"
            [class.is-raised]="raised()"
            [class.is-top]="atTop()"
            role="dialog"
            aria-labelledby="tour-title"
            tabindex="-1"
            (keydown.escape)="collapse()"
          >
            @if (tour.counter(); as c) {
              <p class="tour__counter">{{ t().tour.label }} · {{ t().tour.stepOf(c.n, c.total) }}</p>
            }
            <h2 id="tour-title" class="tour__title">{{ text().title }}</h2>
            <p class="tour__body">{{ text().body }}</p>
            <div class="tour__actions">
              @switch (step.kind) {
                @case ('action') {
                  <button type="button" class="btn btn--primary" (click)="collapse()">{{ t().tour.gotIt }}</button>
                }
                @case ('info') {
                  <button type="button" class="btn btn--primary" (click)="tour.next()">{{ t().tour.next }}</button>
                }
                @case ('more') {
                  <button type="button" class="btn" (click)="tour.finishBasics()">{{ t().tour.finish }}</button>
                  <button type="button" class="btn btn--primary" (click)="tour.more()">{{ t().tour.more }}</button>
                }
                @case ('cleanup') {
                  <button type="button" class="btn btn--primary" (click)="tour.keepPractice()">{{ t().tour.keep }}</button>
                  <button type="button" class="btn btn--danger" (click)="tour.deletePractice()">
                    {{ t().tour.deletePractice }}
                  </button>
                }
              }
              @if (step.kind !== 'cleanup') {
                <button type="button" class="btn btn--ghost" (click)="tour.end()">{{ t().tour.end }}</button>
              }
            </div>
          </section>
        } @else {
          <div class="tour tour--bar" [class.is-raised]="raised()" [class.is-top]="atTop()" role="region" [attr.aria-label]="t().tour.label">
            <span class="tour__bar-text">
              @if (tour.counter(); as c) {
                {{ t().tour.stepOf(c.n, c.total) }}:
              }
              {{ text().title }}
            </span>
            <button type="button" class="btn" (click)="expand()">{{ t().tour.showHint }}</button>
            <button type="button" class="btn btn--ghost" (click)="tour.end()">{{ t().tour.end }}</button>
          </div>
        }
      }
    }
  `,
  styles: `
    .tour {
      position: fixed;
      z-index: 60;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-3));
      transform: translateX(-50%);
      width: min(32rem, calc(100vw - 2 * var(--space-3)));
      max-height: 60dvh;
      overflow-y: auto;
      padding: var(--space-4);
      border: 2px solid var(--color-primary);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow);
    }

    /* Über der Snackbar, wenn beide unten stehen. */
    .tour.is-raised {
      bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
    }

    /* Liegt das Ziel in der unteren Hälfte, steht der Hinweis oben – nie darüber. */
    .tour.is-top {
      top: calc(env(safe-area-inset-top, 0px) + var(--space-3));
      bottom: auto;
    }

    .tour__counter {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }

    .tour__title {
      margin: var(--space-1) 0 var(--space-2);
      font-size: 1.2rem;
    }

    .tour__body {
      margin: 0 0 var(--space-3);
    }

    .tour__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .tour--bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
    }

    .tour__bar-text {
      flex: 1 1 10rem;
      min-width: 0;
      font-weight: 600;
    }
  `,
})
export class TourOverlay {
  protected readonly tour = inject(TourService);
  protected readonly t = inject(I18nStore).t;
  private readonly snackbar = inject(SnackbarService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly raised = computed(() => this.snackbar.state() !== null);
  protected readonly atTop = signal(false);
  protected readonly text = computed(() => {
    const step = this.tour.step();
    const tour = this.t().tour;
    if (!step) return { title: '', body: '' };
    const text = tour.steps[step.id];
    // Ohne einfachen Modus beim Start entfällt der Satz über ihn.
    return step.id === 'more' && !this.tour.simpleAtStart() ? { ...text, body: tour.moreWithoutSimple } : text;
  });

  constructor() {
    // Solange die Tour läuft: offene Dialoge sofort melden (der Hinweis weicht),
    // das Ziel im Takt hervorheben (es erscheint oft erst nach dem Rendern).
    let timer: ReturnType<typeof setInterval> | null = null;
    let observer: MutationObserver | null = null;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      observer?.disconnect();
      observer = null;
      this.highlight(null);
    };
    effect(() => {
      if (!this.tour.active()) return stop();
      timer ??= setInterval(() => this.poll(), 250);
      if (!observer) {
        observer = new MutationObserver(() => this.poll());
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      }
    });
    inject(DestroyRef).onDestroy(stop);

    // Neuer Hinweis: gleich das richtige Ziel hervorheben und den Fokus hinein,
    // damit Tastatur und Screenreader ihn gleich haben.
    afterRenderEffect(() => {
      this.tour.index();
      this.tour.collapsed();
      this.tour.focusRequest();
      if (this.tour.active()) this.poll();
      this.panel()?.nativeElement.focus({ preventScroll: true });
    });
  }

  protected collapse(): void {
    this.tour.collapsed.set(true);
    // Zum erklärten Element (mittig, nicht unter der Tour-Leiste), damit man gleich loslegen kann.
    const target = this.target();
    target?.scrollIntoView({ block: 'center' });
    if (target?.matches('a, button, summary, [tabindex]')) target.focus();
  }

  protected expand(): void {
    this.tour.collapsed.set(false);
  }

  private target(): HTMLElement | null {
    const selector = this.tour.step()?.target?.(this.tour.practiceId());
    return selector ? document.querySelector<HTMLElement>(selector) : null;
  }

  private poll(): void {
    const open = document.querySelector('dialog[open]') !== null;
    if (open !== this.tour.dialogOpen()) this.tour.setDialogOpen(open);
    const target = open ? null : this.target();
    this.highlight(target);
    if (target) {
      const rect = target.getBoundingClientRect();
      this.atTop.set(rect.top + rect.height / 2 > window.innerHeight / 2);
    }
  }

  private highlight(target: HTMLElement | null): void {
    for (const el of document.querySelectorAll(`.${TARGET_CLASS}`)) {
      if (el !== target) el.classList.remove(TARGET_CLASS);
    }
    target?.classList.add(TARGET_CLASS);
  }
}
