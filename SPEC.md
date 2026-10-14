# SPEC: „Faden“ – lineare ToDo-App als Ablaufdiagramm (PWA, Angular)

> **Arbeitstitel:** „Faden“ (nur ein Platzhalter; der Name steht an genau **einer** Stelle in `src/app/app.config.ts` bzw. `app-meta.ts` und im Manifest und ist leicht änderbar).
> **Sprache der Oberfläche:** Deutsch (alle Texte zentral in einer Konstantendatei, damit später übersetzbar).
> **Zielgruppe dieses Dokuments:** Ein Coding-Agent, der die App vollständig umsetzt. Dieses Dokument ist die einzige Quelle der Wahrheit. Bei Unklarheiten gilt der Abschnitt „Annahmen“ (Kapitel 14); danach im Zweifel die einfachere Lösung wählen und die Entscheidung in `docs/DECISIONS.md` festhalten.

---

## 1. Zweck und Kernproblem

Die App richtet sich an Menschen mit **exekutiven Funktionsstörungen** und **Problemen mit Objektpermanenz** (was nicht sichtbar ist, existiert gedanklich nicht).

**Das Problem:** Ein ToDo ist selten sofort ausführbar. Es hat Vorarbeiten, die wiederum Vorarbeiten haben:

> „Geschirrspüler einräumen“ → vorher Geschirr in der ganzen Wohnung einsammeln → auf einem Teller liegen Bioabfälle → vorher Biotonne leeren → dabei gleich allen Müll mitnehmen → dafür vorher herumliegenden Müll einsammeln …

Am Ende wird gar nichts getan, weil die Kette im Kopf zu lang und zu unsichtbar ist.

**Die Lösung:** Die App macht die Abhängigkeiten **sichtbar und ordnet sie** als gerichteten Ablauf (ähnlich einem UML-Aktivitätsdiagramm, aber ohne Fachbegriffe). Zu jedem Zeitpunkt zeigt sie nur das, **was jetzt dran ist**. Die App übernimmt die „Objektpermanenz“ für die restliche Kette.

**Leitprinzipien (bei jeder Designentscheidung anwenden):**
1. **Weniger gleichzeitig zeigen.** Standardansicht ist „Jetzt dran“, nicht der ganze Graph.
2. **Einfügen muss schneller gehen als Nachdenken.** Eine fehlende Vorarbeit eintragen darf maximal 2 Taps / 2 Tastendrücke kosten.
3. **Nichts geht verloren, nichts wird bestraft.** Rückgängig überall, keine roten Alarme, keine Schuldgefühle erzeugenden Texte.
4. **Reizarm.** Ruhige Farben, kaum Animation, keine Pop-ups ohne Not, keine Konfetti-Effekte.
5. **Offline-first, für immer.** Die App funktioniert ohne Netz und ohne Server, nachdem sie einmal installiert wurde.

---

## 2. Technische Rahmenbedingungen

| Thema | Vorgabe |
|---|---|
| Framework | **Angular 22** (bzw. die neueste stabile Hauptversion, falls 22 nicht verfügbar ist; Abweichung in `docs/DECISIONS.md` vermerken). Vor Beginn die **aktuelle offizielle Angular-Dokumentation** konsultieren, nicht auf veraltetes Wissen verlassen. |
| Architektur | Standalone-Komponenten, **Signals** für State, neue Template-Control-Flow-Syntax (`@if`, `@for`), `inject()`, `OnPush`, wenn es die Version noch erfordert **zoneless**. Keine NgModules. |
| Sprache | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`. |
| Routing | **Hash-Routing** (`withHashLocation()`), damit die App auf jedem statischen Host ohne Rewrite-Regeln läuft und später rein aus dem Cache startet. `base href="./"` (relative Pfade), damit das Hosting-Unterverzeichnis egal ist. |
| Styling | Eigenes CSS mit CSS-Variablen (Design Tokens). Kein großes UI-Framework nötig. Optional `@angular/cdk` für Dialoge/A11y/Drag. Schriften **selbst hosten** (oder Systemschriften). **Keine** Laufzeit-Requests zu Fremddomains (CDNs, Google Fonts, Analytics etc.). |
| Persistenz | **IndexedDB** (dünner eigener Wrapper oder `idb`). Kein `localStorage` für Nutzdaten. |
| Tests | Unit-Tests (Standard-Test-Runner der Angular-Version) für alle reinen Logikmodule (Kapitel 12). Ein Offline-/PWA-Test (Kapitel 9). |
| Pakete | Möglichst wenige Abhängigkeiten. Für das Graph-Layout darf ein kleines, **gebündeltes** Layout-Paket (z. B. `@dagrejs/dagre`) oder ein eigener einfacher Layered-Layout-Algorithmus genutzt werden. |
| Backend | **Keines.** Keine Konten, kein Sync, keine Push-Benachrichtigungen. |

---

## 3. Fachbegriffe (Oberfläche) und Datenmodell

### 3.1 Begriffe in der Oberfläche (nicht-technisch!)

| Intern | Anzeige für Nutzer |
|---|---|
| List / Graph | **Zettel** (ein Zettel = eine ToDo-Liste mit Ablauf) |
| Task / Node | **ToDo** |
| Edge | **Pfeil** (bedeutet: „erst A, dann B“) |
| Split | **Aufteilen** („ab hier parallel mehrere ToDos“) |
| Join | **Zusammenführen** („erst weiter, wenn alle davor erledigt sind“) |
| Available | **Jetzt dran** |
| Template | **Vorlage** |

Die Wörter „Graph“, „Knoten“, „Kante“, „DAG“, „Vorgänger/Nachfolger“ erscheinen **nirgends** in der UI. Stattdessen: „davor“, „danach“, „muss vorher erledigt sein“, „kommt danach“.

### 3.2 TypeScript-Modell (Zielstruktur)

```ts
export type TimeboxMode = 'none' | 'estimate' | 'dayPlan' | 'schedule';

export interface TodoList {            // „Zettel“
  id: string;                          // crypto.randomUUID()
  title: string;
  timeboxMode: TimeboxMode;            // Standard: 'none'
  tasks: Task[];
  edges: Edge[];
  dayPlanReferenceDate?: string;       // 'YYYY-MM-DD', nur Modus 'dayPlan' (siehe 7.3)
  archived: boolean;
  createdAt: string;                   // ISO
  updatedAt: string;                   // ISO
  sortOrder: number;                   // Reihenfolge in der Zettel-Übersicht
}

