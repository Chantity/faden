# Design-Prinzipien

Diese Datei hält fest, **wofür Faden da ist und nach welchen Regeln es gebaut wird.**
Sie ist die verbindliche Grundlage für jede neue Funktion und jede Änderung.
Wie die App technisch aufgebaut ist, steht in `docs/ARCHITECTURE.md`; wie man sie
bedient, in `docs/USER-GUIDE.md`.

Bei Zielkonflikten gilt: **Prinzipien vor Funktionsumfang.** Eine bewusste
Ausnahme wird hier im Abschnitt „Bewusste Ausnahmen“ mit Begründung vermerkt.

---

## Teil A – Produkt

### A1. Zweck und Zielgruppe

Faden richtet sich an Menschen mit **exekutiven Funktionsstörungen** und
**Problemen mit Objektpermanenz** (was nicht sichtbar ist, existiert gedanklich
nicht).

Ein ToDo ist selten sofort ausführbar; es hat Vorarbeiten, die wiederum
Vorarbeiten haben („Geschirrspüler einräumen“ → Geschirr einsammeln → Bioabfall
in die Tonne → …). Die Kette ist im Kopf zu lang und zu unsichtbar, und am Ende
passiert nichts.

Faden **macht die Abhängigkeiten sichtbar, ordnet sie als Ablauf und zeigt immer
nur, was jetzt dran ist.** Die App übernimmt die Objektpermanenz für den Rest der
Kette.

### A2. Leitprinzipien (bei jeder Entscheidung anwenden)

1. **Weniger gleichzeitig zeigen.** Standardansicht ist „Jetzt dran“, nicht der
   ganze Ablauf. Neue Funktionen werden schrittweise aufgedeckt (Zusammenfassung
   zuerst, Details auf Antippen), statt die Oberfläche zu füllen.
2. **Einfügen muss schneller gehen als Nachdenken.** Eine fehlende Vorarbeit
   einzutragen kostet höchstens 2 Taps bzw. 2 Tastendrücke; Enter bestätigt
   immer sofort.
3. **Nichts geht verloren, nichts wird bestraft.** Rückgängig überall, keine
   roten Alarme, keine Schuldgefühle erzeugenden Texte. Wo ein Rückgängig nicht
   reicht (Daten werden ersetzt), wird vorher automatisch eine Sicherung
   heruntergeladen.
4. **Reizarm.** Ruhige Farben, kaum Bewegung, keine Pop-ups ohne Not, keine
   Konfetti- oder Blink-Effekte, keine Gamification.
5. **Offline-first, für immer.** Nach einmaligem Laden funktioniert Faden ohne
   Netz und ohne Server – auch wenn der Host verschwunden ist.
6. **Reibung minimieren.** Jede Rückfrage, jeder Pflichtschritt und jedes
   zusätzliche Feld muss sich rechtfertigen. Gute Standardwerte statt Fragen.

### A3. Sprache und Begriffe

- Oberfläche auf **Englisch (Standard)** und **Deutsch**, zur Laufzeit
  umschaltbar. Neue Texte gibt es immer in beiden Sprachen.
- Einfache Sprache, kurze Sätze, **Du-Form**, freundlich, nie wertend
  (*„Nicht abgehakt“* statt *„Überfällig!“*).
- Fachbegriffe wie Graph, Knoten, Kante, DAG, Vorgänger/Nachfolger erscheinen
  **nirgends** in der Oberfläche. Begriffe:

| Intern | Deutsch | Englisch |
|---|---|---|
| List | Zettel | List |
| Task | ToDo | Todo |
| Edge | Pfeil („erst A, dann B“) | Arrow |
| Component | Strang | Strand |
| Available | Jetzt dran | Now |
| Template | Vorlage | Template |

Statt Fachbegriffen: „davor“, „danach“, „muss vorher erledigt sein“, „kommt
danach“.

### A4. Design und Barrierefreiheit

- **Farben:** gedämpfte Palette über Design-Tokens, Kontrast mindestens WCAG AA
  (Text AAA, wo möglich). Hell, Dunkel und System; Dunkel ist gleichwertig
  gestaltet.
