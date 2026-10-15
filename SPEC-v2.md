# SPEC v2: „Faden“

> **Zielgruppe:** der Coding-Agent, der v2 umsetzt.
> **Grundlage:** `v2-requirements.md` (Wünsche des Nutzers) und die bestehende App 1.0.0.
> **Prinzipien:** Ab Phase 0 gilt `docs/DESIGN-PRINCIPLES.md`. Bis dahin gelten `SPEC.md` und `docs/DECISIONS.md`. Bei Zielkonflikten gehen die Prinzipien vor. Ausnahmen sind hier ausdrücklich benannt.
> **Reihenfolge der Umsetzung:** `PLAN-v2.md`.
> **Versionen:** Die **App** geht von 1.0.0 auf **2.0.0**. Das **Speicherschema** (`SCHEMA_VERSION`, gespeicherte Daten und Backups) geht von 2 auf **3**. Beides sind getrennte Nummern.

---

## 0. Vorarbeiten

1. **`docs/DESIGN-PRINCIPLES.md`** neu anlegen. Darin stehen alle Prinzipien aus `SPEC.md`, `docs/DECISIONS.md` und den übrigen Dokumenten unter `docs/`.
   - **Produkt:** Zweck und Zielgruppe, Leitprinzipien (weniger zeigen, Einfügen schneller als Nachdenken, nichts geht verloren, reizarm, offline-first), Design und Barrierefreiheit, Sprache und Ton, Begriffe der Oberfläche, Timeboxing-Grundsätze, Datensicherheit, PWA „einmal hosten“, Nicht-Ziele.
   - **Entwicklung:** Technik-Rahmen (Angular, zoneless, Signals, Hash-Routing), minimale Abhängigkeiten, reine und getestete Logikmodule, Testpyramide (Unit-, PWA- und Abnahmetests), Definition of Done, i18n (Englisch Standard, Deutsch), Doku-Pflege, Commit-Regeln (Autorin Chantity, keine Claude-Attribution, **nie pushen**).
2. **`SPEC.md` und `docs/DECISIONS.md` löschen.**
   - Verweise darauf in README, `docs/` und Code-Kommentaren („SPEC 5.1“ o. ä.) entfernen oder auf DESIGN-PRINCIPLES umstellen.
   - `docs/ACCEPTANCE.md` erhält eine eigene, vollständige Kriterienliste statt des Verweises auf SPEC 12.2.
3. **Doku-Pflege ist Teil jeder Phase:** `README.md`, `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`, `docs/ACCEPTANCE.md`, `docs/PWA-TESTS.md` und `docs/DESIGN-PRINCIPLES.md` bleiben während der ganzen Umsetzung von v2 aktuell.

---

## 1. Datenmodell: Schema-Version 3

Alle Änderungen laufen über `migrate()` (`src/app/core/storage/`) als reine, getestete Funktion. Das gilt für gespeicherte Daten **und** für importierte Backups.

| Änderung | Detail |
|---|---|
| **Checkliste** | `Task.checklist?: ChecklistItem[]` mit `ChecklistItem = { id: string; text: string; done: boolean }`. Ist `checklist` gesetzt, ist die Beschreibung eine Checkliste; sonst gilt `notes`. Es wird immer nur **eine** Form gespeichert. Grenzen: höchstens 100 Punkte, je höchstens 200 Zeichen, Text nicht leer. |
| **Dauer statt Ende** | `estimateMinutes` (in der Oberfläche „Dauer“) ist in **allen** Modi die Dauer: Schätzung in `estimate`, Plan-Dauer in `dayPlan`/`schedule`. Der Start bleibt `dayStart` (`HH:mm`) bzw. `startAt` (`YYYY-MM-DDTHH:mm`). Das **Ende wird berechnet**, nie gespeichert. `dayEnd` und `endAt` entfallen. |
| Migration Dauer | Sind Start und Ende gesetzt, gilt Dauer = Ende − Start. Das überschreibt eine abweichende Schätzung, denn der konkrete Plan gewinnt. Ist nur das Ende gesetzt, gilt Start = Ende − (`estimateMinutes` ?? 15) und Dauer = `estimateMinutes` ?? 15. Ist nur der Start gesetzt, bleibt alles, wie es ist. Haben `dayStart`/`dayEnd` und `startAt`/`endAt` beide Werte, werden beide Paare umgerechnet. Weichen die Dauern ab, gewinnt das Paar des aktiven Modus. |
| **Eindeutige Zettel-Namen** | Bestehende Duplikate (Vergleich siehe 4.9) erhalten bei der Migration „ (2)“, „ (3)“ usw. Das ältere `createdAt` behält den Namen. |
| Backup | Die Validierung in `backup.ts` kennt `checklist`; ältere Schemata werden vorher migriert, `dayEnd`/`endAt` in einer Schema-3-Datei werden ignoriert. Die Migrationsschritte für Zettel/Vorlagen sind idempotent und laufen auch beim Laden aus IndexedDB. Neue `BackupIssueCode`s erhalten Übersetzungen. |

