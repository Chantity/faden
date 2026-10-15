import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { I18nStore } from '../../core/i18n/i18n.store';
import { ListsStore } from '../../core/state/lists.store';
import { SettingsStore } from '../../core/state/settings.store';
import { ViewStore } from '../../core/state/view.store';
import {
  newListId,
  newTaskId,
  TOUR_ADVANCED_START,
  TOUR_CLEANUP,
  TOUR_STEPS,
  type TourContext,
} from '../../core/tour';
import { SnackbarService } from '../snackbar/snackbar.service';
import { TOUR_ACTIVE_KEY } from '../first-run/first-run.store';

/**
 * Geführte Tour: führt Schritt für Schritt durch echte Aktionen am Übungszettel.
 * Ein Merker in localStorage zeigt, dass sie läuft – bricht man ab, indem man die
 * App verlässt, bietet der Erst-Start-Dialog sie beim nächsten Mal wieder an.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly lists = inject(ListsStore);
  private readonly views = inject(ViewStore);
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly t = inject(I18nStore).t;

  readonly index = signal<number | null>(null);
  /** Hinweis weggeklickt – jetzt ist die Aktion dran. */
  readonly collapsed = signal(false);
  readonly practiceId = signal<string | null>(null);
  /** Neue Karte aus „Neuer Strang“ – der nächste Schritt zeigt auf sie. */
  readonly taskId = signal<string | null>(null);
  /** Ein Dialog ist offen (der Hinweis wartet dann); gemeldet vom TourOverlay. */
  readonly dialogOpen = signal(false);
  private readonly sawDialog = signal(false);
  /** Zählt hoch, wenn der Hinweis den Fokus (neu) bekommen soll – etwa nach dem Seitenwechsel beim Start. */
  readonly focusRequest = signal(0);
  /** War der einfache Modus beim Start an? Bestimmt den Text nach den Grundlagen. */
  readonly simpleAtStart = signal(false);
  private readonly start = signal<TourContext['start']>({ listIds: [], taskIds: [], done: 0 });

  readonly active = computed(() => this.index() !== null);
  readonly step = computed(() => {
    const index = this.index();
    return index === null ? null : TOUR_STEPS[index]!;
  });
  readonly practice = computed(() => this.lists.lists().find((l) => l.id === this.practiceId()));

  /** „Schritt n von m“: Grundlagen und erweiterte Schritte zählen je für sich weiter. */
  readonly counter = computed(() => {
    const index = this.index();
    if (index === null || index === TOUR_CLEANUP) return null;
    return { n: index + 1, total: index < TOUR_ADVANCED_START ? TOUR_ADVANCED_START : TOUR_CLEANUP };
  });

  /** Namensvorschlag für „Neuer Zettel“ – nur im ersten Schritt. */
  readonly suggestedListTitle = computed(() =>
    this.step()?.id === 'createList' ? this.t().tour.practiceName : null,
  );

  private readonly context = computed<TourContext>(() => {
    const practice = this.practice();
    return {
      listIds: this.lists.lists().map((l) => l.id),
      practice,
      view: practice ? this.views.view(practice.id) : 'focus',
      dialogOpen: this.dialogOpen(),
      sawDialog: this.sawDialog(),
      start: this.start(),
    };
  });

  constructor() {
    effect(() => {
      const step = this.step();
      if (step?.done?.(this.context())) untracked(() => this.next());
    });
  }

  startTour(): void {
    try {
      localStorage.setItem(TOUR_ACTIVE_KEY, '1');
    } catch {
      // Ohne Speicher läuft die Tour trotzdem; nur das Wiederanbieten fehlt.
    }
    this.simpleAtStart.set(this.settings.simpleEnabled());
    this.practiceId.set(null);
    this.goTo(0);
    void this.router.navigate(['/']).then(() => this.focusRequest.update((n) => n + 1));
  }

  /** Nächster Schritt; nach „Dein erster Zettel“ ist der neue Zettel der Übungszettel. */
  next(): void {
    const index = this.index();
    if (index === null) return;
    if (this.step()?.id === 'createList') this.practiceId.set(newListId(this.context()));
    if (this.step()?.id === 'newStrand') this.taskId.set(newTaskId(this.context()));
    this.goTo(index + 1);
  }

  /** „Mehr anzeigen“: einfachen Modus aus und weiter mit den erweiterten Schritten. */
  more(): void {
    if (this.settings.simpleEnabled()) void this.settings.setSimpleEnabled(false);
    this.goTo(TOUR_ADVANCED_START);
  }

  /** „Fertig“ nach den Grundlagen. */
  finishBasics(): void {
    this.goTo(TOUR_CLEANUP);
  }

  keepPractice(): void {
    this.end();
  }

  deletePractice(): void {
    const id = this.practiceId();
    this.end();
    if (!id || !this.lists.getList(id)) return;
    this.lists.remove(id);
    this.snackbar.show(this.t().snackbar.listDeleted, {
      label: this.t().common.undo,
      run: () => this.lists.undo(),
    });
    void this.router.navigate(['/']);
  }

  end(): void {
    try {
      localStorage.removeItem(TOUR_ACTIVE_KEY);
    } catch {
      // nichts zu tun
    }
    this.index.set(null);
    this.practiceId.set(null);
    this.taskId.set(null);
  }

  setDialogOpen(open: boolean): void {
    this.dialogOpen.set(open);
    if (open) this.sawDialog.set(true);
  }

  private goTo(index: number): void {
    // Ohne Übungszettel gibt es nichts aufzuräumen.
    if (index >= TOUR_STEPS.length || (index === TOUR_CLEANUP && !untracked(this.practice))) {
      this.end();
      return;
    }
    const practice = untracked(this.practice);
    this.start.set({
      listIds: untracked(this.lists.lists).map((l) => l.id),
      taskIds: practice?.tasks.map((t) => t.id) ?? [],
      done: practice?.tasks.filter((t) => t.done).length ?? 0,
    });
    this.sawDialog.set(untracked(this.dialogOpen));
    this.collapsed.set(false);
    this.index.set(index);
  }
}
