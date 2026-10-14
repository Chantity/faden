import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import { SnackbarService } from './snackbar.service';

@Component({
  selector: 'app-snackbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="snackbar-host" aria-live="polite" role="region" [attr.aria-label]="t().a11y.snackbarRegion">
      @if (snackbar.state(); as state) {
        <div class="snackbar">
          <span class="snackbar__message">{{ state.message }}</span>
          @if (state.action; as action) {
            <button type="button" class="snackbar__action" (click)="runAction()">
              {{ action.label }}
            </button>
          }
          <button
            type="button"
            class="snackbar__close"
            [attr.aria-label]="t().common.close"
            (click)="snackbar.dismiss()"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .snackbar-host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-3));
      display: flex;
      justify-content: center;
      padding: 0 var(--space-3);
      pointer-events: none;
      z-index: 50;
    }

    .snackbar {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      max-width: 560px;
      width: 100%;
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      background: var(--color-inverse);
      color: var(--color-on-inverse);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .snackbar__message {
      flex: 1;
    }

    .snackbar__action {
      min-height: 40px;
      padding: 0 var(--space-3);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-accent-inverse);
      font-weight: 600;
      cursor: pointer;
    }

    .snackbar__close {
      border: none;
      background: transparent;
      color: inherit;
      font-size: 1rem;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
    }
  `,
})
export class Snackbar {
  protected readonly snackbar = inject(SnackbarService);
  protected readonly t = inject(I18nStore).t;

  protected runAction(): void {
    const state = this.snackbar.state();
    state?.action?.run();
    this.snackbar.dismiss();
  }
}
