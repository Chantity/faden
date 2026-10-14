import { NowStore } from './now.store';

describe('NowStore', () => {
  it('liefert ein Datum und aktualisiert es beim tick', () => {
    const store = new NowStore();
    const before = store.now();
    expect(before).toBeInstanceOf(Date);

    store.tick();

    expect(store.now().getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
