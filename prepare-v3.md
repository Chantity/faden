# Vorbereitung v3: Ordner und Synchronisierung

> **Status:** Nur ausgelotet, **nicht umsetzen.** Dieses Dokument sammelt Optionen, Abwägungen und offene Fragen für v3. Grundlage: der letzte Abschnitt von `v2-requirements.md`.
> **Begriff:** „Notiz“ meint hier einen **Zettel**.
> **Leitplanke:** Das Prinzip „einmal hosten, nie wieder“ bleibt. Faden bekommt **keinen eigenen Server**. Was eine Synchronisierung braucht, muss Faden direkt vom Gerät aus mit einem fremden Dienst erledigen, den der Nutzer selbst einrichtet. Ohne Konfiguration bleibt Faden vollständig lokal und macht keine externen Requests.

---

## 1. Ordner

### 1.1 Anforderungen (aus den Wünschen)
- Zettel **können** in Ordnern liegen; die Root-Ebene bleibt bestehen.
- Unterordner.
- Beim Anlegen einen Ordner angeben; Standard ist der Ordner, in dem man gerade ist.
- Zettel zwischen Ordnern verschieben.

### 1.2 Datenmodell: Optionen

| Option | Beschreibung | Pro | Contra |
|---|---|---|---|
| **A: Ordner-Store mit `parentId`** (empfohlen) | Neuer IndexedDB-Store `folders` mit `Folder = { id, title, parentId?: string, sortOrder, createdAt, updatedAt }`. `TodoList.folderId?: string`; fehlt es, liegt der Zettel im Root. | Umbenennen und Verschieben ändern nur **einen** Datensatz; die IDs bleiben stabil, was für den Sync (Kap. 2) wichtig ist. Zyklenprüfung wie beim Graph. | Ein Store mehr; Migration und Backup müssen Ordner kennen. |
| B: Pfad-String am Zettel | `TodoList.path = "Haushalt/Küche"` | Kein neuer Store, einfach zu exportieren. | Umbenennen eines Ordners ändert alle Zettel darin; leere Ordner gibt es nicht; jede Umbenennung wäre im Sync ein Massen-Konflikt. |
| C: Tags | Mehrere Etiketten je Zettel. | Flexibel. | Ist keine Ordnerstruktur und erfüllt den Wunsch nicht. |

### 1.3 Oberfläche (Skizze, reizarm)
- Die Übersicht zeigt oben Ordner als ruhige Zeilen, darunter die Zettel des aktuellen Ordners. Eine **Brotkrumen-Zeile** („Alle › Haushalt › Küche“) dient zur Navigation. Route `#/ordner/:id`; Root bleibt `#/`.
- „Neuer Zettel“ legt im aktuellen Ordner an; der Dialog hat ein Feld „Ordner“, vorbelegt mit dem aktuellen Ordner.
- ⋯ am Zettel → **„Verschieben …“**: Dialog mit Ordnerbaum, ohne Ziehen, barrierefrei. Auf dem PC zusätzlich optional Ziehen auf einen Ordner.
- ⋯ am Ordner: Umbenennen, Verschieben, Löschen. Löschen nur leerer Ordner oder mit Rückfrage „Inhalt nach oben verschieben“. Alles mit Undo (`CommandHistory`).
- Die Seitenleiste am PC zeigt den aktuellen Ordner.

### 1.4 Offene Fragen
1. Gilt die Eindeutigkeit der Namen (v2) **pro Ordner** oder global? Pro Ordner ist natürlicher, aber dann werden Konflikte beim Import und Sync pfadabhängig.
2. Archiv: global oder pro Ordner? Automatisches Archivieren (v2) lässt den Zettel dann in seinem Ordner.
3. Vorlagen: global (Vorschlag) oder auch in Ordnern?
4. Maximale Tiefe begrenzen (z. B. 5), damit es auf dem Handy bedienbar bleibt?

---

## 2. Synchronisierung zwischen Geräten