---

## 2. ToDos anlegen und beschreiben

### 2.1 Anlegen mit vollem Sheet (einheitlich)

- **Jedes** Anlegen eines ToDos öffnet das Sheet, das bisher nur zum Bearbeiten diente (`TaskEditor`, jetzt mit Modus *anlegen*). Das gilt für ✚ „Neues eigenes ToDo“, „Erst noch etwas anderes nötig …“ (V), „Danach einfügen“ (N), alle „+“ im Ablauf, die Menüpunkte „Nachfolge-/Voraufgabe erstellen“, „Neuer eigener Strang“ und den leeren Zettel.
- Felder: Titel, Beschreibung (Text oder Checkliste, 2.2) und Zeit (je nach Modus, Kapitel 3). Die Listen „Muss vorher erledigt sein / Kommt danach“ erscheinen erst beim Bearbeiten.
- **Schnellweg bleibt:** Der Fokus liegt im Titel. **Enter im Titelfeld legt das ToDo sofort an.** Im Modus „Keine Zeitplanung“ ist das Sheet deshalb kaum langsamer als das bisherige Eingabefeld.
- **Ketten-Eingabe** über „Erst noch etwas anderes nötig …“: Nach Enter öffnet sich das Sheet sofort leer für die nächste Vorarbeit, wie bisher das Eingabefeld. „Fertig“ übernimmt die aktuelle Eingabe und beendet die Kette; „Abbrechen“ bzw. Esc beendet sie ohne die aktuelle Eingabe.
- Das Geschirrspüler-Szenario (Abnahme 1) muss weiter nur mit der Tastatur gelingen.

### 2.2 Beschreibung als Text oder Checkliste

- Im Sheet steht über der Beschreibung ein Umschalter **„Text | Checkliste“** (Segmented Control, `radiogroup`). Er ist beim Anlegen und beim Bearbeiten verfügbar.
- **Checkliste bearbeiten:** Jeder Punkt hat ein Textfeld, einen Haken und „Entfernen“. Enter in einem Punkt legt direkt darunter einen neuen an. *Umgesetzt ohne „Nach oben/unten“:* Auf 360 px blieben neben drei Knöpfen nur etwa 110 px für den Text; neue Punkte entstehen dafür an der Stelle, an der man Enter drückt.
- **Umwandeln, ohne Inhalt zu verlieren:**
  - Checkliste → Text: Jeder Punkt wird zu `- {text}\n`. **Der Haken geht verloren** (Entscheidung des Nutzers). Der Wechsel ist rückgängig machbar.
  - Text → Checkliste: Jede **nicht-leere Zeile** wird ein offener Punkt. Ein führendes `- ` oder `-` wird entfernt, Leerzeichen am Rand werden getrimmt. Zeilen über 200 Zeichen werden gekürzt, und es gibt einen Hinweis.
  - Beide Funktionen sind rein (`src/app/core/`) und unit-getestet, inklusive Roundtrip Text → Checkliste → Text.
- **Abhaken unterwegs:** In „Jetzt dran“ zeigt eine Karte mit Checkliste den Fortschritt („2 von 5“) und die Punkte zum Aufklappen. Die Punkte sind **direkt dort abhakbar** (`checkbox`-Semantik, Tippfläche ≥ 48 px, Undo pro Haken). Im Ablauf steht nur „☑ 2/5“ an der Karte.
- Ein Punkt der Checkliste hakt **nicht** das ToDo ab. Sind alle Punkte erledigt, zeigt die Karte dezent „Alles auf der Liste erledigt“, und der „Erledigt“-Knopf bleibt wie gewohnt.

---

## 3. Zeitplanung in „Tagesplan“ und „Fester Zeitplan“

Alle Rechnungen sind reine Funktionen in `src/app/core/time/` und vollständig unit-getestet, inklusive Sommer-/Winterzeit im festen Zeitplan. Jede Aktion ist **ein** Undo-Schritt.

