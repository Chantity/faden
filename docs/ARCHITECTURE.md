# Architektur

Technische Beschreibung der App „Faden" samt der technischen Entscheidungen und
ihrer Begründung. Wofür die App da ist und nach welchen Regeln sie gebaut wird,
steht in `docs/DESIGN-PRINCIPLES.md`; die Bedienung in `docs/USER-GUIDE.md`.

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
│  ├─ model.ts                      Datenmodell + Konstanten, eindeutige Namen
│  ├─ checklist.ts                  Beschreibung: Checkliste ↔ Text (rein)
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
│  │  ├─ plan.ts                    Validierung, Verschieben, Strecken, Vorschläge
│  │  └─ relative.ts                Pause am Pfeil, Einfügen mit relativen Zeiten
│  ├─ keymap.ts                     REINE Tastenkürzel-Logik (Standard, eigene Belegung, Konflikte)
│  ├─ preferences.ts                Einstellungen ab 2.2: Notiz-Standard, erledigte Zettel, einfacher Modus
│  ├─ color-scheme.ts               REINE Farbschema-Logik (Standard „Salbei“, Ableitung, Kontrast, Prüfung)
│  ├─ tour.ts                       REINE Tour-Schritte (Ziel, wann erledigt)
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
│     └─ settings.store.ts          Einstellungen (Theme, Sprache, einfacher Modus, Farbschemata …) + Anwendung
├─ features/
│  ├─ lists/                        Zettel-Übersicht (Phase 1, fertig)
│  ├─ list-detail/                  Zettel-Detail (Phase 2, fertig)
│  │  ├─ list-detail-page.ts        Container: Kopf, Umschalter, Tastatur, Dialoge
│  │  ├─ focus-view.ts              „Jetzt dran" (Karten, Ketten-Eingabe)
│  │  ├─ flow-view.ts               „Ablauf" (Layout, SVG-Pfeile, Pan/Zoom, „+")
│  │  ├─ task-editor.ts             Bearbeiten-Sheet (Titel/Notizen/Chips)
│  │  ├─ plan-editor.ts             „Zeitplan bearbeiten" / „Ab hier / Strang verschieben"
│  │  └─ shortcut-help.ts           Tastenkürzel-Übersicht
│  ├─ templates/                    Vorlagen-Seite (Phase 3, fertig)
│  ├─ settings/                     Einstellungen; advanced-page.ts = „Für Fortgeschrittene“,
│  │                                scheme-section.ts / scheme-editor-page.ts = Farbschemata
│  └─ about/                        Tab „Über“: Version, Hilfe (Tour, Anleitung), Speicher
└─ shared/
   ├─ menus.ts                      gemeinsames Schließen aller ⋯-Menüs (Klick, Esc)
   ├─ focus.ts                      focusAfterRender (Fokus in neu erscheinende Felder)
   ├─ language-picker.ts            Sprachwahl (Einstellungen, Start-Dialog)
   ├─ first-run/                    Erst-Start: Speicher-Hinweis → Sprache + Tour/Anleitung anbieten (FirstRunStore)
   ├─ guide/                        Anleitungs-Dialog (lädt guide/{guide,changelog}.{en,de}.html, setzt Anker)
   ├─ tour/                         Geführte Tour: TourService (Schritte, Übungszettel) + TourOverlay (Hinweis)
   ├─ install-banner/               Hinweis „Als App installieren" (erst nach first-run)
   └─ snackbar/                     nicht-modaler Hinweisband-Dienst + Komponente
