# PWA-/Offline-Pflichttests

> Status: **offen** – wird in Phase 3 bearbeitet. Die Tests sind hier als
> wiederholbare Anleitung festgehalten (SPEC 9.4). Ein fehlgeschlagener Test ist
> ein **Blocker**: Die App gilt erst als fertig, wenn **alle** Tests bestehen.

## Voraussetzungen

- Produktionsbuild: `npm run build` → Ausgabe in `dist/faden`.
- Ein einfacher statischer Server, der freiwillig auch **404**, **500** und
  HTML-Antworten für unbekannte Dateien liefern kann (z. B. per Skript/Alias).
- Browser mit DevTools (Application → Service Workers / Cache Storage).

## Testfälle

1. **Installierbarkeit / Precache**
   - App einmal online laden.
   - Service Worker ist **aktiv**; `Cache Storage` enthält den Precache
     (`faden-v1`).
   - DevTools/Lighthouse: „Installability" ok.

2. **Server aus (Verbindungsfehler)**
   - Server beenden, Seite neu laden.
   - App startet vollständig, alle Funktionen laufen (Zettel anlegen, abhaken,
     Export).

3. **Server liefert überall 404** *(kritischer Test)*
   - Server so umstellen, dass alle Anfragen mit **404** beantwortet werden.
   - Seite mehrfach neu laden, auch nach mehreren Minuten und nach
     Browser-Neustart.
   - Erwartung: App läuft weiter; Service Worker bleibt **registriert**; Caches
     bleiben **erhalten**; kein Deregistrieren.
   - *Hintergrund:* `@angular/service-worker` würde hier Caches löschen und sich
     deregistrieren – deshalb wurde Variante B (eigener SW) gewählt
     (`docs/DECISIONS.md`, Abschnitt 3).

4. **Server liefert 500 und Captive-Portal-HTML**
   - Für `sw.js`, Manifest und `ngsw.json`(falls vorhanden) eine **500**-Antwort
     und eine HTML-Seite liefern.
   - Erwartung: App läuft unverändert.

5. **Direkte Hash-Route offline**
   - `…/index.html#/zettel/xyz` offline bzw. bei kaputtem Server direkt öffnen.
   - Erwartung: funktioniert (Navigation wird mit gecachter `index.html`
     beantwortet).

6. **Daten überleben Neustart**
   - Zettel anlegen, Browser komplett schließen, neu starten.
   - Erwartung: Daten sind da (IndexedDB).

7. **Keine externen Requests** (Abnahmekriterium 12.2/11)
   - Im Netzwerk-Tab: keine Requests zu Fremddomains zur Laufzeit.

## Ergebnisprotokoll

| Test | Datum | Ergebnis | Notizen |
|---|---|---|---|
| 1 Installierbarkeit | – | offen | – |
| 2 Server aus | – | offen | – |
| 3 Server 404 | – | offen | – |
| 4 500 / Captive-Portal | – | offen | – |
| 5 Hash-Route offline | – | offen | – |
| 6 Daten nach Neustart | – | offen | – |
| 7 Keine externen Requests | – | offen | – |