### 2.1 Anforderungen
- Möglichst reibungslos den **Stand von einem Gerät auf ein anderes** bringen.
- **Kein gleichzeitiges Bearbeiten** auf mehreren Geräten nötig (Grundfall).
- Kommt die Verbindung nach einem Ausfall zurück und ist der Server-Stand neuer, wird pro Zettel oder für alle entschieden: lokal überschreiben, Server überschreiben oder Server-Stand mit Suffix übernehmen.
- Optional: nur **einzelne Ordner** synchronisieren, mit verschiedenen Zielen; kein entfernter Ordner in einem entfernten Ordner.

### 2.2 Optionen im Vergleich

| Option | Wie Faden vom Gerät aus spricht | Ohne eigenen Server? | iOS/Safari | Reibung bei der Einrichtung | Bewertung |
|---|---|---|---|---|---|
| **A: GitHub per REST** | `api.github.com` erlaubt CORS. Je Zettel eine JSON-Datei über die Contents-API; mehrere Dateien in **einem** Commit über die Git-Data-API. | **Nur mit Personal Access Token (PAT).** Der OAuth-Web-Flow und der Device-Flow lassen sich nicht direkt aus dem Browser abschließen (der Token-Tausch-Endpunkt erlaubt kein CORS) und bräuchten einen Proxy-Server. | ja | mittel: Token auf github.com erzeugen und einfügen. | **Machbar.** Am besten ein Fine-grained PAT, beschränkt auf **ein** Repo, nur „Contents: Read and write“. |
| **B: GitLab (auch selbst gehostet) per REST** | GitLab-API mit CORS. | **Ja, auch mit Login:** GitLab unterstützt OAuth mit PKCE für reine Browser-Apps. Faden bräuchte eine registrierte Application-ID; bei selbst gehostetem GitLab registriert der Nutzer sie selbst. | ja | gering (Login-Fenster) bis mittel. | **Machbar, komfortabelste Git-Variante.** |
| C: Gitea/Forgejo/Codeberg | REST mit PAT. | ja (PAT) | ja | mittel | Wie A; CORS hängt von der Instanz ab. |
| **D: Cloud-Speicher mit App-Ordner** (Dropbox, Google Drive `appDataFolder`, OneDrive) | REST mit CORS, Login per OAuth PKCE bzw. Google Identity Services im Browser. | ja; braucht eine einmal registrierte Client-ID (bei Google zusätzlich ein Projekt mit Zustimmungsbildschirm). | ja | **gering:** „Mit Dropbox verbinden“, Login, fertig. | **Machbar, wahrscheinlich die reibungsloseste Lösung** für Nicht-Entwickler. |
| E: WebDAV/Nextcloud | WebDAV per `fetch`. | ja | ja | mittel | Viele Instanzen erlauben kein CORS; das ist unzuverlässig. |
| F: Lokaler Sync-Ordner (File System Access API) + Syncthing/OneDrive-Client | Faden schreibt Dateien in einen gewählten Ordner, ein fremdes Programm synchronisiert ihn. | ja, kein Netzwerk-Code. | **nein** (nur Chromium am Desktop) | mittel | Als Zusatz für Desktop denkbar, nicht als Hauptweg. |

### 2.3 Die Git-Idee im Detail (Wunsch des Nutzers)

| Wunsch | Bewertung |
|---|---|
| Login; Token wird automatisch gespeichert | GitHub: nur mit eingefügtem PAT (siehe A). GitLab: echter Login per PKCE. Gespeichert wird in IndexedDB (eigener Store `secrets`, **nicht** im Backup-Export). |
| Noch nicht vorhandenen Repo-Namen festlegen; Repo wird erstellt | **Zielkonflikt bei GitHub:** Ein Fine-grained PAT, das auf ein Repo beschränkt ist, kann kein neues Repo anlegen. Zum Anlegen braucht es weitreichendere Rechte (Classic PAT `repo` bzw. Zugriff auf alle Repos). Vorschlag: Der Nutzer legt das (private) Repo selbst an, Faden zeigt dafür eine Schritt-für-Schritt-Anleitung. Alternativ einmalig ein breiter Token nur zum Anlegen, danach ein enger Token. Bei GitLab ist das Anlegen per OAuth mit `api`-Scope möglich. |
| Repo existiert schon: als Speicher nutzen? Dann Pull mit „Zusammenführen“-Logik | Machbar mit `resolveConflicts` aus v2. |
| Bei jeder Änderung automatisch Push, dann Pull | Machbar, aber **entprellt** (z. B. 5–10 s Ruhe) und gebündelt: ein Commit für alle geänderten Zettel. Sonst gibt es Hunderte Commits pro Tag und die API-Limits werden belastet. Pull beim Start, bei `visibilitychange` (sichtbar) und vor jedem Push. |
| Merge-Konflikte automatisch mit der Import-Logik lösen | Machbar und robuster als echtes Git-Merge: Faden „merged“ nicht zeilenweise, sondern **pro Zettel**. Die Contents-API verlangt beim Aktualisieren den `sha` des bekannten Stands. Ist er veraltet, antwortet der Server mit einem Konflikt, und Faden entscheidet nach 2.5. Das ist eingebaute optimistische Sperre, ohne Git im Browser. |