### 3.1 Start + Dauer statt von–bis

- Eingabe: **Startzeit** (Uhrzeit bzw. Datum + Uhrzeit) und **Dauer** (Chips 5, 10, 15, 30, 45, 60, 90 Min + freie Eingabe, wie bei der Zeitschätzung).
- Das gilt beim Anlegen (2.1) und beim Bearbeiten.
- Validierung im Tagesplan: Das Ende darf höchstens 24:00 sein; über Mitternacht geht weiterhin nur der feste Zeitplan.
- Statusanzeige (Läuft gerade / Als Nächstes / Nicht abgehakt), weiche Hinweise, Gruppierung nach Tagen und „Zeiten aus Schätzungen vorschlagen“ arbeiten mit dem berechneten Ende.
- Moduswechsel: Die Dauer bleibt in allen Modi erhalten. Das Angebot „Tageszeiten auf ein Datum übertragen“ überträgt nur noch den Start.

### 3.2 Zeitversatz für Zettel oder Strang

- Der Dialog „Zeitplan bearbeiten → Alles verschieben“ (`plan-editor.ts`) bekommt einen **Bereich**: „ganzer Zettel“ oder „dieser Strang“.
- Aufruf im **Ablauf**:
  - Zettel-Menü (⋯) → „Zeitplan bearbeiten“ für den ganzen Zettel.
  - ⋯ einer Karte → **„Strang verschieben …“** für den Strang dieser Karte (`connectedComponents`).
- Richtung: früher oder später, um Minuten, Stunden und (fester Zeitplan) Tage. Vorher steht eine Vorschau der ersten und letzten Zeit.
- Verschoben werden nur ToDos mit Startzeit; erledigte ToDos werden mitverschoben, damit Pausen erhalten bleiben.

### 3.3 Pause am Pfeil

- Pause = Start(danach) − Ende(davor).
- Sie wird klein und gedämpft am Pfeil angezeigt („Pause 15 Min“), **nur wenn** beide ToDos eine Startzeit haben und die Pause **> 0** ist.
- **Entscheidung:** Ist die Pause 0, steht kein Label am Pfeil; das hält das Diagramm ruhig. Bei negativer Pause (Überlappung) ebenfalls nicht; dafür gibt es die bestehenden weichen Hinweise.
- Wie die „+“-Knöpfe wird sie bei Zoom < 100 % ausgeblendet.
- Screenreader: Die Pause wird Teil des Pfeil-Labels.

### 3.4 Einfügen mit relativen Zeiten

Die Funktion greift beim Anlegen über eine Position (2.1), wenn der Zettel im Modus `dayPlan`/`schedule` ist **und** die Nachbarn eine Startzeit haben. Sonst gilt die normale Eingabe (3.1).

**Vor dem ersten ToDo eines Strangs:**
- Felder: **Dauer** und **Pause danach** (bis zum bisherigen ersten ToDo).
- Option (Radio, Standard zuerst):
  1. **„Davor einplanen“:** Ende(neu) = Start(erstes) − Pause. Sonst ändert sich nichts.
  2. **„Startzeit beibehalten“:** Das neue ToDo beginnt zur bisherigen Startzeit des Strangs. **Alle Nachfolger im Strang** (nicht der ganze Zettel) rücken um Dauer + Pause nach hinten.

**Nach dem letzten ToDo eines Strangs:**
- Felder: **Pause davor** und **Dauer**. Start(neu) = Ende(letztes) + Pause.

**Zwischen ToDos** (auf einem Pfeil A → B oder „danach einfügen“ an einer Verzweigung):
- Felder: **Dauer** und **Pause danach** (zum Nachfolger).
- Die **bisherige Pause A → B wird zur Pause A → neu**: Start(neu) = Ende(A) + alte Pause. Bei mehreren Vorgängern zählt der, der zuletzt endet.
- Modus (Radio, Standard zuerst):
  1. **„Danach alles nach hinten schieben“:** Alle transitiven Nachfolger des neuen ToDos rücken um Dauer + Pause nach hinten.
  2. **„Davor alles nach vorne schieben“:** Das neue ToDo endet mit „Pause danach“ vor B. Alle transitiven Vorgänger, also A und dessen Vorgänger, rücken um Dauer + Pause nach vorne.
- Mit Verzweigung (mehrere Nachfolger) beziehen sich „Pause danach“ und der Versatz auf den **frühesten** Nachfolger. Alle Nachfolger rücken um denselben Betrag, damit ihre Abstände erhalten bleiben.