export interface Task {                // „ToDo“
  id: string;
  title: string;                       // Pflicht, max. 200 Zeichen
  notes?: string;                      // optional, max. 2000 Zeichen
  done: boolean;
  doneAt?: string;                     // ISO, wann abgehakt
  // Zeitfelder: werden IMMER gespeichert und beim Modus-Wechsel NICHT gelöscht
  estimateMinutes?: number;            // Modus 'estimate' (ganzzahlig, 1–1440)
  dayStart?: string;                   // 'HH:mm', Modus 'dayPlan'
  dayEnd?: string;                     // 'HH:mm', Modus 'dayPlan'
  startAt?: string;                    // 'YYYY-MM-DDTHH:mm' (lokale Zeit, OHNE Zeitzone), Modus 'schedule'
  endAt?: string;                      // 'YYYY-MM-DDTHH:mm' (lokale Zeit, OHNE Zeitzone), Modus 'schedule'
}

export interface Edge {                // „Pfeil“: from muss vor to erledigt sein
  id: string;
  from: string;                        // Task.id
  to: string;                          // Task.id
}

export interface Template {            // „Vorlage“
  id: string;
  title: string;
  tasks: Omit<Task, 'done' | 'doneAt'>[];
  edges: Edge[];
  timeboxMode: TimeboxMode;
  createdAt: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  lastBackupAt?: string;
  schemaVersion: number;
}
```

**Wichtige Regeln:**
- **Lokale Zeit ohne Zeitzone speichern** (`'2026-03-14T09:30'`), damit Sommer-/Winterzeitumstellung und Reisen nichts verschieben. Beim Vergleich mit „jetzt“ ebenfalls lokale Zeit verwenden.
- Ein Zettel ist **eine Zeichenfläche**, auf der **mehrere voneinander unabhängige Stränge** liegen dürfen (nicht verbundene Teilgraphen). Zusätzlich gibt es mehrere Zettel („wie mehrere Notizzettel“).
- Die gesamte Zettel-Struktur (Tasks + Edges) liegt **in einem Dokument** pro Zettel (ein IndexedDB-Record), damit Schreibvorgänge atomar sind und Undo/Redo einfach bleibt.
- `schemaVersion` ab Tag 1 mitführen, mit Migrationsfunktion (auch wenn zunächst leer).

---

## 4. Graph-Regeln und Logik (reines TypeScript, ohne Angular, vollständig unit-getestet)

Ablegen in `src/app/core/graph/`. Alle Funktionen sind **rein** (Eingabe → neue Struktur, keine Mutation).

### 4.1 Invarianten
1. **Keine Zyklen.** Ein Pfeil `a → b` wird abgelehnt, wenn `b` bereits `a` erreichen kann (inkl. `a === b`). Nutzertext: *„Das geht nicht: A müsste dann auf sich selbst warten.“* (ohne Fachbegriffe, mit Namen der beteiligten ToDos).
2. **Keine doppelten Pfeile** (`from`/`to`-Paar eindeutig).
3. **Keine Pfeile zu/von nicht existierenden ToDos.**
4. Zeitlich/strukturell gleichwertige Umwege (A→B, B→C, A→C) sind **erlaubt**, werden aber nicht extra behandelt.

### 4.2 Abgeleitete Zustände (nie speichern, immer berechnen)

- `predecessors(t)`, `successors(t)`
- **Aufteilen:** ToDo mit ≥ 2 ausgehenden Pfeilen.
- **Zusammenführen:** ToDo mit ≥ 2 eingehenden Pfeilen. **Semantik: UND**, das ToDo ist erst „dran“, wenn **alle** Vorgänger erledigt sind.
- **`isAvailable(t)`** („Jetzt dran“): `!t.done` und alle Vorgänger sind `done`.
- **`isBlocked(t)`**: `!t.done` und mindestens ein Vorgänger ist nicht erledigt. Anzeige: *„Wartet auf: X, Y“*.
- **`isEarlyDone(t)`**: `t.done` obwohl ein Vorgänger nicht erledigt ist (erlaubt, siehe 4.4); dezenter Hinweis, kein Fehler.
- **Fortschritt** je Zettel: `erledigt / gesamt`.

### 4.3 Einfüge-Operationen (Kernfunktion)

Jede Operation erzeugt ein neues ToDo `m` und baut die Pfeile um. Gewünschte Standardverhalten:

| Operation | Ergebnis |
|---|---|
| **`insertBefore(n)`** („Davor etwas einfügen“) | Alle Pfeile `p → n` werden zu `p → m` ersetzt, plus neuer Pfeil `m → n`. Hat `n` keine Vorgänger, ist `m` danach der neue Anfang. |
| **`insertAfter(n)`** („Danach etwas einfügen“) | Alle Pfeile `n → s` werden zu `m → s` ersetzt, plus neuer Pfeil `n → m`. Hat `n` keine Nachfolger, ist `m` das neue Ende. |
| **`insertBetween(edge a→b)`** („Dazwischen“, per „+“ auf dem Pfeil) | Pfeil `a → b` wird entfernt, neu: `a → m` und `m → b`. |
| **`addParallelAfter(n)`** („Daneben aufteilen“) | Nur ein neuer Pfeil `n → m`, **bestehende Pfeile bleiben**. Dadurch entsteht eine Verzweigung. |
| **`addParallelBefore(n)`** („Daneben zusammenführen“) | Nur ein neuer Pfeil `m → n`, bestehende Pfeile bleiben. Dadurch entsteht eine Zusammenführung. |
| **`addStandalone()`** | Neues ToDo ohne Pfeile (eigener neuer Strang auf dem Zettel). |
| **`connect(a, b)`** | Neuer Pfeil `a → b` (mit Zyklusprüfung). Dient zum **Zusammenführen** vorhandener Stränge. |
| **`disconnect(edge)`** | Entfernt einen Pfeil. |
| **`deleteTask(n)`** | Standard: **„Überbrücken“** – jeder Vorgänger wird mit jedem Nachfolger verbunden (Duplikate vermeiden), dann `n` und seine Pfeile entfernen. Zyklen können dabei nicht entstehen. Zweite Option im Dialog: *„Nur dieses ToDo entfernen, nichts verbinden“*. Immer über Undo rückgängig machbar. |

Nach `insert*`/`addParallel*` wird sofort das **Titel-Eingabefeld des neuen ToDos fokussiert** (Inline-Edit, Enter bestätigt, Esc verwirft das leere ToDo).

### 4.4 Abhaken
- Abhaken ist **immer erlaubt**, auch wenn Vorgänger offen sind (z. B. nachträgliches Abhaken). In diesem Fall wird `isEarlyDone` angezeigt (dezent: *„Vorarbeit noch offen“*).
- Abhaken setzt `doneAt = jetzt`; Wieder-Aufhaken löscht `doneAt`.
- Wird ein ToDo wieder auf „offen“ gesetzt, werden Nachfolger **nicht** automatisch zurückgesetzt.

### 4.5 Weitere reine Funktionen
- `topologicalOrder(list)` (stabil: bei Gleichstand nach Erstellungsreihenfolge).
- `connectedComponents(list)` (= die „Stränge“ eines Zettels; wird für „Strang als Vorlage speichern“ und für das Layout genutzt).
- `wouldCreateCycle(list, from, to)`.
- `extractStrand(list, taskId)` (Teilgraph der Komponente).

---

## 5. Ansichten und Bedienung

### 5.1 Navigation (Hash-Routen)
- `#/` – **Zettel-Übersicht**
- `#/zettel/:id` – **Zettel** mit Umschalter **„Jetzt dran“ | „Ablauf“** (Standard: **Jetzt dran**; letzte Wahl pro Zettel merken)
- `#/vorlagen` – Vorlagen
- `#/einstellungen` – Einstellungen (Design, Backup, Speicherstatus, Info/Hilfe)