### 2.4 Echtzeit wie Google Docs: geprüft, **verworfen**

Gewünscht: mehrere Personen gleichzeitig, sichtbar wer welchen Zettel bzw. welches ToDo bearbeitet, eventuell Cursor im Beschreibungstext, sonst Sperren. Bedingung des Nutzers: **Faden müsste direkt vom Gerät mit Google sprechen**, sonst wird die Option nicht umgesetzt.

- Google bietet dafür **keine nutzbare Schnittstelle** mehr. Die *Google Drive Realtime API*, die genau das konnte (gemeinsame Datenmodelle, Präsenz), wurde eingestellt.
- Die *Google Docs API* kann Dokumente lesen und ändern, liefert aber **keine Präsenz, keine Cursor und keine Live-Ereignisse** an den Browser. Änderungs-Benachrichtigungen von Drive (Push-Notifications) gehen nur an eine HTTPS-Webhook-Adresse, also an einen Server.
- Ohne Server bliebe nur **Polling** (z. B. alle paar Sekunden die Datei abfragen). Das ist keine Echtzeit und erzeugt Konflikte statt sie zu vermeiden.
- Alle echten Alternativen (Yjs/Automerge mit Relay, Firebase/Supabase, Liveblocks, WebRTC mit Signalisierung) brauchen einen dauerhaft laufenden Server oder Dienst. Bei Firebase ist es zwar ein fremder Dienst, aber mit einem eigenen Projekt und eigenen Regeln, die jemand betreiben muss.

**Ergebnis:** Echtzeit-Zusammenarbeit wird **nicht** umgesetzt. Als leichtgewichtiger Ersatz ließe sich bei den Optionen A, B und D später eine **weiche Sperre** denken. Faden schreibt beim Öffnen eines Zettels eine kleine Datei „wird gerade auf Gerät X bearbeitet (seit …)“ und andere Geräte zeigen einen ruhigen Hinweis. Das ist ohne Server möglich, aber nicht in Echtzeit.

### 2.5 Konfliktmodell (für alle Sync-Optionen)

- Je Zettel lokal speichern: `updatedAt` (gibt es schon) **und** `syncedVersion`. Das ist die Kennung des zuletzt synchronisierten Server-Stands, z. B. der Git-`sha` oder die Dropbox-`rev`.
- Beim Pull pro Zettel:
  - Server unverändert seit `syncedVersion` → lokalen Stand pushen.
  - Lokal unverändert seit dem letzten Sync, Server neuer → Server-Stand übernehmen (Fast-Forward, keine Rückfrage).
  - **Beide geändert** → echter Konflikt. Der Nutzer entscheidet pro Zettel oder für alle: **lokal behalten** (Server überschreiben), **Server übernehmen** (lokal überschreiben) oder **Server-Stand mit Suffix „(2)“ zusätzlich holen**. Das entspricht den Strategien von `resolveConflicts` aus v2 (Kap. 4.10 der SPEC-v2).
- Ein reiner `updatedAt`-Vergleich (Wunsch des Nutzers) reicht für „wer ist neuer“. Ohne `syncedVersion` lässt sich aber **nicht** erkennen, ob beide Seiten geändert wurden; dann gingen Änderungen still verloren. Deshalb beides speichern.
- Gelöschte Zettel brauchen einen „Grabstein“ (`deletedAt` bleibt bis zum nächsten erfolgreichen Sync), sonst tauchen sie beim nächsten Pull wieder auf. Das Soft-Delete aus v1 ist dafür eine gute Grundlage.
- Ausfälle: Änderungen werden lokal in eine Warteschlange gestellt; Faden bleibt voll offline-fähig. Ein ruhiger Status in der Kopfzeile oder in den Einstellungen zeigt „Zuletzt synchronisiert: vor 5 Min“, „Offline, 3 Änderungen warten“ oder „Konflikt bei 1 Zettel“.

