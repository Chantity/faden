# Abnahme

Alle Abnahmekriterien von Faden mit Nachweis. Automatisierte Prüfungen laufen
gegen den **Produktionsbuild** (`npm run build`) in einem echten
Chromium-Browser (Edge/Chrome headless). Neue Funktionen ergänzen hier ihre
Kriterien (Definition of Done, `docs/DESIGN-PRINCIPLES.md` B5).

```bash
npm test                 # Unit-Tests (Vitest)
npm run build            # Produktionsbuild + Precache-Liste
npm run test:pwa         # Offline-/PWA-Pflichttests (docs/PWA-TESTS.md)
npm run test:acceptance  # Abnahme: Tastatur, Responsive, Reizarm
```

`test:acceptance` lässt sich mit `VIEWPORT=360` (bzw. `quer`, `768`, `1280`)
auf eine Bildschirmgröße einschränken.

## Kriterien

| # | Kriterium | Nachweis | Status |
|---|---|---|---|
| 1 | **Geschirrspüler-Szenario, nur Tastatur:** Zettel mit „Geschirrspüler einräumen“ anlegen, über „Erst noch etwas anderes nötig …“ nacheinander „Geschirr einsammeln“ → „Bioabfall in die Tonne“ → „Müll mitnehmen“ → „Herumliegenden Müll einsammeln“ eintragen. Ergebnis: Kette in richtiger Reihenfolge, nur „Herumliegenden Müll einsammeln“ ist „Jetzt dran“; nach dem Abhaken erscheint genau das nächste ToDo. Alles ohne Maus. | `test:acceptance` Test 1: echte Tastendrücke, kein Mausklick; an jedem Tab-Ziel wird ein sichtbarer Fokusrahmen geprüft. | ✔ |
| 2 | **Aufteilen und Zusammenführen (UND):** Ein ToDo in zwei Zweige aufteilen und wieder zusammenführen; das gemeinsame ToDo ist erst dran, wenn **beide** Zweige erledigt sind. | Unit-Tests `graph.spec` (UND-Semantik, Einfüge-Operationen), `flow-view.spec` | ✔ |
| 3 | **Mehrere unabhängige Stränge** in einem Zettel und **mehrere Zettel** funktionieren parallel. | Unit-Tests `graph.spec` (Komponenten), `layout.spec`; Testdaten in `test:acceptance` | ✔ |
| 4 | **Einfügen** vor, nach und zwischen ToDos (auch an Verzweigungen und auf Pfeilen) per „+“ im Ablauf; Pfeile werden korrekt umgebaut. | Unit-Tests `graph.spec`, `flow-view.spec` | ✔ |
| 5 | **Keine Zyklen** erzeugbar, mit verständlicher Meldung. | Unit-Tests `graph.spec`, `i18n`/`graph-error` | ✔ |
| 6 | **Rückgängig/Wiederholen** für jede Änderungsart (pro Zettel und in der Übersicht, ≥ 100 Schritte). | Unit-Tests `history.spec`, `lists.store.spec` | ✔ |
| 7 | **Timeboxing:** alle vier Modi; Moduswechsel verliert keine Daten; „Nicht abgehakt“ lässt sich nachträglich abhaken; ein fester Zeitplan lässt sich verschieben und auf einen neuen Zeitraum strecken. | Unit-Tests `time.spec`, `focus-view-time.spec`, `plan-editor.spec`, `task-editor.spec` | ✔ |
| 8 | **Responsive** von 360 px bis Desktop: kein horizontales Scrollen außer in der Diagrammfläche, Tippflächen ≥ 48 px. | `test:acceptance` Tests 8: 360×740, 740×360 (quer), 768×1024, 1280×800; je 5 Seiten + Dialog. Prüft horizontales Scrollen, Basis-Schrift ≥ 17 px, Tippflächen ≥ 48 px (die „+“ im Diagramm ≥ 44 px), Bottom-Sheet + FAB unter 600 px, einklappbare Zettel-Spalte über 1024 px. | ✔ |
| 9 | **PWA/Offline:** alle Pflichttests bestanden, installierbar, Lighthouse-Accessibility ≥ 95. | `test:pwa` (11/11). Lighthouse-Accessibility: **100** (manuell in den Edge-DevTools, 2026-10-14). | ✔ |
| 10 | **Datensicherheit:** Export/Import verlustfrei, Daten überleben einen Neustart, `storage.persist()` wird angefragt und der Status ist sichtbar. | Unit-Tests `storage.spec`, `backup.service.spec`; `test:pwa` Tests 2 und 6 | ✔ |
| 11 | **Keine externen Requests** zur Laufzeit. | `test:pwa` Test 7 (Seite **und** Service Worker) | ✔ |
| 12 | **Reizarm:** keine Bewegung bei `prefers-reduced-motion`, keine Konfetti-/Blink-Effekte, Dark Mode vollständig. | `test:acceptance` Test 12 (keine Übergänge/Animationen ≥ 1 ms auf allen Seiten). Dark Mode: Design-Tokens mit `light-dark()`. | ✔ |
| 13 | **⋯-Menüs** schließen sich überall per Klick/Tipp außerhalb und mit Esc. | `test:acceptance` Test M (Übersicht: Karte + Archiv, „Jetzt dran“, Zettel-Kopf, Ablauf); Unit-Test `menus.spec` | ✔ |
| 14 | **Archiv:** Fertige Zettel werden beim Betreten der Übersicht archiviert (rückgängig machbar); archivierte Zettel zeigen Modus, enthaltene ToDos und ein Menü (Umbenennen, Duplizieren als frische Kopie, Als Vorlage). | Unit-Tests `lists.store.spec` (Archiv und Namen); `test:acceptance` Tests 8 (Archiv aufgeklappt) und M | ✔ |
| 15 | **Eindeutige Zettel-Namen** (ohne Groß-/Kleinschreibung); automatisch entstehende Namen werden zu „Name (2)“ usw.; Alt-Daten werden beim Laden bereinigt. | Unit-Tests `storage.spec` (`uniqueTitle`, Migration), `lists.store.spec` | ✔ |
| 16 | **ToDo-Sheet zum Anlegen:** Jeder Anlege-Weg öffnet das volle Sheet (Titel, Beschreibung, Zeit); Enter legt sofort an, in „Jetzt dran“ als Enter-Kette; mehrzeiliges Einfügen ergibt eine Kette. | Unit-Tests `graph.spec` (`insertAt`, `nextInChain`), `task-editor.spec` (Anlegen); `test:acceptance` Test 1 (Kette per Tastatur im Sheet) und Tests 8 (Sheet responsiv) | ✔ |
| 17 | **Checkliste:** Beschreibung als Text oder Checkliste umschaltbar ohne Inhaltsverlust (Haken entfallen beim Wechsel zu Text); Punkte direkt auf der Karte in „Jetzt dran“ abhakbar. | Unit-Tests `checklist.spec`, `task-editor.spec`, `focus-view.spec`; `test:acceptance` Tests 8 | ✔ |