**Für alle drei Fälle:**
- Ein Link **„Uhrzeit direkt eingeben“** wechselt zur normalen Eingabe (Start + Dauer); „Relativ eingeben“ wechselt zurück. Zeiten dürfen sich grundsätzlich überlappen; dann gibt es nur die weichen Hinweise.
- Verschoben wird nur innerhalb des Strangs (`connectedComponents`), nie in anderen Strängen.

### 3.5 Gegen Überladung: schrittweise Aufdeckung

- Im Sheet sind **Titel und Beschreibung** immer sichtbar.
- **Zeit** ist **eine Zusammenfassungszeile**, etwa „14:30 · 30 Min · Pause davor 10 Min“ oder „Keine Zeit“. Erst ein Antippen klappt die Felder auf (`<details>` bzw. ein Knopf mit `aria-expanded`). Im Modus `dayPlan`/`schedule` ist sie beim Anlegen **aufgeklappt**, weil dort fast immer eine Zeit gewünscht ist (Wunsch des Nutzers).
- Relative Eingabe (3.4): zwei Felder. Die Verschiebe-Optionen erscheinen **nur, wenn tatsächlich etwas verschoben würde**, zusammen mit einer Vorschauzeile, etwa „Danach rücken 3 ToDos um 40 Min nach hinten (‚Spülen‘ dann 15:10)“.
- Keine neuen Knöpfe in Kopfzeilen. Neue Aktionen leben in bestehenden ⋯-Menüs oder im Sheet.
- Pausen-Labels nur bei > 0 und Zoom ≥ 100 %.

---

## 4. Polishing

1. **Jedes ⋯-Menü schließt sich bei einem Klick bzw. Tipp irgendwo außerhalb.** Das gilt für die Karten der Übersicht, archivierte Zettel (neu, 4.7), Karten in „Jetzt dran“, Karten im Ablauf, das Zettel-Menü in der Detailansicht und die Vorlagen. Esc schließt ebenfalls, und der Fokus kehrt zum ⋯ zurück. Ein Abnahmetest prüft jedes Menü.
2. **Modus-Chip in der Detailansicht:** Er steht unter den Metadaten bzw. über dem Umschalter „Jetzt dran | Ablauf“, genauso wie in der Übersicht (`modeLabel`, `.badge`). Beim Modus „Keine Zeitplanung“ gibt es keinen Chip, wie in der Übersicht.
3. **Modus-Chip in der Seitenleiste** (Desktop > 1024 px), je Eintrag.
4. **Automatisch archivieren:**
   - Wann: wenn der Nutzer die Zettel-Übersicht betritt.
   - Welche Zettel: alle nicht archivierten mit **mindestens einem ToDo**, bei denen **alle ToDos erledigt** sind.
   - Ein ruhiges Hinweisband „‚X‘ archiviert“ bzw. „3 Zettel archiviert“ bietet **Rückgängig**, als ein Command in `ListsStore`.
   - Leere Zettel werden nicht archiviert.
5. **Chip mit dem Modus** auch an archivierten Zetteln.
6. **Aufklappbare Liste an archivierten Zetteln:** `<details>` „Enthaltene ToDos (n)“ mit allen Titeln in Ablauf-Reihenfolge (`topologicalOrder`), ohne die Angaben „wartet auf“.
7. **⋯-Menü an archivierten Zetteln:**
   - **Umbenennen:** derselbe Dialog wie für aktive Zettel.
   - **Duplizieren:** Die Kopie ist **nicht archiviert**, alle Haken sind entfernt, und sie heißt nach 4.9.
   - **Zettel als Vorlage speichern.**
   - „Wiederherstellen“ und „Löschen“ bleiben erhalten.
8. **Hinweis zum lokalen Speicher**, einmalig beim ersten Start:
   - Modaler Dialog. Text sinngemäß: „Faden speichert keine Cookies. Damit die App funktioniert, legt sie deine Zettel und Einstellungen im Speicher dieses Browsers ab. Sie verlassen dein Gerät nicht. Wenn du damit nicht einverstanden bist, verlasse diese Seite bitte.“
   - Knopf **„Verstanden“** setzt `localStorage['faden.storageNoticeAck'] = '1'`.
   - Der Dialog lässt sich nicht per Esc oder Klick daneben schließen; nur „Verstanden“ schließt ihn.
   - **Bewusste Ausnahme** von „keine Pop-ups ohne Not“ (Wunsch des Nutzers). Er erscheint nur einmal.
   - **Reihenfolge der Erst-Start-Hinweise:** Speicher-Hinweis (4.8) → Anleitung (5.3) → Installations-Banner (erst wenn beide Popups erledigt sind).
