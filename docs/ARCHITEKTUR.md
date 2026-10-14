# Architektur

Technische Beschreibung der App „Faden". Fachliche Anforderungen stehen in
`SPEC.md`, getroffene Entscheidungen in `docs/DECISIONS.md`.

## 1. Überblick

„Faden" ist eine **offline-first Progressive Web App** (Angular 22, standalone,
**zoneless**, Signals). Es gibt **kein Backend**: Alle Daten liegen lokal in
**IndexedDB**. Nach einmaligem Hosten läuft die App dauerhaft aus dem
Service-Worker-Cache – auch wenn der Host verschwindet.

Kernidee: Ein ToDo wird als Knoten in einem gerichteten, azyklischen Graphen
(DAG) modelliert. Pfeile bedeuten „erst A, dann B". Die App berechnet daraus
jederzeit „**Jetzt dran**" (alle Vorgänger erledigt) und übernimmt so die
Objektpermanenz der restlichen Kette.

## 2. Schichten und Ordnerstruktur

```
src/app/
├─ app.ts / app.html / app.css      App-Shell (Kopfzeile, Navigation, Outlet)
├─ app.config.ts                    Provider: Router (Hash), FadenDb-Factory
├─ app.routes.ts                    Hash-Routen (lazy geladen)
├─ app-meta.ts                      App-Name + Version (einzige Namensquelle)
├─ core/
│  ├─ model.ts                      Datenmodell (SPEC 3.2) + Konstanten
│  ├─ i18n/                         Oberflächentexte + reaktiver Sprachzugriff
│  │  ├─ de.ts / en.ts              Wörterbücher (en = Standard)
│  │  ├─ types.ts                   Translations = typeof de (Vorlage)
│  │  ├─ dictionaries.ts            Registry + Englisch-Fallback
│  │  ├─ i18n.store.ts              Signals: locale, t(); pflegt <html lang>
│  │  └─ page-title.ts              lokalisierter Dokumenttitel
│  ├─ graph/                        REINE Graph-Logik (framewerkfrei)
│  │  ├─ validation.ts              Invarianten, Zyklen, GraphError, validateGraph
│  │  ├─ derive.ts                  Vorgänger/Nachfolger, isAvailable/isBlocked/…
│  │  ├─ ordering.ts                topologische Ordnung, Komponenten, Stränge
│  │  ├─ layout.ts                  deterministisches top-down Layered-Layout (SVG)
│  │  └─ operations.ts              insert*/addParallel*/connect/deleteTask
│  ├─ time/                         REINE Zeit-Logik (framewerkfrei, Phase 3)
│  │  ├─ format.ts                  Uhrzeiten/Dauern/Datum (lokalisiert)
│  │  ├─ status.ts                  Zeitstatus, nächster Schritt, Sortierung, Spannen
│  │  └─ plan.ts                    Validierung, Verschieben, Strecken, Vorschläge
│  ├─ templates/                    REINE Vorlagen-Logik (framewerkfrei, Phase 3)
│  │  └─ templates.ts               Zettel/Strang → Vorlage, Vorlage → Zettel/Strang
│  ├─ storage/                      Persistenz (IndexedDB, Migration, Backup)
│  │  ├─ db.ts                      dünner Promise-Wrapper um IndexedDB
│  │  ├─ migrations.ts              reine migrate()-Funktion
│  │  └─ backup.ts                  Export/Import + Validierung
│  ├─ backup/                       Backup-/Speicher-Service (Phase 3)
│  │  └─ backup.service.ts           Export/Import, Erinnerung, persist-Anfrage
│  └─ state/                        Reactive State (Signals)
│     ├─ history.ts                 generischer Undo/Redo-Verlauf (100 Schritte)
│     ├─ lists.store.ts             Zettel: CRUD, Persistenz, Tabs-Sync
│     ├─ templates.store.ts         Vorlagen
│     ├─ view.store.ts              Ansicht „Jetzt dran"/„Ablauf" je Zettel
│     ├─ now.store.ts               minütliches now-Signal (Timeboxing)
│     └─ settings.store.ts          Einstellungen (Theme, Sprache) + Anwendung
├─ features/
│  ├─ lists/                        Zettel-Übersicht (Phase 1, fertig)
│  ├─ list-detail/                  Zettel-Detail (Phase 2, fertig)
│  │  ├─ list-detail-page.ts        Container: Kopf, Umschalter, Tastatur, Dialoge
│  │  ├─ focus-view.ts              „Jetzt dran" (Karten, Ketten-Eingabe)
│  │  ├─ flow-view.ts               „Ablauf" (Layout, SVG-Pfeile, Pan/Zoom, „+")
│  │  ├─ task-editor.ts             Bearbeiten-Sheet (Titel/Notizen/Chips)
│  │  ├─ connect-dialog.ts          Ziel-Auswahl „Mit anderem ToDo verbinden"
│  │  ├─ plan-editor.ts             „Zeitplan bearbeiten" (verschieben/strecken/…)
│  │  └─ shortcut-help.ts           Tastenkürzel-Übersicht
│  ├─ templates/                    Vorlagen-Seite (Phase 3, fertig)
│  └─ settings/                     Einstellungen (Phase 1: Theme, Sprache, Version, Speicher)
└─ shared/
   └─ snackbar/                     nicht-modaler Hinweisband-Dienst + Komponente
```

