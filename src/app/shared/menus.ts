// Gemeinsames Verhalten aller ⋯-Menüs (`<details class="menu">` mit `.menu__panel`),
// in der App-Shell einmal für das ganze Dokument verdrahtet.

/**
 * Ein Klick irgendwo schließt jedes offene Menü – außer Klicks im Menüinhalt.
 * Auch ein Klick auf das offene Menü selbst (Zusammenfassung oder die Fläche
 * daneben) schließt es; ohne `preventDefault` würde die native Kippbewegung es
 * dann sofort wieder öffnen.
 */
export function closeMenusOnClick(event: Event): void {
  const target = event.target as HTMLElement | null;
  const inMenu = target?.closest('details.menu') as HTMLDetailsElement | null;
  const inPanel = target?.closest('.menu__panel') != null;
  if (inMenu?.open && !inPanel) event.preventDefault();
  for (const menu of document.querySelectorAll<HTMLDetailsElement>('details.menu[open]')) {
    if (menu === inMenu && inPanel) continue;
    menu.removeAttribute('open');
  }
}

/** Esc schließt offene Menüs und gibt den Fokus an ihre Zusammenfassung (⋯) zurück. */
export function closeMenusOnEscape(event: Event): void {
  const open = document.querySelectorAll<HTMLDetailsElement>('details.menu[open]');
  if (open.length === 0) return;
  for (const menu of open) {
    const hadFocus = menu.contains(document.activeElement);
    menu.removeAttribute('open');
    if (hadFocus) menu.querySelector('summary')?.focus();
  }
  event.preventDefault();
}

/** Schließt das Menü, in dem ein Menüpunkt gewählt wurde. */
export function closeMenu(event: Event): void {
  (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
}