- **Zustände nie nur über Farbe**, immer Icon + Text + Farbe.
- **Fehler und Verpasstes** in ruhigem Bernstein/Grau, neutral formuliert.
- **Schrift:** Systemschrift, Basisgröße ≥ 17 px, großzügiger Zeilenabstand,
  skaliert mit den Browser-Einstellungen (`rem`).
- **Tippflächen** ≥ 48 × 48 px (Hauptaktionen 56 px; die „+“ im Diagramm ≥ 44 px
  Trefferfläche bei kleinerem sichtbarem Symbol).
- **Bewegung:** minimal; `prefers-reduced-motion: reduce` schaltet alle
  Übergänge ab. Keine automatisch laufenden Animationen.
- **Bestätigungsdialoge** nur, wo Rückgängig nicht reicht.
- **Screenreader:** sinnvolle Rollen und Labels, Live-Region für Hinweisbänder,
  das Diagramm hat eine linearisierte Alternative („Jetzt dran“ + „Danach kommt
  noch …“).
- **Tastatur:** alles per Tastatur bedienbar, sichtbare Fokusrahmen, Fokus
  landet in neu erscheinenden Feldern und geht nach einer Aktion nie verloren.
- **Menüs** (⋯) schließen sich bei Klick/Tipp außerhalb und mit Esc.
- **Responsive:** ab 360 px Breite ohne horizontales Scrollen (außer in der
  Diagrammfläche). Unter 600 px Dialoge als Bottom-Sheets, über 1024 px
  zweispaltig mit einklappbarer Zettel-Liste. Safe-Area beachten, Querformat
  funktioniert.
- Ziel: Lighthouse-Accessibility ≥ 95 (zuletzt gemessen: 100).

### A5. Fachliche Grundregeln

**Ablauf (Zettel als gerichteter Graph):**

- Ein Zettel ist eine Zeichenfläche mit beliebig vielen **unabhängigen
  Strängen**; es gibt beliebig viele Zettel.
- **Keine Zyklen**, keine doppelten Pfeile, keine Pfeile ins Leere. Ein
  verbotener Pfeil wird mit einer verständlichen Meldung mit den Namen der
  ToDos abgelehnt, und nichts ändert sich.
- **Zusammenführen ist UND:** Ein ToDo ist erst „jetzt dran“, wenn **alle**
  Vorarbeiten erledigt sind – transitiv, also auch die mittelbaren.
- **Abhaken ist nie blockiert**, auch mit offenen Vorarbeiten (dezenter Hinweis
  „Vorarbeit noch offen“). Wieder-Aufhaken setzt Nachfolger nicht zurück.
- **Löschen überbrückt:** Vorgänger werden mit Nachfolgern verbunden, damit die
  Kette nicht reißt; „Löschen, ohne zu verbinden“ gibt es, wo es einen
  Unterschied macht.
- Das Diagramm wird **automatisch** von oben nach unten angeordnet (kein freies
  Positionieren), deterministisch und ohne Springen.
- Abgeleitete Zustände („jetzt dran“, „wartet“, Fortschritt) werden **nie
  gespeichert**, immer berechnet.

**Rückgängig:**

- Jede Änderung ist rückgängig machbar: **pro Zettel ein Verlauf** (≥ 100
  Schritte) und ein eigener Verlauf der **Übersicht**, dessen Befehle nur ihre
  eigene Wirkung umkehren.
- Löschen und Abhaken zeigen ein nicht-modales Hinweisband mit „Rückgängig“
  (ca. 8 s). Gelöschte Zettel werden erst nach einer Frist endgültig entfernt.

**Zeitplanung (Timeboxing):**

- Gilt **pro Zettel** und ist jederzeit umschaltbar: keine Zeitplanung,
  Zeitschätzung, Tagesplan (Uhrzeiten ohne Datum, mit Bezugstag), fester
  Zeitplan (Datum + Uhrzeit).
- **Moduswechsel verliert keine Daten.**
- **Kein Timer, kein Countdown, keine Benachrichtigungen, keine Wecker.**
  Faden rechnet nur mit; Anzeigen aktualisieren sich minütlich, solange die App
  sichtbar ist.
