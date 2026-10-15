import { closeMenusOnClick, closeMenusOnEscape } from './menus';

describe('⋯-Menüs (für die ganze App)', () => {
  let menu: HTMLDetailsElement;
  let other: HTMLDetailsElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <p id="outside">Text</p>
      <details class="menu" id="m1" open>
        <summary>⋯</summary>
        <div class="menu__panel"><button>Umbenennen</button></div>
      </details>
      <details class="menu" id="m2" open>
        <summary>⋯</summary>
        <div class="menu__panel"></div>
      </details>`;
    menu = document.getElementById('m1') as HTMLDetailsElement;
    other = document.getElementById('m2') as HTMLDetailsElement;
    document.addEventListener('click', closeMenusOnClick);
  });

  afterEach(() => {
    document.removeEventListener('click', closeMenusOnClick);
    document.body.innerHTML = '';
  });

  function click(target: Element): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it('schließt alle Menüs bei einem Klick außerhalb', () => {
    click(document.getElementById('outside')!);
    expect(menu.open).toBe(false);
    expect(other.open).toBe(false);
  });

  it('lässt ein Menü bei einem Klick in seinen Inhalt offen, schließt aber die anderen', () => {
    click(menu.querySelector('button')!);
    expect(menu.open).toBe(true);
    expect(other.open).toBe(false);
  });

  it('schließt beim Klick auf das offene Menü selbst, ohne dass es wieder aufklappt', () => {
    const onSelf = click(menu);
    other.open = true;
    const onSummary = click(other.querySelector('summary')!);
    expect(menu.open).toBe(false);
    expect(other.open).toBe(false);
    expect(onSelf.defaultPrevented && onSummary.defaultPrevented).toBe(true);
  });

  it('Esc schließt und gibt den Fokus an das ⋯ zurück', () => {
    menu.querySelector('button')!.focus();
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    closeMenusOnEscape(event);
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('summary'));
    expect(event.defaultPrevented).toBe(true);
  });
});
