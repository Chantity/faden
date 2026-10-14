# Abnahme (SPEC 12.2)

Stand aller Abnahmekriterien aus `SPEC.md` Kap. 12.2. Automatisierte Prüfungen
laufen gegen den **Produktionsbuild** (`npm run build`) in einem echten
Chromium-Browser (Edge/Chrome headless).

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
| 1 | Geschirrspüler-Szenario, nur Tastatur | `test:acceptance` Test 1: Zettel anlegen, erstes ToDo, mit **V** vier Vorarbeiten als Enter-Kette, nur „Herumliegenden Müll einsammeln" ist dran, Abhaken mit Enter/Leertaste rückt genau das nächste ToDo nach. Echte Tastendrücke, kein Mausklick; an jedem Tab-Ziel wird ein sichtbarer Fokusrahmen geprüft. | ✔ |
| 2 | Aufteilen und Zusammenführen (UND) | Unit-Tests `graph.spec` (UND-Semantik, Einfüge-Operationen), `flow-view.spec` | ✔ |
| 3 | Mehrere Stränge, mehrere Zettel | Unit-Tests `graph.spec` (Komponenten), `layout.spec`; Testdaten in `test:acceptance` | ✔ |
| 4 | Einfügen vor/nach/zwischen per „+" | Unit-Tests `graph.spec`, `flow-view.spec` | ✔ |
| 5 | Keine Zyklen, verständliche Meldung | Unit-Tests `graph.spec`, `i18n`/`graph-error` | ✔ |
| 6 | Undo/Redo für jede Änderungsart | Unit-Tests `history.spec`, `lists.store.spec` (pro Zettel + Übersicht, ≥ 100 Schritte) | ✔ |
| 7 | Timeboxing (4 Modi, kein Datenverlust, nachträglich abhaken, verschieben/strecken) | Unit-Tests `time.spec`, `focus-view-time.spec`, `plan-editor.spec`, `task-editor.spec` | ✔ |
| 8 | Responsive 360 px bis Desktop, kein horizontales Scrollen, Tippflächen ≥ 48 px | `test:acceptance` Tests 8: 360×740, 740×360 (quer), 768×1024, 1280×800; je 5 Seiten + Dialog. Prüft horizontales Scrollen, Basis-Schrift ≥ 17 px, Tippflächen ≥ 48 px (die „+" im Diagramm ≥ 44 px, SPEC 5.4), Bottom-Sheet + FAB unter 600 px, einklappbare Zettel-Spalte über 1024 px. | ✔ |
| 9 | PWA/Offline, Installierbarkeit, Lighthouse-Accessibility ≥ 95 | `test:pwa` (11/11). Lighthouse-Accessibility: **100** (manuell in den Edge-DevTools, 2026-10-14). | ✔ |
| 10 | Datensicherheit (Export/Import verlustfrei, Neustart, `storage.persist()`) | Unit-Tests `storage.spec`, `backup.service.spec`; `test:pwa` Tests 2 und 6 | ✔ |
| 11 | Keine externen Requests | `test:pwa` Test 7 (Seite **und** Service Worker) | ✔ |
| 12 | Reizarm: keine Bewegung bei `prefers-reduced-motion`, Dark Mode | `test:acceptance` Test 12 (keine Übergänge/Animationen ≥ 1 ms auf allen Seiten). Dark Mode: Design-Tokens mit `light-dark()`. | ✔ |

## Offen (nur manuell möglich)

| Prüfung | Warum manuell | Status |
|---|---|---|
| Safari/iOS: Installation („Teilen → Zum Home-Bildschirm"), Offline-Start, Daten nach Neustart | Kein WebKit-Testbrowser unter Windows verfügbar | offen |

## Was die Messung bewusst ausnimmt

- **Pfeile im Diagramm** (SVG-Linien): Ihre Trefferfläche ist die Linie selbst;
  dieselben Aktionen gibt es barrierefrei im Bearbeiten-Sheet (SPEC 5.4).
- **Karten im Diagramm bei Zoom < 100 %**: Sie werden mit dem Zoom kleiner; bei
  100 % werden sie mitgeprüft.
- Elemente in geschlossenen Menüs/Aufklappern und hinter offenen Dialogen.
