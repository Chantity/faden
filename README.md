# Faden

[English](#english) · [Deutsch](#deutsch)

---

## English

**Faden arranges todos as a flow and only ever shows you what is up next.**

Many tasks have prerequisites, which in turn have prerequisites. Faden makes
this order visible and keeps track of the rest of the chain for you – made for
people who find it hard to hold invisible sequences in their head.

- **Calm and low-stimulus:** no alarms, no guilt, no animations.
- **Nothing gets lost:** everything can be undone.
- **Offline, no server:** all data stays local on your device.

The app is available in **English** (default) and **German** (Settings →
Language).

### Basic usage

1. **Create a list** – a list is a to-do list with a flow.
2. **“Now”** shows only the todos you can actually do right now.
3. If a prerequisite is missing, add it in seconds right in front of it with
   **“Something else has to come first …”**.
4. **“Done”** checks a todo off; the next one moves up automatically.
5. The **“Flow”** view shows the whole list as a flowchart.

Detailed instructions are in the [user guide](docs/USER-GUIDE.md#english),
changes per version in the [changelog](CHANGELOG.md#english).
The technical structure is described in the
[architecture](docs/ARCHITECTURE.md) (German).

### Development

```bash
npm install
npm start               # dev server at http://localhost:4200
npm test                # unit tests (Vitest)
npm run build           # production build into dist/faden/browser
npm run test:pwa        # mandatory offline tests (Edge/Chrome headless)
npm run test:acceptance # acceptance: keyboard, responsive, reduced motion
npm run test:scripts    # tests for the build scripts (guide converter)
```

**Deployment:** Every push to `main` runs the unit tests, builds the app and
publishes it to **GitHub Pages** (`.github/workflows/deploy.yml`). In the
repository settings, set *Pages → Source* to **GitHub Actions** once.

**Host once:** Put the contents of `dist/faden/browser` on any HTTPS host (or
use GitHub Pages), open the page once, wait until Settings shows “Offline
ready”, and install it. After that the host may disappear – Faden then runs
entirely from the local cache and **never updates by itself** (About →
“Check for a new version”). **iOS:** only the installed app (Share → Add to
Home Screen) is protected from Safari's automatic data deletion. Download a
backup regularly (Settings).

### Documentation

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md) – detailed usage (English/German).
- [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) – product and
  development principles (German).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – technical structure and
  decisions (German).
- [docs/PWA-TESTS.md](docs/PWA-TESTS.md) – mandatory offline tests (German).
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) – status of the acceptance criteria
  (German).

---

## Deutsch

**Faden ordnet ToDos als Ablauf und zeigt dir immer nur, was jetzt dran ist.**

Viele Aufgaben haben Vorarbeiten, die wiederum Vorarbeiten haben. Faden macht
diese Reihenfolge sichtbar und merkt sich die restliche Kette für dich – gedacht
für Menschen, denen es schwerfällt, unsichtbare Abläufe im Kopf zu halten.

- **Ruhig und reizarm:** keine Alarme, keine Schuldgefühle, keine Animationen.
- **Nichts geht verloren:** alles rückgängig zu machen.
- **Offline, ohne Server:** alle Daten bleiben lokal auf deinem Gerät.

Die App gibt es auf **Englisch** (Standard) und **Deutsch** (Einstellungen →
Sprache).

### Grundsätzliche Bedienung

1. **Zettel anlegen** – ein Zettel ist eine ToDo-Liste mit Ablauf.
2. In „**Jetzt dran**" siehst du nur die Aufgaben, die gerade machbar sind.
3. Fehlt eine Vorarbeit, trägst du sie mit **„Erst noch etwas anderes nötig …"**
   in Sekunden direkt davor ein.
4. **„Erledigt"** hakt ab; danach rückt automatisch die nächste Aufgabe nach.
5. Die Ansicht **„Ablauf"** zeigt den ganzen Zettel als Ablaufdiagramm.

Die ausführliche Anleitung steht im
[Benutzerhandbuch](docs/USER-GUIDE.md#deutsch), die Änderungen je Version im
[Änderungsprotokoll](CHANGELOG.md#deutsch). Wie die App technisch aufgebaut
ist, beschreibt die [Architektur](docs/ARCHITECTURE.md).

### Entwicklung

```bash
npm install
npm start               # Dev-Server auf http://localhost:4200
npm test                # Unit-Tests (Vitest)
npm run build           # Produktionsbuild nach dist/faden/browser
npm run test:pwa        # Offline-Pflichttests (Edge/Chrome headless)
npm run test:acceptance # Abnahme: Tastatur, Responsive, Reizarm
npm run test:scripts    # Tests der Build-Skripte (Anleitungs-Konverter)
```

**Deployment:** Jeder Push auf `main` führt die Unit-Tests aus, baut die App
und veröffentlicht sie auf **GitHub Pages** (`.github/workflows/deploy.yml`).
Dazu einmalig in den Repository-Einstellungen unter *Pages → Source*
**GitHub Actions** auswählen.

**Einmal hosten:** Den Inhalt von `dist/faden/browser` auf einen beliebigen
HTTPS-Host legen (oder GitHub Pages nutzen), die Seite einmal öffnen, warten bis
die Einstellungen „Offline bereit" zeigen, und installieren. Danach darf der
Host verschwinden – Faden läuft dann vollständig aus dem lokalen Cache und
aktualisiert sich **nie von selbst** (Über → „Nach neuer Version
suchen"). **iOS:** nur die installierte App (Teilen → Zum Home-Bildschirm) ist
vor Safaris automatischem Löschen geschützt. Regelmäßig ein Backup
herunterladen (Einstellungen).

### Dokumentation

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md) – ausführliche Bedienung
  (Englisch/Deutsch).
- [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) – Produkt- und
  Entwicklungsprinzipien.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – technischer Aufbau und
  Entscheidungen.
- [docs/PWA-TESTS.md](docs/PWA-TESTS.md) – Offline-Pflichttests.
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) – Stand der Abnahmekriterien.