9. **Eindeutige Zettel-Namen:**
   - Vergleich: getrimmt, ohne Unterscheidung von Groß-/Kleinschreibung (`titleKey`: `trim().toLocaleLowerCase()`; Umlaute bleiben verschieden, „Bär“ ≠ „Bar“), über aktive **und** archivierte Zettel. Soft-gelöschte Zettel zählen nicht.
   - Im Anlegen- bzw. Umbenennen-Dialog: ruhiger Inline-Hinweis „Es gibt schon einen Zettel mit diesem Namen.“; Anlegen/Speichern ist gesperrt.
   - **Automatisch entstehende Namen** werden eindeutig gemacht mit „ (2)“, „ (3)“ usw. Das betrifft Duplizieren (ersetzt das bisherige „ (Kopie)“), „Neuer Zettel aus Vorlage“, Undo eines Löschens (falls der Name inzwischen vergeben ist) und den Import (4.10). Hilfsfunktion `uniqueTitle(title, existing)` als reine, getestete Funktion.
   - Vorlagen sind nicht betroffen.
10. **Konflikte beim „Zusammenführen“ eines Backups:**
    - Ein **Konflikt** ist ein importierter Zettel, dessen Name (Vergleich wie 4.9) lokal schon existiert. Gleiche IDs mit anderem Namen bekommen wie bisher eine neue ID.
    - Gibt es Konflikte, zeigt ein Dialog die betroffenen Namen und **eine** Wahl für alle:
      1. **„Mit (2), (3) … importieren“:** Der importierte Zettel erhält einen eindeutigen Namen.
      2. **„Überschreiben“:** Der Inhalt des lokalen Zettels wird ersetzt; ID und Position in der Übersicht bleiben. Vorher wird **automatisch eine Sicherung heruntergeladen**, wie bei „Alles ersetzen“.
      3. **„Nicht importieren“:** Gleichnamige Zettel werden übersprungen.
      4. **„Nur neuere importieren“:** Ersetzt wird nur, wenn `updatedAt` des Imports **neuer** ist. Bei Gleichstand oder älterem Stand wird übersprungen; vorher gibt es dieselbe Sicherung wie bei 2.
    - Zettel ohne Konflikt werden normal importiert. Vorlagen verhalten sich wie bisher.
    - Umsetzung als reine Funktion `resolveConflicts(local, incoming, strategy)` in `src/app/core/storage/backup.ts`. Sie ist **bewusst unabhängig von der Import-Oberfläche**, damit v3 (Sync, siehe `prepare-v3.md`) sie wiederverwenden kann.
    - Ergebnis-Hinweis: „5 importiert, 2 übersprungen, 1 überschrieben“.

---

## 5. Anleitung und Verlinkung

1. **`docs/USER-GUIDE.md` deutlich ausbauen.** Englisch und Deutsch, Aufbau je Sprache:
   - Erste Schritte
   - Zettel-Übersicht (inkl. Archiv)
   - Zettel: „Jetzt dran“
   - Zettel: „Ablauf“
   - ToDo anlegen und bearbeiten (Sheet, Checkliste, Zeit)
   - Zeitplanung (vier Modi, relatives Einfügen, Verschieben, Pausen)
   - Vorlagen
   - Einstellungen
   - Daten, Backup und Offline (inkl. Konflikte beim Zusammenführen)
   - Tastatur
   - Wenn etwas schiefgeht
   - **Jede einzelne Funktion** einer Seite wird erklärt. Wo es hilft, gibt es **zugeschnittene Screenshots**.
2. **Eine Anleitung für Handy und PC** (Entscheidung des Nutzers). Abweichungen stehen in kurzen Kästen **„Am PC“ / „Auf dem Handy“**.
   - Screenshots im Handyformat (360 px); vom Desktop (1280 px) nur dort, wo es anders aussieht (Seitenleiste, Diagramm).
   - Screenshots **pro Sprache**, damit die Oberfläche im Bild zum Text passt.
   - Sie entstehen **automatisch** mit `scripts/screenshots.mjs` über `scripts/lib/browser.mjs` (CDP, `clip` auf den Element-Rahmen, Testdaten wie im Abnahmetest) und liegen in `docs/images/{en,de}/`.
   - Bildgröße im Blick behalten, weil sie mit vorab gecacht werden; Richtwert insgesamt < 1,5 MB.
