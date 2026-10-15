import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { SettingsStore } from '../../core/state/settings.store';
import {
  comboFromEvent,
  comboProblem,
  conflictFor,
  formatCombo,
  SHORTCUT_ACTIONS,
  SHORTCUT_SCOPES,
  type ShortcutAction,
  type ShortcutScope,
} from '../../core/keymap';
import { shortcutLabel } from '../../shared/shortcut-label';
import { SchemeSection } from './scheme-section';
import { COMPLETED_LISTS_ACTIONS, NOTE_KINDS, SIMPLE_FEATURES } from '../../core/preferences';

const SCOPE_ORDER: readonly ShortcutScope[] = ['focus', 'flow', 'global'];

/** „Für Fortgeschrittene“: selten gebrauchte Einstellungen (Modus, Verhalten, Farben, Tasten). */
@Component({
  selector: 'app-advanced-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SchemeSection],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a class="back" routerLink="/einstellungen">← {{ t().titles.settings }}</a>
    <h1>{{ t().advanced.title }}</h1>
    <p class="muted">{{ t().advanced.intro }}</p>

    <section class="card block" aria-labelledby="simple-heading">
      <h2 id="simple-heading">{{ t().simple.heading }}</h2>
      <label class="check-row">
        <input
          type="checkbox"
          [checked]="settings.simpleEnabled()"
          (change)="settings.setSimpleEnabled($any($event.target).checked)"
        />
        <span>{{ t().simple.toggle }}</span>
      </label>
      <p class="muted">{{ t().simple.intro }}</p>
      <fieldset class="group" [disabled]="!settings.simpleEnabled()">
        <legend class="field__label">{{ t().simple.showHeading }}</legend>
        <p class="muted">{{ settings.simpleEnabled() ? t().simple.showHint : t().simple.offHint }}</p>
        @for (feature of simpleFeatures; track feature) {
          <label class="check-row">
            <input
              type="checkbox"
              [checked]="!!settings.settings().simpleMode?.show?.[feature]"
              (change)="settings.setSimpleShow(feature, $any($event.target).checked)"
            />
            <span>{{ t().simple.features[feature] }}</span>
          </label>
        }
      </fieldset>
    </section>

    <section class="card block" aria-labelledby="notes-heading">
      <h2 id="notes-heading">{{ t().advanced.notesHeading }}</h2>
      <fieldset class="group">
        <legend class="field__label">{{ t().advanced.noteKindLabel }}</legend>
        <div class="options">
          @for (kind of noteKinds; track kind) {
            <label class="option" [class.is-selected]="settings.noteKind() === kind">
              <input
                type="radio"
                name="noteKind"
                [checked]="settings.noteKind() === kind"
                (change)="settings.setNoteKind(kind)"
              />
              <span>{{ kind === 'text' ? t().editor.descText : t().editor.descChecklist }}</span>
            </label>
          }
        </div>
      </fieldset>
    </section>

    <section class="card block" aria-labelledby="completed-heading">
      <h2 id="completed-heading">{{ t().advanced.completedHeading }}</h2>
      <fieldset class="group">
        <legend class="muted">{{ t().advanced.completedHint }}</legend>
        <div class="options">
          @for (action of completedActions; track action) {
            <label class="option" [class.is-selected]="settings.completedLists() === action">
              <input
                type="radio"
                name="completedLists"
                [checked]="settings.completedLists() === action"
                (change)="settings.setCompletedLists(action)"
              />
              <span>{{ t().advanced.completed[action] }}</span>
            </label>
          }
        </div>
      </fieldset>
    </section>

    <app-scheme-section />

    <section class="card block" aria-labelledby="shortcuts-heading">
      <h2 id="shortcuts-heading">{{ t().advanced.shortcutsHeading }}</h2>
      <p class="muted">{{ t().advanced.shortcutsHint }}</p>

      @for (group of groups(); track group.scope) {
        <h3>{{ t().advanced.scopes[group.scope] }}</h3>
        <ul class="keys">
          @for (row of group.rows; track row.action) {
            <li class="keys__row">
              <span class="keys__label">{{ row.label }}</span>
              <span class="keys__combo">
                @if (recording() === row.action) {
                  <span class="keys__recording">{{ t().advanced.recording }}</span>
                } @else {
                  <kbd>{{ row.keys }}</kbd>
                  @if (row.custom) {
                    <span class="badge">{{ t().advanced.custom }}</span>
                  }
                }
              </span>
              <span class="keys__actions">
                <button
                  type="button"
                  class="btn"
                  [attr.data-action]="row.action"
                  [attr.aria-label]="t().advanced.changeLabel(row.label)"
                  [attr.aria-pressed]="recording() === row.action"
                  (click)="toggleRecording(row.action)"
                >
                  {{ recording() === row.action ? t().common.cancel : t().advanced.change }}
                </button>
                @if (row.custom) {
                  <button
                    type="button"
                    class="btn btn--ghost"
                    [attr.aria-label]="t().advanced.resetLabel(row.label)"
                    (click)="reset(row.action)"
                  >
                    {{ t().advanced.reset }}
                  </button>
                }
              </span>
            </li>
          }
        </ul>
      }

      <p class="status" role="status">{{ message() }}</p>
      <button type="button" class="btn" [disabled]="!hasCustom()" (click)="resetAll()">
        {{ t().advanced.resetAll }}
      </button>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 720px;
    }

    .back {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-min);
      margin-bottom: var(--space-2);
    }

    .block {
      padding: var(--space-4) var(--space-5);
      margin-bottom: var(--space-4);
    }

    .block h2 {
      margin-top: 0;
    }

    .group {
      border: none;
      margin: 0;
      padding: 0;
    }

    .group legend {
      margin-bottom: var(--space-2);
      padding: 0;
    }

    .group:disabled .check-row {
      opacity: 0.55;
      cursor: default;
    }

    h3 {
      margin: var(--space-4) 0 var(--space-2);
    }

    .keys {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .keys__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border);
    }

    .keys__label {
      flex: 1 1 12rem;
      min-width: 0;
    }

    .keys__combo {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1 1 8rem;
    }

    .keys__recording {
      color: var(--color-primary-strong);
      font-weight: 600;
    }

    .keys__actions {
      display: inline-flex;
      gap: var(--space-2);
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
      font-size: 0.9rem;
      text-align: center;
    }

    .status {
      min-height: 1.5em;
      margin: var(--space-3) 0;
    }
  `,
})
export class AdvancedPage {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly settings = inject(SettingsStore);
  protected readonly t = inject(I18nStore).t;

  protected readonly simpleFeatures = SIMPLE_FEATURES;
  protected readonly noteKinds = NOTE_KINDS;
  protected readonly completedActions = COMPLETED_LISTS_ACTIONS;

  /** Aktion, deren neue Taste gerade aufgenommen wird. */
  protected readonly recording = signal<ShortcutAction | null>(null);
  protected readonly message = signal('');

  protected readonly hasCustom = computed(() => Object.keys(this.settings.settings().keymap ?? {}).length > 0);

  protected readonly groups = computed(() => {
    const t = this.t();
    const keymap = this.settings.keymap();
    const custom = this.settings.settings().keymap ?? {};
    return SCOPE_ORDER.map((scope) => ({
      scope,
      rows: SHORTCUT_ACTIONS.filter((action) => SHORTCUT_SCOPES[action] === scope).map((action) => ({
        action,
        label: shortcutLabel(t, action),
        keys: keymap[action].map((combo) => formatCombo(combo, t.keys)).join(' / '),
        custom: action in custom,
      })),
    }));
  });

  constructor() {
    inject(PageTitleService).set('advanced');
    // Sprung aus den Einstellungen („Einstellen, was ausgeblendet wird“) zum passenden Abschnitt.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    if (fragment) {
      afterNextRender(() => this.host.nativeElement.querySelector(`#${CSS.escape(fragment)}`)?.scrollIntoView());
    }
  }

  protected toggleRecording(action: ShortcutAction): void {
    if (this.recording() === action) {
      this.stop(this.t().advanced.cancelled);
      return;
    }
    this.message.set('');
    this.recording.set(action);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const action = this.recording();
    if (!action) return;
    if (event.key === 'Tab') {
      // Tab bleibt Navigation: Aufnahme beenden, Fokus normal weitergeben.
      this.recording.set(null);
      this.message.set(this.t().advanced.cancelled);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.stop(this.t().advanced.cancelled, action);
      return;
    }
    const t = this.t();
    const combo = comboFromEvent(event);
    const problem = comboProblem(combo);
    if (problem === 'modifier') return; // auf die eigentliche Taste warten
    if (problem) {
      this.message.set(t.advanced.reserved(formatCombo(combo, t.keys)));
      return;
    }
    const conflict = conflictFor(this.settings.keymap(), action, combo);
    if (conflict) {
      this.message.set(t.advanced.conflict(shortcutLabel(t, conflict)));
      return;
    }
    void this.settings.setShortcut(action, [combo]);
    this.stop(t.advanced.saved(shortcutLabel(t, action), formatCombo(combo, t.keys)), action);
  }

  protected reset(action: ShortcutAction): void {
    void this.settings.setShortcut(action, null);
    const t = this.t();
    const keys = this.settings.keymap()[action].map((combo) => formatCombo(combo, t.keys)).join(' / ');
    this.stop(t.advanced.saved(shortcutLabel(t, action), keys), action);
  }

  protected resetAll(): void {
    void this.settings.resetShortcuts();
    this.stop(this.t().advanced.resetAllDone);
  }

  /** Aufnahme beenden, Ergebnis ansagen und den Fokus zum „Ändern“ der Zeile zurückgeben. */
  private stop(message: string, focusAction?: ShortcutAction): void {
    this.recording.set(null);
    this.message.set(message);
    if (!focusAction) return;
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`[data-action="${focusAction}"]`)?.focus(),
      { injector: this.injector },
    );
  }
}