- Zeitsummen sind die **Summe** aller ToDos (eine Person arbeitet nacheinander),
  nicht der kritische Pfad.
- Zeiten werden als **lokale Zeit ohne Zeitzone** gespeichert.
- Hinweise zu Zeitkonflikten (Überschneidung, vor der Vorarbeit) sind weich und
  blockieren nie.

**Vorlagen:** speichern Struktur, Titel, Notizen, Dauern und Modus – nie den
Erledigt-Status und nie absolute Datumsangaben.

### A6. Daten und Datenschutz

- Alle Daten bleiben **lokal auf dem Gerät** (IndexedDB). Kein Konto, keine
  Cloud, kein Tracking, keine Cookies.
- `localStorage` nur für reine Anzeige-Merker (z. B. „Hinweis gesehen“), nie für
  Nutzdaten.
- **Keine Laufzeit-Requests zu Fremddomains** (keine CDNs, Schriften,
  Analytics). Links, die der Nutzer selbst anklickt, sind erlaubt.
- Speichern geschieht sofort im Speicher und entprellt in IndexedDB, sofort beim
  Verlassen der Seite. Fehler werden ruhig angezeigt, nie verschwiegen.
- `navigator.storage.persist()` wird angefragt, der Status ist sichtbar.
- **Backup** als JSON-Datei (Export, Teilen, Import mit vollständiger Prüfung;
  ungültige Dateien werden komplett abgelehnt). Ersetzen von Daten nur mit
  vorheriger automatischer Sicherung. Erinnerung höchstens einmal pro Woche,
  wenn das letzte Backup älter als 30 Tage ist.
- Das Speicherschema ist versioniert; Migrationen sind reine, getestete
  Funktionen. Mehrere Tabs bleiben über `BroadcastChannel` konsistent.

### A7. PWA: „Einmal hosten, nie wieder“

- Nach einmaligem Laden und Installieren läuft Faden **dauerhaft ohne Server**,
  auch wenn der Host abgeschaltet ist oder 404/500/Captive-Portal-Seiten liefert.
- **Keine automatischen Updates.** Eine neue Version gibt es nur auf Knopfdruck;
  sie wird vollständig geladen, bevor die alte ersetzt wird. Schlägt etwas fehl,
  bleibt alles, wie es war.
- Installationshilfe für alle Plattformen inkl. iOS-Hinweis (Safari löscht
  Daten nicht installierter Seiten nach ca. 7 Tagen).

### A8. Nicht-Ziele

- Benutzerkonten, Cloud-Sync, Kollaboration (Überlegungen für die Zukunft:
  `prepare-v3.md`, solange es existiert).
- Push-/Hintergrund-Benachrichtigungen, Wecker, Alarme, Timer.
- Freies Positionieren von Karten im Diagramm.
- Wiederkehrende Aufgaben mit Regeln (Vorlagen decken das Wiederverwenden ab).
- Gamification (Punkte, Streaks, Konfetti).

### A9. Bewusste Ausnahmen

| Ausnahme | Gegen | Begründung |
|---|---|---|
| Installations-Banner beim ersten Öffnen im Browser-Tab | A2.4 „keine Pop-ups ohne Not“ | Nutzerwunsch; nicht modal, einmal ignorierbar, nur wenn Installation möglich ist. |

---

## Teil B – Entwicklung

### B1. Technik-Rahmen

- **Angular** (aktuelle Hauptversion), standalone, **zoneless**, Signals,
  `OnPush`, `inject()`, neue Control-Flow-Syntax; keine NgModules.
- TypeScript `strict` und `noUncheckedIndexedAccess`.
- **Hash-Routing** und `base href="./"`: läuft auf jedem statischen Host, in
  jedem Unterverzeichnis, und startet aus dem Cache.
- Eigenes CSS mit Design-Tokens; kein UI-Framework.
- Eigener, minimaler Service Worker (Begründung in `docs/ARCHITECTURE.md`).

### B2. Abhängigkeiten

- **So wenige wie möglich.** Laufzeit: Angular, RxJS, tslib. Kein UI-Kit, keine
  Layout-, IndexedDB- oder i18n-Bibliothek. `@angular/cdk` nur bei konkretem
  Bedarf.
