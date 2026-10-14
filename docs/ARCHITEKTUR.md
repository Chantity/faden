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
│  │  └─ operations.ts              insert*/addParallel*/connect/deleteTask
│  ├─ storage/                      Persistenz (IndexedDB, Migration, Backup)
│  │  ├─ db.ts                      dünner Promise-Wrapper um IndexedDB
│  │  ├─ migrations.ts              reine migrate()-Funktion
│  │  └─ backup.ts                  Export/Import + Validierung
│  └─ state/                        Reactive State (Signals)
│     ├─ history.ts                 generischer Undo/Redo-Verlauf (100 Schritte)
│     ├─ lists.store.ts             Zettel: CRUD, Persistenz, Tabs-Sync
│     ├─ templates.store.ts         Vorlagen
│     └─ settings.store.ts          Einstellungen (Theme, Sprache) + Anwendung
├─ features/
│  ├─ lists/                        Zettel-Übersicht (Phase 1, fertig)
│  ├─ list-detail/                  Zettel-Detail (Phase 2, Platzhalter)
│  ├─ templates/                    Vorlagen-Seite (Phase 3, Platzhalter)
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
  `isJoin` (UND-Semantik), `progress`, `availableTasks`.
- **Einfüge-Operationen** (`operations.ts`): `insertBefore`, `insertAfter`,
  `insertBetween`, `addParallelAfter/Before`, `addStandalone`, `connect`,
  `disconnect`, `deleteTask` (Standard „Überbrücken" oder „nur entfernen").
  `insertBefore`/`insertAfter` bauen alle betroffenen Pfeile um.
- **Reihenfolge/Komponenten** (`ordering.ts`): stabile topologische Ordnung
  (Gleichstand = Erstellungsreihenfolge), verbundene Komponenten („Stränge") via
  Union-Find, `extractStrand` für „Strang als Vorlage".

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

## 6. State (`core/state`)

- **Signals** als einzige Zustandsquelle. `computed` leitet ab (z. B. aktive vs.
  archivierte Zettel).
- **Undo/Redo** (`history.ts`): generischer Snapshot-Verlauf, Obergrenze 100,
  Redo wird nach neuer Änderung verworfen. Der `ListsStore` schiebt vor jeder
  Mutation einen Schnappschuss.
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

## 8. PWA und Service Worker (Phase 3)

**Entscheidung: eigener, minimaler Service Worker** (Variante B) statt
`@angular/service-worker`, weil ngsw bei HTTP 404 auf `ngsw.json` alle Caches
löscht und sich deregistriert (Details in `docs/DECISIONS.md`).

Geplanter Aufbau:
- Ein kleines Node-Skript erzeugt nach `ng build` die Precache-Liste aller
  Output-Dateien und setzt sie in `public/sw.js` ein.
- `install`: alle Artefakte in `caches.open('faden-v1')`.
- `fetch`: Cache-first; Navigationen immer mit der gecachten `index.html`.
- `activate`: **niemals** Caches löschen, kein Selbst-Deregistrieren.
- Registrierung nur in Produktionsbuilds.

Die wiederholbaren Pflichttests stehen in `docs/PWA-TESTS.md`.

## 9. Entwickeln, Testen, Bauen

```bash
npm install        # Abhängigkeiten
npm start          # Dev-Server (http://localhost:4200)
npm test           # Unit-Tests (Vitest)
npm run build      # Produktionsbuild nach dist/faden
```

„Einmal hosten": den Inhalt von `dist/faden` auf einen beliebigen HTTPS-Host
legen, die Seite einmal laden und installieren. Danach darf der Host verschwinden
(ab Phase 3 mit Service Worker vollständig garantiert).

## 10. Abhängigkeiten

Bewusst minimal: Angular + RxJS + tslib. Kein Layout-Framework, keine
IndexedDB-Bibliothek, kein UI-Kit. `@angular/cdk` ist erlaubt, wenn konkrete
Komponenten (Overlay/Fokus/Drag) es rechtfertigen. Keine Laufzeit-Requests zu
Fremddomains.
