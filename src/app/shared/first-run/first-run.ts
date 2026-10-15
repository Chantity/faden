import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { GuideDialog } from '../guide/guide-dialog';
import { FirstRunStore } from './first-run.store';

/**
 * Erst-Start: modaler Hinweis zum lokalen Speicher (nur „Verstanden“ schließt
 * ihn), danach einmal das Angebot, die Anleitung zu lesen.
 */
@Component({
  selector: 'app-first-run',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideDialog],
  template: `
    <dialog
      #storage
      class="sheet"
      aria-labelledby="first-run-storage"
      (cancel)="$event.preventDefault()"
      (close)="next()"
    >
      <div class="sheet__body">
        <h2 id="first-run-storage">{{ t().firstRun.storageTitle }}</h2>
        <p>{{ t().firstRun.storageBody }}</p>
        <p class="muted">{{ t().firstRun.storageLeave }}</p>
        <div class="sheet__actions">
          <button type="button" class="btn btn--primary" (click)="acknowledge()">
            {{ t().firstRun.understood }}
          </button>
        </div>
      </div>
    </dialog>

    <dialog #offer class="sheet" aria-labelledby="first-run-guide" (close)="store.markGuideOffered()">
      <div class="sheet__body">
        <h2 id="first-run-guide">{{ t().firstRun.guideTitle }}</h2>
        <p>{{ t().firstRun.guideBody }}</p>
        <div class="sheet__actions">
          <button type="button" class="btn" (click)="offer.close()">{{ t().firstRun.guideIgnore }}</button>
          <button type="button" class="btn btn--primary" (click)="readGuide()">
            {{ t().firstRun.guideRead }}
          </button>
        </div>
      </div>
    </dialog>

    <app-guide-dialog />
  `,
})
export class FirstRun {
  protected readonly store = inject(FirstRunStore);
  protected readonly t = inject(I18nStore).t;
  private readonly storageRef = viewChild.required<ElementRef<HTMLDialogElement>>('storage');
  private readonly offerRef = viewChild.required<ElementRef<HTMLDialogElement>>('offer');
  private readonly guide = viewChild.required(GuideDialog);

  constructor() {
    afterNextRender(() => this.next());
  }

  /** Zeigt den nächsten offenen Hinweis; schließt der Browser den Speicher-Hinweis trotzdem, kommt er wieder. */
  protected next(): void {
    if (!this.store.storageAck()) this.storageRef().nativeElement.showModal();
    else if (!this.store.guideOffered()) this.offerRef().nativeElement.showModal();
  }

  protected acknowledge(): void {
    this.store.acknowledgeStorage();
    this.storageRef().nativeElement.close();
  }

  protected readGuide(): void {
    this.offerRef().nativeElement.close();
    void this.guide().open();
  }
}