**Schichtregel:** `core/graph` (und später `core/time`) sind **rein**: Eingabe →
neue Struktur, keine Mutation, kein Angular, keine Browser-APIs. Dadurch sind sie
vollständig unit-testbar und bilden das Herz der App.

## 3. Datenmodell

Definiert in `core/model.ts`, 1:1 zu `SPEC.md` 3.2:

- `TodoList` („Zettel") enthält `tasks`, `edges`, `timeboxMode`, `archived`,
  Zeitstempel und `sortOrder`.
- `Task` („ToDo") enthält optional Zeitfelder. **Wichtig:** Zeitfelder werden
  immer gespeichert und beim Moduswechsel **nicht** gelöscht.
- `Edge` („Pfeil"): `from` muss vor `to` erledigt sein.

**Zettel = ein IndexedDB-Record.** Tasks und Pfeile liegen gemeinsam im Dokument,
damit Schreibvorgänge atomar sind und Undo/Redo einfach bleibt.

**Kanten-IDs sind deterministisch** (`edgeId(from,to)`): Da Doppelpfeile verboten
sind, ist das Paar eindeutig. Das hält die Graph-Operationen rein und ohne
Zufallsquelle.

**Zeiten ohne Zeitzone:** `'2026-03-14T09:30'` (lokal). So verschieben
Sommer-/Winterzeit oder Reisen nichts.

## 4. Graph-Logik (`core/graph`)

Alle Funktionen sind rein und getestet (`graph.spec.ts`, 37 Tests).

- **Invarianten** (`validation.ts`): keine Zyklen (inkl. Selbstschleife), keine
  doppelten Pfeile, keine Pfeile zu unbekannten ToDos. `wouldCreateCycle` prüft
  per Erreichbarkeitssuche. Verstöße lösen `GraphError` mit Code aus; die UI
  formuliert daraus den freundlichen Text.
- **Ableitungen** (`derive.ts`): `predecessors`/`successors`, `isAvailable`
  („Jetzt dran"), `isBlocked` („Wartet auf …"), `isEarlyDone`, `isSplit`,
  `isJoin` (UND-Semantik), `progress`, `availableTasks`. „Jetzt dran"/„Wartet"
  werden **transitiv** bestimmt (`openAncestors`): Ist weiter oben in der Kette
  noch eine Vorarbeit offen, wartet alles darunter – auch wenn das direkte
  Mittelglied schon abgehakt ist.
- **Einfüge-Operationen** (`operations.ts`): `insertBefore`, `insertAfter`,
  `insertBetween`, `addParallelAfter/Before`, `addStandalone`, `connect`,
  `disconnect`, `deleteTask` (Standard „Überbrücken" oder „nur entfernen").
  `insertBefore`/`insertAfter` bauen alle betroffenen Pfeile um.
- **Reihenfolge/Komponenten** (`ordering.ts`): stabile topologische Ordnung
  (Gleichstand = Erstellungsreihenfolge), verbundene Komponenten („Stränge") via
  Union-Find, `extractStrand` für „Strang als Vorlage". `transitiveReduction`
  blendet Umweg-Pfeile (A→C trotz A→B→C) **nur fürs Zeichnen** aus – die Daten
  behalten alle Pfeile, die Erreichbarkeit bleibt gleich.

## 4a. Zeit-Logik (`core/time`)

Frameworkfrei und vollständig unit-getestet. Drei Dateien:

- **`format.ts`** – `parseHhMm`/`isValidHhMm`, `formatDuration` (de/en),
  `minutesToHhMm`, `formatDayLabel` (de/en via `Intl`), `toIsoDate`/`fromIsoDate`,
  `toDatetimeLocal`/`fromDatetimeLocal`, `roundToFiveMinutes`.
- **`status.ts`** – `plannedBounds` (kombiniert `dayPlanReferenceDate` mit
  `dayStart`/`dayEnd` bzw. nutzt `startAt`/`endAt`), `timeStatus`
  (`running`/`next`/`late`/`planned`), `earliestNextTask`, `sortPlannedFirst`
  (Reihenfolge Läuft → Überfällig → Als Nächstes → Geplant), `formatPlannedRange`,
  `plannedTimeParts`, `referenceRelation`, `todayIso`.
- **`plan.ts`** – `estimateSums`, `validateDayTimes`, `shiftPlan`,
  `stretchPlan`, `planBounds`, `transferDayTimesToList`, `proposeTimes`,
  `modeFields`.

Alle Funktionen sind **rein** (Eingabe → neue Struktur). Das minütliche `now`
liefert `core/state/now.store.ts` als Signal; die reinen Funktionen bekommen `now`
übergeben und bleiben dadurch testbar.

## 4b. Vorlagen-Logik (`core/templates`)

Ebenfalls frameworkfrei und getestet. `templates.ts`:

- `listToTemplate(list, title?)` – ganzer Zettel als Vorlage.
- `strandToTemplate(list, taskId, title?)` – Strang (`extractStrand`) als Vorlage.
- `templateToList(template)` – frischer Zettel mit **neuen IDs**, nichts erledigt.
- `insertTemplate(list, template)` – Vorlage als neuen Strang anhängen.
- `templatePreview(template)` – Titel in topologischer Reihenfolge.

Beim Erstellen einer Vorlage entfallen `done`/`doneAt`; `startAt`/`endAt` werden
verworfen (fehlt die Schätzung, wird sie aus der Dauer abgeleitet). `dayStart`/
`dayEnd` bleiben erhalten. Die Vorlagen-Seite nutzt einen `TemplatesStore` mit
CRUD und Undo-Snackbar beim Löschen.

## 5. Persistenz (`core/storage`)

- `FadenDb` ist ein dünner Promise-Wrapper um IndexedDB (Stores `lists`,
  `templates`, `settings`, `meta`). Er ist bewusst framework-frei und wird in
  `app.config.ts` per Factory bereitgestellt.
- Transaktionen werden erst **nach** dem Öffnen erzeugt und dann synchron
  befüllt, um den IndexedDB-Auto-Commit nicht zu verpassen.
- `migrate(data, fromVersion)` ist rein; `schemaVersion` wird ab Tag 1
  mitgeführt. Höhere Versionen werden abgelehnt.
- `backup.ts`: `createBackup` erzeugt das Export-Objekt
  `{ app, schemaVersion, exportedAt, settings, lists, templates }`;
  `validateBackup` prüft Schema, Version, Zyklen, Referenzen und lehnt
  ungültige Daten **komplett** ab (kein Teilimport); `applyImport` unterstützt
  **Zusammenführen** (neue IDs bei Kollision) und **Ersetzen**.
- **Backup-Service (`core/backup/backup.service.ts`, Phase 3.10):** Export
  (Download `faden-backup-YYYY-MM-DD.json`, schreibt `lastBackupAt`), Teilen
  (`navigator.share` mit Datei, falls verfügbar), Import (validieren →
  Zusammenführen/Ersetzen; bei Ersetzen vorher automatisches Sicherungs-Download),
  Backup-Erinnerung (> 30 Tage, einmal pro Woche wegklickbar), erstes
  `navigator.storage.persist()` nach Nutzerinteraktion.

## 6. State (`core/state`)

- **Signals** als einzige Zustandsquelle. `computed` leitet ab (z. B. aktive vs.
  archivierte Zettel).
- **Undo/Redo** (`history.ts`), jeweils Obergrenze 100, Redo wird nach neuer
  Änderung verworfen:
  - `History<TodoList>` **pro Zettel**: `ListsStore.editList` schiebt vor jeder
    Änderung im Zettel einen Schnappschuss; `undo(listId)` setzt ihn zurück
    (Archiv-Status und Reihenfolge bleiben).
  - `CommandHistory` für die **Übersicht**: Anlegen, Duplizieren, Umbenennen,
    Archivieren, Löschen, Verschieben und Import sind Befehle mit `undo`/`redo`,
    die nur ihre eigene Wirkung umkehren. `undo()` ohne ID gilt der Übersicht.
  - `canUndo(listId?)`/`canRedo(listId?)` sind über ein internes Zähl-Signal
    reaktiv.
- **Löschen** ist ein Soft-Delete (`TodoList.deletedAt`): sofort unsichtbar,
  gespeichert, nach `DELETE_GRACE_MS` (10 s) endgültig entfernt; beim Start
  werden Reste früherer Sitzungen aufgeräumt.
- **Schreiben:** Änderungen landen sofort im Signal und werden **entprellt
  (~300 ms)** sowie **sofort bei `visibilitychange: hidden`/`pagehide`** nach
  IndexedDB geschrieben (`flush()`). Fehler setzen `saveError` und zeigen ein
  ruhiges Banner.
- **Mehrere Tabs:** `BroadcastChannel('faden')` meldet Änderungen; andere Tabs
  laden neu, wenn `updatedAt` neuer ist. Zusätzlich Neuladen bei `focus`.

## 7. Oberfläche

- **Hash-Routing** (`withHashLocation()`), `base href="./"`: läuft auf jedem
  statischen Host ohne Rewrite-Regeln und startet aus dem Cache.
- **Englisch-first** (Standard), Deutsch umschaltbar: alle Texte in
  `core/i18n/*.ts`, Zugriff reaktiv über `I18nStore.t()`.
- **Reizarm**: gedämpfte CSS-Variablen-Tokens, Hell/Dunkel/System,
  `prefers-reduced-motion`, Zustände immer über **Icon + Text + Farbe**.
- **Barrierefreiheit**: Tippflächen ≥ 48 px, sichtbare Fokusrahmen, native
  `<dialog>`-Elemente (Fokusfalle, Esc), Snackbar mit `aria-live="polite"`.

### 7.1 Zettel-Detail: „Jetzt dran" und „Ablauf"

`list-detail-page` ist der Container: Kopfzeile (Zurück, Titel, Fortschritt,
Undo/Redo, Menü), der Umschalter **„Jetzt dran" | „Ablauf"** (Wahl je Zettel im
`ViewStore` gemerkt) und die seitenweiten Tastenkürzel (`Strg/Cmd+Z`,
`Strg/Cmd+Shift+Z`, `Strg+Y`, `?`). Die beiden Ansichten und alle Dialoge
(`task-editor`, `connect-dialog`, `shortcut-help`) hängen als Kinder darunter.

- **„Jetzt dran"** (`focus-view`) zeigt **nur** `isAvailable`-ToDos als große
  Karten. Der wichtigste Pfad ist „Erst noch etwas anderes nötig …"
  (`insertBefore`) mit sofortigem Eingabefeld und **Enter-Kette**; mehrzeilig
  eingefügter Text wird zu einer Kette. Danach ist die neue Vorarbeit sofort das
  einzige „Jetzt dran". Dazu: großer „Erledigt"-Button (Undo-Snackbar), dezente
  „Danach: …"/„Außerdem …"-Hinweise, Mehr-Menü und die eingeklappte, gesperrte
  Restliste („Danach kommt noch …") als **lineare, zugängliche Alternative** zum
  Diagramm. Das ⋯-Menü (`<details class="menu">`) schließt ein Host-Listener auf
  `(document:click)` beim Klick außerhalb **oder auf dem `<details>`-Element
  selbst** (Fläche neben der als `inline-flex` schrumpfenden Zusammenfassung);
  nur Klicks im Menüinhalt bleiben offen. Der Handler liefert bei der
  Zusammenfassung `preventDefault`, damit die native Kippbewegung das Menü
  nicht sofort wieder öffnet.
- **„Ablauf"** (`flow-view`) rendert den ganzen Zettel als Diagramm: Positionen
  aus `layout.ts` (rein/deterministisch), Karten als HTML, Pfeile als SVG,
  beides zusammen in einem per CSS-Transform verschobenen/gezoomten Container
  (Pan/Zoom 40–200 %, Buttons „+"/„−"/„Einpassen"/„Zum aktuellen ToDo"). „+" über
  jeder Karte am Strang-Anfang, unter jeder Karte am Strang-Ende **und an
  Verzweigungen** (dort ersetzt es die überlagernden Kanten-„+"; Einfügen =
  Engpass-Einfügung, alle bisherigen Nachfolger hängen danach vom neuen Knoten
  ab), **auf** jeder Kante, Karten- und Kanten-Menüs, Verbinden per Dialog.
  Zustände immer als **Icon + Text + Farbe**.
- **Bearbeiten** (`task-editor`): Titel, Notizen und Vorgänger-/Nachfolger-Chips
  mit „+ hinzufügen"/„×" – alle Verbindungen auch ohne Drag bedienbar.
- Beide Ansichten bekommen den Zettel über `input()` und melden Aktionen über
  `output()` (`edit`, `connectRequest`) an den Container; die Datenänderungen
  laufen ausschließlich über `ListsStore.editList()` (ein Undo-Schritt, und bei
  `GraphError` bleibt der Zustand unverändert).

## 8. PWA und Service Worker

**Entscheidung: eigener, minimaler Service Worker** (Variante B) statt
`@angular/service-worker`, weil ngsw bei HTTP 404 auf `ngsw.json` alle Caches
löscht und sich deregistriert (Details in `docs/DECISIONS.md`).

Bausteine:

| Datei | Aufgabe |
|---|---|
| `public/sw.js` | Service Worker. **Zwischen Builds byte-identisch**, damit der Browser nie von selbst ein Update installiert. |
| `scripts/precache.mjs` | Läuft nach `ng build` (`npm run build`) und schreibt `precache-manifest.json`: `{ app, version, build, files: [{ url, rev }] }` (SHA-256 je Datei, `build` = Hash über alle). |
| `public/manifest.webmanifest`, `public/icons/*`, `public/favicon.ico` | Web-App-Manifest und Icons (192, 512, maskable 512, apple-touch 180). |
| `scripts/generate-icons.mjs` | Rastert die Icon-Geometrie (Quelle: `public/icons/icon.svg`) ohne Fremdpakete zu PNG/ICO (`npm run icons`). |
| `core/pwa/pwa.service.ts` | Registriert `./sw.js` (nur Produktion, nach `load`), fängt `beforeinstallprompt` ab, erkennt iOS und installierten Modus, fragt den SW nach dem Precache-Status („Offline bereit"). |
| `scripts/pwa-test.mjs` | Automatisierte Pflichttests (SPEC 9.4), siehe `docs/PWA-TESTS.md`. |

Ablauf im Service Worker:

- `install`: Gibt es schon einen vollständigen Precache, passiert nichts (kein
  stilles Update). Sonst `precache-manifest.json` holen (`no-store`),
  streng prüfen und jede Datei mit `cache: 'reload'` in den **neuen** Cache
  `faden-v1-<build>` laden. Nur wenn **jede** Datei HTTP 200 (ohne
  Weiterleitung) liefert, wird der Cache in `faden-meta` als aktiv vermerkt;
  andernfalls wird nur der neue, unvollständige Cache verworfen.
- `activate`: `clients.claim()`; **niemals** Caches löschen.
- `fetch` (nur GET, gleiche Herkunft): Cache-first aus dem aktiven Precache;
  Navigationen bekommen die gecachte `index.html`; Netzwerk nur bei Cache-Miss.
- `message`: `status` (aktiver Precache), sowie `check-update` /
  `apply-update` für die nutzergesteuerte Update-Prüfung (SPEC 9.3, UI in 3.12).
  Ein alter Precache wird erst gelöscht, wenn der neue vollständig geladen ist.

404, 500, Captive-Portal-HTML oder ein abgeschalteter Server lassen
Registrierung und Caches unberührt: Die Update-Prüfung des Browsers auf
`sw.js` schlägt dann einfach fehl, und der bestehende Worker bleibt aktiv.

## 9. Entwickeln, Testen, Bauen

```bash
npm install        # Abhängigkeiten
npm start          # Dev-Server (http://localhost:4200)
npm test           # Unit-Tests (Vitest)
npm run build      # Produktionsbuild + Precache-Liste nach dist/faden/browser
npm run test:pwa   # PWA-/Offline-Pflichttests gegen den Produktionsbuild
npm run icons      # Icons neu erzeugen (nur nach Änderung am Icon)
```

Wichtig: `npm run build` statt nur `ng build` verwenden – ohne
`precache-manifest.json` installiert sich der Service Worker nicht (die App läuft
dann normal, aber nicht offline).

„Einmal hosten": den Inhalt von `dist/faden/browser` auf einen beliebigen
HTTPS-Host legen (Unterverzeichnis egal), die Seite einmal laden, warten bis die
Einstellungen „Offline bereit" zeigen, und installieren. Danach darf der Host
verschwinden.

Die Komponententests laufen unter jsdom. Da jsdom `<dialog>.showModal()` nicht
kennt, ergänzt `src/test-setup.ts` (verdrahtet über `setupFiles` in
`angular.json`) minimale `show`/`showModal`/`close`-Polyfills.

## 10. Abhängigkeiten

Bewusst minimal: Angular + RxJS + tslib. Kein Layout-Framework, keine
IndexedDB-Bibliothek, kein UI-Kit. `@angular/cdk` ist erlaubt, wenn konkrete
Komponenten (Overlay/Fokus/Drag) es rechtfertigen. Keine Laufzeit-Requests zu
Fremddomains.
