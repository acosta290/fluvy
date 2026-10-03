import { describe, expect, it } from 'vitest';
import { viewIcon, viewIconName } from '../look/view-icons.js';

describe('the icon a view’s name says', () => {
  it('reads the name in any of Fluvy’s languages, then the path', () => {
    const named = (title: string, path?: string) => viewIconName(title, path);
    expect(['Home', 'Luces', 'Clima', 'Energia', 'Baterias', 'Hab 1'].map((t) => named(t))).toEqual(
      ['home', 'bulb', 'thermo', 'bolt', 'battery', 'rooms'],
    );
    expect(named('Licht')).toBe('bulb');
    expect(named('Sécurité')).toBe('shield');
    expect(named('Camera da letto')).toBe('rooms');
    expect(named('Cameras')).toBe('camera');
    expect(named('Planta baja')).toBe('rooms');
    expect(named('Plantas')).toBe('leaf');
    expect(named('Automatizaciones')).toBe('automation');
    expect(named('Mutfak')).toBe('rooms');
    // what round 3 of the design review found
    expect(named('Accueil')).toBe('home');
    expect(named('Kameras')).toBe('camera');
    expect(named('Kameralar')).toBe('camera');
    expect(named('Panel principal')).toBe('home');
    expect(named('Işıklar')).toBe('bulb');
    expect(named('Oturma odası')).toBe('rooms');
    expect(named('Ana sayfa')).toBe('home');
    expect(
      ['Wohnzimmer', 'Badezimmer', 'Woonkamer', 'Slaapkamer', 'Séjour', 'Camere'].map((t) =>
        named(t),
      ),
    ).toEqual(['rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms']);
    expect(['Weather', 'Wetter', 'Météo', 'Weer', 'Hava durumu'].map((t) => named(t))).toEqual([
      'cloud',
      'cloud',
      'cloud',
      'cloud',
      'cloud',
    ]);
    // a bathroom is a room in every language; air and ventilation are not the weather
    expect(
      ['Baño', 'Bathroom', 'Badkamer', 'Badezimmer', 'Salle de bain', 'Bagno', 'Banyo'].map((t) =>
        named(t),
      ),
    ).toEqual(['rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms']);
    expect(['Badkamers', 'Slaapkamers'].map((t) => named(t))).toEqual(['rooms', 'rooms']);
    expect(named('Solaire')).toBe('sun');
    expect(named('Accus')).toBe('battery');
    expect(named('Havalandırma')).not.toBe('cloud');
    expect(named('Hava kalitesi')).not.toBe('cloud');
    // a name it does not know reads its path
    expect(named('Mi sitio', 'fotovoltaica')).toBe('sun');
    expect(named('Xyzzy', 'qwerty')).toBeUndefined();
  });

  it('gives the icon as a mask image of the fluvy set', () => {
    expect(viewIcon('Luces')).toMatch(
      /^url\("data:image\/svg\+xml;utf8,<svg .*<path d='M[^']+'\/><\/svg>"\)$/,
    );
    expect(viewIcon('Xyzzy')).toBeUndefined();
  });
});