**Responsive:**
- **< 600 px (Handy):** Eine Spalte, untere Navigation oder Floating-Action-Button für „+“, Dialoge als **Bottom-Sheets**.
- **600–1024 px:** Eine Spalte mit größerem Inhalt.
- **> 1024 px (PC):** Zweispaltig: links Liste der Zettel (einklappbar), rechts der geöffnete Zettel.
- Safe-Area-Insets (`env(safe-area-inset-*)`) beachten, Querformat funktioniert.

### 5.2 Zettel-Übersicht
- Karten pro Zettel: Titel, Fortschritt („3 von 8 erledigt“), Modus-Badge (nur wenn nicht „kein Timeboxing“), und **das nächste „Jetzt dran“-ToDo** als Vorschau (Objektpermanenz!).
- Aktionen: Neuer Zettel (Titel + Modus wählen, Modus später änderbar), Umbenennen, Duplizieren, Archivieren/Wiederherstellen, Löschen (mit Undo statt Bestätigungsdialog), Reihenfolge ändern (einfach: Hoch/Runter-Buttons; Drag optional).
- **Neuer Zettel aus Vorlage** als zweite Option im „Neu“-Menü.
- Leerzustand: freundlicher Text + ein großer Button *„Ersten Zettel anlegen“*.

### 5.3 Ansicht „Jetzt dran“ (Standard, wichtigster Bildschirm)

Zeigt **nur** ToDos, die `isAvailable` sind, als große Karten (bei mehreren: untereinander).

Jede Karte:
- Titel groß, Notizen eingeklappt darunter.
- **Großer Button „Erledigt“** (mind. 56 px hoch, volle Kartenbreite).
- Button **„Erst noch etwas anderes nötig …“** → `insertBefore` mit sofortigem Eingabefeld. **Das ist der wichtigste Interaktionspfad der App**: Vorarbeit blitzschnell erfassen; danach ist die neue Vorarbeit sofort das einzige „Jetzt dran“. Direkt nach dem Bestätigen wird das Eingabefeld erneut angeboten (Enter-Kette), mit Abbruch durch Esc/„Fertig“; dabei entsteht eine **Kette** (jedes neue ToDo kommt vor das zuletzt eingefügte).
- Unauffällig: *„Danach: X“* (Titel der Nachfolger, max. 2 + „+n weitere“), und bei Zusammenführung *„Außerdem muss noch erledigt sein: …“* nur wenn relevant.
- Mehr-Menü (⋯): Bearbeiten, Danach einfügen, Daneben aufteilen, Mit anderem ToDo verbinden, Löschen.
- In Zeit-Modi zusätzlich Zeitangaben (siehe Kapitel 7).

Darunter, **eingeklappt** (Standard zu): *„Danach kommt noch … (n ToDos)“* – Liste der gesperrten ToDos in topologischer Reihenfolge mit *„wartet auf …“*. Ausgeklappt ist es eine reine Leseliste (Tap öffnet das Bearbeiten-Sheet).

Leerzustände:
- Alles erledigt: ruhige Meldung *„Alles erledigt.“* + Button „Zettel archivieren“. **Keine** Konfetti-Animation.
- Zettel ist leer: Hinweis + Eingabefeld **„Was möchtest du erledigen?“**.

**Schnelles Erfassen von Ketten:** Im leeren/Ablauf-Zustand gibt es ein Mehrfach-Eingabefeld: jedes `Enter` erzeugt ein neues ToDo, das mit dem vorigen verkettet ist (`insertAfter` des letzten). `Shift+Enter` = Zeilenumbruch in Notizen nicht nötig; Esc/„Fertig“ beendet. Einfügen mehrzeiligen Texts erzeugt eine Kette, ein ToDo pro Zeile.

### 5.4 Ansicht „Ablauf“ (Diagramm)

Zeigt den gesamten Zettel als Ablaufdiagramm.

**Layout:** **Automatisch, Richtung von oben nach unten** (Schichten-Layout). Verzweigungen liegen nebeneinander, Zusammenführungen laufen wieder zusammen. Mehrere unabhängige Stränge stehen nebeneinander getrennt, mit etwas Abstand. **Kein freies Verschieben** von Karten (Entscheidung, siehe Kapitel 14). Layout wird bei jeder Strukturänderung neu berechnet (stabil, ohne wildes Springen: gleiche Eingabe ergibt gleiche Position; sanfte oder gar keine Übergangsanimation, beachte `prefers-reduced-motion`).

**Rendering:** ToDo-Karten als HTML-Elemente (gut bedienbar und barrierearm), Pfeile als SVG-Pfade darunter (leicht gebogen oder rechtwinklig, mit Pfeilspitze). Beide liegen in einem gemeinsamen Container mit CSS-Transform für Pan/Zoom.

**Pan/Zoom:**
- Handy: Ein-Finger-Wischen = Scrollen/Verschieben, Zwei-Finger-Pinch = Zoom.
- PC: Mausrad + `Strg` = Zoom, Ziehen auf Hintergrund = Verschieben, Tasten `+`/`-`/`0`.
- Sichtbare Buttons: Zoom +, Zoom −, „Alles einpassen“, „Zum aktuellen ToDo springen“.
- Zoom-Grenzen 40 % – 200 %. Beim ersten Öffnen: „Einpassen“ oder auf das erste „Jetzt dran“ zentrieren.

**Karte im Diagramm (Zustände klar und nicht nur über Farbe unterscheidbar, immer Icon + Text + Farbe):**
- **Erledigt** (Haken, gedämpft)
- **Jetzt dran** (hervorgehoben, Rahmen + Label „Jetzt dran“)
- **Wartet** (gedämpft, Schloss-Icon, Tooltip/Text *„wartet auf …“*)
- In Zeit-Modi zusätzlich Zeit-Badge und ggf. „Verpasst“/„Läuft gerade“ (Kapitel 7)

