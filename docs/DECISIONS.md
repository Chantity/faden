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
| Graph-Layout | **Eigener einfacher, top-down Layered-Layout-Algorithmus** (keine externe Lib). Kartenhöhe **variabel** je nach geschätzter Titel-Zeizenzahl (1–3 Zeilen); die jeweils nächste Schicht beginnt unter der **höchsten** Karte. | Kap. 2 erlaubt eigenes Layout; weniger Abhängigkeiten, volle Kontrolle über Stabilität/Reizarmut. Feste Kartenhöhe ließ lange Titel abschneiden und Pfeile/Folgekarten überlappen. Die Schätzung (`nodeCharsPerLine`) ist konservativ und wird durch `line-clamp` im Diagramm exakt gespiegelt, damit Layout und Rendering übereinstimmen. |
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
- **Status: umgesetzt** (siehe Kap. 6b für Abweichungen).

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
| App-Version | `APP_VERSION` fällt auf `0.0.0` zurück; `define` aus `package.json` folgt. **Erledigt in 3.11.** | 9.3: Version aus `package.json` | Wird in Phase 3 mit dem Build verdrahtet. |
| Service Worker, Manifest, Icons | Noch nicht vorhanden (keine Referenzen in `index.html`). **Erledigt in 3.11.** | Kap. 9 | Bewusst Phase 3; vermeidet 404-Referenzen im Zwischenstand. |
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

## 6b. Abweichungen aus Phase 2 (bewusst, jederzeit nachrüstbar)

