import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nStore } from '../../core/i18n/i18n.store';
import { SettingsStore } from '../../core/state/settings.store';
import { formatCombo, SHORTCUT_ACTIONS } from '../../core/keymap';
import { shortcutLabel } from '../../shared/shortcut-label';

interface Shortcut {
  keys: string;
  label: string;
}

@Component({
  selector: 'app-shortcut-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <dialog #dlg class="sheet">
      <h2>{{ t().shortcuts.title }}</h2>
      <dl class="shortcuts">
        @for (shortcut of shortcuts(); track shortcut.label) {
          <div class="shortcuts__row">
            <dt><kbd>{{ shortcut.keys }}</kbd></dt>
            <dd>{{ shortcut.label }}</dd>
          </div>
        }
      </dl>
      <div class="sheet__actions">
        <a class="btn" routerLink="/einstellungen/fortgeschritten" (click)="close()">{{ t().shortcuts.customize }}</a>
        <button type="button" class="btn btn--primary" (click)="close()">{{ t().common.close }}</button>
      </div>
    </dialog>
  `,
  styles: `
    .sheet {
      width: min(520px, calc(100vw - 2 * var(--space-4)));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      padding: var(--space-5);
      box-shadow: var(--shadow);
    }

    .sheet::backdrop {
      background: rgba(20, 18, 15, 0.4);
    }

    h2 {
      margin-top: 0;
    }

    .shortcuts {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0 0 var(--space-4);
    }

    .shortcuts__row {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }

    dt {
      flex: 0 0 8rem;
    }

    dd {
      margin: 0;
    }

    kbd {
      display: inline-block;
      min-width: 1.6rem;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-border);
      border-bottom-width: 2px;
      border-radius: var(--radius-sm);
      background: var(--color-bg);
      font: inherit;
      font-size: 0.85rem;
      text-align: center;
    }

    .sheet__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class ShortcutHelp {
  private readonly i18n = inject(I18nStore);
  private readonly settings = inject(SettingsStore);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly t = this.i18n.t;

  /** Die aktuelle (ggf. geänderte) Belegung plus die festen Tasten des Browsers. */
  protected readonly shortcuts = computed<Shortcut[]>(() => {
    const t = this.t();
    const keymap = this.settings.keymap();
    return [
      { keys: `${t.keys.named['Enter']} / ${t.keys.named[' ']}`, label: t.shortcuts.activate },
      ...SHORTCUT_ACTIONS.map((action) => ({
        keys: keymap[action].map((combo) => formatCombo(combo, t.keys)).join(' / '),
        label: shortcutLabel(t, action),
      })),
      { keys: t.keys.named['Escape']!, label: t.shortcuts.close },
    ];
  });

  open(): void {
    this.dialogRef().nativeElement.showModal();
  }

  close(): void {
    this.dialogRef().nativeElement.close();
  }
}