**Einfügen mit „+“ (Pflichtanforderung):**
- **Auf jedem Pfeil** mittig ein „+“ → `insertBetween`.
- **Über jeder Karte** ein „+“ → `insertBefore`.
- **Unter jeder Karte** ein „+“ → `insertAfter`.
- Im Karten-Menü zusätzlich: **„Daneben aufteilen“** (`addParallelAfter`) und **„Daneben zusammenführen“** (`addParallelBefore`).
- Ganz oben/unten am Zettel sowie als FAB: **„Neuer eigener Strang“** (`addStandalone`).
- Die „+“-Buttons sind **immer sichtbar** (nicht nur bei Hover, da Touch), klein-dezent, Trefffläche mindestens 44×44 px (auch wenn das Icon kleiner ist). Bei sehr kleinem Zoom werden die „+“ ausgeblendet, bis herangezoomt wird (Hinweis dazu).

**Verbinden (Zusammenführen vorhandener ToDos):**
1. Menü „Mit anderem ToDo verbinden“ → Modus „Ziel wählen“ mit Banner *„Tippe das ToDo, das danach kommen soll“* (und Abbrechen).
2. Alternative für PC: Ziehen von einem Anschluss-Punkt unten an der Karte auf eine andere Karte.
3. Zyklus → freundliche Fehlermeldung (siehe 4.1), nichts wird geändert.
4. **Pfeil löschen:** Tap auf Pfeil → kleines Menü „Pfeil entfernen“, „Dazwischen einfügen“.

**Bearbeiten-Sheet/-Dialog** (Tap auf Karte): Titel, Notizen, Zeitfelder je nach Modus, Liste **„Muss vorher erledigt sein“** und **„Kommt danach“** als Chips (jeweils mit „+ hinzufügen“ per Auswahlliste und „×“ zum Entfernen). Dadurch sind alle Verbindungen **auch ohne Drag/Pan** bedienbar (Barrierefreiheit).

### 5.5 Rückgängig / Wiederholen (Pflicht)
- Gilt für **alle** Änderungen am Zettel (Anlegen, Bearbeiten, Abhaken, Löschen, Pfeile, Zeitänderungen, Moduswechsel).
- Pro Zettel ein Verlauf (Snapshots oder Commands), mindestens die letzten **100** Schritte, im Speicher (Persistenz des Verlaufs nicht nötig).
- Buttons „Rückgängig/Wiederholen“ in der Zettel-Kopfzeile; Tastatur `Strg/Cmd+Z`, `Strg/Cmd+Shift+Z` bzw. `Strg+Y`.
- Nach Löschen und Abhaken erscheint ein **Hinweisband unten (Snackbar) „Rückgängig“** für ca. 8 Sekunden (nicht modal, nicht blockierend, `aria-live="polite"`).
- Löschen ganzer Zettel: ebenfalls Snackbar mit Undo (Zettel wird erst nach Ablauf der Frist endgültig aus IndexedDB entfernt; sonst Soft-Delete).

### 5.6 Vorlagen
- **„Als Vorlage speichern“** für den ganzen Zettel **oder** nur für den **Strang** eines gewählten ToDos (`extractStrand`).
- Vorlage speichert: Titel, Struktur (Tasks + Pfeile), Titel/Notizen, Schätzungen, Modus. **Nicht:** Erledigt-Status, `doneAt`. Absolute Zeitangaben (`startAt`/`endAt`) werden **verworfen**, stattdessen wird, falls Start und Ende vorhanden sind, `estimateMinutes` aus der Dauer abgeleitet. Tageszeiten (`dayStart`/`dayEnd`) bleiben erhalten.
- **„Neuer Zettel aus Vorlage“** erzeugt einen frischen Zettel mit neuen IDs.
- **Vorlagenseite:** Liste, Umbenennen, Löschen (mit Undo), Vorschau (Titel-Liste in topologischer Reihenfolge).
- Zusätzlich: **„Vorlage in bestehenden Zettel einfügen“** als neuer Strang (optional, wenn Aufwand gering; sonst Phase 3).
- Vorlagen sind Teil von Export/Import.

### 5.7 Tastaturbedienung (PC)
- Navigation mit Tab/Shift+Tab, sichtbare Fokusrahmen.
- In „Jetzt dran“: `Enter`/`Leertaste` auf „Erledigt“; `V` = „Erst noch etwas anderes nötig“; `N` = Danach einfügen; `E` = Bearbeiten (nur wenn nicht in einem Eingabefeld).
- `Strg/Cmd+Z` / `Strg/Cmd+Shift+Z` wie oben. `?` öffnet eine Tastenkürzel-Übersicht.
- Im Ablauf: Pfeiltasten wechseln den Kartenfokus nach topologisch/räumlich nächstem Nachbarn (einfache Näherung genügt), `Enter` öffnet Bearbeiten, `Entf` löscht (mit Undo).
- Dialoge: `Esc` schließt, Fokus wird eingefangen und danach zurückgegeben.

---

## 6. Design und Barrierefreiheit (reizarm)

- **Farben:** Gedämpfte Palette, ausreichender Kontrast (WCAG AA mindestens, Text AAA wo möglich). **Hell/Dunkel/System**, Umschalter in den Einstellungen; Dark Mode ist gleichwertig gestaltet (kein reines Schwarz auf grellem Weiß).
- **Zustände nie nur durch Farbe** (immer Icon + Text/Form).
- **Fehler/Verpasstes:** ruhiges Bernstein/Grau statt Alarm-Rot, neutrale Sprache (*„Nicht abgehakt“* statt *„Versäumt/Überfällig!“*).
- **Typografie:** gut lesbare Systemschrift oder eine selbst gehostete Schrift, Basisgröße ≥ 17 px, großzügiger Zeilenabstand, Skalierung mit Browser-Einstellungen (`rem`).
- **Tippflächen:** mindestens 48×48 px (Hauptaktionen 56 px).
- **Bewegung:** Minimal. `prefers-reduced-motion: reduce` schaltet alle Übergänge ab. Keine automatisch laufenden Animationen, kein Blinken, keine Konfetti.
- **Keine Pop-up-Flut:** Bestätigungsdialoge nur, wo Undo nicht reicht (Import mit Ersetzen).
- **Screenreader:** sinnvolle ARIA-Rollen/-Labels (Karte als `article`/`listitem`, Abhaken als `checkbox`/`switch`-Semantik, Live-Region für Snackbars und Statuswechsel). Das Diagramm erhält zusätzlich eine **linearisierte, zugängliche Listenalternative** (die Ansicht „Jetzt dran“ inkl. der eingeklappten Gesamtliste erfüllt das).
- **Sprache:** `<html lang="de">`, einfache Sprache, kurze Sätze, Du-Form, freundlich, nie wertend.

