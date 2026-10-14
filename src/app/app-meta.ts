// Zentrale Stelle für App-Name und Version.
// Der Name ist bewusst nur hier (und im Manifest) hinterlegt, damit er leicht änderbar ist.
export const APP_NAME = 'Faden';
export const APP_SHORT_NAME = 'Faden';

// Wird zur Buildzeit gesetzt (siehe angular.json -> define). Fallback für Entwicklung/Tests.
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

declare global {
  const __APP_VERSION__: string | undefined;
}
