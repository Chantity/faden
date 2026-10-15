# Umsetzungsplan v2

Reihenfolge für `SPEC-v2.md`. Jede Phase ist für sich lauffähig. Nach jeder Phase muss gelten:

- [ ] `npm test` grün; ab Phase mit UI-Änderung auch `npm run build`, `npm run test:pwa` und `npm run test:acceptance`.
- [ ] Betroffene Dokumente aktualisiert: `README.md`, `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`, `docs/ACCEPTANCE.md`, `docs/PWA-TESTS.md`, `docs/DESIGN-PRINCIPLES.md`.
- [ ] Commit mit `git -c user.name="Chantity" -c user.email="herrfrautut@gmail.com" commit …`, ohne Claude-Attribution. **Kein Push.**

Grundregeln: bestehende Bausteine wiederverwenden (siehe Spalte „Nutzt“), keine neuen npm-Pakete, neue Logik als reine Funktion mit Unit-Test, Texte immer in `de.ts` **und** `en.ts`.

---

## Phase 0 – Vorarbeiten (SPEC-v2 Kap. 0)

| Schritt | Dateien | Nutzt |
|---|---|---|
| `docs/DESIGN-PRINCIPLES.md` aus `SPEC.md`, `docs/DECISIONS.md`, `ARCHITECTURE.md`, `ACCEPTANCE.md`, `PWA-TESTS.md` zusammenstellen (Produkt- und Entwicklungsprinzipien) | neu | – |
| `docs/ACCEPTANCE.md`: eigene Kriterienliste statt „SPEC 12.2“ | `docs/ACCEPTANCE.md` | SPEC 12.2 (Inhalt übernehmen) |
| `SPEC.md` und `docs/DECISIONS.md` löschen; Verweise in README, `docs/` und Code-Kommentaren (`grep -rn "SPEC\|DECISIONS"`) entfernen oder auf DESIGN-PRINCIPLES umstellen | viele, nur Kommentare/Doku | – |

Ergebnis: Doku ohne tote Verweise; der Code ist unverändert, abgesehen von Kommentaren.

## Phase 1 – Datenmodell, Schema-Version 3 (Kap. 1)

| Schritt | Dateien | Nutzt |
|---|---|---|
| `ChecklistItem`, `Task.checklist`; `dayEnd`/`endAt` entfernen; `SCHEMA_VERSION = 3` | `src/app/core/model.ts` | – |
| Migration 2 → 3: Dauer aus von–bis, nur Ende vorhanden, eindeutige Namen | `src/app/core/storage/` (`migrate`) | bestehende Migration 1 → 2 als Muster |
| `uniqueTitle(title, existing)` | `src/app/core/` (neu, rein) | – |
| Backup-Validierung: `checklist`, Ablehnung von `dayEnd`/`endAt` in Schema 3, neue Fehlercodes + Übersetzung | `backup.ts`, `backup-error.ts`, `de.ts`, `en.ts` | `BackupIssue` |
| Alle Lese-Stellen des Endes auf berechnetes Ende umstellen (Status, Hinweise, Strecken, Vorschlagen, Übertragen, Vorlagen) | `src/app/core/time/*`, `templates/*`, `plan-editor.ts`, `task-editor.ts`, `focus-view.ts`, `flow-view.ts` | neue Hilfsfunktion `endOf(task, mode)` |

Ergebnis: Die App läuft mit Schema 3. Die Editoren zeigen vorerst noch die Ende-Felder als berechnete Anzeige; die Eingabe Start + Dauer folgt in Phase 4.

## Phase 2 – Polishing (Kap. 4.1–4.7, 4.9)