---

## 7. Timeboxing

Die Einstellung gilt **pro Zettel** und ist jederzeit änderbar (Zettel-Menü → „Zeitplanung“). **Beim Moduswechsel gehen keine Daten verloren** (alle Zeitfelder in `Task` bleiben erhalten, es wird nur gesteuert, was sichtbar/relevant ist). **Es gibt keinen Timer/Countdown in der App.** Es gibt auch **keine Hintergrund-Benachrichtigungen** (siehe 13).

### 7.1 Modus `none` – „Kein Timeboxing“
Nur ToDos, keinerlei Zeitangaben in UI oder Bearbeiten-Sheet.

### 7.2 Modus `estimate` – „Zeitschätzung pro ToDo“
- Im Bearbeiten-Sheet und per Schnellauswahl auf der Karte: **Dauer** in Minuten (Chips: 5, 10, 15, 30, 45, 60, 90 Min + freie Eingabe; Anzeige als „1 Std 25 Min“).
- Pro Zettel in der Kopfzeile: **Summe aller offenen ToDos**, **Summe gesamt**, **bereits erledigt**; ToDos ohne Schätzung werden separat gezählt (*„3 ohne Schätzung“*).
- **Summe, nicht kritischer Pfad:** Es wird davon ausgegangen, dass **eine Person nacheinander** arbeitet (parallele Stränge werden addiert).
- Optional pro Strang (Komponente) eine Teilsumme im Diagramm (kleine Beschriftung am Strang).
- Keine Zeitstempel, kein Plan, nur Schätzwerte.

### 7.3 Modus `dayPlan` – „Tagesplan (Uhrzeiten)“ (unkonkreter Plan ohne Datum)
- Jedes ToDo kann eine **Von-Uhrzeit** und **Bis-Uhrzeit** (`HH:mm`) erhalten. Kein Datum.
- Validierung: `Bis > Von` am selben Tag (über Mitternacht geht nicht; dafür gibt es Modus `schedule`). Nur eine der beiden Zeiten zu setzen ist erlaubt (dann gilt das ToDo als nicht vollständig geplant, wird aber angezeigt).
- **Bezugstag:** `dayPlanReferenceDate` (Standard: das Datum, an dem der Modus aktiviert wurde). Die Uhrzeiten beziehen sich auf diesen Tag.
  - Ist der Bezugstag **heute**: normale Anzeige (siehe unten).
  - Liegt der Bezugstag **in der Vergangenheit**: Banner *„Dieser Tagesplan ist von {Datum}. Auf heute übertragen?“* mit den Aktionen **„Auf heute setzen“** (setzt `dayPlanReferenceDate = heute`, offene ToDos behalten ihre Uhrzeiten) und **„So lassen“**. Bis dahin werden alle offenen ToDos als „Nicht abgehakt“ gezeigt.
  - Liegt er in der Zukunft: alles als „Geplant“ ohne „Läuft gerade“/„Nicht abgehakt“.
- **Anzeige-Status je ToDo (abgeleitet aus aktueller Uhrzeit, nie gespeichert):**
  - **Läuft gerade:** nicht erledigt und `Von ≤ jetzt < Bis` (Hervorhebung, Text *„Jetzt, bis 14:30“*).
  - **Als Nächstes:** nicht erledigt, `Von > jetzt`, das zeitlich früheste solche ToDo erhält das Label *„Als Nächstes um 14:30“*.
  - **Nicht abgehakt:** nicht erledigt und `Bis ≤ jetzt` (ruhiger Bernstein, Text *„Nicht abgehakt (war 13:00–13:30)“*) mit sichtbarem Button **„Nachträglich abhaken“** (setzt `done = true`, `doneAt = jetzt`).
  - **Erledigt:** wie gewohnt.
- In „Jetzt dran“ werden ToDos zusätzlich **nach Von-Uhrzeit sortiert**; zwischen den Gruppen: **„Läuft gerade“**, **„Nicht abgehakt“**, **„Als Nächstes“**. In der Gesamtliste/dem Ablauf wird die Uhrzeit auf jeder Karte angezeigt.
- Zeitbezogene Anzeigen aktualisieren sich **minütlich** und bei `visibilitychange` (wenn die App wieder sichtbar wird) über ein `now`-Signal. **Kein** sekundengenauer Timer.
- **Weiche Hinweise** (nie blockierend):
  - Überlappung mit einem anderen ToDo (*„Überschneidet sich mit X“*).
  - ToDo ist zeitlich **vor** dem Ende eines seiner Vorgänger geplant (*„Liegt vor der Vorarbeit X“*).
  - ToDo ist „dran“ (Zeit erreicht), aber Vorgänger sind offen (*„Davor ist noch X offen“*).

### 7.4 Modus `schedule` – „Konkreter Zeitplan (Datum + Uhrzeit)“
- Wie `dayPlan`, aber mit `startAt`/`endAt` als **Datum + Uhrzeit** (lokale Zeit). Der Plan kann sich über **mehrere Tage** erstrecken; auch ein einzelnes ToDo darf über Mitternacht/mehrere Tage gehen (`endAt > startAt`).
- Status-Ableitung identisch zu 7.3 (Läuft gerade / Als Nächstes / Nicht abgehakt / Erledigt), aber auf Basis des vollständigen Zeitstempels; „Nachträglich abhaken“ ebenfalls vorhanden.
- **Gruppierung nach Tagen** in der Gesamtliste und im aufgeklappten Bereich: Tageskopf *„Heute“, „Morgen“, „Do., 14.03.“*. Im Diagramm: Datum + Uhrzeit auf der Karte (Datum nur anzeigen, wenn es nicht „heute“ ist).
- **Plan über mehrere Tage strecken** (Werkzeuge im Zettel-Menü „Zeitplan bearbeiten“):
  1. **Alles verschieben:** alle Zeiten um ± N Minuten/Stunden/Tage verschieben (Vorschau der ersten/letzten Zeit vor Bestätigung, Undo vorhanden).
  2. **Auf Zeitraum strecken/stauchen:** Nutzer wählt einen neuen Start (Datum+Uhrzeit) und ein neues Ende; alle `startAt`/`endAt` werden **proportional** auf den neuen Zeitraum abgebildet (Rundung auf 5 Minuten). Vorschau und Undo.
  3. **Einzelbearbeitung** je ToDo mit nativen `datetime-local`-Feldern bzw. einer eigenen, tastaturfreundlichen Alternative, wenn die nativen Felder auf einer Zielplattform schlecht bedienbar sind.
