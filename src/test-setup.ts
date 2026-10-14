// jsdom implementiert `<dialog>`-Methoden nicht vollständig; für Komponenten-
// tests, die `showModal()`/`close()` aufrufen, ergänzen wir sie minimal.
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;

  if (typeof proto['showModal'] !== 'function') {
    proto['showModal'] = function (this: HTMLDialogElement): void {
      this.open = true;
    };
  }

  if (typeof proto['show'] !== 'function') {
    proto['show'] = function (this: HTMLDialogElement): void {
      this.open = true;
    };
  }

  if (typeof proto['close'] !== 'function') {
    proto['close'] = function (this: HTMLDialogElement): void {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
}