| Thema | Ist-Stand in Phase 2 | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Undo/Redo-Verlauf | Weiterhin **ein globaler Snapshot-Verlauf** über alle Zettel. | 5.5: „Pro Zettel ein Verlauf" | Verhalten identisch (≥100 Schritte); ein Verlauf pro Zettel kann später ergänzt werden. |
| „Mit anderem ToDo verbinden" | **Auswahl-Dialog** statt Banner-Modus „Ziel wählen" (Punkt 1) bzw. Drag (Punkt 2). | 5.4, Punkte 1–2 | Der Dialog ist per Tastatur/Screenreader bedienbar und funktional gleichwertig; Drag-to-connect bleibt optional. |
| Pfeil-Aktionen / „+"-Anordnung | **Ein** „+" pro Verbindung (auf der Kante, `insertBetween`); das Karten-„+" **über** einer Karte wird am Strang-Anfang (kein Vorgänger) gezeigt, das Karten-„+" **unter** einer Karte am Strang-Ende (kein Nachfolger) und **an einer Verzweigung** (≥2 Nachfolger). Bei genau **einem** Nachfolger ersetzt das Kanten-„+" das Karten-„+". Zusätzlich öffnet ein Tap auf die Kante ein kleines Menü. | 5.4: „auf jedem Pfeil · über jeder Karte · unter jeder Karte" | In einer Kette wären die drei „+" deckungsgleich und täten dasselbe. Ein „+" pro Verbindung plus Rand-„+" ist überlappungsfrei; `insertBefore`/`insertAfter` an Mittelknoten entspricht `insertBetween` auf der jeweiligen Kante. |
| Karten-„+" an Verzweigungen (Fan-out) | Hat ein ToDo **≥2 direkte Nachfolger**, erscheint unter ihm wieder ein „+" (`showsAfterPlus`: 0 oder ≥2 Nachfolger). Es fügt einen Knoten ein, **von dem alle bisherigen Nachfolger abhängen** (vorhandenes `insertAfter` = Engpass-Einfügung: alle `A→s` werden zu `D→s`, dazu `A→D`). Der Schichtabstand im Ablauf ist **128 px** (vorher 72 px), damit Karten-„+" und die Kanten-„+" der abgehenden Pfeile nebeneinander Platz haben; auf **jedem** Pfeil bleibt ein „+" sichtbar. Die Überlagerungsprüfung (`edgePlusHidden`) bleibt als Absicherung bestehen. | Nutzerwunsch (Ablauf, Bugfix-Runde) | In einer Verzweigung A→{B,C,…} ließ sich bisher nicht *vor* der Verzweigung ein neuer gemeinsamer Schritt einfügen. Beim ersten Wurf wurde das senkrechte Kanten-„+" A→B ausgeblendet; der Nutzer wollte stattdessen längere Pfeile mit sichtbarem „+". |
| „+" bei kleinem Zoom | Unter ~60 % Zoom werden die „+" ausgeblendet, dazu der Hinweis *„Für ‚+' heranzoomen"*. | 5.4 | Entspricht der Vorgabe („Bei sehr kleinem Zoom werden die ‚+' ausgeblendet … Hinweis"). |
| „+"-Trefferfläche | Sichtbarer Kreis bleibt klein-dezent (38 px auf der Karte, 30 px auf dem Pfeil), die **Klick-/Tippfläche ist 44×44 px** (transparente `::after`-Fläche, `inset:-3px` bzw. `-7px`). | 5.4: „Trefffläche mindestens 44×44 px (auch wenn das Icon kleiner ist)" | Erfüllt die A11y-Vorgabe, ohne das ruhige Bild zu vergrößern. Eine absolute `::before`-Fläche überdeckte zuvor das „+"-Zeichen (positionierte Ebene über Inline-Text). |
| Kartenhöhe im Ablauf | **Variabel** je geschätzter Titelzeilenzahl (1–3, per `line-clamp` gespiegelt); die nächste Schicht beginnt unter der höchsten Karte. | 5.4 (Layout) | Lange Titel wurden abgeschnitten und Folgekarten/Pfeile überdeckten sich. |
| Pfeilform | **Gerade Linie** von Unterkante zu Oberkante (statt rechtwinklig). | 5.4 („leicht gebogen oder rechtwinklig") | Bei Verzweigungen überlagerten sich die senkrechten Teilstücke der rechtwinkligen Führung an der Abzweigung; gerade Linien fächern sich überlappungsfrei auf. |
| Umweg-Pfeile (A→C trotz A→B→C) | Im Ablauf **ausgeblendet** (transitive Reduktion fürs Zeichnen); Daten behalten alle Pfeile. | 4.1.4: erlaubt, „nicht extra behandelt" | Redundante Pfeile verdeckten Karten. Ausblenden statt Verbieten ist verlustfrei: nach Löschen eines Zwischenschritts taucht der Pfeil wieder auf. |
| „Wartet"/„Jetzt dran" | **Transitiv** bestimmt: Offen = „jetzt dran" nur, wenn **keine** (auch mittelbare) Vorarbeit offen ist; sonst „wartet". | 4.2/4.4 | Wunsch: In einer Kette offen→erledigt→offen ist nur der vorderste offene Schritt „jetzt dran", die folgenden „warten", auch wenn das direkte Mittelglied schon abgehakt ist. |
| Abhaken im Ablauf | Jede Karte hat einen **runden Haken-Button** (ab- und wieder aufhaken, mit Undo-Snackbar). | 5.4/6 („Abhaken als checkbox/switch-Semantik") | Abhaken war bisher nur in „Jetzt dran" möglich. |
| Menü schließen im Ablauf | Klick/Tipp auf die Diagrammfläche schließt das offene Karten-/Pfeilmenü **ohne Auswahl**. | 5.4 (Menüs) | Menüs ließen sich nur durch eine Aktion schließen. |
| Menü schließen in „Jetzt dran" | Klick/Tipp irgendwo außerhalb schließt das offene ⋯-Menü; **auch ein Klick auf das Menü-`<details>`-Element selbst** (Fläche neben der Zusammenfassung). Nur ein Klick im Menüinhalt lässt es offen. | 5.3 (Menüs) | Auf dem Handy gab es sonst keinen Weg, das Menü ohne Auswahl zu schließen. Weil `⋯` als `inline-flex` schrumpft, liegt um die Zusammenfassung Fläche des `<details>`-Elements, die nativ nicht kippt; der Handler schließt sie (mit `preventDefault`, damit die native Kippbewegung es nicht sofort wieder öffnet). |
| Ketten-Eingabe abbrechen | Neben **Esc** beendet ein sichtbarer **„Abbrechen"-Button** die Kette (mobil ohne Tastatur). „Fertig" übernimmt eine noch offene Eingabe und beendet dann. | 5.3 | Esc gibt es auf Touch-Geräten nicht. |
| „Danach kommt noch …" | Aufgaben und „wartet auf: …" stehen mit **Gedankenstrich** getrennt in einer flexiblen Zeile. | 5.3 | Titel und Begründung klebten ohne Trenner aneinander. |
| Ketten-Eingabe | Ein Eingabefeld mit **Enter-Kette** (jedes Enter hängt vor das zuletzt eingefügte) und **mehrzeiliges Einfügen** (eine Zeile = ein ToDo). | 5.3 | Deckt „Schnelles Erfassen von Ketten" ab. |
| „+" für unabhängiges ToDo in „Jetzt dran" | Rechts oben in der Kopfzeile ein **„✚"-Button**, der ein **einzelnes ToDo ohne Vorgänger** anlegt (dieselbe Ketten-Eingabe, aber ohne Anker). | 5.3 („einen neuen, unabhängigen Faden starten") | Bisher gab es ein „+" ohne Verbindung nur im Ablauf. |


| Zeit-Badges im Ablauf/„Jetzt dran" | **Vorhanden** (Phase 3.8): „Jetzt dran" zeigt ein Zeit-Badge + „Nachträglich abhaken"; der Ablauf zeigt ein kompaktes Zeit-Badge am Kasten. | 5.3/5.4 („in Zeit-Modi zusätzlich") | Zeitlogik in `core/time` (Phase 3). |
| Tastenkürzel-Übersicht | Eigenes `<dialog>` mit `?`; Undo/Redo `Strg/Cmd+Z`, `Strg/Cmd+Shift+Z`, `Strg+Y`. | 5.7 | Vollständig umgesetzt. |