- Gleiche weiche Hinweise wie in 7.3 (Überlappung, vor Vorgänger).
- Ein Wechsel `dayPlan` → `schedule` bietet an: **„Tageszeiten auf ein Datum übertragen“** (Datumsauswahl, kopiert `dayStart`/`dayEnd` zu `startAt`/`endAt`). Umgekehrt `schedule` → `dayPlan` übernimmt nichts automatisch (nur Hinweis, dass Uhrzeiten getrennt gespeichert sind), die Felder bleiben aber beide erhalten.

### 7.5 Optional (Priorität „Kann“, nur wenn Zeit bleibt): Zeiten vorschlagen
Aktion „Zeiten aus Schätzungen vorschlagen“ (verfügbar in `dayPlan`/`schedule`): legt die ToDos in `topologicalOrder` nacheinander ab einer gewählten Startzeit an, nutzt `estimateMinutes` (Standard 15 Min bei fehlender Schätzung), zeigt eine Vorschau und überschreibt nur nach Bestätigung (mit Undo).

---

## 8. Persistenz, Backup, Datenverlustschutz

1. **IndexedDB-Stores:** `lists` (Schlüssel `id`), `templates`, `settings` (Key/Value), `meta`.
2. **Schreiben:** Änderungen sofort in den In-Memory-State (Signals), **entprellt (~300 ms) und beim `visibilitychange: hidden`/`pagehide` sofort** nach IndexedDB schreiben. Fehler beim Speichern sichtbar (ruhiges Banner *„Speichern hat nicht geklappt – bitte Backup erstellen“*), nicht verschweigen.
3. **`navigator.storage.persist()`** beim ersten Start (nach erster Nutzerinteraktion) anfordern und das Ergebnis in den Einstellungen anzeigen (*„Speicher ist dauerhaft geschützt“* / *„Browser kann den Speicher bei Platzmangel räumen – erstelle Backups“*). `navigator.storage.estimate()` darf als Info angezeigt werden.
4. **Export (JSON):** Download-Datei `faden-backup-YYYY-MM-DD.json` mit `{ app: "faden", schemaVersion, exportedAt, settings, lists, templates }`. Schreibt `lastBackupAt`. Zusätzlich **Teilen-Funktion** über `navigator.share` mit Datei, falls verfügbar.
5. **Import (JSON):** Datei wählen → **Validierung** (Schema, Versionsprüfung, Zyklenprüfung, Referenzprüfung; ungültige Daten werden **abgelehnt** mit verständlicher Meldung, ohne Teilimport). Optionen: **„Zusammenführen“** (neue IDs bei Kollisionen, bestehende Daten bleiben) oder **„Alles ersetzen“** (mit einziger Bestätigungsabfrage und automatisch vorher erstelltem Sicherungs-Download).
6. **Backup-Erinnerung:** In den Einstellungen *„Letztes Backup: vor 12 Tagen“*; wenn > 30 Tage und Daten vorhanden, auf der Zettel-Übersicht ein **einmal pro Woche** erscheinendes, wegklickbares Hinweisband. Keine weitere Aufdringlichkeit.
7. **Migrationen:** `migrate(data, fromVersion)` als reine, getestete Funktion.
8. **Mehrere Tabs:** Änderungen eines anderen Tabs über `BroadcastChannel` erkennen und den State neu laden (Vermeidung von „Last Write Wins“-Überraschungen). Mindestens: beim Fokus-Wechsel auf den Tab Daten neu einlesen, wenn `updatedAt` neuer ist.

---

## 9. PWA: „Einmal hosten, nie wieder“

**Ziel:** Nach einmaligem Hosten und Installation (PC und Handy) läuft die App **dauerhaft ohne jeden Server**, auch wenn der Host später abgeschaltet wird.

### 9.1 Manifest (`manifest.webmanifest`)
- `name`, `short_name`, `lang: "de"`, `id: "./"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "any"`, `theme_color`, `background_color`.
- Icons: 192, 512 (PNG, `any`) und **maskable** 512; zusätzlich `apple-touch-icon` (180). Icons werden aus einer SVG-Quelle generiert; einfaches, ruhiges Symbol (z. B. ein Faden/Pfeilkette).
- Metatags für iOS (`apple-mobile-web-app-capable`, Statusbar-Stil), `viewport-fit=cover`.

### 9.2 Service Worker (kritisch, sorgfältig prüfen)

Anforderungen an das Verhalten:
1. **Alle** Build-Artefakte (HTML, JS, CSS, Schriften, Icons, Manifest) werden **vorab** beim Installieren des Service Workers gecacht (**Precache**, kein Lazy-/Laufzeit-Caching nötig).
2. **Cache-first**, immer. Die App startet vollständig aus dem Cache, auch im Flugmodus und nachdem der Host verschwunden ist.
3. **Keine automatische Aktualisierung, die den Cache löschen kann.** Insbesondere darf der Service Worker **sich selbst oder seinen Cache niemals löschen/deregistrieren**, nur weil der Server nicht antwortet, `404`/`5xx`/Weiterleitungen/Captive-Portal-HTML liefert.
4. Navigationsanfragen (auch auf `#/…`-Routen und `index.html`) werden mit der gecachten `index.html` beantwortet.
5. Es gibt **keine** Runtime-Netzwerkaufrufe der App selbst.

> ⚠️ **Wichtiger Prüfauftrag zu `@angular/service-worker`:** Der Standard-Angular-Service-Worker (`ngsw`) fragt regelmäßig `ngsw.json` beim Server ab, um Updates zu finden. Nach meinem Kenntnisstand kann er sich bei **HTTP 404 auf `ngsw.json`** selbst **deregistrieren und alle Caches löschen**. Das wäre genau der Fall „Host wurde abgeschaltet, Domain/URL antwortet mit 404“ und würde den Kern der Anforderung („nie wieder hosten“) zerstören. **Der Agent muss das anhand des Quellcodes der installierten Version von `@angular/service-worker` und per praktischem Test (siehe 9.4) verifizieren.** Ergebnis in `docs/DECISIONS.md` dokumentieren.
>
> **Entscheidungsregel:**
> - **Variante A (bevorzugt, wenn Test bestanden):** `@angular/service-worker` mit `ngsw-config.json` (`installMode: "prefetch"`, `updateMode: "prefetch"`, alle App-Dateien in `assetGroups`, `registerImmediately`-Strategie). Bestehen nur, wenn **alle** Tests aus 9.4 grün sind, inklusive „Server liefert 404/500/leere Antwort“.
> - **Variante B (Fallback, falls Variante A den 404-Test nicht besteht und sich nicht entschärfen lässt):** **Eigener, minimaler Service Worker** (`public/sw.js`, ohne Fremdbibliothek oder mit Workbox-Precache nur dann, wenn dessen Verhalten dieselben Tests besteht). Eine Precache-Liste wird beim Build automatisch erzeugt (kleines Node-Skript nach `ng build`, das alle Dateien im Output samt Hash/Revision auflistet und in `sw.js` einsetzt). Verhalten: `install` → alle Dateien in `caches.open('faden-v1')` ablegen (`skipWaiting` nicht nötig); `fetch` → `caches.match` zuerst, Navigation → gecachte `index.html`, bei Cache-Miss Netzwerk als Notlösung; **niemals** Caches in `activate` löschen, außer es gibt eine **explizit nutzergesteuerte** neue Version (siehe 9.3). Registrierung in `main.ts`/`app.config.ts` manuell über `navigator.serviceWorker.register('./sw.js', { scope: './' })`.
>
> In beiden Varianten: Der Service Worker wird **nur in Produktionsbuilds** aktiviert.