| Schritt | Dateien | Nutzt |
|---|---|---|
| Alle ⋯-Menüs: Klick außerhalb und Esc schließen, Fokus zurück | `lists-page.*`, `focus-view.ts`, `flow-view.ts`, `list-detail-page.ts`, `templates-page.ts` | vorhandene Schließ-Logik der Übersicht vereinheitlichen |
| Modus-Chip in der Detailansicht und in der Seitenleiste | `list-detail-page.ts`, `lists-sidebar.ts` | `modeLabel`, `.badge` aus `lists-page` |
| Automatisch archivieren beim Betreten der Übersicht + Snackbar mit Undo | `lists.store.ts` (Command `archiveCompleted`), `lists-page.ts` | `CommandHistory`, `SnackbarService` |
| Archiv: Chip, `<details>` mit ToDo-Titeln, ⋯-Menü (Umbenennen, Duplizieren nicht archiviert, Als Vorlage) | `lists-page.*`, `lists.store.ts` (`duplicate` mit Option) | `topologicalOrder`, `listToTemplate`, `ListDialog` |
| Eindeutige Namen: Inline-Hinweis im Dialog; `duplicate` und „aus Vorlage“ mit `uniqueTitle` statt „(Kopie)“ | `list-dialog.ts`, `lists.store.ts`, `templates-page.ts` | `uniqueTitle` |

Tests: Store-Tests (Auto-Archiv inkl. Undo, Duplikat-Namen), Abnahmetest „jedes ⋯-Menü schließt“.

## Phase 3 – ToDo-Sheet zum Anlegen + Checkliste (Kap. 2)

| Schritt | Dateien | Nutzt |
|---|---|---|
| `TaskEditor` bekommt den Modus *anlegen* (Position: vor/nach/dazwischen/eigener Strang/Kette); Enter im Titel legt an | `task-editor.ts` | `focusAfterRender`, Einfüge-Operationen aus `core/graph` |
| Alle Anlege-Wege öffnen das Sheet; Ketten-Eingabe öffnet nach Enter ein leeres Sheet für die nächste Vorarbeit | `focus-view.ts`, `flow-view.ts` | bestehende Ketten-Logik |
| Umschalter „Text / Checkliste“, Punkte bearbeiten | `task-editor.ts` | – |
| `checklistToText` / `textToChecklist` | `src/app/core/` (neu, rein) | – |
| Checkliste auf der Karte in „Jetzt dran“ abhaken (Undo), „☑ 2/5“ im Ablauf | `focus-view.ts`, `flow-view.ts` | `editList` |

Tests: Umwandlung inkl. Grenzfälle; Komponententests Sheet/Kette/Checkliste; Abnahmetest Geschirrspüler (nur Tastatur) angepasst und grün.

## Phase 4 – Zeitplanung (Kap. 3)

| Schritt | Dateien | Nutzt |
|---|---|---|
| Eingabe Start + Dauer im Sheet; Zeit als Zusammenfassungszeile, aufklappbar (3.5) | `task-editor.ts` | Dauer-Chips aus dem Schätz-Modus |
| Pause pro Pfeil berechnen und anzeigen (> 0, Zoom ≥ 100 %, im Pfeil-Label) | `src/app/core/time/` (neu `pauseBetween`), `flow-view.ts` | `endOf`, Zoom-Schwelle der „+“ |
| Verschieben mit Bereich Zettel/Strang; „Strang verschieben …“ im Karten-Menü | `plan.ts`, `plan-editor.ts`, `flow-view.ts` | bestehendes „Alles verschieben“, `connectedComponents` |
| Relatives Einfügen: vor dem ersten (2 Optionen), nach dem letzten, dazwischen (2 Modi), Verzweigungen; Vorschauzeile; Link „Uhrzeit direkt eingeben“ | `src/app/core/time/` (neu `placeRelative`, `shiftAncestors`/`shiftDescendants`), `task-editor.ts` | `predecessors`/`successors`, Einfüge-Operationen |
| Moduswechsel: „Tageszeiten übertragen“ überträgt nur noch den Start | `plan.ts`, `plan-editor.ts` | – |

Tests: alle Fälle aus 3.4 mit festem `now`, Sommer-/Winterzeit, 24:00-Grenze im Tagesplan, ein Undo-Schritt je Aktion.

