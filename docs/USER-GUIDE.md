# Faden – User Guide / Benutzerhandbuch

[English](#english) · [Deutsch](#deutsch)

---

## English

Detailed instructions for “Faden”. A short overview is in the
[README](../README.md#english).

### 1. What is Faden for?

Many todos can't be done right away: before the dishwasher can be loaded, the
dishes have to be collected; before that, the organic waste bin has to be
emptied – and so on. This chain is too long and invisible to keep in your head,
so in the end nothing happens at all.

**Faden makes the order visible and only ever shows you what is up next.** The
app remembers everything else for you. You never have to hold the whole mess in
your head at once.

Faden is deliberately calm: no alarms, no guilt, no pressure. Nothing gets
lost, and everything can be undone.

### 2. Key terms

| Term | Meaning |
|---|---|
| **List** | A to-do list with a flow. You can have several lists side by side. |
| **Todo** | A single task on a list. |
| **Arrow** | “This todo only comes afterwards.” |
| **Now** | A todo whose prerequisites are all done. |
| **Strand** | A chain of connected todos. A list can contain several independent strands. |
| **Template** | A reusable structure from which you create new lists. |

### 3. Getting started

1. Open the app. The first time, you see an empty state.
2. Tap **“Create your first list”**.
3. Enter a title (e.g. “Load the dishwasher”).
4. Optionally choose a **time planning** (see section 7). The default is
   “No time planning”.
5. **“Create”**. The list appears in the overview.

### 4. The list overview

The start page shows all your lists as cards. Each card shows:

- the **title**,
- the **progress** (“3 of 8 done”),
- a **mode label** if you have chosen a time planning,
- the **next “Now” todo** as a preview – so you know what's coming next
  without opening the list.

Tapping the card opens the list.

Via the **menu (⋯)** on the card:
- **Rename** – change title and time planning.
- **Duplicate** – create a copy of the list (e.g. as a starting point). The
  copy is called “Name (2)”, “Name (3)” and so on.
- **Save list as template** – keep the structure for later (see section 8).
- **Move up / Move down** – change the order.
- **Archive** – the list moves to the archive (expandable at the bottom).
  Nothing is deleted.
- **Delete** – remove the list. “Undo” appears at the bottom – you have about
  8 seconds.

The menu closes when you click/tap anywhere outside it (or press **Esc**),
without having to pick anything.

Every list has its **own name**: two lists can't be called the same (upper and
lower case don't count as a difference). If a name is taken, the dialog says so
quietly and waits until you choose another one.

**Finished lists archive themselves:** when you come back to the overview, every
list whose todos are all done moves to the archive. A notice at the bottom
offers **“Undo”**.

**The archive** (expandable at the bottom) shows for each list its mode label
and, expandable, **“Contained todos”** in the order of the flow. Each archived
list has **Restore**, **Delete** and a menu (⋯) with **Rename**, **Duplicate**
(the copy starts fresh: not archived, nothing checked off) and **Save list as
template**.

At the top right you'll also find **“New list”** as well as **Undo** (↶) and
**Redo** (↷) for your latest changes. If you have saved templates,
**“From template …”** appears next to them: choose the template in the create
dialog; title and time planning are taken over and can still be changed before
creating.

**On a computer** (wide window), an open list shows all your lists on the left
– for switching quickly, each with its mode label. **«** collapses this column,
**»** expands it again.
**On a phone**, “New list” is a round button at the bottom right, and dialogs
slide in from the bottom.

### 5. Undo and redo

Almost every action can be undone – creating, renaming, archiving, deleting
and (in the detail view) also checking off. Use the arrow buttons at the top
or the keyboard:

- **Inside a list**, undo/redo only affect **this list**. Each list remembers
  its own last 100 steps.
- **In the overview**, they affect what you did there (create, rename,
  archive, delete, order). Changes you have made inside a list in the meantime
  are kept.
- A **deleted list** is only removed for good after a few seconds. As long as
  the app is open, “Undo” in the overview brings it back.

- **Ctrl/Cmd + Z** – undo
- **Ctrl/Cmd + Shift + Z** or **Ctrl + Y** – redo

After deleting or checking something off, a calm notice bar with “Undo”
appears at the bottom. It doesn't block anything and disappears by itself.

### 6. The list itself (detail view)

At the top you see the title, the progress and – if the list uses a time
planning – its mode label. A list has two views you can switch between below
(the app remembers your last choice per list):

- **Now** (default): only the todos you can do right now – as large cards with
  a wide **“Done”** button. The **“✚”** at the top right adds a single,
  standalone todo without prerequisites.
- **Flow**: the whole list as a top-to-bottom flowchart with arrows and
  branches.

#### 6.1 Adding a prerequisite in a flash

Every card in “Now” has the button
**“Something else has to come first …”**. It places a new prerequisite right
in front of it. This is the most important move in the app:

1. The todo “Load the dishwasher” is up now.
2. “Something else has to come first …” (or **V**) opens the todo sheet →
   “Collect the dishes” → Enter.
3. The sheet is offered again right away, empty → “Empty the organic waste
   into the bin” → Enter.
4. As often as you like. **Enter** adds one more step in front each time.
   **“Finish”** takes the last entry and ends the chain; **“Cancel”** (or
   **Esc** on a computer) stops without that last entry — handy on a phone,
   where there is no Esc key.

Result: only the *newest* prerequisite is “Now”. Once it's checked off, the
next one moves up automatically.

You don't have to fill in more than the title – Enter is enough. If you want,
you can also add a description or (with a time planning) times in the same
sheet. Pasting several lines into the title creates one todo per line, as a
chain. **“✚”**, “Insert after” (**N**) and “Create successor task” work the
same way.

**Checklists on the card:** if a todo has a checklist, the card shows
“2 of 5 checked” with the items below – you can check them off right there,
e.g. while shopping. Checking items off doesn't check off the todo itself.

#### 6.2 Done

The large **“Done”** button checks the todo off. Checking off is always
allowed, even if a prerequisite is still open – the app doesn't complain, it
just points it out discreetly (“Prerequisite still open”).

#### 6.3 What comes next

Below the card it quietly says what comes next and – if several branches come
together – what else has to be done as well. Collapsed below that you'll find
the full list “Still to come …”.

#### 6.4 Changing the structure (in the flow)

Every “+” and every “Create … task” opens the todo sheet (section 6.5) for the
new todo.

- **“+” on an arrow**: insert something *in between*.
- **“+” above a card** (only at the start of a strand): insert *before*.
- **“+” below a card** (at the end of a strand **or at a branch**): insert
  *after*. If several tasks depend on this one (a branch), a new task is
  created on which **all** previous successors then depend – this is how you
  put a shared step in front of the branch.
- **Round checkmark at the top left of a card**: check the todo off directly in
  the flow – and set it back to “open” with another tap (with “Undo”).
- Menu **“Create successor task”**: add another task that comes afterwards –
  parallel to the existing successors (branch).
- Menu **“Create predecessor task”**: add a task that also has to be done
  before things can continue (merge).
- Menu **“Connect to another todo”**: merge two strands.
- Menu **“Delete”**: removes the todo and connects everything before it with
  everything after it, so the chain doesn't break. If the todo has something
  before **and** after it, there is also **“Delete without reconnecting”** –
  this leaves a gap at that point (two separate parts). Both can be undone.
- **“New separate strand”**: an independent new chain on the same list.

Every menu in the app (the three dots ⋯) closes with a click/tap anywhere
outside it, **on the three dots again** or with **Esc**, without having to pick
anything. Only a click inside the menu content keeps it open.

Pan with one finger (phone) or the mouse; zoom with two fingers (phone),
**Ctrl + mouse wheel** or the visible **+/-** buttons (computer). “Fit all”
brings the whole drawing into view. A card with a checklist shows “☑ 2/5”.

#### 6.5 The todo sheet (create and edit)

The same sheet is used to **create** and to **edit** a todo. Tapping a card (or
**E**) opens it for editing.

- **Title** – required. When creating, **Enter** creates the todo right away.
- **Description** – switch between **Text** and **Checklist**:
  - *Text*: free notes.
  - *Checklist*: one item per line with a checkbox; **Enter** in an item adds
    a new one below, **✕** removes it. Empty items are dropped when saving.
  - Switching keeps the content: a checklist becomes bullet points
    (“- Milk”), and every line of a text becomes an item (a leading “-” is
    dropped). Checkmarks are not kept when switching to text.
- **Time** – depending on the time planning (section 7). It is a single
  summary line such as “14:30 · 30 min”; tap it to show the fields. When
  creating in a day plan or fixed schedule it is already open.
- When editing, also the lists **“Must be done before”** and
  **“Comes after”**: there you can maintain connections without any dragging.

### 7. Time planning (timeboxing)

Time planning applies **per list** and can be changed at any time. Switching
**never loses data**. There is **no timer** and there are **no
notifications** – Faden just does the maths.

- **No time planning** – just todos.
- **Time estimate** – a duration per todo (5, 10, 15, 30, 45, 60, 90 min or
  custom). The list shows totals: open, total, done and “3 without estimate”.
  If the list has several independent strands, the **Flow** shows the open
  subtotal above each strand.
- **Day plan** – a start time of day (without a date) and a duration per todo;
  a todo has to end by midnight. Todos are “Now, until …”,
  “Next at …” or “Not checked off” (then with **“Check off afterwards”**).
  The times apply to the day on which you switched the day plan on. Once that
  day is over, the app offers to “Set to today”.
- **Fixed schedule** – start date + time and a duration per todo; a todo may
  also run over midnight or several days.

The duration is the same field in all modes: an estimate you entered stays the
duration when you switch to a day plan or a fixed schedule, and vice versa.

In **Day plan** or **Fixed schedule** mode, the list menu (⋯) has the entry
**“Edit schedule”**:

- **Shift everything** – shift all times by minutes, hours (in a fixed
  schedule also days).
- **Stretch to a period** (fixed schedule only) – set start and end; the other
  times are moved proportionally.
- **Propose times from estimates** – open todos are placed one after another
  from a start time (todos without an estimate count as 15 min).
- **Transfer times of day onto a date** (day plan only) – copies the start
  times as date + time; the durations stay.

A preview shows the first and last time after shifting. In a day plan
everything has to stay between 0:00 and 24:00; otherwise the app says so and
changes nothing. To shift only **one strand**, open **⋯** on a card in the
**Flow** and choose **“Shift strand …”** (you can still switch to the whole
list there).

**Breaks:** In the Flow, an arrow between two todos with times shows the break
between them (“Break 15 min”) – only if there is one, and only when zoomed in
far enough to see the “+”.

**Inserting with relative times:** If you add a todo next to todos that already
have a start time (with “+” in the Flow or in “Now”), you don't type a time of
day. Instead:

- **Before the first todo:** duration and **break after**. Choose
  *“Schedule it before”* (the new todo ends the break before the old start) or
  *“Keep the start time”* (the new todo starts then, and everything after it in
  this strand moves later).
- **After the last todo:** **break before** and duration.
- **In between:** duration and **break after**. The old break before the next
  todo stays in front of the new one. Choose *“Push everything after it
  later”* or *“Pull everything before it earlier”*. At a branch, the earliest
  next todo counts, and all next todos move by the same amount.

A line below tells you when the new todo starts and who moves where. Only the
own strand ever moves. **“Enter the time directly”** switches to the normal
start time field; **Undo** reverts the insertion and the shifting in one step.

If you switch a list from **Day plan** to **Fixed schedule**, the app asks
right away whether the times of day should be transferred onto a date (you can
also choose “Don’t transfer”). The other way round nothing is lost: the date
times stay saved and are back when you switch back.

In **“Now”**, every card with a time shows a badge and the matching state; in
the **Flow**, the time span is shown small on the box.

Each of these actions is a normal change: **Undo** in the header restores the
previous state.

### 8. Templates

You can save a whole list **or** just a single strand as a **template**:

- **Whole list:** in the list menu (⋯) at the top, **“Save list as
  template”** – or directly in the list overview in the ⋯ menu of the list
  card.
- **One strand:** in the flow, the **⋯** on a card of the strand →
  **“Save strand as template”**.

Templates remember structure, titles, notes, estimates, times of day and the
time mode – but **not** what was already done. Fixed date/time entries are
converted into an estimate.

On the **Templates** page you can:

- expand the order of titles as a **preview**,
- **rename** a template,
- **delete** a template (with **Undo** in the notice bar),
- **“New list from template”** – creates a fresh list and opens it.

In an open list, the menu (⋯) also has **“Insert template into list”**: the
chosen template is added as a **new, separate strand**; existing todos stay
unchanged (with “Undo”).

### 9. Settings

- **Theme**: system setting, light or dark. Dark is designed to the same
  standard.
- **Language**: English (default) or German. The switch takes effect
  immediately.
- **Storage**: shows how much space Faden uses and whether the browser
  protects the data permanently. If the protection is missing, you can tap
  **“Protect permanently”** (the browser asks after the first user
  interaction).
- **Version**: the installed app version. Faden **never updates by itself**.
  With **“Check for a new version”** you ask for one; if there is one,
  **“New version … available – update now?”** appears. The new version is
  first downloaded completely; if that fails, everything stays as it was.
- **Backup and data**: **“Download backup”** creates
  `faden-backup-YYYY-MM-DD.json` and remembers the date
  (“Last backup: today / X days ago / No backup created yet”). **“Share
  backup”** uses the device's share feature, if available. **“Restore a
  backup”** checks the chosen file completely and then offers **“Merge”** or
  **“Replace everything”** (replaces everything, automatically downloads a
  backup first).
- **Install**: shows **“Offline ready”** as soon as Faden is completely stored
  on your device. Chrome/Edge/Android have the **“Install app”** button. On
  **iPhone/iPad**: in Safari, **Share → Add to Home Screen**. Important for
  iOS: Safari deletes data of websites that haven't been used for about 7 days
  – only the installed app is reliably protected from this.

As long as Faden runs in a browser tab and can be installed, a notice
**“Install Faden as an app”** appears at the top with **“Install”** and
**“Ignore”**. After “Ignore” it doesn't come back; you can still install the
app at any time under Settings → Install.

### 10. Data, backup and offline

- All data stays **local on your device** (IndexedDB). There is no account and
  no cloud.
- **Offline**: after loading once, Faden also works without a network – even
  if the website you installed Faden from no longer exists later. Faden
  **never updates by itself**; your installed version stays as it is.
- **Backup**: export as the file `faden-backup-YYYY-MM-DD.json`.
  Import either **“Merge”** or **“Replace everything”** (with backup).
- **Same names when merging**: if the backup contains lists whose names you
  already have (upper/lower case doesn't matter), Faden shows them and asks
  **once for all of them**: *import as well* as “Name (2)”, *overwrite my
  lists* (content is replaced, the list keeps its place), *don't import*, or
  *overwrite only if the imported one is newer*. Before overwriting, a backup
  of your data is downloaded. Afterwards a note says e.g. “5 imported,
  2 skipped, 1 overwritten”.
- **Reminder**: if the last backup is more than 30 days old and there is data,
  a dismissable notice bar with **“Create backup”** appears on the list
  overview **once a week**.
- **Several tabs**: changes are detected and reloaded automatically.

### 11. Keyboard (computer)

- **Tab / Shift+Tab**: move through the controls.
- In “Now”: **Enter/Space** = Done, **V** = something else has to come first,
  **N** = insert after, **E** = edit.
- **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z**/`Ctrl+Y`: undo/redo.
- In the flow: arrow keys move between cards, **Enter** edits, **Delete**
  deletes (with undo).
- **?** shows an overview of the shortcuts.

### 12. If something goes wrong

- **“Saving failed”**: the app calmly shows a banner. Reload the page; create a
  backup as soon as possible.
- **Deleted by mistake**: “Undo” in the notice bar or Ctrl/Cmd+Z.

---

## Deutsch

Ausführliche Bedienung von „Faden". Eine kurze Übersicht steht in der
[README](../README.md#deutsch).

### 1. Wozu ist Faden da?

Viele ToDos sind nicht sofort machbar: Bevor die Spülmaschine eingeräumt werden
kann, muss Geschirr eingesammelt werden, bevor das geht, die Biotonne geleert
werden – und so weiter. Diese Kette ist im Kopf zu lang und unsichtbar, deshalb
passiert am Ende gar nichts.

**Faden macht die Reihenfolge sichtbar und zeigt dir immer nur das, was jetzt
dran ist.** Alles andere merkt sich die App für dich. Du musst nie das ganze
Durcheinander gleichzeitig im Kopf halten.

Faden ist bewusst ruhig: keine Alarme, keine Schuldgefühle, kein Gedrängel.
Nichts geht verloren, und alles lässt sich rückgängig machen.

### 2. Wichtige Begriffe

| Begriff | Bedeutung |
|---|---|
| **Zettel** | Eine ToDo-Liste mit Ablauf. Du kannst mehrere Zettel nebeneinander haben. |
| **ToDo** | Eine einzelne Aufgabe auf einem Zettel. |
| **Pfeil** | „Dieses ToDo kommt erst danach." |
| **Jetzt dran** | Ein ToDo, bei dem alle Vorarbeiten erledigt sind. |
| **Strang** | Eine Kette verbundener ToDos. Ein Zettel kann mehrere unabhängige Stränge enthalten. |
| **Vorlage** | Eine wiederverwendbare Struktur, aus der du neue Zettel anlegst. |

### 3. Erste Schritte

1. App öffnen. Beim ersten Mal siehst du einen leeren Zustand.
2. **„Ersten Zettel anlegen"** antippen.
3. Titel eingeben (z. B. „Geschirrspüler einräumen").
4. Optional eine **Zeitplanung** wählen (siehe Abschnitt 7). Standard ist
   „Keine Zeitplanung".
5. **„Anlegen"**. Der Zettel erscheint in der Übersicht.

### 4. Die Zettel-Übersicht

Auf der Startseite siehst du alle deine Zettel als Karten. Jede Karte zeigt:

- den **Titel**,
- den **Fortschritt** („3 von 8 erledigt"),
- ein **Modus-Kürzel**, falls du eine Zeitplanung gewählt hast,
- das **nächste „Jetzt dran"-ToDo** als Vorschau – damit du weißt, was als
  Nächstes ansteht, ohne den Zettel zu öffnen.

Ein Tipp auf die Karte öffnet den Zettel.

Über das **Menü (⋯)** auf der Karte:
- **Umbenennen** – Titel und Zeitplanung ändern.
- **Duplizieren** – Kopie des Zettels anlegen (z. B. als Ausgangspunkt). Die
  Kopie heißt „Name (2)“, „Name (3)“ usw.
- **Zettel als Vorlage speichern** – die Struktur für später aufheben (siehe
  Kap. 8).
- **Nach oben / Nach unten** – Reihenfolge ändern.
- **Archivieren** – Zettel wandert ins Archiv (unten aufklappbar). Nichts wird
  gelöscht.
- **Löschen** – Zettel entfernen. Unten erscheint „Rückgängig" – du hast ca.
  8 Sekunden Zeit.

Das Menü schließt sich mit einem Klick/Tipp irgendwo außerhalb (oder mit
**Esc**), ohne dass du etwas auswählen musst.

Jeder Zettel hat einen **eigenen Namen**: Zwei Zettel können nicht gleich heißen
(Groß-/Kleinschreibung zählt nicht als Unterschied). Ist ein Name vergeben, sagt
der Dialog das ruhig und wartet, bis du einen anderen wählst.

**Fertige Zettel archivieren sich selbst:** Kommst du zurück in die Übersicht,
wandert jeder Zettel, dessen ToDos alle erledigt sind, ins Archiv. Unten
erscheint ein Hinweis mit **„Rückgängig“**.

**Das Archiv** (unten aufklappbar) zeigt zu jedem Zettel das Modus-Kürzel und,
aufklappbar, die **„Enthaltenen ToDos“** in Ablauf-Reihenfolge. Jeder
archivierte Zettel hat **Wiederherstellen**, **Löschen** und ein Menü (⋯) mit
**Umbenennen**, **Duplizieren** (die Kopie startet frisch: nicht archiviert,
nichts abgehakt) und **Zettel als Vorlage speichern**.

Oben rechts findest du außerdem **„+ Neuer Zettel"** sowie **Rückgängig** (↶)
und **Wiederholen** (↷) für die letzten Änderungen. Hast du Vorlagen gespeichert,
steht daneben **„Aus Vorlage …"**: Im Anlegen-Dialog wählst du die Vorlage; Titel
und Zeitplanung werden übernommen und lassen sich vor dem Anlegen noch ändern.

**Am PC** (breites Fenster) steht beim geöffneten Zettel links die Liste aller
Zettel – zum schnellen Wechseln, jeweils mit Modus-Kürzel. Mit **«** klappst du
sie ein, mit **»** wieder aus. **Auf dem Handy** liegt „+ Neuer Zettel" als runder Button unten rechts,
und Dialoge kommen von unten herein.

### 5. Rückgängig und Wiederholen

Fast jede Aktion lässt sich rückgängig machen – Anlegen, Umbenennen,
Archivieren, Löschen und (in der Detailansicht) auch das Abhaken. Nutze die
Pfeil-Buttons oben oder die Tastatur:

- **In einem Zettel** wirken Rückgängig/Wiederholen nur auf **diesen Zettel**.
  Jeder Zettel merkt sich seine eigenen letzten 100 Schritte.
- **In der Übersicht** wirken sie auf das, was du dort getan hast (Anlegen,
  Umbenennen, Archivieren, Löschen, Reihenfolge). Änderungen, die du inzwischen
  in einem Zettel gemacht hast, bleiben dabei erhalten.
- Ein **gelöschter Zettel** wird erst nach ein paar Sekunden endgültig entfernt.
  Solange die App offen ist, holt „Rückgängig" in der Übersicht ihn zurück.

- **Strg/Cmd + Z** – rückgängig
- **Strg/Cmd + Shift + Z** bzw. **Strg + Y** – wiederholen

Nach einem Löschen oder Abhaken erscheint unten ein ruhiges Hinweisband mit
„Rückgängig". Es blockiert nichts und verschwindet von selbst.

### 6. Der Zettel selbst (Detailansicht)

Oben stehen Titel, Fortschritt und – falls der Zettel eine Zeitplanung nutzt –
das Modus-Kürzel. Darunter schaltest du zwischen zwei Sichten um (die App merkt
sich deine letzte Wahl je Zettel):

- **Jetzt dran** (Standard): nur die ToDos, die gerade machbar sind – als große
  Karten mit einem breiten **„Erledigt"**-Button. Mit dem **„✚"** rechts oben
  legst du ein einzelnes, unabhängiges ToDo ohne Vorarbeit an.
- **Ablauf**: der ganze Zettel als Ablaufdiagramm von oben nach unten, mit
  Pfeilen und Verzweigungen.

#### 6.1 Vorarbeit blitzschnell eintragen

Auf jeder Karte in „Jetzt dran" gibt es den Knopf
**„Erst noch etwas anderes nötig …"**. Er legt eine neue Vorarbeit direkt
davor. Das ist der wichtigste Handgriff der App:

1. ToDo „Geschirrspüler einräumen" ist dran.
2. „Erst noch etwas anderes nötig …" (oder **V**) öffnet das ToDo-Sheet →
   „Geschirr einsammeln" → Enter.
3. Sofort wird das Sheet wieder leer angeboten → „Bioabfall in die Tonne" → Enter.
4. So oft du willst. **Enter** hängt jeweils einen weiteren Schritt davor.
   **„Fertig"** übernimmt die letzte Eingabe und beendet die Kette; **„Abbrechen"**
   (oder **Esc** am Rechner) bricht ohne diese letzte Eingabe ab — praktisch auf
   dem Handy, wo es keine Esc-Taste gibt.

Ergebnis: Nur die *neueste* Vorarbeit ist „Jetzt dran". Nach dem Abhaken rückt
automatisch die nächste nach.

Mehr als den Titel musst du nicht ausfüllen – Enter genügt. Wenn du willst,
trägst du im selben Sheet auch eine Beschreibung oder (mit Zeitplanung) Zeiten
ein. Fügst du mehrere Zeilen in den Titel ein, entsteht pro Zeile ein ToDo, als
Kette. **„✚"**, „Danach einfügen" (**N**) und „Nachfolgeaufgabe erstellen"
funktionieren genauso.

**Checklisten auf der Karte:** Hat ein ToDo eine Checkliste, zeigt die Karte
„2 von 5 abgehakt" und darunter die Punkte – du hakst sie direkt dort ab, z. B.
beim Einkaufen. Das Abhaken von Punkten hakt das ToDo selbst nicht ab.

#### 6.2 Erledigt

Der große **„Erledigt"**-Button hakt das ToDo ab. Abhaken ist immer erlaubt,
auch wenn noch eine Vorarbeit offen ist – die App meckert nicht, sie weist nur
dezent darauf hin („Vorarbeit noch offen").

#### 6.3 Danach

Unter der Karte steht unauffällig, was danach kommt, und – falls mehrere Zweige
zusammenlaufen – was außerdem noch erledigt sein muss. Eingeklappt darunter
findest du die vollständige Liste „Danach kommt noch …".

#### 6.4 Struktur ändern (im Ablauf)

Jedes „+" und jedes „… erstellen" öffnet das ToDo-Sheet (Abschnitt 6.5) für das
neue ToDo.

- **„+" auf einem Pfeil**: etwas *dazwischen* einfügen.
- **„+" über einer Karte** (nur am Strang-Anfang): *davor* einfügen.
- **„+" unter einer Karte** (am Strang-Ende **oder an einer Verzweigung**):
  *danach* einfügen. Hängen mehrere Aufgaben von dieser ab (Verzweigung),
  entsteht eine neue Aufgabe, von der anschließend **alle** bisherigen Nachfolger
  abhängen – so schiebst du einen gemeinsamen Schritt vor die Verzweigung.
- **Runder Haken links oben auf einer Karte**: das ToDo direkt im Ablauf abhaken
  – und mit einem weiteren Tipp wieder auf „offen" setzen (mit „Rückgängig").
- Menü **„Nachfolgeaufgabe erstellen"**: eine weitere Aufgabe anlegen, die
  danach kommt – parallel zu den bisherigen Nachfolgern (Verzweigung).
- Menü **„Voraufgabe erstellen"**: eine Aufgabe ergänzen, die zusätzlich
  vorher erledigt sein muss, bevor es weitergeht (Zusammenführung).
- Menü **„Mit anderem ToDo verbinden"**: zwei Stränge zusammenführen.
- Menü **„Löschen"**: entfernt das ToDo und verbindet alles davor mit allem
  danach, damit die Kette nicht reißt. Hat das ToDo etwas davor **und** danach,
  gibt es zusätzlich **„Löschen, ohne zu verbinden"** – dann entsteht an dieser
  Stelle eine Lücke (zwei getrennte Teile). Beides lässt sich rückgängig machen.
- **„Neuer eigener Strang"**: eine unabhängige neue Kette auf demselben Zettel.

Jedes Menü der App (die drei Punkte ⋯) schließt sich mit einem Klick/Tipp
irgendwo außerhalb, **wieder auf die drei Punkte** oder mit **Esc**, ohne dass
du etwas auswählen musst. Nur ein Klick im Menüinhalt lässt es offen.

Verschieben mit einem Finger (Handy) oder Maus; Zoomen mit zwei Fingern
(Handy), **Strg + Mausrad** oder den sichtbaren **+/-**-Buttons (PC). „Alles
einpassen" bringt die ganze Zeichnung ins Bild. Eine Karte mit Checkliste zeigt
„☑ 2/5".

#### 6.5 Das ToDo-Sheet (anlegen und bearbeiten)

Mit demselben Sheet **legst** du ToDos **an** und **bearbeitest** sie. Ein Tipp
auf eine Karte (oder **E**) öffnet es zum Bearbeiten.

- **Titel** – Pflicht. Beim Anlegen legt **Enter** das ToDo sofort an.
- **Beschreibung** – umschaltbar zwischen **Text** und **Checkliste**:
  - *Text*: freie Notizen.
  - *Checkliste*: ein Punkt pro Zeile mit Haken; **Enter** in einem Punkt legt
    darunter einen neuen an, **✕** entfernt ihn. Leere Punkte entfallen beim
    Speichern.
  - Beim Umschalten bleibt der Inhalt erhalten: Aus einer Checkliste werden
    Stichpunkte („- Milch"), aus jeder Zeile eines Textes wird ein Punkt (ein
    führendes „-" entfällt). Haken bleiben beim Wechsel zu Text nicht erhalten.
- **Zeit** – je nach Zeitplanung (Abschnitt 7). Sie ist eine
  Zusammenfassungszeile wie „14:30 · 30 Min“; ein Tipp darauf zeigt die Felder.
  Beim Anlegen im Tagesplan oder festen Zeitplan ist sie schon aufgeklappt.
- Beim Bearbeiten außerdem die Listen **„Muss vorher erledigt sein"** und
  **„Kommt danach"**: Dort pflegst du Verbindungen ganz ohne Ziehen.

### 7. Zeitplanung (Timeboxing)

Die Zeitplanung gilt **pro Zettel** und ist jederzeit änderbar. Beim Wechsel
gehen **keine Daten verloren**. Es gibt **keinen Timer** und **keine
Benachrichtigungen** – Faden rechnet nur mit.

- **Keine Zeitplanung** – nur ToDos.
- **Zeitschätzung** – Dauer je ToDo (5, 10, 15, 30, 45, 60, 90 Min oder frei).
  Der Zettel zeigt Summen: offen, gesamt, erledigt und „3 ohne Schätzung".
  Hat der Zettel mehrere unabhängige Stränge, steht im **Ablauf** über jedem
  Strang dessen offene Teilsumme.
- **Tagesplan** – je ToDo eine Start-Uhrzeit (ohne Datum) und eine Dauer; ein
  ToDo muss spätestens um 24:00 enden. ToDos sind „Läuft gerade", „Als
  Nächstes" oder „Nicht abgehakt" (dann mit **„Nachträglich abhaken"**).
  Die Uhrzeiten gelten für den Tag, an dem du den Tagesplan eingeschaltet
  hast. Ist dieser Tag vorbei, bietet die App an, den Plan „Auf heute zu
  setzen".
- **Fester Zeitplan** – je ToDo Start (Datum + Uhrzeit) und Dauer; ein ToDo
  darf auch über Mitternacht oder mehrere Tage gehen.

Die Dauer ist in allen Modi dasselbe Feld: Eine Schätzung bleibt die Dauer,
wenn du zum Tagesplan oder festen Zeitplan wechselst, und umgekehrt.

Im Modus **Tagesplan** oder **Fester Zeitplan** findest du im Zettel-Menü (⋯)
den Eintrag **„Zeitplan bearbeiten"**:

- **Alles verschieben** – alle Zeiten um Minuten, Stunden (im festen Zeitplan
  auch Tage) verschieben.
- **Auf Zeitraum strecken** (nur fester Zeitplan) – Start und Ende festlegen, die
  übrigen Zeiten werden proportional mitgezogen.
- **Zeiten aus Schätzungen vorschlagen** – offene ToDos werden ab einer Startzeit
  nacheinander abgelegt (ToDos ohne Schätzung zählen 15 Min).
- **Tageszeiten auf ein Datum übertragen** (nur Tagesplan) – kopiert die
  Start-Uhrzeiten als Datum + Uhrzeit; die Dauern bleiben.

Eine Vorschau zeigt die erste und letzte Zeit nach dem Verschieben. Im
Tagesplan muss alles zwischen 0:00 und 24:00 bleiben; sonst sagt die App das und
ändert nichts. Um nur **einen Strang** zu verschieben, öffne im **Ablauf** das
**⋯** einer Karte und wähle **„Strang verschieben …“** (dort kannst du auch auf
den ganzen Zettel umschalten).

**Pausen:** Im Ablauf zeigt ein Pfeil zwischen zwei ToDos mit Zeiten die Pause
dazwischen („Pause 15 Min“) – nur, wenn es eine gibt, und nur, wenn so weit
herangezoomt ist, dass die „+“ zu sehen sind.

**Einfügen mit relativen Zeiten:** Fügst du ein ToDo neben ToDos ein, die schon
eine Startzeit haben (mit „+“ im Ablauf oder in „Jetzt dran“), tippst du keine
Uhrzeit ein, sondern:

- **Vor dem ersten ToDo:** Dauer und **Pause danach**. Wähle *„Davor
  einplanen“* (das neue ToDo endet die Pause vor dem alten Start) oder
  *„Startzeit beibehalten“* (das neue ToDo beginnt dann, und alles danach in
  diesem Strang rückt nach hinten).
- **Nach dem letzten ToDo:** **Pause davor** und Dauer.
- **Dazwischen:** Dauer und **Pause danach**. Die bisherige Pause vor dem
  nächsten ToDo bleibt vor dem neuen. Wähle *„Danach alles nach hinten
  schieben“* oder *„Davor alles nach vorne schieben“*. An einer Verzweigung
  zählt das früheste nächste ToDo, und alle nächsten ToDos rücken gleich weit.

Eine Zeile darunter sagt dir, wann das neue ToDo beginnt und wer wohin rückt.
Verschoben wird immer nur im eigenen Strang. **„Uhrzeit direkt eingeben“**
wechselt zum normalen Startzeit-Feld; **Rückgängig** nimmt Einfügen und
Verschieben in einem Schritt zurück.

Wechselst du einen Zettel vom **Tagesplan** zum **Festen Zeitplan**, fragt die
App direkt, ob die Uhrzeiten auf ein Datum übertragen werden sollen (du kannst
auch „Nicht übertragen" wählen). Umgekehrt geht nichts verloren: Die
Datums-Zeiten bleiben gespeichert und sind wieder da, wenn du zurückwechselst.

In **„Jetzt dran"** zeigt jede Karte mit Zeit ein Badge und den passenden
Zustand; im **Ablauf** steht die Zeitspanne klein am Kasten.

Jede dieser Aktionen ist eine normale Änderung: **Rückgängig** in der Kopfzeile
stellt den vorherigen Stand wieder her.

### 8. Vorlagen

Du kannst einen ganzen Zettel **oder** nur einen einzelnen Strang als
**Vorlage** speichern:

- **Ganzer Zettel:** im Zettel-Menü (⋯) oben **„Zettel als Vorlage speichern"**
  – oder direkt in der Zettel-Übersicht im ⋯-Menü der Zettel-Karte.
- **Ein Strang:** im Ablauf das **⋯** auf einer Karte des Strangs →
  **„Strang als Vorlage speichern"**.

Vorlagen merken sich Struktur, Titel, Notizen, Schätzungen, Tageszeiten und den
Zeitmodus – aber **nicht**, was schon erledigt war. Feste Datum/Uhrzeit-Angaben
werden zu einer Schätzung umgerechnet.

Auf der Seite **Vorlagen** kannst du:

- die Titel-Reihenfolge als **Vorschau** aufklappen,
- eine Vorlage **umbenennen**,
- eine Vorlage **löschen** (mit **Rückgängig** in der Hinweisleiste),
- **„Neuer Zettel aus Vorlage"** – legt einen frischen Zettel an und öffnet ihn.

In einem geöffneten Zettel findest du im Menü (⋯) außerdem **„Vorlage in Zettel
einfügen"**: Die gewählte Vorlage kommt als **neuer, eigener Strang** dazu;
bestehende ToDos bleiben unverändert (mit „Rückgängig").

### 9. Einstellungen

- **Design**: System, Hell oder Dunkel. Dunkel ist gleichwertig gestaltet.
- **Sprache**: Englisch (Standard) oder Deutsch. Die Umschaltung wirkt sofort.
- **Speicher**: zeigt, wie viel Platz Faden belegt, und ob der Browser die
  Daten dauerhaft schützt. Fehlt der Schutz, kannst du auf **„Dauerhaft
  schützen"** tippen (der Browser fragt nach der ersten Nutzerinteraktion
  danach).
- **Version**: die installierte App-Version. Faden aktualisiert sich **nie von
  selbst**. Mit **„Nach neuer Version suchen"** fragst du nach; gibt es eine,
  erscheint **„Neue Version … – jetzt aktualisieren?"**. Die neue Version wird
  erst vollständig heruntergeladen; klappt das nicht, bleibt alles, wie es war.
- **Sicherung und Daten**: **„Sicherung herunterladen"** erstellt
  `faden-backup-JJJJ-MM-TT.json` und merkt sich das Datum
  („Letztes Backup: heute / vor X Tagen / noch kein Backup"). **„Teilen"** nutzt
  die Freigabe des Geräts, falls vorhanden. **„Sicherung einspielen"** prüft die
  gewählte Datei vollständig und bietet dann **„Zusammenführen"** oder
  **„Alles ersetzen"** (ersetzt alles, lädt vorher automatisch eine Sicherung).
- **Installieren**: zeigt **„Offline bereit"**, sobald Faden vollständig auf
  deinem Gerät gespeichert ist. In Chrome/Edge/Android gibt es den Button
  **„App installieren"**. Auf **iPhone/iPad**: in Safari **Teilen → Zum
  Home-Bildschirm**. Wichtig für iOS: Safari löscht Daten von Websites, die etwa
  7 Tage nicht benutzt wurden – nur die installierte App ist davor zuverlässig
  geschützt.

Solange Faden in einem Browser-Tab läuft und installiert werden kann, erscheint
oben der Hinweis **„Faden als App installieren"** mit **„Installieren"** und
**„Ignorieren"**. Nach „Ignorieren" kommt er nicht wieder; installieren kannst
du trotzdem jederzeit unter Einstellungen → Installieren.

### 10. Daten, Backup und Offline

- Alle Daten bleiben **lokal auf deinem Gerät** (IndexedDB). Es gibt kein Konto
  und keine Cloud.
- **Offline**: Nach einmaligem Laden funktioniert Faden auch ohne Netz – auch
  dann, wenn die Webseite, von der du Faden installiert hast, später nicht mehr
  existiert. Faden aktualisiert sich **nie von selbst**; deine installierte
  Version bleibt, wie sie ist.
- **Backup**: Export als Datei `faden-backup-JJJJ-MM-TT.json`.
  Import entweder **„Zusammenführen"** oder **„Alles ersetzen"** (mit Sicherung).
- **Gleiche Namen beim Zusammenführen**: Enthält die Sicherung Zettel, deren
  Namen du schon hast (Groß-/Kleinschreibung egal), zeigt Faden sie an und
  fragt **einmal für alle**: *zusätzlich importieren* als „Name (2)“, *meine
  Zettel überschreiben* (Inhalt wird ersetzt, der Zettel bleibt an seinem
  Platz), *nicht importieren* oder *nur überschreiben, wenn der importierte
  neuer ist*. Vor dem Überschreiben wird eine Sicherung deiner Daten
  heruntergeladen. Danach steht z. B. „5 importiert, 2 übersprungen,
  1 überschrieben“.
- **Erinnerung**: Liegt die letzte Sicherung mehr als 30 Tage zurück und sind
  Daten vorhanden, erscheint auf der Zettel-Übersicht **einmal pro Woche** ein
  wegklickbares Hinweisband mit **„Sicherung erstellen"**.
- **Mehrere Tabs**: Änderungen werden automatisch erkannt und nachgeladen.

### 11. Tastatur (PC)

- **Tab / Shift+Tab**: durch die Bedienelemente.
- In „Jetzt dran": **Enter/Leertaste** = Erledigt, **V** = Vorarbeit nötig,
  **N** = danach einfügen, **E** = bearbeiten.
- **Strg/Cmd+Z** und **Strg/Cmd+Shift+Z**/`Strg+Y`: Undo/Redo.
- Im Ablauf: Pfeiltasten wechseln zwischen Karten, **Enter** bearbeitet,
  **Entf** löscht (mit Undo).
- **?** zeigt eine Übersicht der Kürzel.

### 12. Wenn etwas schiefgeht

- **„Speichern hat nicht geklappt"**: Die App zeigt ruhig ein Banner. Lade die
  Seite neu; erstelle, sobald möglich, ein Backup.
- **Versehentlich gelöscht**: „Rückgängig" im Hinweisband oder Strg/Cmd+Z.
