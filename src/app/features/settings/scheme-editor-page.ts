import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  contrastIssues,
  DEFAULT_SCHEME_ID,
  isHexColor,
  SCHEME_ROLES,
  schemeProperties,
  type ColorScheme,
  type SchemeColor,
  type SchemeRole,
} from '../../core/color-scheme';
import { I18nStore } from '../../core/i18n/i18n.store';
import { PageTitleService } from '../../core/i18n/page-title';
import { TITLE_MAX_LENGTH } from '../../core/model';
import { SettingsStore } from '../../core/state/settings.store';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';

type Mode = keyof SchemeColor;
const MODES: readonly Mode[] = ['light', 'dark'];

/** Editor für ein eigenes Farbschema: Name, je Rolle Hell/Dunkel, Vorschau in beiden Modi. */
@Component({
  selector: 'app-scheme-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="back" routerLink="/einstellungen/fortgeschritten">← {{ t().titles.advanced }}</a>
    <h1>{{ t().schemes.editorTitle }}</h1>

    @if (draft(); as scheme) {
      <form class="card block" (submit)="$event.preventDefault(); save()">
        <label class="field">
          <span class="field__label">{{ t().schemes.nameLabel }}</span>
          <input
            type="text"
            name="name"
            [attr.maxlength]="maxTitle"
            [value]="scheme.name"
            (input)="rename($any($event.target).value)"
            aria-describedby="scheme-name-hint"
            required
          />
        </label>
        <p class="field__hint" id="scheme-name-hint" role="status">{{ nameHint() }}</p>

        @for (role of roles; track role) {
          <fieldset class="role">
            <legend class="field__label">{{ t().schemes.roles[role] }}</legend>
            <p class="muted role__hint">{{ t().schemes.roleHints[role] }}</p>
            @if (role === 'control') {
              <label class="check-row">
                <input
                  type="checkbox"
                  [checked]="scheme.control === null"
                  (change)="setBrowserDefault($any($event.target).checked)"
                />
                <span>{{ t().schemes.browserDefault }}</span>
              </label>
            }
            @if (colorOf(scheme, role); as color) {
              <div class="pickers">
                @for (mode of modes; track mode) {
                  <div class="picker">
                    <span class="picker__mode">{{ t().schemes.modes[mode] }}</span>
                    <input
                      type="color"
                      class="picker__color"
                      [value]="color[mode]"
                      [attr.aria-label]="t().schemes.colorLabel(t().schemes.roles[role], t().schemes.modes[mode])"
                      (input)="setColor(role, mode, $any($event.target).value)"
                    />
                    <input
                      type="text"
                      class="picker__hex"
                      spellcheck="false"
                      maxlength="7"
                      [value]="color[mode]"
                      [attr.aria-label]="t().schemes.hexLabel(t().schemes.roles[role], t().schemes.modes[mode])"
                      (change)="setHex(role, mode, $event)"
                    />
                  </div>
                }
              </div>
            }
          </fieldset>
        }
        <p class="field__hint" role="status">{{ hexError() }}</p>

        <h2>{{ t().schemes.preview }}</h2>
        <div class="previews" [style]="previewStyle()">
          @for (mode of modes; track mode) {
            <div class="preview" [style.color-scheme]="mode" [attr.aria-label]="t().schemes.modes[mode]" role="group">
              <span class="preview__mode">{{ t().schemes.modes[mode] }}</span>
              <div class="preview__row">
                <span class="btn btn--primary" aria-hidden="true">{{ t().schemes.previewPrimary }}</span>
                <span class="btn" aria-hidden="true">{{ t().schemes.previewButton }}</span>
              </div>
              <div class="preview__row">
                <span class="option is-selected" aria-hidden="true">
                  <input type="radio" checked tabindex="-1" inert />
                  {{ t().schemes.previewOption }}
                </span>
                <span class="check-row" aria-hidden="true">
                  <input type="checkbox" checked tabindex="-1" inert />
                  {{ t().schemes.previewCheck }}
                </span>
              </div>
              <div class="preview__row">
                <span class="badge" aria-hidden="true">{{ t().schemes.previewBadge }}</span>
                <span class="btn preview__focus" aria-hidden="true">{{ t().schemes.previewFocus }}</span>
              </div>
            </div>
          }
        </div>

        @for (issue of issues(); track $index) {
          <p class="issue">{{ issue }}</p>
        }

        <div class="actions">
          <button type="submit" class="btn btn--primary" [attr.aria-disabled]="!canSave()">
            {{ t().common.save }}
          </button>
          <a class="btn" routerLink="/einstellungen/fortgeschritten">{{ t().common.cancel }}</a>
        </div>
      </form>
    } @else {
      <p>{{ t().schemes.notFound }}</p>
    }
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
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
    }

    h2 {
      margin: var(--space-3) 0 0;
    }

    .role {
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      margin: 0;
      padding: var(--space-3) var(--space-4);
    }

    .role__hint {
      margin: 0 0 var(--space-2);
    }

    .pickers {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-5);
    }

    .picker {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .picker__mode {
      min-width: 4rem;
    }

    .picker__color {
      width: var(--touch-min);
      height: var(--touch-min);
      padding: 2px;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      cursor: pointer;
    }

    .field input,
    .picker__hex {
      min-height: var(--touch-min);
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
    }

    .picker__hex {
      width: 7.5em;
      font-family: ui-monospace, monospace;
    }

    .previews {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: var(--space-3);
    }

    /* Eigene Flächen je Modus: light-dark() folgt dem color-scheme des Containers. */
    .preview {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .preview__mode {
      font-weight: 600;
    }

    .preview__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .preview .btn,
    .preview .option,
    .preview .check-row {
      cursor: default;
    }

    .preview__focus {
      outline: 3px solid var(--color-focus);
      outline-offset: 2px;
    }

    .issue {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-left: 4px solid var(--color-warn);
      background: var(--color-warn-soft);
      border-radius: var(--radius-sm);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class SchemeEditorPage {
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  protected readonly t = inject(I18nStore).t;
  protected readonly roles = SCHEME_ROLES;
  protected readonly modes = MODES;
  protected readonly maxTitle = TITLE_MAX_LENGTH;

  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null,
  });

  /** Arbeitskopie; gespeichert wird erst mit „Speichern“. */
  private readonly edited = signal<ColorScheme | null>(null);
  protected readonly draft = computed<ColorScheme | null>(() => {
    const edited = this.edited();
    if (edited && edited.id === this.id()) return edited;
    const stored = this.settings.schemes().find((s) => s.id === this.id());
    return stored && stored.id !== DEFAULT_SCHEME_ID ? stored : null;
  });

  private readonly touched = signal(false);
  protected readonly hexError = signal('');

  private readonly empty = computed(() => (this.draft()?.name ?? '').trim() === '');
  private readonly taken = computed(() => {
    const draft = this.draft();
    return !!draft && !this.empty() && this.settings.isSchemeNameTaken(draft.name, draft.id);
  });
  protected readonly nameHint = computed(() => {
    if (this.taken()) return this.t().schemes.nameTaken;
    return this.empty() && this.touched() ? this.t().errors.titleRequired : '';
  });
  protected readonly canSave = computed(() => !this.empty() && !this.taken());

  protected readonly previewStyle = computed(() => {
    const draft = this.draft();
    return draft ? schemeProperties(draft) : {};
  });

  protected readonly issues = computed(() => {
    const draft = this.draft();
    if (!draft) return [];
    const t = this.t().schemes;
    return contrastIssues(draft).map((issue) => t.issue(t.modes[issue.mode], issue.kind));
  });

  constructor() {
    inject(PageTitleService).set('scheme');
  }

  protected colorOf(scheme: ColorScheme, role: SchemeRole): SchemeColor | null {
    return scheme[role];
  }

  private update(change: (scheme: ColorScheme) => ColorScheme): void {
    const draft = this.draft();
    if (draft) this.edited.set(change(draft));
  }

  protected rename(name: string): void {
    this.touched.set(true);
    this.update((s) => ({ ...s, name }));
  }

  protected setColor(role: SchemeRole, mode: Mode, value: string): void {
    this.hexError.set('');
    this.update((s) => {
      const current = s[role] ?? s.primary;
      return { ...s, [role]: { ...current, [mode]: value.toLowerCase() } };
    });
  }

  protected setHex(role: SchemeRole, mode: Mode, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim().toLowerCase();
    const hex = value.startsWith('#') ? value : `#${value}`;
    if (!isHexColor(hex)) {
      this.hexError.set(this.t().schemes.invalidHex);
      input.value = this.draft()?.[role]?.[mode] ?? '';
      return;
    }
    this.setColor(role, mode, hex);
  }

  /** „Browser-Standard“ aus: mit der Hauptfarbe als Startwert. */
  protected setBrowserDefault(on: boolean): void {
    this.update((s) => ({ ...s, control: on ? null : { ...s.primary } }));
  }

  protected async save(): Promise<void> {
    this.touched.set(true);
    const draft = this.draft();
    if (!draft || !this.canSave()) return;
    const scheme = { ...draft, name: draft.name.trim() };
    await this.settings.saveScheme(scheme);
    await this.settings.setActiveScheme(scheme.id);
    this.edited.set(null);
    this.snackbar.show(this.t().schemes.saved(scheme.name));
    void this.router.navigate(['/einstellungen/fortgeschritten']);
  }
}