### 9.3 Updates (bewusst zurückhaltend)
- Standard: **Es gibt keine Auto-Updates.** Die installierte Version bleibt für immer funktionsfähig.
- Optional und nutzergesteuert: In den Einstellungen Button **„Nach neuer Version suchen“**. Ist ein Server erreichbar **und** liefert er eine gültige, neuere Precache-Liste (HTTP 200, gültiges Format, Versionsnummer größer), wird ein Banner *„Neue Version verfügbar – jetzt aktualisieren?“* gezeigt. Die neue Version wird **erst vollständig in einen neuen Cache geladen**; der alte Cache wird nur gelöscht, wenn der neue **komplett und erfolgreich** geladen ist. Schlägt irgendetwas fehl, bleibt die alte Version unverändert. (Phase 3, nur wenn Variante B oder wenn Variante A sicher dafür konfigurierbar ist.)
- Versionsnummer der App in den Einstellungen anzeigen (aus `package.json` zur Buildzeit).

### 9.4 Pflichttests PWA / Offline (dokumentiert in `docs/PWA-TESTS.md`, wiederholbar)
Ein Skript oder eine Schritt-für-Schritt-Anleitung, um Folgendes mit einem **gebauten Produktionsbuild** hinter einem einfachen lokalen Static-Server zu prüfen:
1. App einmal online laden → Service Worker aktiv, Installierbarkeit (Lighthouse/DevTools „Installability“ ok).
2. **Server beenden** (Verbindungsfehler) → Seite neu laden, App startet vollständig, alle Funktionen laufen (Zettel anlegen, abhaken, Export).
3. **Server so umstellen, dass alles mit `404` antwortet** → Neu laden, mehrfach, auch nach mehreren Minuten/Neustart des Browsers: App läuft weiterhin; Service Worker bleibt registriert; Caches bleiben erhalten.
4. Server antwortet mit `500` und mit einer HTML-Seite (Captive-Portal-Simulation) für `sw.js`/Manifest/`ngsw.json` → App läuft unverändert.
5. Direkter Aufruf einer Hash-Route (`…/index.html#/zettel/xyz`) offline → funktioniert.
6. Daten bleiben nach Neustart erhalten (IndexedDB).
Fehlgeschlagene Tests sind **Blocker**, die Auslieferung gilt erst als fertig, wenn alle bestehen.

### 9.5 Installationshilfe in der App
- Unter „Einstellungen → Installieren“: erkennt `beforeinstallprompt` (Chrome/Edge/Android) und bietet **„App installieren“**; für **iOS/Safari** eine bebilderte/Text-Anleitung („Teilen → Zum Home-Bildschirm“) und den **Hinweis, dass nur installierte iOS-PWAs vor dem automatischen Löschen von Websitedaten (ca. 7 Tage Inaktivität in Safari) zuverlässig geschützt sind**.
- Anzeige: *„Offline bereit“*, sobald der Precache vollständig ist.

---

## 10. Projektstruktur (Vorschlag)

```
/
├─ SPEC.md                      (dieses Dokument)
├─ docs/
│  ├─ DECISIONS.md              (getroffene Entscheidungen, Abweichungen)
│  └─ PWA-TESTS.md
├─ src/
│  ├─ index.html, main.ts, styles.css (Tokens)
│  └─ app/
│     ├─ app.config.ts, app.routes.ts, app-meta.ts
│     ├─ core/
│     │  ├─ graph/              (rein: operations, validation, derive, layout-input)
│     │  ├─ time/               (rein: Zeitstatus, Formatierung, Strecken/Verschieben)
│     │  ├─ storage/            (IndexedDB, Migrationen, Export/Import, persist)
│     │  ├─ state/              (Signals-Stores: lists, templates, settings, undo)
│     │  └─ i18n/de.ts          (alle UI-Texte)
│     ├─ features/
│     │  ├─ lists/              (Zettel-Übersicht)
│     │  ├─ list-detail/        (Kopf, Umschalter, Menüs)
│     │  ├─ focus-view/         (Jetzt dran)
│     │  ├─ flow-view/          (Diagramm, Pan/Zoom, Layout, Pfeile)
│     │  ├─ task-editor/        (Bearbeiten-Sheet)
│     │  ├─ templates/
│     │  └─ settings/
│     └─ shared/                (Button, Sheet/Dialog, Snackbar, Chips, Icons)
└─ public/                      (Icons, Manifest, ggf. sw.js)
```

---

## 11. Umsetzungsphasen (in dieser Reihenfolge abarbeiten, jede Phase lauffähig und committet)

**Phase 1 – Fundament**
1. Angular-Projekt (aktuelle Version) anlegen, strikte TS-Einstellungen, Hash-Routing, relative `base href`, Design-Tokens, Hell/Dunkel.
2. `core/graph` mit allen Operationen aus Kapitel 4 und **vollständigen Unit-Tests** (inkl. Zyklen, Duplikate, Überbrücken-Löschen, jede Einfüge-Operation, UND-Semantik).
3. Storage (IndexedDB), State-Stores, Undo/Redo, Migrationsgerüst.
4. Zettel-Übersicht (CRUD, Archiv, Sortierung).

**Phase 2 – Kernfunktion**
5. Ansicht „Jetzt dran“ inkl. „Erst noch etwas anderes nötig …“, Ketten-Eingabe, Erledigt, Undo-Snackbar, Bearbeiten-Sheet.
6. Ansicht „Ablauf“: Layout, Pfeile, „+“ auf Pfeilen/Karten, Verbinden, Pan/Zoom.
7. Tastaturbedienung, A11y-Durchgang, Responsive-Durchgang (360 px, 768 px, 1280 px).

**Phase 3 – Timeboxing, Vorlagen, Backup, PWA**
8. `core/time` (rein, getestet) und Modi `estimate`, `dayPlan`, `schedule` inklusive Hinweisen, „Nachträglich abhaken“, Verschieben/Strecken.
9. Vorlagen.
10. Export/Import, `storage.persist()`, Backup-Erinnerung.
11. PWA (Kapitel 9) inklusive der Pflichttests, Installationshilfe.
12. Optionale Punkte (7.5, Update-Prüfung 9.3, Vorlage in bestehenden Zettel einfügen).