```

**Schichtregel:** `core/graph` (und später `core/time`) sind **rein**: Eingabe →
neue Struktur, keine Mutation, kein Angular, keine Browser-APIs. Dadurch sind sie
vollständig unit-testbar und bilden das Herz der App.

## 3. Datenmodell

Definiert in `core/model.ts`:

- `TodoList` („Zettel") enthält `tasks`, `edges`, `timeboxMode`, `archived`,
  Zeitstempel und `sortOrder`.
- `Task` („ToDo") enthält optional Zeitfelder. **Wichtig:** Zeitfelder werden
  immer gespeichert und beim Moduswechsel **nicht** gelöscht.
  - **Start + Dauer** (Schema 3): `estimateMinutes` ist in allen Modi die Dauer
    (Schätzung bzw. Plan-Dauer), der Start ist `dayStart` (`HH:mm`, Tagesplan)
    bzw. `startAt` (fester Zeitplan). Das **Ende wird berechnet**
    (`plannedBounds`), nie gespeichert – so können Start und Dauer nie
    widersprüchlich werden, und Verschieben ändert nur Starts.
  - **Beschreibung:** Freitext `notes` **oder** `checklist`
    (`{ id, text, done }[]`, höchstens 100 Punkte); gespeichert ist immer nur
    eine der beiden Formen.
- `Edge` („Pfeil"): `from` muss vor `to` erledigt sein.
- **Zettel-Namen sind eindeutig** (getrimmt, ohne Groß-/Kleinschreibung,
  `titleKey`); automatisch entstehende Namen macht `uniqueTitle` mit „ (2)“,
  „ (3)“ … eindeutig.

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

Frameworkfrei und vollständig unit-getestet. Vier Dateien:

- **`format.ts`** – `parseHhMm`/`isValidHhMm`, `formatDuration` (de/en),
  `minutesToHhMm`, `formatDayLabel` (de/en via `Intl`), `toIsoDate`/`fromIsoDate`,
  `toDatetimeLocal`/`fromDatetimeLocal`, `toLocalIso`, `roundToFiveMinutes`.
- **`status.ts`** – `plannedBounds` (Start aus `dayStart` + Bezugstag bzw.
  `startAt`; Ende = Start + `estimateMinutes`), `timeStatus`
  (`running`/`next`/`late`/`planned`), `earliestNextTask`, `sortPlannedFirst`
  (Reihenfolge Läuft → Überfällig → Als Nächstes → Geplant), `formatPlannedRange`,
  `plannedTimeParts`, `referenceRelation`, `todayIso`.
- **`plan.ts`** – `estimateSums`, `validateDayTimes`, `shiftPlan` (optional nur
  für einen Bereich, z. B. einen Strang; rechnet in lokalen Uhrzeit-Feldern, damit
  „+1 Tag“ über die Zeitumstellung dieselbe Uhrzeit behält), `shiftLeavesDay`
  (Tagesplan: nichts über 0:00/24:00 hinaus), `stretchPlan`, `planBounds`,
  `transferDayTimesToList`, `proposeTimes`, `modeFields`.
- **`relative.ts`** – `taskSpan`, `pauseBetween` (Pause am Pfeil),
  `startFields` (Zeitpunkt → `dayStart`/`startAt`), `relativeContext` und
  `placeRelative` (Einfügen mit relativen Zeiten). `relativeContext` fügt
  probeweise ein und liest daraus Vorgänger/Nachfolger des neuen ToDos ab – so
  gilt dieselbe Logik für jede Einfüge-Position (davor, danach, dazwischen,
  aufteilen, zusammenführen), und mitgerückt wird über `reachableIds` nur im
  eigenen Strang. Das Sheet wendet Einfügen und Verschieben in **einem**
  `editList` an (ein Undo-Schritt).

Alle Funktionen sind **rein** (Eingabe → neue Struktur). Das minütliche `now`
liefert `core/state/now.store.ts` als Signal; die reinen Funktionen bekommen `now`
übergeben und bleiben dadurch testbar.

## 4a2. Tastenkürzel (`core/keymap.ts`)

Frameworkfrei und getestet (`keymap.spec.ts`). Jede Aktion gehört zu einem
**Bereich**: `focus` („Jetzt dran“), `flow` (Ablauf, nur auf einer fokussierten
Karte) oder `global` (überall im Zettel). `DEFAULT_KEYMAP` ist die
Standardbelegung; `AppSettings.keymap` speichert **nur Abweichungen**
(`SettingsStore.keymap` = Standard + eigene). `actionFor(event, keymap,
scopes)` ersetzt alle früheren Tasten-Vergleiche in `focus-view`, `flow-view`
und `list-detail-page`. Regeln: Strg und Cmd gelten gleich; Umschalt zählt bei
Buchstaben und benannten Tasten, nicht bei Zeichen wie „?“ (je nach
Tastaturlayout nötig); Tab und Esc sind reserviert; `conflictFor` verhindert
Doppelbelegungen in Bereichen, die zugleich aktiv sein können (`global`
überschneidet sich mit allen). Die Seite `einstellungen/fortgeschritten`
nimmt neue Tasten auf; die Tastenkürzel-Hilfe zeigt die aktuelle Belegung.

## 4a3. Einfacher Modus, Farbschemata, Tour (ab 2.2)

- **Einfacher Modus** (`core/preferences.ts`): `AppSettings.simpleMode =
  { enabled, show? }`. `SIMPLE_FEATURES` zählt auf, was er einschränkt;
  `show[feature] = true` blendet einzelnes wieder ein.
  `SettingsStore.simple()(feature)` ist die **einzige** Abfrage, die
  Komponenten stellen (Menüs, Zeitplanungs-Modi, Tabs, Bearbeiten-Dialog). Fehlt
  die Angabe, entscheidet der Erst-Start: neue Installation → an, vorhandene
  Daten → aus. Die Entscheidung steht im Meta-Eintrag `simpleModeDefault`, nicht
  in den Einstellungen – so überschreibt der Erst-Start nie gleichzeitig
  gespeicherte Einstellungen. Im Bearbeiten-Dialog bietet ein einzelnes Dropdown
  nur „freie Enden“ an (`singleLinkOptions` in `core/graph/derive.ts`: kein
  Nachfolger bzw. Vorgänger, kein Kreis); so entsteht keine Verzweigung.
  Verzweigte Daten (Import, Vorlagen) zeigen weiter die Chip-Liste.
- **Farbschemata** (`core/color-scheme.ts`): Ein Schema legt drei Rollen fest
  (Primär, Auswahl, Fokus), je hell/dunkel. `schemeProperties` leitet daraus die
  CSS-Variablen ab (`--color-primary-strong`, `--color-accent-soft` usw. per
  `color-mix()`, `--color-on-primary` per Kontrast), `contrastIssues` liefert
  ruhige Hinweise (WCAG 3:1 bzw. 4.5:1). Das Standardschema „Salbei“ ist nur
  `styles.css` (+ `DEFAULT_SCHEME` als Vorlage fürs Duplizieren) und wird nie
  gespeichert; eigene Schemata setzt `SettingsStore` als Inline-Variablen auf
  `<html>`. Warn- und Gefahrfarben sowie Flächen gehören bewusst nicht dazu.
- **Geführte Tour** (`core/tour.ts`, `shared/tour/`): Schritte sind Daten (Ziel-
  Selektor, `done`-Bedingung auf Stores). Der `TourService` geht weiter, sobald
  `done` erfüllt ist, und merkt sich den Übungszettel. Der `TourOverlay` ist
  nicht modal (die App bleibt bedienbar), steht auf der dem Ziel abgewandten
  Seite, weicht offenen Dialogen sofort (MutationObserver auf `open`) und hebt
  das Ziel hervor (`.tour-target`). `localStorage['faden.tourActive']` erkennt
  eine abgebrochene Tour: Beim nächsten Start bietet der Start-Dialog sie erneut
  an.

## 4b. Vorlagen-Logik (`core/templates`)

Ebenfalls frameworkfrei und getestet. `templates.ts`:

- `listToTemplate(list, title?)` – ganzer Zettel als Vorlage.
- `strandToTemplate(list, taskId, title?)` – Strang (`extractStrand`) als Vorlage.
- `templateToList(template)` – frischer Zettel mit **neuen IDs**, nichts erledigt.
- `insertTemplate(list, template)` – Vorlage als neuen Strang anhängen.
- `templatePreview(template)` – Titel in topologischer Reihenfolge.

Beim Erstellen einer Vorlage entfallen `done`/`doneAt` (auch die Haken einer
Checkliste) und das Datum `startAt`. Dauer und Tageszeit `dayStart` bleiben
erhalten. Die Vorlagen-Seite nutzt einen `TemplatesStore` mit CRUD und
Undo-Snackbar beim Löschen.

## 5. Persistenz (`core/storage`)

- `FadenDb` ist ein dünner Promise-Wrapper um IndexedDB (Stores `lists`,
  `templates`, `settings`, `meta`). Er ist bewusst framework-frei und wird in
  `app.config.ts` per Factory bereitgestellt.
- Transaktionen werden erst **nach** dem Öffnen erzeugt und dann synchron
  befüllt, um den IndexedDB-Auto-Commit nicht zu verpassen.
- `migrate(data, fromVersion)` ist rein; `schemaVersion` wird ab Tag 1
  mitgeführt. Höhere Versionen werden abgelehnt. Aktuell: **Schema 3**.
  - 1 → 2: `AppSettings.language` (Standard Englisch).
  - 2 → 3: Ende → Dauer (`upgradeList`: Dauer = Ende − Start; der Plan des
    aktiven Modus gewinnt gegen eine abweichende Schätzung; nur ein Ende →
    Start = Ende − Dauer, Standard 15 Min) und eindeutige Zettel-Namen
    (`upgradeLists`, der ältere Zettel behält den Namen).
  - Die Schritte für Zettel/Vorlagen sind **idempotent** und laufen deshalb
    nicht nur beim Backup-Import, sondern auch bei jedem Laden aus IndexedDB
    (`ListsStore.load`, `TemplatesStore.load`); geänderte Datensätze werden
    sofort zurückgeschrieben.
- `backup.ts`: `createBackup` erzeugt das Export-Objekt
  `{ app, schemaVersion, exportedAt, settings, lists, templates }`;
  `validateBackup` prüft Schema, Version, Zyklen, Referenzen und lehnt
  ungültige Daten **komplett** ab (kein Teilimport); `applyImport` unterstützt
  **Zusammenführen** und **Ersetzen**. Beim Zusammenführen entscheidet
  `resolveConflicts(local, incoming, strategy)` über gleichnamige Zettel
  (`findConflicts`, Vergleich wie `titleKey`): `suffix` („Name (2)“),
  `overwrite` (ID und Position bleiben), `skip` oder `newer` (nach `updatedAt`,
  Gleichstand = überspringen); neue Zettel bekommen bei ID-Kollision eine neue
  ID und immer einen eindeutigen Namen. Die Funktion ist bewusst unabhängig von
  der Oberfläche, damit ein späterer Sync sie wiederverwenden kann. Der
  Backup-Service lädt vor `overwrite`/`newer` mit Konflikten automatisch eine
  Sicherung herunter.
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
  Neu geladen wird **nur, wenn der gespeicherte Stand neuer ist** als der im
  Speicher: Ein älterer Stand ist der eigene, noch nicht entprellt
  geschriebene (bis 300 ms), und hat früher bei einem Fensterwechsel in dieser
  Lücke frische Eingaben überschrieben (Datenverlust-Bug bis 1.0.0, gefunden
  durch den Tastatur-Abnahmetest).

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
(`task-editor`, `shortcut-help`, `plan-editor` …) hängen als Kinder darunter. Ein
leerer Zettel öffnet beim Aufrufen einmal von selbst „Neues ToDo“.

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
  ab), **auf** jeder Kante, Karten- und Kanten-Menüs. Verbunden wird im
  Bearbeiten-Dialog (der frühere Verbinden-Dialog entfiel mit 2.2).
  Zustände immer als **Icon + Text + Farbe**.
- **ToDo-Sheet** (`task-editor`) zum **Anlegen und Bearbeiten**: Titel,
  Beschreibung (Text oder Checkliste, Umwandlung über `core/checklist.ts`),
  Zeitfelder; beim Bearbeiten Vorgänger-/Nachfolger-Chips mit „+ hinzufügen"/„×"
  (alle Verbindungen auch ohne Drag bedienbar).
  - Die Ansichten legen nicht selbst an, sondern melden über `output()` eine
    `CreateRequest` (`{ position: InsertPosition, chain }`); der Container
    öffnet damit `TaskEditor.create()`. `insertAt` (`core/graph`) setzt die
    Position in die passende Einfüge-Operation um.
  - **Enter-Kette** (`chain`): Enter legt an und öffnet das Sheet sofort leer
    für das nächste ToDo (`nextInChain`: Vorarbeiten weiter davor, sonst
    danach). „Jetzt dran" legt immer als Kette an, der Ablauf einzeln.
    Mehrzeilig eingefügter Text wird zu einer Kette.
  - Nach dem Schließen landet der Fokus beim nächsten „Erledigt", falls der
    Auslöser (z. B. die von einer neuen Vorarbeit verdrängte Karte) weg ist.
- Beide Ansichten bekommen den Zettel über `input()` und melden Aktionen über
  `output()` (`edit`, `connectRequest`) an den Container; die Datenänderungen
  laufen ausschließlich über `ListsStore.editList()` (ein Undo-Schritt, und bei
  `GraphError` bleibt der Zustand unverändert).

## 8. PWA und Service Worker

**Entscheidung: eigener, minimaler Service Worker** statt
`@angular/service-worker` (ngsw). Begründung (verifiziert): ngsw ruft beim
Update-Check `ngsw.json` ab. Liefert der Server darauf **HTTP 404**, löscht ngsw
**alle Caches und deregistriert sich selbst** (`fetchLatestManifest` →
`deleteAllCaches()` + `unregister()`). Das ist laut Angular bewusstes Design und
nicht abschaltbar (https://angular.dev/ecosystem/service-workers/devops,
https://github.com/angular/angular/issues/51337). Genau dieser Fall – „Host
abgeschaltet, Domain antwortet mit 404" – würde „einmal hosten, nie wieder"
zerstören; ngsw fiel deshalb durch die PWA-Pflichttests.

**`public/sw.js` wird nie aus kosmetischen Gründen geändert** (auch nicht seine
Kommentare): Jede Änderung an der Datei installiert der Browser bei bestehenden
Nutzern selbstständig als neuen Worker. Das ist zwar abgesichert (siehe
`install` unten), widerspricht aber dem Grundsatz „keine Auto-Updates".
Die Kommentare dort verweisen deshalb noch auf die frühere `SPEC.md` bzw.
`docs/DECISIONS.md` (mit v2 entfernt; Inhalt jetzt hier und in
`docs/DESIGN-PRINCIPLES.md`).

Bausteine:

| Datei | Aufgabe |
|---|---|
| `public/sw.js` | Service Worker. **Zwischen Builds byte-identisch**, damit der Browser nie von selbst ein Update installiert. |
| `scripts/precache.mjs` | Läuft nach `ng build` (`npm run build`) und schreibt `precache-manifest.json`: `{ app, version, build, files: [{ url, rev }] }` (SHA-256 je Datei, `build` = Hash über alle). |
| `public/manifest.webmanifest`, `public/icons/*`, `public/favicon.ico` | Web-App-Manifest und Icons (192, 512, maskable 512, apple-touch 180). |
| `scripts/generate-icons.mjs` | Rastert die Icon-Geometrie (Quelle: `public/icons/icon.svg`) ohne Fremdpakete zu PNG/ICO (`npm run icons`). |
| `core/pwa/pwa.service.ts` | Registriert `./sw.js` (nur Produktion, nach `load`), fängt `beforeinstallprompt` ab, erkennt iOS und installierten Modus, fragt den SW nach dem Precache-Status („Offline bereit"). |
| `scripts/pwa-test.mjs` | Automatisierte Pflichttests, siehe `docs/PWA-TESTS.md`. |
| `scripts/guide.mjs`, `scripts/lib/markdown.mjs` | Läuft vor `ng build` und `ng serve`: wandelt `docs/USER-GUIDE.md` und `CHANGELOG.md` mit einem eigenen kleinen Konverter (nur die genutzten Elemente, Zitate als Kästen „Am PC / Auf dem Handy“, keine Abhängigkeit; Tests mit `npm run test:scripts`) je Sprache in die Fragmente `public/guide/{guide,changelog}.{en,de}.html` um (`splitLanguages` trennt an `## English` / `## Deutsch`; der `GuideDialog` lädt die Datei der eingestellten Sprache und wechselt bei offenem Dialog mit) und kopiert `docs/images/`. Nicht eingecheckt; über den Build im Precache, also offline lesbar. |

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
  `apply-update` für die nutzergesteuerte Update-Prüfung (Einstellungen → „Nach neuer
  Version suchen").
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
npm run test:acceptance  # Abnahme: Tastatur, Responsive, Reizarm (docs/ACCEPTANCE.md)
npm run test:scripts     # Tests der Build-Skripte (Anleitungs-Konverter, node --test)
npm run icons      # Icons neu erzeugen (nur nach Änderung am Icon)
npm run screenshots      # Bilder der Anleitung neu erzeugen (nach npm run build)
```

**Screenshots der Anleitung** (`scripts/screenshots.mjs`): spielt je Sprache
eigene Testdaten in IndexedDB ein, steuert die App per CDP und speichert
zugeschnittene WebP-Bilder nach `docs/images/{en,de}/` – Handyformat 360 px,
vom Desktop (1280 px) nur der Ablauf mit Seitenleiste. Einfache Pixeldichte,
damit die Bilder auf GitHub und in der App so groß erscheinen wie auf dem
Gerät. Das Skript bricht mit Fehler ab, wenn alle Bilder zusammen größer als
1,5 MB sind (sie landen im Precache). Nach Änderungen an der Oberfläche neu
erzeugen und die Bilder sichten.

Wichtig: `npm run build` statt nur `ng build` verwenden – ohne
`precache-manifest.json` installiert sich der Service Worker nicht (die App läuft
dann normal, aber nicht offline).

„Einmal hosten": den Inhalt von `dist/faden/browser` auf einen beliebigen
HTTPS-Host legen (Unterverzeichnis egal), die Seite einmal laden, warten bis die
Einstellungen „Offline bereit" zeigen, und installieren. Danach darf der Host
verschwinden.

Die Browser-Tests (`scripts/pwa-test.mjs`, `scripts/acceptance-test.mjs`)
teilen sich `scripts/lib/browser.mjs`: statischer Server, Chromium headless über
das DevTools-Protokoll (Node-WebSocket, keine Fremdpakete), echte Tastendrücke,
kleiner Test-Runner.

**Fokus:** Ohne Zone.js wird ein Element, das durch eine Änderung erst
erscheint, nicht im selben Microtask gerendert. Fokus daher immer über
`focusAfterRender` (`shared/focus.ts`, `afterNextRender`).

Die Komponententests laufen unter jsdom. Da jsdom `<dialog>.showModal()` nicht
kennt, ergänzt `src/test-setup.ts` (verdrahtet über `setupFiles` in
`angular.json`) minimale `show`/`showModal`/`close`-Polyfills.

## 10. Abhängigkeiten

Bewusst minimal: Angular + RxJS + tslib. Kein Layout-Framework, keine
IndexedDB-Bibliothek, kein UI-Kit. `@angular/cdk` ist erlaubt, wenn konkrete
Komponenten (Overlay/Fokus/Drag) es rechtfertigen. Keine Laufzeit-Requests zu
Fremddomains.

## 11. Technische Entscheidungen (Kurzfassung)

Übernommen aus dem früheren Entscheidungsprotokoll (bis v1.0.0). Neue
Entscheidungen werden hier ergänzt.

| Thema | Entscheidung | Begründung |
|---|---|---|
| Graph-Layout | Eigenes deterministisches top-down Layered-Layout statt `@dagrejs/dagre`. Kartenhöhe **variabel** (1–3 Titelzeilen, geschätzt über `nodeCharsPerLine`, gespiegelt per `line-clamp`); die nächste Schicht beginnt unter der höchsten Karte. Schichtabstand 128 px. | Keine Abhängigkeit; feste Höhen schnitten lange Titel ab und ließen Karten überlappen. 128 px lassen Karten- und Kanten-„+" an Verzweigungen nebeneinander Platz. |
| Pfeile | Gerade Linien von Unter- zu Oberkante. Umweg-Pfeile (A→C trotz A→B→C) werden **nur beim Zeichnen** ausgeblendet (`transitiveReduction`). | Rechtwinklige Führung überlagerte sich an Verzweigungen; Ausblenden statt Verbieten ist verlustfrei. |
| „+" im Ablauf | Ein „+" pro Pfeil (`insertBetween`); Karten-„+" darüber nur am Strang-Anfang, darunter am Strang-Ende **und an Verzweigungen** (≥ 2 Nachfolger, Engpass-Einfügung über `insertAfter`). Sichtbarer Kreis klein (38/30 px), Trefferfläche 44 × 44 px über `::after`. Unter ~60 % Zoom ausgeblendet mit Hinweis. | In einer Kette täten drei „+" dasselbe; so ist alles überlappungsfrei erreichbar. |
| Verbinden | Im **Bearbeiten-Dialog** („Muss vorher erledigt sein“ / „Kommt danach“) statt Ziel-Antippen oder Ziehen; der eigene Verbinden-Dialog entfiel mit 2.2. | Per Tastatur und Screenreader bedienbar, ein Weg statt zwei. |
| ⋯-Menüs | `<details class="menu">` mit `.menu__panel`; **ein** gemeinsamer Handler (`shared/menus.ts`), in der App-Shell an `document` gehängt: Klick außerhalb **oder auf das offene `<details>` selbst** schließt (mit `preventDefault`, sonst klappt es nativ wieder auf), nur Klicks im Menüinhalt lassen es offen; **Esc** schließt und gibt den Fokus an das ⋯ zurück. Die Popover im Ablauf (Signal statt `<details>`) öffnen mit `stopPropagation` und schließen bei jedem anderen Dokument-Klick und bei Esc. | Auf dem Handy gab es sonst keinen Weg, ein Menü ohne Auswahl zu schließen. Vorher hatte jede Seite eine eigene Kopie, und das Zettel-Menü in der Detailansicht fehlte ganz. |
| Automatisches Archivieren | `ListsStore.archiveCompleted()` (ein Befehl im Verlauf der Übersicht) läuft einmal pro Besuch der Übersicht, sobald `ListsStore.ready` (erster Ladeversuch fertig) gesetzt ist. | Beim allerersten Öffnen ist die Übersicht schon da, bevor IndexedDB geladen hat. |
| „Jetzt dran"/„Wartet" | **Transitiv** über `openAncestors`. | In einer Kette offen → erledigt → offen ist nur der vorderste offene Schritt dran. |
| i18n | Eigene, reaktive Lösung (`I18nStore`, Signals) statt `@angular/localize` oder Transloco. `de.ts` ist die Vorlage, `en.ts` erfüllt sie per `satisfies`. | `@angular/localize` übersetzt zur Buildzeit (eine Sprache je Build) – kein Umschalten zur Laufzeit im Ein-Build-Offline-Betrieb; Bibliotheken wären Abhängigkeiten. Fehlende Übersetzung = Compile-Fehler. |
| Precache-Liste | Eigene Datei `precache-manifest.json` statt Einsetzen in `sw.js`; Cache-Name `faden-v1-<build>` plus `faden-meta`. | Eine geänderte `sw.js` wäre ein Auto-Update; ein eigener Cache je Build erlaubt, eine neue Version vollständig zu laden, bevor die alte gelöscht wird. |
| App-Version | `APP_VERSION` per JSON-Import aus `package.json`. | Eine Quelle; der Update-Vergleich braucht eine echte Versionsnummer. |
| Icons | Quelle `public/icons/icon.svg`, `scripts/generate-icons.mjs` rastert ohne Fremdpakete. | Keine Bildbibliothek. |
| Erst-Start-Merker | `localStorage` (z. B. `faden.installBannerDismissed`), nicht IndexedDB. | Synchron lesbar (kein Aufblitzen beim Start); reine Anzeige-Merker gehören nicht ins Backup. |
| Testwerkzeuge | Browser-Tests steuern Edge/Chrome headless über das DevTools-Protokoll mit Node-WebSocket; Tippen als echte Tastendrücke. | Keine Fremdpakete; `Input.insertText` ahmt eine IME-Eingabe nach und testet die Tastatur nicht. |
| Deployment | GitHub Actions → GitHub Pages bei Push auf `main`: Unit-Tests, `npm run build`. Kein `--base-href`, kein `404.html`. | `<base href="./">` läuft unter jedem Pfad; Hash-Routing braucht keinen Fallback. |
| Anleitung in der App | Beim Build gerendertes HTML-Fragment, per `[innerHTML]` mit aktivem Sanitizer. Der Sanitizer entfernt `id`s; der Dialog setzt die Anker nach dem Rendern neu und fängt `#…`-Links ab. | Eine Quelle (`docs/USER-GUIDE.md`) für GitHub und App, offline verfügbar, keine Markdown-Bibliothek. Ohne Abfangen würde ein Anker-Link die Hash-Route wechseln. |
| Erst-Start-Hinweise | `FirstRunStore` (localStorage `faden.storageNoticeAck`, `faden.guideOffered`); Speicher-Hinweis modal und nur per „Verstanden“ schließbar, danach das Anleitungs-Angebot, erst dann das Installations-Banner. | Bewusste Ausnahme von „keine Pop-ups“ (Wunsch des Nutzers); jeder Hinweis kommt genau einmal. Browser-Tests setzen die Merker über `skipFirstRunNotices` vorab. |
