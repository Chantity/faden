# Entscheidungen und Abweichungen

Diese Datei hält alle getroffenen Entscheidungen, Abweichungen von `SPEC.md` und
deren Begründung fest. Sie ist die einzige Quelle für „warum ist das so?".
`SPEC.md` bleibt die fachliche Quelle der Wahrheit.

---

## 1. Vom Nutzer beschriebene Abweichungen (Projektstruktur / Doku)

Die von `SPEC.md` in Kapitel 10 (Projektstruktur) und Kapitel 15 (Definition of
Done) vorgesehene Dokumentationsmenge wird auf ausdrücklichen Wunsch erweitert:

| Abweichung | Beschreibung |
|---|---|
| **Neue Datei `docs/ARCHITEKTUR.md`** | Ausführliche Architekturbeschreibung (Schichten, Module, Datenfluss, Graph-/Zeit-/Storage-Logik, PWA-Aufbau). Nicht in `SPEC.md` vorgesehen. |
| **Neue Datei `docs/BENUTZERHANDBUCH.md`** | Ausführliches Anwenderhandbuch (Schritt-für-Schritt-Bedienung aller Funktionen, Ketten, Aufteilen/Zusammenführen, Timeboxing, Backup, Installation). Nicht in `SPEC.md` vorgesehen. |
| **`README.md` bewusst schlank** | Die README enthält **nur** Zweck der Anwendung und die grundsätzliche Bedienung (kurz). Die ausführliche Bedienung lebt im Benutzerhandbuch, die Technik in der Architekturbeschreibung. Abweichung von Kapitel 15, das README mit Entwicklungs-, Test-, Build- und „Einmal hosten"-Anleitung beschreibt — diese Inhalte wandern in `ARCHITEKTUR.md` bzw. bleiben als kurzer Verweis-Block in der README erhalten. |

Auswirkungen auf die Projektstruktur (Kap. 10):

```
docs/
├─ DECISIONS.md          (bereits vorgesehen)
├─ PWA-TESTS.md          (bereits vorgesehen)
├─ ARCHITEKTUR.md        (NEU, Abweichung)
└─ BENUTZERHANDBUCH.md   (NEU, Abweichung)
```

---

## 2. Technische Grundentscheidungen

| Entscheidung | Wert | Begründung |
|---|---|---|
| Framework-Version | **Angular 22.2.x** | In `SPEC.md` Kap. 2 gefordert; zum Zeitpunkt der Umsetzung neueste stabile Hauptversion. |
| Architektur | Standalone, **zoneless**, Signals, neue Control-Flow-Syntax, `inject()`, `OnPush` | Angular-22-Default für neue Projekte, deckt Kap. 2 ab. |
| Test-Runner | **Vitest** (Angular-22-Default) | In Kap. 2 als „Standard-Test-Runner der Angular-Version" gefordert. |
| Routing | **Hash-Routing** (`withHashLocation()`), `base href="./"` | Kap. 2/14: beliebiger statischer Host, Offline-Start. |
| UI-Sprache | **Englisch als Standard**, Deutsch umschaltbar; Texte zentral in `core/i18n/` | Nutzerwunsch (siehe Kap. 9); Kap. 3.1 lässt zentralisierte Texte zu. |
| Arbeitstitel | **„Faden"** | Kap. 14.8; zentral in `app-meta.ts` + Manifest änderbar. |

---

## 3. Service Worker: Variante A verworfen → **Variante B**