3. **Popup „Anleitung lesen“** nach dem Speicher-Hinweis (4.8), einmalig:
   - Kurzer Text, Knöpfe **„Anleitung lesen“** und **„Ignorieren“**.
   - Beide setzen `localStorage['faden.guideOffered'] = '1'`.
   - „Anleitung lesen“ öffnet den **Anleitungs-Dialog** im Vollbild (auf dem Handy als Bottom-Sheet in voller Höhe), gerendert und direkt zum Teil der eingestellten Sprache gescrollt (`#english` / `#deutsch`).
   - **Rendering beim Build:** `scripts/guide.mjs` wandelt `docs/USER-GUIDE.md` mit einem eigenen kleinen Markdown-Konverter um. Er beherrscht nur, was die Anleitung nutzt: Überschriften mit Ankern, Absätze, Listen, Tabellen, fett/kursiv/Code, Links, Bilder. **Keine neue Abhängigkeit.**
   - Das Skript schreibt `public/guide/guide.html` und kopiert die Bilder nach `public/guide/images/`; beides ist in `.gitignore`. Die Dateien landen im Precache und sind damit **offline** verfügbar.
   - `npm run build` = `node scripts/guide.mjs && ng build && node scripts/precache.mjs`.
   - Die App lädt `guide/guide.html` vom eigenen Ursprung und zeigt es per `[innerHTML]` (Angular-Sanitizer bleibt aktiv). Relative Bildpfade müssen funktionieren.
   - Der Konverter bekommt Unit-Tests für die genutzten Elemente.
4. **Einstellungen: Knopf „Anleitung lesen“**, der denselben Dialog öffnet.
5. **Einstellungen: Link zum GitHub-Repository.** Die URL steht als `APP_REPO_URL` in `src/app/app-meta.ts`. Der Link öffnet mit `target="_blank" rel="noopener"`. Ein Link ist eine Navigation durch den Nutzer und keine Laufzeit-Anfrage, das Prinzip „keine externen Requests“ bleibt also gewahrt. URL: `https://github.com/Chantity/faden`.

---

## 6. Tests und Abnahme

- **Unit-Tests** für jede neue reine Funktion: Migration auf Schema 3 (alle Fälle aus Kapitel 1), Umwandlung Checkliste ↔ Text, Ende- und Pausenberechnung, relatives Einfügen (alle Fälle und beide Modi, Verzweigungen), Verschieben pro Strang, `uniqueTitle`, `resolveConflicts` (alle vier Strategien), automatisches Archivieren (Command inkl. Undo), Markdown-Konverter.
- **Komponententests:** Sheet im Anlege-Modus (Enter legt an, Kette), Checkliste abhaken auf der Karte, Konflikt-Dialog, Popups (localStorage-Schlüssel).
- **Abnahmetest** (`scripts/acceptance-test.mjs`) erweitern:
  - Geschirrspüler-Szenario mit Sheet nur per Tastatur.
  - Jedes ⋯-Menü schließt per Klick außerhalb.
  - Popups beim Erst-Start und danach nie wieder.
  - Checkliste auf dem Handy abhaken.
  - Responsive-Prüfungen inkl. Sheet und Anleitungs-Dialog.
- **PWA-Tests:** Die Anleitung samt Bildern ist offline verfügbar. Alle bestehenden Tests bleiben grün. Browser-Tests setzen die Popup-Schlüssel vorab, wo die Popups nicht Gegenstand des Tests sind.
- `docs/ACCEPTANCE.md` listet alle Kriterien (alte und neue) mit Nachweis.

## 7. Definition of Done v2

- Alles aus diesem Dokument ist umgesetzt. Unit-, PWA- und Abnahmetests sind grün. `npm run build` läuft ohne Warnungen.
- Alle Dokumente in `docs/` sowie die README sind aktuell. `docs/DESIGN-PRINCIPLES.md` enthält neue Prinzipien bzw. bewusste Ausnahmen (4.8, 5.3).
- App-Version **2.0.0**, Schema-Version **3**.
- `SPEC-v2.md` und `PLAN-v2.md` sind gelöscht, ihre bleibenden Entscheidungen stehen in `docs/`. `prepare-v3.md` bleibt.
- Jede Phase ist committet (Autorin Chantity). **Kein Push.**
