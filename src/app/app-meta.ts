// Zentrale Stelle für App-Name und Version.
// Der Name ist bewusst nur hier (und im Manifest) hinterlegt, damit er leicht änderbar ist.
import { version } from '../../package.json';

export const APP_NAME = 'Faden';
export const APP_SHORT_NAME = 'Faden';

// Zur Buildzeit aus package.json übernommen (der Bundler übernimmt nur dieses Feld).
export const APP_VERSION: string = version;

/** Quellcode und Fehlermeldungen (nur ein Link; die App selbst fragt dort nie an). */
export const APP_REPO_URL = 'https://github.com/Chantity/faden';