## 6c. Abweichungen aus Phase 3 – Timeboxing (3.8)

| Thema | Ist-Stand in Phase 3.8 | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Uhr ohne Sekunden | Ein `NowStore` liefert ein `now`-Signal, das **minütlich** und bei `visibilitychange` aktualisiert. | 7.3 | Zustände „läuft/als Nächstes/überfällig" genügen auf Minutenebene; kein Sekundentakt. |
| Zeitfelder im Editor | Der ToDo-Editor zeigt **modusabhängig** nur die Felder des aktuellen Modus (Schätzung / Von-Bis / Start-Ende); Felder anderer Modi bleiben beim Speichern unberührt. | 5.1/7.2–7.4 | Modulwechsel löschen keine Daten (7.1). |
| Schätz-Chips | Schnellwahl-Chips (5–90 Min) **und** freies Zahlenfeld (1–1440). | 7.2 | Schnelle Eingabe; freies Feld deckt Sonderfälle ab. |
| „Zeitplan bearbeiten" | Ein Dialog (Menü `⋯` bei `dayPlan`/`schedule`) bündelt **Verschieben**, **Strecken** (nur `schedule`), **Vorschlagen** und **Übertragen** (nur `dayPlan`). | 7.4/7.5 | Ein Ort für alle Zeitplan-Werkzeuge; die reinen Funktionen liegen getestet in `core/time`. |
| Datum/Uhrzeit-Format | Deutsche Ausgabe „Do. 12.03." / „1 Std 25 Min", englische „Thu 12 Mar" / „1 h 25 min" (`Intl` + Sprachparameter). | 3.1 | Englisch ist Standard → Datums-/Dauertexte sind lokalisiert. |

## 6d. Abweichungen aus Phase 3 – Vorlagen (3.9)