**Befund (verifiziert):** Der von Angular mitgelieferte Service Worker
`@angular/service-worker` (ngsw) ruft beim Update-Check `ngsw.json` ab. Liefert
der Server darauf **HTTP 404**, löscht ngsw **alle Caches und deregistriert sich
selbst** (`fetchLatestManifest` → `deleteAllCaches()` + `unregister()`). Das ist
laut Angular-Doku **bewusstes Design** und nicht abschaltbar
(Quellen: https://angular.dev/ecosystem/service-workers/devops,
https://github.com/angular/angular/issues/51337).

Genau dieser Fall — „Host abgeschaltet, Domain antwortet mit 404" — ist aber der
Kern der Anforderung aus `SPEC.md` Kap. 9 („einmal hosten, nie wieder").
**Variante A fällt damit durch die Pflichttests aus Kap. 9.4.**

**Entscheidung:** Umsetzung von **Variante B** — ein eigener, minimaler Service
Worker (`public/sw.js`, ohne Fremdbibliothek):

- `install`: alle Build-Artefakte vorab in `caches.open('faden-v1')` ablegen.
- `fetch`: `caches.match` zuerst (Cache-first); Navigationen immer mit der
  gecachten `index.html` beantworten; bei Cache-Miss Netzwerk nur als Notlösung.
- `activate`: **niemals** Caches löschen. Kein Selbst-Deregistrieren, egal was
  der Server liefert (404 / 5xx / Captive-Portal-HTML / Weiterleitung).
- Precache-Liste wird **zur Buildzeit** von einem kleinen Node-Skript nach
  `ng build` erzeugt (alle Dateien im Output inkl. Hash/Revision → in `sw.js`).
- Registrierung nur in **Produktionsbuilds** über `main.ts`.
- Nutzergesteuerte Update-Prüfung (Kap. 9.3) ist Phase 3 und optional.

Die Pflichttests aus Kap. 9.4 werden in `docs/PWA-TESTS.md` dokumentiert und
müssen **alle** grün sein (inkl. 404-/500-/Captive-Portal-Szenario).

---

## 4. Abhängigkeiten: minimal

Ausdrücklicher Wunsch: möglichst keine Zusatzpakete, **`@angular/cdk`** darf bei
Bedarf genutzt werden.

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Graph-Layout | **Eigener einfacher, top-down Layered-Layout-Algorithmus** (keine externe Lib) | Kap. 2 erlaubt eigenes Layout; weniger Abhängigkeiten, volle Kontrolle über Stabilität/Reizarmut. |
| IndexedDB | **Eigener dünner Wrapper** (kein `idb`) | Kap. 2 erlaubt eigenen Wrapper; minimale Abhängigkeiten. |
| Dialoge/Sheets/A11y | **`@angular/cdk`** nur wenn konkret nötig | Vom Nutzer explizit erlaubt; Fokus-Falle, Overlay, Live-Announcements. |
| Sonstiges | Keine weiteren Laufzeitabhängigkeiten | Kap. 2: wenige Pakete; keine externen Requests zur Laufzeit (Kap. 9/12). |

---

## 5. Umsetzungsplan (Phasen)

Jede Phase ist lauffähig und wird einzeln committet (Kap. 11). Start: **Phase 1**,
anschließend Review, dann Phase 2 und 3.

### Phase 0 – Projektgerüst (Teil von Phase 1)
1. Angular-22-Projekt am Repo-Root scaffolden (standalone, zoneless, css,
   Routing, Vitest, **kein SSR**).
2. `tsconfig` verschärfen (`strict`, `noUncheckedIndexedAccess`), Hash-Routing,
   `base href="./"`.
3. Ordnerstruktur gemäß Kap. 10; `core/i18n/de.ts` (alle UI-Texte);
   `app-meta.ts` (Name, Version aus `package.json`).
4. Design-Tokens in `styles.css` (gedämpfte Palette, Hell/Dunkel/System,
   Basis ≥17 px in `rem`, `prefers-reduced-motion`).
5. `docs/DECISIONS.md` (diese Datei), `docs/PWA-TESTS.md` (Gerüst),
   `docs/ARCHITEKTUR.md`, `docs/BENUTZERHANDBUCH.md`.

### Phase 1 – Fundament
6. `core/graph` — rein, vollständig getestet (Kap. 4.1–4.5):
   `insertBefore/After/Between`, `addParallelAfter/Before`, `addStandalone`,
   `connect/disconnect`, `deleteTask` (Überbrücken + „nur entfernen"),
   `wouldCreateCycle`; Ableitungen (`predecessors`/`successors`,
   `isAvailable`/`isBlocked`/`isEarlyDone`, Aufteilen/Zusammenführen, Fortschritt,
   `topologicalOrder`, `connectedComponents`, `extractStrand`); Invarianten.
7. `core/storage` — dünner IndexedDB-Wrapper (Stores `lists`, `templates`,
   `settings`, `meta`), `migrate()`-Gerüst (`schemaVersion` ab Tag 1),
   Export/Import-Validierung (Schema/Version/Zyklen/Referenzen).
8. `core/state` — Signal-Stores (lists, templates, settings), **Undo/Redo**
   (Snapshot-Historie ≥100, Redo-Verwerfen), entprelltes Schreiben (~300 ms) +
   sofort bei `visibilitychange`/`pagehide`, BroadcastChannel (Mehr-Tab).
9. `features/lists` — Zettel-Übersicht: CRUD, Duplizieren,
   Archivieren/Wiederherstellen, Sortierung (Hoch/Runter), Leerzustand, Karten
   mit Fortschritt + Modus-Badge + „Jetzt dran"-Vorschau, Löschen mit Undo.
10. `shared` — Button, Dialog/Sheet, Snackbar (`aria-live`), Chips (was Phase 1
    braucht).
11. Verifikation: `npm test` grün, `ng build` (Produktion) ohne Warnungen → Commit.

### Phase 2 – Kernfunktion
- `features/focus-view` („Jetzt dran", Ketten-Eingabe, Erledigt, Undo-Snackbar).
- `features/task-editor` (Titel/Notizen/Vorgänger-/Nachfolger-Chips).
- `features/flow-view` (eigenes Layered-Layout, SVG-Pfeile, „+", Verbinden,
  Pan/Zoom 40–200 %, Zustände Icon+Text+Farbe, linearisierte Listenalternative).
- Tastaturbedienung (Kap. 5.7), A11y- und Responsive-Durchgang.

### Phase 3 – Timeboxing, Vorlagen, Backup, PWA
- `core/time` (rein/getestet) + Modi `estimate`/`dayPlan`/`schedule`.
- Vorlagen (`extractStrand`, „Neuer Zettel aus Vorlage").
- Export/Import-UI, `storage.persist()`, Backup-Erinnerung.
- Eigener `sw.js` + Precache-Build-Skript, Manifest + Icons, Installationshilfe;
  Pflichttests Kap. 9.4 → `docs/PWA-TESTS.md`.
- Optional: Kap. 7.5, Update-Prüfung Kap. 9.3, Vorlage in bestehenden Zettel.

---

## 6. Kleine Abweichungen aus Phase 1 (bewusst, jederzeit nachrüstbar)

| Thema | Ist-Stand in Phase 1 | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Undo/Redo-Verlauf | **Globaler Snapshot-Verlauf** für die Zettel-Übersicht (bis 100 Schritte). | 5.5: „Pro Zettel ein Verlauf" | Ein expliziter Verlauf pro Zettel ist erst mit der Detailansicht (Phase 2) sinnvoll; `History<T>` ist bereits generisch vorbereitet. |
| Löschen von Zetteln | Sofort aus IndexedDB entfernt, **Undo im Speicher** (Hinweisband 8 s). | 5.5: verzögertes/Soft-Delete | Verhalten für den Nutzer identisch; verzögertes Schreiben kann später ergänzt werden. |
| App-Version | `APP_VERSION` fällt auf `0.0.0` zurück; `define` aus `package.json` folgt. | 9.3: Version aus `package.json` | Wird in Phase 3 mit dem Build verdrahtet. |
| Service Worker, Manifest, Icons | Noch nicht vorhanden (keine Referenzen in `index.html`). | Kap. 9 | Bewusst Phase 3; vermeidet 404-Referenzen im Zwischenstand. |
| `@angular/cdk` | Noch nicht installiert. | Kap. 2 (optional) | Wird nur bei konkretem Bedarf ergänzt. |

## 6a. Mehrsprachigkeit (Phase 1.5)

Auf Wunsch: **Englisch ist Standardsprache**, Deutsch umschaltbar; weitere Sprachen
sind ohne Umbau ergänzbar. Bewusste Entscheidungen:

- **Eigene, kleine i18n statt Bibliothek.** Angulars eingebautes
  `@angular/localize` übersetzt **zur Buildzeit** (eine Sprache pro Build) und
  scheidet für einen Laufzeit-Umschalter im Ein-Build-Offline-Betrieb aus.
  Externe Libs (Transloco/ngx-translate) wären eine zusätzliche Abhängigkeit.
- **Reaktiv über Signals.** `I18nStore` hält die Sprache und liefert `t()` als
  `computed`; Templates lesen `t()`. Beim Umschalten zeichnet Angular sofort neu.
- **Typsicherheit.** `de.ts` ist die Vorlage; `en.ts` erfüllt sie über
  `satisfies Translations` (`typeof de`). Eine vergessene Übersetzung ist ein
  **Compile-Fehler**.
- **Fallback.** Unbekannte Sprache → Englisch (`dictionaryFor`).
- **Persistenz & Default.** `AppSettings.language` (Default `en`); `SCHEMA_VERSION`
  auf **2** erhöht, Migration v1→v2 ergänzt fehlendes `language`. Umschalten
  speichert entprellt über den bestehenden Settings-Pfad.
- **A11y.** `I18nStore` pflegt `document.documentElement.lang`; Seitentitel werden
  lokalisiert über `PageTitleService` (früher hartkodierte Routen-Titel entfernt).
- **Noch deutsch:** die Validierungsfehlertexte in `core/storage/backup.ts`. Sie
  werden mit der Backup-UI in Phase 3 an i18n angebunden.


## 7. Fortschritt

- **Phase 1 – Fundament: abgeschlossen.**
  - Angular-22-Gerüst (standalone, zoneless, CSS, Hash-Routing, Vitest, kein SSR).
  - `core/graph` mit allen Operationen und Ableitungen, **37 Unit-Tests**.
  - `core/storage` (IndexedDB-Wrapper, Migration, Backup-Validierung/Import),
    **Logik-Tests** für Migration und Export/Import.
  - `core/state` (Signal-Stores, Undo/Redo, entprellte Persistenz,
    BroadcastChannel) inkl. History-Tests.
  - `features/lists` (Zettel-Übersicht: CRUD, Archiv, Sortierung, Undo-Snackbar),
    Einstellungen (Theme), Platzhalter für Detail/Vorlagen.
  - `npm test` = 50 Tests grün; `ng build` (Produktion) ohne Warnungen.

- **Phase 1.5 – Mehrsprachigkeit: abgeschlossen** (siehe Kap. 6a).
  - `core/i18n`: `types.ts`, `de.ts`, `en.ts`, `dictionaries.ts`, `i18n.store.ts`,
    `page-title.ts`; Settings-Feld `language` (+ Migration v2), Sprachwahl in den
    Einstellungen, `<html lang>` und Dokumenttitel lokalisiert.
  - `npm test` = **55 Tests** grün; `ng build` (Produktion) ohne Warnungen.

## 8. Laufendes Entscheidungsprotokoll

| Datum | Entscheidung | Grund |
|---|---|---|
| 2026-10-14 | Start mit Phase 1, Commit vor Phase 2 | Nutzerwunsch, Zwischen-Review. |
| 2026-10-14 | Service Worker: Variante B | ngsw löscht bei 404 Caches (Kap. 3 hier). |
| 2026-10-14 | Kein `@dagrejs/dagre`, kein `idb` | Nutzerwunsch: minimale Abhängigkeiten. |
| 2026-10-14 | `docs/ARCHITEKTUR.md` + `docs/BENUTZERHANDBUCH.md` ergänzt; README schlank | Nutzerwunsch (Kap. 1 hier). |
| 2026-10-14 | Kanten-IDs deterministisch (`edgeId(from,to)`) | Hält Graph-Operationen rein, keine Zufallsquelle nötig. |
| 2026-10-14 | Phase 1 abgeschlossen und committet | Kap. 7 hier. |
| 2026-10-14 | Englisch als Standardsprache, eigene reaktive i18n (kein `@angular/localize`) | Nutzerwunsch; Runtime-Switch im Ein-Build-Offline-Betrieb (Kap. 6a). |
| 2026-10-14 | `SCHEMA_VERSION` 1 → 2 (`AppSettings.language`) | Migration v1→v2 ergänzt Sprache/Default Englisch. |