- Werkzeuge (Tests im Browser, Icons, Precache, Screenshots) sind eigene
  Node-Skripte ohne Fremdpakete.
- Ein neues Paket braucht eine ausdrückliche Zustimmung des Nutzers.

### B3. Code-Struktur

- **Reine Logik** (Graph, Zeit, Vorlagen, Migration, Backup-Prüfung) liegt
  framework-frei in `src/app/core/` und verändert nichts (Eingabe → neue
  Struktur). Sie ist das Herz der App und vollständig getestet.
- Zustand ausschließlich über Signal-Stores; jede Datenänderung eines Zettels
  läuft über eine Stelle (`ListsStore`) und ist damit ein Rückgängig-Schritt.
- Alle Oberflächentexte zentral in `core/i18n/` (`de.ts` ist die Vorlage, `en.ts`
  muss sie per `satisfies` vollständig erfüllen).
- Der App-Name steht an genau einer Stelle (`app-meta.ts`) plus Manifest.
- Code wie der umgebende Code: gleiche Benennung, Kommentar-Dichte, Muster.
  Bestehendes wiederverwenden, bevor Neues entsteht.

### B4. Tests

- **Unit-Tests** (Vitest) für jede reine Funktion, inklusive Grenzfällen
  (Zyklen, Verzweigungen, Sommer-/Winterzeit, Migration, Import-Roundtrip).
- **Komponententests** für Bedienabläufe mit Logik in der Komponente.
- **PWA-Pflichttests** (`npm run test:pwa`) gegen den Produktionsbuild in einem
  echten Browser: Offline, 404/500/Captive-Portal, keine Auto-Updates, Neustart,
  keine externen Requests (`docs/PWA-TESTS.md`).
- **Abnahmetests** (`npm run test:acceptance`): Tastatur-Szenarien, Responsive
  (360, quer, 768, 1280), Tippflächen, reduzierte Bewegung
  (`docs/ACCEPTANCE.md`).
- Was nur von Hand geht (Safari/iOS, Lighthouse), steht als offener Punkt in
  `docs/ACCEPTANCE.md`.
- Ein Fehlschlag ist ein Blocker; Tests werden nicht abgeschwächt, um grün zu
  werden – außer die Messung selbst war falsch (dann mit Begründung).

### B5. Definition of Done

Eine Änderung ist fertig, wenn:

1. sie vollständig umgesetzt ist (alle Aufrufer, Texte in beiden Sprachen,
   Tastatur und Screenreader bedacht),
2. `npm test` grün ist und `npm run build` ohne Warnungen läuft,
3. bei Oberflächen- oder PWA-Änderungen `npm run test:pwa` und
   `npm run test:acceptance` grün sind,
4. alle betroffenen Dokumente aktuell sind: `README.md`, `docs/ARCHITECTURE.md`,
   `docs/USER-GUIDE.md` (Englisch **und** Deutsch), `docs/ACCEPTANCE.md`,
   `docs/PWA-TESTS.md` und diese Datei,
5. sie committet ist.

### B6. Doku

- README und Benutzerhandbuch sind zweisprachig (erst Englisch, dann Deutsch,
  Sprungmarken `#english`/`#deutsch`); die übrigen Dokumente sind Deutsch.
- Dateinamen in `docs/` sind Englisch.
- Bleibende Entscheidungen landen in der passenden Datei (Prinzip → hier,
  Technik → `ARCHITECTURE.md`, Bedienung → `USER-GUIDE.md`).

### B7. Git

- Commits mit Autorin **Chantity** (`git -c user.name="Chantity"
  -c user.email="herrfrautut@gmail.com" commit …`), ohne Claude-Attribution.
- Committen in sinnvollen, lauffähigen Schritten ist erwünscht.
- **Niemals pushen.** Das macht ausschließlich der Nutzer.
- Deployment: Ein Push auf `main` veröffentlicht über GitHub Actions auf GitHub
  Pages (`.github/workflows/deploy.yml`, mit Unit-Tests vor dem Build).
