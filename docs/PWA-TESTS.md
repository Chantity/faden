# PWA-/Offline-Pflichttests

> Status: **alle bestanden** (siehe Ergebnisprotokoll). Ein fehlgeschlagener
> Test ist ein **Blocker** (SPEC 9.4): Die App gilt erst als fertig, wenn
> **alle** Tests bestehen. Nach jeder Änderung an `public/sw.js`, am Build oder
> an `index.html` erneut ausführen.

## Automatisiert ausführen

```bash
npm run build      # Produktionsbuild + precache-manifest.json
npm run test:pwa   # scripts/pwa-test.mjs
```

Das Skript braucht **keine** Zusatzpakete (Node ≥ 22). Es

- startet einen lokalen Static-Server für `dist/faden/browser`, dessen Verhalten
  umschaltbar ist: **normal**, **aus** (Verbindungsfehler), **404 für alles**,
  **500 für alles**, **Captive-Portal-HTML (200) für alles**, **neuere Version**
  (geänderte `precache-manifest.json`);
- steuert einen echten Chromium-Browser (Edge oder Chrome, headless, frisches
  Profil) über das DevTools-Protokoll; Pfad überschreibbar mit `BROWSER=…`;
- beendet sich mit Exit-Code 1, sobald ein Test fehlschlägt.

## Testfälle

| # | Test | Wie geprüft |
|---|---|---|
| 1 | Installierbarkeit / Precache | Einmal online laden. SW übernimmt die Seite; aktiver Precache enthält **alle** Dateien aus `precache-manifest.json`; `Page.getAppManifest` ohne Fehler; `Page.getInstallabilityErrors` leer; Einstellungen zeigen „Offline ready". |
| 2 | Server aus | Server beenden, neu laden. App startet; per Oberfläche Zettel anlegen, ToDo anlegen, abhaken; Backup exportieren (Download wird geprüft und enthält die Änderungen). |
| 3 | Überall 404 | 3× neu laden, jedes Mal Update-Prüfung des Browsers erzwingen (`registration.update()`, entspricht der automatischen Prüfung nach 24 h). Erwartung: App + Daten da, Update-Prüfung schlägt fehl, SW registriert, Precache unverändert und vollständig. |
| 4a | Überall 500 | wie 3. |
| 4b | Captive-Portal-HTML | wie 3 (`sw.js`, Manifest, `precache-manifest.json` liefern HTML mit 200). |
| 4c | Keine Auto-Updates | Host bietet eine neuere Version an (andere Precache-Liste). Nach Neuladen + Update-Prüfung bleibt der installierte Precache aktiv (SPEC 9.3). |
| 5 | Hash-Route offline | Server aus, neuer Tab direkt auf `…/index.html#/zettel/<id>` → Zettel-Ansicht erscheint. |
| 6 | Neustart | Browser vollständig beenden und mit demselben Profil neu starten – einmal bei Server-404, einmal bei Server aus. Daten (IndexedDB) und Precache unverändert. |
| 7 | Keine externen Requests | Alle mitgeschnittenen Anfragen von Seite **und** Service Worker gehen an den eigenen Host. |

### Zur „Wartezeit von mehreren Minuten"

SPEC 9.4/3 verlangt auch Neuladen „nach mehreren Minuten". Zeitabhängig ist im
Browser nur die automatische Update-Prüfung von `sw.js` (spätestens alle 24 h
bei einer Navigation). Das Skript löst genau diese Prüfung mit
`registration.update()` sofort aus und deckt den Fall damit deterministisch ab.
Der eigene Service Worker hat keine zeitgesteuerte Logik.

## Manuelle Gegenprobe (optional, z. B. auf dem Handy)

1. `npm run build`, dann `dist/faden/browser` über HTTPS oder `localhost`
   ausliefern (z. B. `npx http-server dist/faden/browser`).
2. Einmal öffnen, in den Einstellungen auf „Offline bereit" warten, installieren.
3. Server stoppen bzw. auf 404 umstellen, Flugmodus an; App mehrfach öffnen,
   Gerät neu starten. DevTools → Application → Service Workers / Cache Storage:
   Worker aktiv, `faden-v1-<build>` und `faden-meta` vorhanden.

## Ergebnisprotokoll

| Test | Datum | Ergebnis | Notizen |
|---|---|---|---|
| 1 Installierbarkeit | 2026-10-14 | bestanden | 17 Dateien in `faden-v1-b200e83d45a60299`, installierbar, „Offline ready" |
| 2 Server aus | 2026-10-14 | bestanden | Anlegen, Abhaken, Export offline |
| 3 Server 404 | 2026-10-14 | bestanden | Update-Prüfung: `TypeError`, SW + Cache intakt |
| 4a Server 500 | 2026-10-14 | bestanden | Update-Prüfung: `TypeError`, SW + Cache intakt |
| 4b Captive-Portal | 2026-10-14 | bestanden | Update-Prüfung: `SecurityError` (MIME), SW + Cache intakt |
| 4c Keine Auto-Updates | 2026-10-14 | bestanden | Installierte Version bleibt aktiv |
| 5 Hash-Route offline | 2026-10-14 | bestanden | – |
| 6 Daten nach Neustart | 2026-10-14 | bestanden | 2 Browser-Neustarts |
| 7 Keine externen Requests | 2026-10-14 | bestanden | 209 Requests, alle an den eigenen Host |

Umgebung: Windows 10, Microsoft Edge (headless, Chromium), Node 24.21, Build 0.1.0.
Nicht automatisiert: Safari/iOS (kein WebKit-Testbrowser verfügbar) und
Lighthouse-Accessibility (Abnahmekriterium 12.2/9) – manuell prüfen.
