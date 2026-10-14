// Alle sichtbaren Texte der Oberfläche zentral an einer Stelle.
// So bleibt eine spätere Übersetzung möglich, ohne die Templates zu durchsuchen.
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
    allDone: 'Alles erledigt',
    xWithoutEstimate: (n: number): string =>
      n === 1 ? '1 ohne Schätzung' : `${n} ohne Schätzung`,
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
  },

  settings: {
    themeHeading: 'Design',
    themeSystem: 'Systemeinstellung',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    versionHeading: 'Version',
    versionLabel: 'App-Version',
    storageHeading: 'Speicher',
    storagePending: 'Speicherstatus wird geprüft …',
    storagePersisted: 'Speicher ist dauerhaft geschützt.',
    storageUnprotected: 'Der Browser kann den Speicher bei Platzmangel räumen – erstelle Backups.',
  },

  a11y: {
    listCard: 'Zettel',
    actionsFor: (title: string): string => `Aktionen für ${title}`,
    snackbarRegion: 'Hinweise',
  },
} as const;
