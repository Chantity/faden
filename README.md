# Faden

**Faden ordnet ToDos als Ablauf und zeigt dir immer nur, was jetzt dran ist.**

Viele Aufgaben haben Vorarbeiten, die wiederum Vorarbeiten haben. Faden macht
diese Reihenfolge sichtbar und merkt sich die restliche Kette für dich – gedacht
für Menschen, denen es schwerfällt, unsichtbare Abläufe im Kopf zu halten.

- **Ruhig und reizarm:** keine Alarme, keine Schuldgefühle, keine Animationen.
- **Nichts geht verloren:** alles rückgängig zu machen.
- **Offline, ohne Server:** alle Daten bleiben lokal auf deinem Gerät.

## Grundsätzliche Bedienung

1. **Zettel anlegen** – ein Zettel ist eine ToDo-Liste mit Ablauf.
2. In „**Jetzt dran**" siehst du nur die Aufgaben, die gerade machbar sind.
3. Fehlt eine Vorarbeit, trägst du sie mit **„Erst noch etwas anderes nötig …"**
   in Sekunden direkt davor ein.
4. **„Erledigt"** hakt ab; danach rückt automatisch die nächste Aufgabe nach.
5. Die Ansicht **„Ablauf"** zeigt den ganzen Zettel als Ablaufdiagramm.

Die ausführliche Anleitung steht im [Benutzerhandbuch](docs/BENUTZERHANDBUCH.md).
Wie die App technisch aufgebaut ist, beschreibt die
[Architektur](docs/ARCHITEKTUR.md).

## Entwicklung

```bash
npm install
npm start        # Dev-Server auf http://localhost:4200
npm test         # Unit-Tests (Vitest)
npm run build    # Produktionsbuild nach dist/faden/browser
npm run test:pwa # Offline-Pflichttests (Edge/Chrome headless)
```

**Einmal hosten:** Den Inhalt von `dist/faden/browser` auf einen beliebigen
HTTPS-Host legen, die Seite einmal öffnen, warten bis die Einstellungen
„Offline bereit" zeigen, und installieren. Danach darf der Host verschwinden –
Faden läuft dann vollständig aus dem lokalen Cache. **iOS:** nur die
installierte App (Teilen → Zum Home-Bildschirm) ist vor Safaris automatischem
Löschen geschützt. Regelmäßig ein Backup herunterladen (Einstellungen).

## Dokumentation

- [SPEC.md](SPEC.md) – fachliche Anforderungen.
- [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) – technischer Aufbau.
- [docs/BENUTZERHANDBUCH.md](docs/BENUTZERHANDBUCH.md) – ausführliche Bedienung.
- [docs/DECISIONS.md](docs/DECISIONS.md) – Entscheidungen und Abweichungen.
- [docs/PWA-TESTS.md](docs/PWA-TESTS.md) – Offline-Pflichttests.
