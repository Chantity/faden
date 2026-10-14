// Englische Oberflächentexte – Standardsprache der App.
// Muss den Aufbau von de.ts exakt erfüllen (siehe `satisfies Translations`).
import type { TimeboxMode } from '../model';
import type { Translations } from './types';

export const en = {
  app: {
    name: 'Faden',
    tagline: 'See only what matters right now.',
  },

  common: {
    cancel: 'Cancel',
    save: 'Save',
    done: 'Done',
    delete: 'Delete',
    rename: 'Rename',
    duplicate: 'Duplicate',
    archive: 'Archive',
    restore: 'Restore',
    moveUp: 'Move up',
    moveDown: 'Move down',
    undo: 'Undo',
    redo: 'Redo',
    close: 'Close',
    more: 'More',
    add: 'Add',
    none: 'None',
  },

  nav: {
    lists: 'Lists',
    templates: 'Templates',
    settings: 'Settings',
  },

  titles: {
    lists: 'Lists',
    list: 'List',
    templates: 'Templates',
    settings: 'Settings',
  },

  lists: {
    title: 'Your lists',
    newList: 'New list',
    firstList: 'Create your first list',
    emptyTitle: 'No list yet',
    emptyHint:
      'A list is a to-do list with a flow. Create your first list and write down what needs doing.',
    archivedHeading: 'Archived lists',
    archivedCount: (n: number): string => (n === 1 ? '1 archived list' : `${n} archived lists`),
    progress: (done: number, total: number): string => `${done} of ${total} done`,
    emptyList: 'No todos yet',
    nowDoing: (title: string): string => `Now: ${title}`,
    nowHeading: 'Now',
    allDone: 'All done',
    xWithoutEstimate: (n: number): string =>
      n === 1 ? '1 without estimate' : `${n} without estimate`,
  },

  listDetail: {
    notFound: 'This list was not found.',
    placeholder: 'The “Now” and “Flow” views are coming in phase 2.',
  },

  templates: {
    placeholder:
      'Templates arrive in phase 3. There you can save lists or individual strands as a template and create new lists from them.',
  },

  focus: {
    tabFocus: 'Now',
    tabFlow: 'Flow',
    markDone: 'Done',
    needFirst: 'Something else has to come first …',
    newWorkLabel: 'Prerequisite',
    newWorkPlaceholder: 'What has to happen first?',
    chainHint: 'Enter adds more · Esc finishes',
    finish: 'Finish',
    then: (title: string): string => `Then: ${title}`,
    thenMore: (n: number): string => `+${n} more`,
    joinNote: 'This also has to be done:',
    waitsFor: (names: string): string => `waiting on: ${names}`,
    earlyDone: 'Prerequisite still open',
    laterHeading: (n: number): string => `Still to come … (${n} todos)`,
    allDoneHeading: 'All done.',
    archiveList: 'Archive list',
    emptyHeading: 'What would you like to get done?',
    addPlaceholder: 'New todo …',
    add: 'Add',
    newTodo: 'Add a new standalone todo',
    newTodoLabel: 'New todo',
    menu: {
      edit: 'Edit',
      addAfter: 'Insert after',
      splitAfter: 'Split alongside',
      join: 'Merge alongside',
      connect: 'Connect to another todo',
      delete: 'Delete',
    },
  },

  editor: {
    title: 'Edit todo',
    titleLabel: 'Title',
    notesLabel: 'Notes',
    predecessors: 'Must be done before',
    successors: 'Comes after',
    addLink: '+ add',
    chooseTask: 'Choose a todo',
    removeLink: (title: string): string => `Remove ${title}`,
  },

  flow: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit all',
    centerCurrent: 'Jump to current todo',
    newStrand: 'New separate strand',
    insertBefore: 'Insert before',
    insertAfter: 'Insert after',
    insertBetween: 'Insert in between',
    removeEdge: 'Remove arrow',
    zoomHint: 'Zoom in for “+”',
    empty: 'No todos yet.',
    stateDone: 'Done',
    stateNow: 'Now',
    stateWaiting: 'Waiting',
    check: 'Mark done',
    uncheck: 'Remove checkmark',
    menuLabel: (title: string): string => `Actions for ${title}`,
  },

  shortcuts: {
    title: 'Keyboard shortcuts',
    done: 'Mark done (in “Now”)',
    needFirst: 'Something else has to come first',
    after: 'Insert after',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    help: 'Open this overview',
    flowNav: 'In flow: pick neighbour',
    flowEdit: 'In flow: edit',
    flowDelete: 'In flow: delete',
  },

  listDialog: {
    newTitle: 'New list',
    editTitle: 'Edit list',
    nameLabel: 'What should the list be called?',
    namePlaceholder: 'e.g. load the dishwasher',
    timeboxLabel: 'Time planning',
    create: 'Create',
  },

  timebox: {
    modes: {
      none: 'No time planning',
      estimate: 'Time estimate',
      dayPlan: 'Day plan',
      schedule: 'Fixed schedule',
    } satisfies Record<TimeboxMode, string>,
    modeDescriptions: {
      none: 'Just todos, no times.',
      estimate: 'Estimate duration per todo.',
      dayPlan: 'Times of day without a date.',
      schedule: 'Date and time.',
    } satisfies Record<TimeboxMode, string>,
  },

  snackbar: {
    listDeleted: 'List deleted.',
    listArchived: 'List archived.',
    listRestored: 'List restored.',
    listDuplicated: 'List duplicated.',
    saveFailed: 'Saving failed – please try again later.',
  },

  errors: {
    titleRequired: 'Please enter a title.',
    titleTooLong: (max: number): string => `Title must be at most ${max} characters.`,
    notesTooLong: (max: number): string => `Notes must be at most ${max} characters.`,
    selfLoop: (name: string): string => `That won’t work: “${name}” cannot wait on itself.`,
    cycle: (from: string, to: string): string =>
      `That won’t work: “${from}” would then have to wait on “${to}”.`,
    duplicateEdge: 'That connection already exists.',
  },

  settings: {
    themeHeading: 'Theme',
    themeSystem: 'System setting',
    themeLight: 'Light',
    themeDark: 'Dark',
    languageHeading: 'Language',
    languageEnglish: 'English',
    languageGerman: 'German',
    versionHeading: 'Version',
    versionLabel: 'App version',
    storageHeading: 'Storage',
    storagePending: 'Checking storage status …',
    storagePersisted: 'Storage is protected permanently.',
    storageUnprotected: 'The browser may clear storage when space is low – create backups.',
  },

  a11y: {
    listCard: 'List',
    mainNav: 'Main navigation',
    actionsFor: (title: string): string => `Actions for ${title}`,
    snackbarRegion: 'Notifications',
  },
} satisfies Translations;
