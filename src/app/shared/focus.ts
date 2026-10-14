import { afterNextRender, type ElementRef, type Injector } from '@angular/core';

/**
 * Fokussiert ein Element, sobald Angular die nächste Änderung gerendert hat.
 * Ohne Zone.js reicht ein Microtask nicht: Ein Feld, das erst durch die
 * Änderung erscheint (z. B. die Ketten-Eingabe), existiert dann noch nicht.
 */
export function focusAfterRender(
  injector: Injector,
  target: () => ElementRef<HTMLElement> | undefined,
): void {
  afterNextRender(() => target()?.nativeElement.focus(), { injector });
}