| Thema | Ist-Stand in Phase 3.9 | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Vorlagen-Logik | Reines Modul `core/templates` (Zettel/Strang → Vorlage, Vorlage → Zettel/Strang, Vorschau). | 5.6 | Wie `core/graph`/`core/time` framewerkfrei und getestet. |
| Zeitfelder in Vorlagen | `startAt`/`endAt` werden verworfen; fehlt eine Schätzung, wird sie aus der Dauer abgeleitet. `dayStart`/`dayEnd` und `estimateMinutes` bleiben. | 5.6 | Wortlaut der SPEC. |
| „Strang als Vorlage" | Im Ablauf-Werkzeugmenü je Karte (⋯). | 5.6 | Der Strang ist die verbundene Komponente des gewählten ToDos (`extractStrand`). |
| Löschen mit Undo | Vorlagen-Löschen zeigt eine Snackbar mit **Rückgängig** (statt globalem Verlauf). | 5.6 | Der Undo-Verlauf der App gilt für Zettel; für Vorlagen genügt die Snackbar. |
| Vorlage in Zettel einfügen | Logik vorhanden (`insertTemplate`), UI folgt in Phase 3.12 (optional). | 5.6 (optional) | Als optional eingestuft. |
| Vorlage aus der Übersicht | „Zettel als Vorlage speichern" auch im ⋯-Menü der Zettel-Karte in der Übersicht. | 5.6 | Nutzerwunsch (Bugfix-Runde). |

## 6e. Bugfix-Runde nach Phase 3.10 (Nutzerwünsche)

| Thema | Ist-Stand | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Menünamen im Karten-⋯ | „Daneben aufteilen" → **„Nachfolgeaufgabe erstellen"** (en: *Create successor task*), „Daneben zusammenführen" → **„Voraufgabe erstellen"** (en: *Create predecessor task*). Die Operationen `addParallelAfter`/`addParallelBefore` bleiben unverändert. | 3.1/5.3/5.4 | Nutzerwunsch: verständlichere Bezeichnungen. Weicht vom SPEC-Wortlaut ab. |
| Kanten-„+" an Verzweigungen | Schichtabstand 72 → 128 px; alle Kanten-„+" sichtbar (siehe Kap. 6b). | 5.4 | Nutzerwunsch. |
| Vorlage aus der Übersicht | Neuer Menüpunkt in der Zettel-Übersicht (siehe Kap. 6d). | 5.6 | Nutzerwunsch. |
| ⋯-Menü in der Übersicht schließen | Klick/Tipp irgendwo außerhalb (oder erneut auf das Menü) schließt es, wie in „Jetzt dran". Ein Klick im Menüinhalt lässt es offen. | 5.2 | Nutzerwunsch; gleiches Verhalten wie in der Zettel-Ansicht. |


## 6f. Abweichungen/Präzisierungen aus Phase 3.11 – PWA