## Phase 5 – Konflikte beim Zusammenführen (Kap. 4.10)

| Schritt | Dateien | Nutzt |
|---|---|---|
| `resolveConflicts(local, incoming, strategy)` mit vier Strategien, unabhängig von der Oberfläche | `backup.ts` | `applyImport`, `uniqueTitle` |
| Konflikt-Dialog, automatische Sicherung bei „Überschreiben“ / „Nur neuere“, Ergebnis-Hinweis | `settings-page.ts`, `backup.service.ts` | bestehende Sicherung vor „Alles ersetzen“ |

Tests: jede Strategie, Gleichstand bei `updatedAt`, Position bleibt beim Überschreiben, Roundtrip.

## Phase 6 – Erst-Start-Hinweise und Anleitung in der App (Kap. 4.8, 5.3–5.5)

| Schritt | Dateien | Nutzt |
|---|---|---|
| Speicher-Hinweis (modal, nur „Verstanden“) | `src/app/shared/` (neu), `app.html`, `de.ts`/`en.ts` | Muster `InstallBanner` (localStorage mit try/catch) |
| `scripts/guide.mjs` (eigener Markdown-Konverter) → `public/guide/`; `.gitignore`; `build`-Skript erweitern | `scripts/`, `package.json`, `.gitignore` | `scripts/precache.mjs` als Muster |
| Anleitungs-Dialog (Vollbild, scrollt zu `#english`/`#deutsch`), Popup „Anleitung lesen / Ignorieren“ | `src/app/shared/` (neu) | `dialog.sheet`, `I18nStore` |
| Reihenfolge Speicher-Hinweis → Anleitung → Installations-Banner | `install-banner.ts` | – |
| Einstellungen: „Anleitung lesen“, Link zum Repo (`APP_REPO_URL`) | `settings-page.ts`, `app-meta.ts` | – |
| Browser-Tests setzen die Popup-Schlüssel vorab; PWA-Test: Anleitung offline | `scripts/*-test.mjs`, `scripts/lib/browser.mjs` | – |

Tests: Konverter (Unit), Popups und Reihenfolge (Komponente), Erst-Start im Abnahmetest.

## Phase 7 – Anleitung neu schreiben + Screenshots (Kap. 5.1–5.2)

| Schritt | Dateien | Nutzt |
|---|---|---|
| `scripts/screenshots.mjs`: Testdaten anlegen, pro Sprache und Format zugeschnittene PNGs | `scripts/`, `docs/images/{en,de}/` | `scripts/lib/browser.mjs`, Testdaten aus `acceptance-test.mjs` |
| `docs/USER-GUIDE.md` neu: Kapitel je Seite, jede Funktion, Kästen „Am PC / Auf dem Handy“, EN + DE | `docs/USER-GUIDE.md` | bestehender Text als Ausgangspunkt |
| Bildgröße prüfen (< 1,5 MB gesamt), Precache prüfen | – | `precache.mjs`-Ausgabe |

## Phase 8 – Abnahme v2 (Kap. 6–7)

- [ ] Alle Test-Suiten grün; Abnahmetests erweitert (Kap. 6). Lighthouse-Accessibility prüft der Nutzer von Hand.
- [ ] `docs/ACCEPTANCE.md` mit allen Kriterien und Nachweisen; `docs/PWA-TESTS.md` mit neuem Lauf.
- [ ] Version 2.0.0 (`npm version 2.0.0 --no-git-tag-version`).
- [ ] Bleibende Entscheidungen aus `SPEC-v2.md` in `docs/` übertragen, dann `SPEC-v2.md` und `PLAN-v2.md` löschen. `v2-requirements.md` nach Rücksprache mit dem Nutzer.
- [ ] Commit. **Kein Push.**

## Offene Punkte

- ~~Repo-URL für `APP_REPO_URL`~~ → `https://github.com/Chantity/faden`.
- Ob `v2-requirements.md` am Ende gelöscht werden soll.