---

## 12. Tests und Abnahme

### 12.1 Unit-Tests (Pflicht)
- **Graph:** alle Operationen aus 4.3 (inkl. Randfälle: Einfügen vor Startknoten, nach Endknoten, zwischen Aufteilung/Zusammenführung, Löschen mit mehreren Vorgängern/Nachfolgern), Zyklusprüfung (direkt, indirekt, Selbstschleife), `isAvailable`/`isBlocked`/UND-Semantik, topologische Ordnung, Komponenten.
- **Zeit:** Statusableitung (Läuft gerade/Als Nächstes/Nicht abgehakt) mit festgelegter `now`; Grenzfälle (genau Start, genau Ende, über Mitternacht in `schedule`), Dauer-Formatierung, Verschieben und proportionales Strecken (inkl. Sommer-/Winterzeitumstellung bei lokaler Zeit), Bezugstag-Logik im Tagesplan.
- **Storage:** Export → Import (Roundtrip identisch), Validierung lehnt kaputte/zyklische Daten ab, Migration.
- **Undo/Redo:** Reihenfolge, Grenze von 100 Schritten, Redo-Verwerfen nach neuer Änderung.

### 12.2 Abnahmekriterien (alle müssen erfüllt sein)
1. **Beispielszenario Geschirrspüler:** Zettel anlegen mit dem ToDo „Geschirrspüler einräumen“. Über „Erst noch etwas anderes nötig …“ nacheinander eintragen: „Geschirr einsammeln“ → „Bioabfall in die Tonne“ → „Müll mitnehmen“ → „Herumliegenden Müll einsammeln“. Ergebnis: Kette in korrekter Reihenfolge, **nur „Herumliegenden Müll einsammeln“ ist „Jetzt dran“**. Nach Abhaken erscheint genau das nächste ToDo. Der gesamte Eintragsvorgang geht ohne Maus nur mit Tastatur.
2. **Aufteilen und Zusammenführen:** Ein ToDo in zwei parallele Zweige aufteilen und danach wieder in einem gemeinsamen ToDo zusammenführen; das gemeinsame ToDo ist erst „dran“, wenn **beide** Zweige erledigt sind.
3. **Mehrere unabhängige Stränge** in einem Zettel sowie **mehrere Zettel** funktionieren parallel.
4. **Einfügen:** Vor, nach und zwischen ToDos (auch zwischen zwei Verzweigungen und auf Pfeilen) gelingt per „+“ im Ablauf; Pfeile werden korrekt umgebaut.
5. **Keine Zyklen** sind erzeugbar, die Fehlermeldung ist verständlich.
6. **Undo/Redo** funktioniert für jede Änderungsart.
7. **Timeboxing:** Alle vier Modi funktionieren wie in Kapitel 7; Moduswechsel verliert keine Daten; „Nicht abgehakt“ lässt sich nachträglich abhaken; im Modus `schedule` lässt sich ein Plan verschieben und über einen neuen Zeitraum strecken.
8. **Responsive:** Bedienbar von 360 px bis Desktop; keine horizontal scrollende Seite außer innerhalb der Diagrammfläche; Tippflächen ≥ 48 px.
9. **PWA/Offline:** Alle Tests aus 9.4 bestanden. Lighthouse-PWA/Installierbarkeit ok, Lighthouse-Accessibility ≥ 95.
10. **Datensicherheit:** Export/Import-Roundtrip verlustfrei; Daten überleben Neustart; `storage.persist()` wird angefragt, Status sichtbar.
11. **Keine externen Requests** zur Laufzeit (im Netzwerk-Tab des Browsers nachgewiesen).
12. **Reizarm:** Keine automatischen Animationen bei `prefers-reduced-motion`; keine Konfetti-/Blink-Effekte; Dark Mode vollständig.

---

## 13. Bewusst nicht enthalten (Nicht-Ziele)

- Benutzerkonten, Cloud-Sync, Teilen/Kollaboration (ginge nicht ohne Server; widerspricht „einmal hosten“). Backup erfolgt per JSON-Export.
- **Push-/Hintergrund-Benachrichtigungen, Wecker, Alarme** (offline ohne Server nicht zuverlässig). Zeitbezogene Anzeigen aktualisieren sich nur, solange die App geöffnet/sichtbar ist.
- **Timer/Countdown** innerhalb der App (derzeit nicht gewünscht).
- Freies Positionieren von Karten im Diagramm.
- Wiederkehrende Aufgaben/Routinen mit Wiederholungsregeln (Vorlagen decken das Wiederverwenden ab).
- Gamification (Punkte, Streaks, Konfetti).

---

## 14. Annahmen und Entscheidungen (gelten, solange der Nutzer nichts anderes sagt)

1. **Automatisches Layout, kein freies Verschieben** (einfacher, handytauglich).
2. **Aufteilen/Zusammenführen** basiert auf UND-Logik (alle Vorgänger erforderlich).
3. **Löschen überbrückt Pfeile** standardmäßig (Vorgänger werden mit Nachfolgern verbunden).
4. **Abhaken ist nie blockiert**, auch bei offenen Vorgängern (dezenter Hinweis statt Verbot).
5. **Zeitsumme im Modus „estimate“ ist die Summe aller ToDos** (eine Person erledigt nacheinander), nicht der kritische Pfad.
6. **Tagesplan-Bezugstag** wie in 7.3 beschrieben (Banner „Auf heute setzen“, wenn der Plan veraltet ist).
7. **Zeiten werden als lokale Zeit ohne Zeitzone gespeichert.**
8. **Arbeitstitel „Faden“**, jederzeit änderbar.
9. **Standardansicht je Zettel ist „Jetzt dran“.**
10. **Hash-Routing** zugunsten beliebiger statischer Hosts und Offline-Start.
11. Ob `@angular/service-worker` verwendet werden darf, entscheidet das Ergebnis der Tests aus Kapitel 9 (Variante A oder B).

---

## 15. Definition of Done
- Alle Abnahmekriterien aus 12.2 sind erfüllt, alle Unit-Tests grün, `ng build` (Produktion) ohne Warnungen/Fehler.
- `README.md` mit: Entwicklung starten, Test ausführen, Produktionsbuild, **„Einmal hosten“-Anleitung** (Ordner `dist/…` auf beliebigen HTTPS-Host legen, einmal öffnen, installieren, danach darf der Host verschwinden), sowie Hinweise zu Backup und iOS.
- `docs/DECISIONS.md` und `docs/PWA-TESTS.md` vorhanden und aktuell.