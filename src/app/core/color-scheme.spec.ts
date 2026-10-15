import {
  contrastIssues,
  contrastRatio,
  DEFAULT_SCHEME,
  onColor,
  parseColorSchemes,
  schemeProperties,
} from './color-scheme';

describe('color-scheme', () => {
  it('rechnet Kontraste nach WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('wählt die besser lesbare Schrift auf Primärflächen', () => {
    expect(onColor('#4a6b57')).toBe('#ffffff');
    expect(onColor('#8fb69b')).toBe('#16201a');
  });

  it('das Standardschema hat keine Kontrast-Hinweise, ein blasses Grün schon', () => {
    expect(contrastIssues(DEFAULT_SCHEME)).toEqual([]);
    const pale = { ...DEFAULT_SCHEME, primary: { light: '#e0f0e0', dark: '#8fb69b' } };
    expect(contrastIssues(pale)).toEqual([{ mode: 'light', kind: 'primary' }]);
  });

  it('setzt „Auswahl“ ohne eigene Farbe auf den Browser-Ton', () => {
    expect(schemeProperties(DEFAULT_SCHEME)['--color-control']).toBe('auto');
    const own = { ...DEFAULT_SCHEME, control: { light: '#112233', dark: '#445566' } };
    expect(schemeProperties(own)['--color-control']).toBe('light-dark(#112233, #445566)');
  });

  it('lässt beim Laden nur gültige Schemata durch und macht Namen eindeutig', () => {
    const ok = { id: 'a', name: 'Meer', primary: { light: '#123456', dark: '#abcdef' }, control: null, focus: { light: '#000000', dark: '#ffffff' } };
    const parsed = parseColorSchemes(
      [
        ok,
        { ...ok, id: 'b', name: 'Salbei' }, // Name des Standardschemas
        { ...ok, id: 'c', primary: { light: 'red', dark: '#abcdef' } }, // keine Hex-Farbe
        { ...ok, id: 'a' }, // doppelte ID
        { ...ok, id: 'salbei' }, // ID des Standardschemas
      ],
      ['Salbei', 'Sage'],
    );
    expect(parsed?.map((s) => [s.id, s.name])).toEqual([
      ['a', 'Meer'],
      ['b', 'Salbei (2)'],
    ]);
    expect(parseColorSchemes('kaputt', [])).toBeUndefined();
  });
});