| Thema | Ist-Stand | SPEC-Referenz | Einordnung |
|---|---|---|---|
| Precache-Liste | **Nicht** in `sw.js` eingesetzt, sondern als `precache-manifest.json` daneben (erzeugt von `scripts/precache.mjs`). `sw.js` bleibt zwischen Builds byte-identisch. | 9.2 (Variante B: Liste „in `sw.js` einsetzen") | Ändert sich `sw.js`, installiert der Browser die neue Datei **von selbst** – das wäre ein Auto-Update (verboten laut 9.3). Mit unveränderter `sw.js` gibt es Updates nur über den ausdrücklichen Weg (`apply-update`). Durch Test 4c belegt. |
| Cache-Name | `faden-v1-<build>` plus `faden-meta` (vermerkt den aktiven Precache) statt nur `faden-v1`. | 9.2 | Nötig, damit ein neuer Precache vollständig neben dem alten geladen werden kann, bevor der alte gelöscht wird (9.3). |
| `install` bei vorhandenem Precache | Lädt nichts nach; die installierte Version bleibt. | 9.3 | Selbst ein absichtlich geändertes `sw.js` tauscht die App-Dateien nicht stillschweigend aus. |
| Update-Protokoll | SW versteht schon `check-update`/`apply-update` (Versionsvergleich, vollständiges Laden vor dem Umschalten). **Button in den Einstellungen folgt in 3.12.** | 9.3 (optional) | Die riskante Logik liegt im SW und ist jetzt schon so gebaut, dass Fehler die alte Version nie antasten. |
| App-Version | `APP_VERSION` per JSON-Import aus `package.json` (der Bundler übernimmt nur das Feld `version`). `package.json`-Version 0.0.0 → **0.1.0**. | 9.3 | Ein Ort für die Version; der Update-Vergleich braucht eine echte Versionsnummer. |
| Icons | Eigenes, ruhiges Motiv (drei verbundene Punkte von oben nach unten), Quelle `public/icons/icon.svg`; `scripts/generate-icons.mjs` rastert ohne Fremdpakete (PNG + ICO). Ersetzt das Angular-Standard-Favicon. | 9.1 | Keine Bildbibliothek nötig; die PNGs liegen im Repo, das Skript läuft nur bei Änderungen. |
| Manifest-Sprache | `lang: "en"` statt `"de"`. | 9.1 | Englisch ist Standardsprache (Kap. 6a). |
| PWA-Tests | **Automatisiert** (`npm run test:pwa`): Edge/Chrome headless über das DevTools-Protokoll + umschaltbarer Server; „nach mehreren Minuten" wird durch erzwungene Update-Prüfung abgedeckt (Details in `docs/PWA-TESTS.md`). | 9.4 | Wiederholbar statt nur Anleitung; keine Abhängigkeit (Node-WebSocket). Safari/iOS und Lighthouse-Accessibility bleiben manuelle Prüfungen. |

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

- **Phase 2 – Kernfunktion: abgeschlossen** (siehe Kap. 6b).
  - `core/graph/layout.ts` (deterministisches top-down Layered-Layout) + Tests.
  - `core/state/view.store.ts` (Ansicht je Zettel, persistiert in `meta`).
  - `features/list-detail`: `focus-view`, `flow-view`, `task-editor`,
    `connect-dialog`, `shortcut-help`; `list-detail-page` als Container mit
    Umschalter „Jetzt dran" / „Ablauf", Kopfzeile mit Undo/Redo/Menü und
    seitenweiten Tastenkürzeln.
  - i18n um `focus`/`editor`/`flow`/`shortcuts`/`errors`-Graph-Keys erweitert
    (`graph-error.ts` übersetzt `GraphError`).
  - Nachbesserungen (Nutzerwunsch): variable Kartenhöhen + gerade Pfeile im
    Ablauf, entzerrte „+"-Buttons (Trefferfläche 44 px), **transitive**
    „wartet"/„jetzt dran"-Logik, transitive Reduktion fürs Zeichnen, Abhaken
    direkt auf der Karte sowie Menü-Schließen per Klick auf die Diagrammfläche.
  - `npm test` = **74 Tests** grün; `ng build` (Produktion) ohne Warnungen.

- **Phase 3.8 – Timeboxing (UI): abgeschlossen** (siehe Kap. 6c).
  - `core/time` (rein, getestet): `format.ts` (Uhrzeiten/Dauern/Datum, lokalisiert),
    `status.ts` (Zeitstatus, nächster fälliger Schritt, Sortierung, Spannen),
    `plan.ts` (Validierung, Verschieben, Strecken, Vorschläge, Übertragen).
  - `core/state/now.store.ts` (minütliches `now`-Signal).
  - `features/list-detail`: Zeitfelder im `task-editor`, Zeit-Badges + „Nachträglich
    abhaken" + Tagesplan-Hinweis in `focus-view`, Zeit-Badge im `flow-view`,
    Schätz-Summen in der Kopfzeile, neuer `plan-editor`-Dialog.
  - Tests: `time.spec`, `now.store.spec`, `focus-view-time.spec`, `plan-editor.spec`,
    `task-editor.spec`; Test-Setup `src/test-setup.ts` (Dialog-Polyfill für jsdom).
  - `npm test` = **115 Tests** grün; `ng build` (Produktion) ohne Warnungen.

- **Phase 3.9 – Vorlagen: abgeschlossen** (siehe Kap. 6d).
  - `core/templates` (rein, getestet): Zettel/Strang → Vorlage, Vorlage → Zettel
    bzw. als neuer Strang einfügen (`insertTemplate`), Vorschau (`templatePreview`).
  - `TemplatesStore` um CRUD erweitert (`add`, `rename`, `remove`, `restore`).
  - `features/templates/templates-page`: Liste, Vorschau (topologische Titel),
    Umbenennen (Dialog), Löschen mit Undo-Snackbar, „Neuer Zettel aus Vorlage".
  - „Als Vorlage speichern": ganzer Zettel im Kopfmenü, Strang im Ablauf-Menü.
  - `npm test` = **121 Tests** grün; `ng build` (Produktion) ohne Warnungen.

- **Phase 3.10 – Backup & Speicher: abgeschlossen.**
  - `core/backup/backup.service.ts`: Export (`faden-backup-YYYY-MM-DD.json`,
    schreibt `lastBackupAt`), Teilen (`navigator.share` mit Datei),
    Import (validieren → Zusammenführen/Ersetzen mit automatischer Sicherung),
    wöchentliche Backup-Erinnerung (> 30 Tage), `storage.persist()` nach der
    ersten Nutzerinteraktion.
  - `settings-page`: Bereich „Sicherung und Daten" (Herunterladen/Teilen/
    Einspielen + „Letztes Backup"-Anzeige); „Dauerhaft schützen"-Button.
  - `lists-page`: einmal pro Woche wegklickbares Hinweisband mit
    „Sicherung erstellen".
  - Tests: `backup.service.spec.ts` (8); `npm test` = **129 Tests** grün;
    `ng build` (Produktion) ohne Warnungen.

- **Bugfix-Runde nach 3.10: abgeschlossen** (siehe Kap. 6e).
  - Längere Pfeile im Ablauf, Kanten-„+" an Verzweigungen wieder sichtbar.
  - Menüpunkte umbenannt (de + en).
  - Zettel-Übersicht: „Zettel als Vorlage speichern" + Menü schließt bei Klick
    außerhalb.
  - Tests: `lists-page.spec.ts` (3), `flow-view.spec.ts` angepasst;
    `npm test` = **132 Tests** grün; `ng build` (Produktion) ohne Warnungen.

- **Phase 3.11 – PWA: abgeschlossen** (siehe Kap. 6f).
  - `public/sw.js` (Variante B), `scripts/precache.mjs` (läuft in `npm run build`),
    `public/manifest.webmanifest`, Icons + `scripts/generate-icons.mjs`,
    `index.html` mit Manifest/Icons.
  - `core/pwa/pwa.service.ts`: Registrierung nur in Produktion,
    Installationsaufforderung, iOS-Hinweis (7-Tage-Löschung), „Offline bereit".
  - Einstellungen: Abschnitt „Installieren".
  - `scripts/pwa-test.mjs`: **9/9 Pflichttests bestanden** (`docs/PWA-TESTS.md`).
  - `npm test` = **132 Tests** grün; `npm run build` ohne Warnungen.

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
| 2026-10-14 | Phase 1.5 abgeschlossen und committet | Kap. 7 hier. |
| 2026-10-14 | Phase 2 abgeschlossen: „Jetzt dran"/„Ablauf", Editor, Verbinden, Tastatur | Kernfunktion laut Kap. 5.3–5.7; Abweichungen in Kap. 6b. |
| 2026-10-14 | Phase 2 committet; Timeboxing gehört zu Phase 3 | Nutzerwunsch: erst Phase 2 sichern, dann Phase 3 vollständig. |
| 2026-10-14 | Test-Setup `src/test-setup.ts` + `setupFiles` in `angular.json` | jsdom kennt `<dialog>.showModal()` nicht; Polyfill für Dialog-Komponententests. |
| 2026-10-14 | Phase 3.8 (Timeboxing) umgesetzt | Kern der Phase 3; Abweichungen in Kap. 6c. |
| 2026-10-14 | Phase 3.9 (Vorlagen) umgesetzt | Kap. 5.6; Abweichungen in Kap. 6d. |
| 2026-10-14 | Phase 3.10 (Backup & Speicher) umgesetzt | Kap. 8; `navigator.storage.persist()` nach erster Interaktion. |
| 2026-10-14 | Bugfix-Runde: längere Pfeile, neue Menünamen, Vorlage + Menü-Schließen in der Übersicht | Nutzerwünsche (Kap. 6e). |
| 2026-10-14 | Phase 3.11: eigener SW mit stabiler `sw.js` + separater Precache-Liste; PWA-Tests automatisiert, alle grün | Kap. 6f; keine Auto-Updates. |