## Offen (nur manuell möglich)

| Prüfung | Warum manuell | Status |
|---|---|---|
| Safari/iOS: Installation („Teilen → Zum Home-Bildschirm“), Offline-Start, Daten nach Neustart | Kein WebKit-Testbrowser unter Windows verfügbar | offen |

## Was die Messung bewusst ausnimmt

- **Pfeile im Diagramm** (SVG-Linien): Ihre Trefferfläche ist die Linie selbst;
  dieselben Aktionen gibt es barrierefrei im Bearbeiten-Sheet.
- **Karten im Diagramm bei Zoom < 100 %**: Sie werden mit dem Zoom kleiner; bei
  100 % werden sie mitgeprüft.
- Elemente in geschlossenen Menüs/Aufklappern und hinter offenen Dialogen.
- Elemente, die gerade unter einem **schwebenden** Element liegen (`position:
  fixed`/`sticky`, z. B. der runde „+ Neuer Zettel“-Button): Sie sind durch
  Weiterscrollen erreichbar; der zusätzliche Abstand unten in der Übersicht
  sorgt dafür, dass auch das letzte Element frei liegt.
- Einmalige Erst-Start-Hinweise (Installations-Banner) sind in den
  Abnahmetests vorab als „gesehen“ markiert, damit sie nicht mitten in einen
  Tab-Durchlauf fallen; sie haben eigene Tests.