### 2.6 Sync pro Ordner
- `Folder.remote?: { provider, target, … }`. Ein Ordner mit `remote` und **alle** seine Unterordner gehen an dieses Ziel; Zettel ohne entfernten Vorfahren bleiben lokal.
- Regel „kein entfernter Ordner in einem entfernten Ordner“: Beim Konfigurieren und beim **Verschieben** von Ordnern prüfen (Vorfahren und Nachfahren). Verschieben eines lokalen Ordners in einen entfernten macht ihn implizit entfernt; vorher kommt ein Hinweis.
- Ein Zettel, der von einem entfernten Ordner in einen anderen wandert, wird beim alten Ziel gelöscht (Grabstein) und beim neuen angelegt.
- Damit wird **Option A aus 1.2 (stabile Ordner-IDs) zur Voraussetzung.**

### 2.7 Sicherheit und Prinzipien
- „Keine externen Requests“ wird zu: **keine, außer zu dem Ziel, das der Nutzer selbst eingerichtet hat** (opt-in). `docs/DESIGN-PRINCIPLES.md` und die PWA-Tests sind entsprechend anzupassen; Test 7 prüft dann „nur der eigene Host plus das konfigurierte Ziel“.
- Token und Schlüssel nur in IndexedDB, nie im Backup-Export, mit einem Knopf „Verbindung trennen und Token löschen“. Strikte Content-Security-Policy (`connect-src` nur für bekannte Ziele), weil ein gespeicherter Token XSS attraktiv macht.
- Minimale Rechte (ein Repo, ein App-Ordner).
- Sync-Daten sind Klartext-JSON beim Anbieter. Optional ließe sich vor dem Hochladen mit WebCrypto und einer Passphrase verschlüsseln; das ist ein eigenes Thema für später.
- Der Service Worker darf API-Antworten **nicht** cachen (er cacht ohnehin nur die eigene Herkunft).

---

## 3. Was v2 schon vorbereitet
- `resolveConflicts(local, incoming, strategy)` als reine Funktion, unabhängig von der Import-Oberfläche (SPEC-v2 4.10).
- Verlässliches `updatedAt` je Zettel; eindeutige Namen und `uniqueTitle` für das Suffix.
- Soft-Delete mit `deletedAt` als Grundlage für Grabsteine.

## 4. Empfehlung für v3

1. **Ordner** nach Option A (1.2) umsetzen: geringes Risiko, rein lokal, Voraussetzung für alles Weitere.
2. **Sync, zuerst ein Anbieter:**
   - für Entwickler-nahe Nutzer **GitHub/GitLab per REST** (A/B), mit Fine-grained PAT bzw. GitLab-PKCE;
   - oder für die reibungsloseste Einrichtung **Dropbox mit App-Ordner** (D).
   - Faden bekommt eine schmale Schnittstelle `SyncProvider { list, read, write, remove }`, damit weitere Anbieter folgen können, ohne die Konfliktlogik anzufassen.
3. **Sync pro Ordner** erst, wenn ein Anbieter stabil läuft.
4. **Echtzeit-Zusammenarbeit nicht umsetzen** (2.4).

## 5. Offene Fragen an den Nutzer
1. Welcher Anbieter zuerst: GitHub, GitLab oder Dropbox bzw. ein anderer Cloud-Speicher?
2. Ist ein selbst angelegtes Repo bzw. ein eingefügter Token als Einrichtungsschritt akzeptabel, oder muss es ein Login-Knopf sein?
3. Fragen zu Ordnern aus 1.4 (Namens-Eindeutigkeit, Archiv, Vorlagen, Tiefe).
4. Sollen Sync-Daten verschlüsselt werden (Passphrase)?
5. Soll die weiche Sperre „wird gerade auf Gerät X bearbeitet“ (2.4) in v3 enthalten sein?
