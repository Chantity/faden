// Alle sichtbaren Texte der Oberfläche zentral an einer Stelle.
// Eine zweite Sprachdatei (en.ts) muss exakt diesen Aufbau erfüllen – der
// Compiler erzwingt das über `satisfies Translations` (siehe types.ts).
import type { TimeboxMode } from '../model';

export const de = {
  app: {
    name: 'Faden',
    tagline: 'Sieh immer nur, was jetzt dran ist.',
  },

  common: {
    cancel: 'Abbrechen',
    save: 'Speichern',
    done: 'Fertig',
    delete: 'Löschen',
    rename: 'Umbenennen',
    duplicate: 'Duplizieren',
    archive: 'Archivieren',
    restore: 'Wiederherstellen',
    moveUp: 'Nach oben',
    moveDown: 'Nach unten',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    close: 'Schließen',
    more: 'Mehr',
    add: 'Hinzufügen',
    none: 'Keine',
  },

  nav: {
    lists: 'Zettel',
    templates: 'Vorlagen',
    settings: 'Einstellungen',
  },

  titles: {
    lists: 'Zettel',
    list: 'Zettel',
    templates: 'Vorlagen',
    settings: 'Einstellungen',
  },

  lists: {
    title: 'Deine Zettel',
    newList: 'Neuer Zettel',
    firstList: 'Ersten Zettel anlegen',
    emptyTitle: 'Noch kein Zettel da',
    emptyHint:
      'Ein Zettel ist eine ToDo-Liste mit Ablauf. Lege deinen ersten Zettel an und trage ein, was zu tun ist.',
    archivedHeading: 'Archivierte Zettel',
    archivedCount: (n: number): string => (n === 1 ? '1 archivierter Zettel' : `${n} archivierte Zettel`),
    progress: (done: number, total: number): string => `${done} von ${total} erledigt`,
    emptyList: 'Noch keine ToDos',
    nowDoing: (title: string): string => `Jetzt dran: ${title}`,
    nowHeading: 'Jetzt dran',
    allDone: 'Alles erledigt',
    xWithoutEstimate: (n: number): string =>
      n === 1 ? '1 ohne Schätzung' : `${n} ohne Schätzung`,
  },

  listDetail: {
    notFound: 'Dieser Zettel wurde nicht gefunden.',
    placeholder: 'Die Ansichten „Jetzt dran“ und „Ablauf“ entstehen in Phase 2.',
  },

  templates: {
    placeholder:
      'Vorlagen entstehen in Phase 3. Dort kannst du Zettel oder einzelne Stränge als Vorlage speichern und daraus neue Zettel anlegen.',
  },

  focus: {
    tabFocus: 'Jetzt dran',
    tabFlow: 'Ablauf',
    markDone: 'Erledigt',
    needFirst: 'Erst noch etwas anderes nötig …',
    newWorkLabel: 'Vorarbeit',
    newWorkPlaceholder: 'Was muss zuerst passieren?',
    chainHint: 'Enter fügt weitere hinzu · Esc beendet',
    finish: 'Fertig',
    then: (title: string): string => `Danach: ${title}`,
    thenMore: (n: number): string => `+${n} weitere`,
    joinNote: 'Außerdem muss noch erledigt sein:',
    waitsFor: (names: string): string => `wartet auf: ${names}`,
    earlyDone: 'Vorarbeit noch offen',
    laterHeading: (n: number): string => `Danach kommt noch … (${n} ToDos)`,
    allDoneHeading: 'Alles erledigt.',
    archiveList: 'Zettel archivieren',
    emptyHeading: 'Was möchtest du erledigen?',
    addPlaceholder: 'Neues ToDo …',
    add: 'Hinzufügen',
    newTodo: 'Neues ToDo ohne Abhängigkeit hinzufügen',
    newTodoLabel: 'Neues ToDo',
    menu: {
      edit: 'Bearbeiten',
      addAfter: 'Danach einfügen',
      splitAfter: 'Daneben aufteilen',
      join: 'Daneben zusammenführen',
      connect: 'Mit anderem ToDo verbinden',
      delete: 'Löschen',
    },
  },

  editor: {
    title: 'ToDo bearbeiten',
    titleLabel: 'Titel',
    notesLabel: 'Notizen',
    predecessors: 'Muss vorher erledigt sein',
    successors: 'Kommt danach',
    addLink: '+ hinzufügen',
    chooseTask: 'ToDo auswählen',
    removeLink: (title: string): string => `${title} entfernen`,
  },

  flow: {
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    fit: 'Alles einpassen',
    centerCurrent: 'Zum aktuellen ToDo springen',
    newStrand: 'Neuer eigener Strang',
    insertBefore: 'Davor einfügen',
    insertAfter: 'Danach einfügen',
    insertBetween: 'Dazwischen einfügen',
    removeEdge: 'Pfeil entfernen',
    zoomHint: 'Für „+“ heranzoomen',
    empty: 'Noch keine ToDos.',
    stateDone: 'Erledigt',
    stateNow: 'Jetzt dran',
    stateWaiting: 'Wartet',
    check: 'Abhaken',
    uncheck: 'Häkchen entfernen',
    menuLabel: (title: string): string => `Aktionen für ${title}`,
  },

  shortcuts: {
    title: 'Tastenkürzel',
    done: 'Erledigt abhaken (in „Jetzt dran“)',
    needFirst: 'Erst noch etwas anderes nötig',
    after: 'Danach einfügen',
    edit: 'Bearbeiten',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    help: 'Diese Übersicht öffnen',
    flowNav: 'Im Ablauf: Nachbar wählen',
    flowEdit: 'Im Ablauf: Bearbeiten',
    flowDelete: 'Im Ablauf: Löschen',
  },

  listDialog: {
    newTitle: 'Neuer Zettel',
    editTitle: 'Zettel bearbeiten',
    nameLabel: 'Wie soll der Zettel heißen?',
    namePlaceholder: 'z. B. Geschirrspüler einräumen',
    timeboxLabel: 'Zeitplanung',
    create: 'Anlegen',
  },

  timebox: {
    modes: {
      none: 'Keine Zeitplanung',
      estimate: 'Zeitschätzung',
      dayPlan: 'Tagesplan',
      schedule: 'Fester Zeitplan',
    } satisfies Record<TimeboxMode, string>,
    modeDescriptions: {
      none: 'Nur ToDos, ohne Zeiten.',
      estimate: 'Dauer je ToDo schätzen.',
      dayPlan: 'Uhrzeiten ohne Datum.',
      schedule: 'Datum und Uhrzeit.',
    } satisfies Record<TimeboxMode, string>,
  },

  snackbar: {
    listDeleted: 'Zettel gelöscht.',
    listArchived: 'Zettel archiviert.',
    listRestored: 'Zettel wiederhergestellt.',
    listDuplicated: 'Zettel dupliziert.',
    saveFailed: 'Speichern hat nicht geklappt – bitte später erneut versuchen.',
  },

  errors: {
    titleRequired: 'Bitte gib einen Titel ein.',
    titleTooLong: (max: number): string => `Titel darf höchstens ${max} Zeichen haben.`,
    notesTooLong: (max: number): string => `Notizen dürfen höchstens ${max} Zeichen haben.`,
    selfLoop: (name: string): string =>
      `Das geht nicht: „${name}“ kann nicht auf sich selbst warten.`,
    cycle: (from: string, to: string): string =>
      `Das geht nicht: „${from}“ müsste dann auf „${to}“ warten.`,
    duplicateEdge: 'Diese Verbindung gibt es schon.',
  },

  settings: {
    themeHeading: 'Design',
    themeSystem: 'Systemeinstellung',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    languageHeading: 'Sprache',
    languageEnglish: 'Englisch',
    languageGerman: 'Deutsch',
    versionHeading: 'Version',
    versionLabel: 'App-Version',
    storageHeading: 'Speicher',
    storagePending: 'Speicherstatus wird geprüft …',
    storagePersisted: 'Speicher ist dauerhaft geschützt.',
    storageUnprotected: 'Der Browser kann den Speicher bei Platzmangel räumen – erstelle Backups.',
  },

  a11y: {
    listCard: 'Zettel',
    mainNav: 'Hauptnavigation',
    actionsFor: (title: string): string => `Aktionen für ${title}`,
    snackbarRegion: 'Hinweise',
  },
};
