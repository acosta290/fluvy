// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, nextConfig, shownNames } from '../shared/fixtures/editor.js';
import { stateLineWidths } from '../shared/fixtures/widths.js';
import { FluvyTilesCard } from '../tiles/tiles-card.js';
import { FluvyTileCard } from './tile-card.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);

/**
 * An unavailable tile keeps its size (the owner's rule, 1.9): the tile whose entity cannot be read — unavailable, or
 * missing — draws the live tile's own anatomy in every size (its circle, its name, its state line, its readings as
 * dashes, its switch that does not move, its ruler at rest), so a large one never stands shorter than its neighbours.
 * Only the colours change.
 */

const STAMP = '2026-09-17T19:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

/** The live house, and the same house where each appliance cannot be read (its capabilities kept, as HA keeps them). */
const LIVE = {
  'switch.washer': state('switch.washer', 'on', { friendly_name: 'Washer' }),
  'switch.printer': state('switch.printer', 'on', { friendly_name: '3D printer' }),
  'light.desk': state('light.desk', 'on', {
    friendly_name: 'Desk lamp',
    brightness: 128,
    supported_color_modes: ['brightness'],
  }),
  'sensor.office': state('sensor.office', '21.5', {
    friendly_name: 'Office',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  'sensor.washer_power': state('sensor.washer_power', '142', {
    friendly_name: 'Washer power',
    unit_of_measurement: 'W',
    device_class: 'power',
  }),
  'sensor.washer_energy': state('sensor.washer_energy', '0.8', {
    friendly_name: 'Washer energy',
    unit_of_measurement: 'kWh',
    device_class: 'energy',
  }),
};
const DEAD = Object.fromEntries(
  Object.entries(LIVE).map(([id, s]) => [
    id,
    {
      ...s,
      state: 'unavailable',
      attributes: Object.fromEntries(
        Object.entries(s.attributes).filter(([key]) =>
          [
            'friendly_name',
            'supported_color_modes',
            'unit_of_measurement',
            'device_class',
          ].includes(key),
        ),
      ),
    },
  ]),
);

const house = (states: Record<string, unknown>): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states,
    entities: Object.fromEntries(
      Object.keys(LIVE).map((id) => [id, { entity_id: id, area_id: 'office', device_id: null }]),
    ),
    devices: {},
    areas: { office: { area_id: 'office', name: 'Office', picture: null } },
    user: { id: 'u', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: () => Promise.resolve(),
  }) as unknown as HomeAssistant;

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

async function drawn(
  config: LovelaceCardConfig,
  states: Record<string, unknown>,
  width = 360,
  hass = house(states),
) {
  const card = document.createElement(String(config.type).replace('custom:', '')) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-tile')];
}

/** The parts a tile is drawn of, in their order, and the classes that size it. */
const PARTS: readonly string[] = [
  'fv-tile__tap',
  'fv-tile__head',
  'fv-ico',
  'fv-hit',
  'fv-tile__value',
  'fv-tile__text',
  'fv-tile__name',
  'fv-tile__state',
  'fv-tile__foot',
  'fv-readout',
];
const SIZING = [
  'fv-tile--compact',
  'fv-tile--mini',
  'fv-tile--inner',
  'fv-tile--footless',
  'fv-tile--tight',
];
function anatomy(tile: HTMLElement): string[] {
  const parts = [...tile.querySelectorAll('*')].flatMap((el) =>
    el.tagName === 'FLUVY-RULER' ? ['ruler'] : PARTS.filter((part) => el.classList.contains(part)),
  );
  return [...SIZING.filter((cls) => tile.classList.contains(cls)), ...parts];
}

const sizes = ['large', 'compact', 'mini'] as const;
const PLUG = {
  entity: 'switch.washer',
  readouts: ['sensor.washer_power', 'sensor.washer_energy'],
};

describe('a tile declares the height it draws', () => {
  // the mini tile is 108 tall, icon over name (tiles.css), as a group of minis declares it
  it.each([
    ['large', 168],
    ['compact', 76],
    ['mini', 108],
  ] as const)('%s: %i, as a group of one tile of its size', (size, height) => {
    expect(
      FluvyTileCard.layoutHeight({ type: 'custom:fluvy-tile-card', entity: 'light.desk', size }),
    ).toBe(height);
    expect(
      FluvyTilesCard.layoutHeight({
        type: 'custom:fluvy-tiles-card',
        size,
        entities: ['light.desk'],
      }),
    ).toBe(height);
  });
});

describe('an unavailable tile keeps the live one’s anatomy and size (A7)', () => {
  afterEach(() => document.body.replaceChildren());

  it.each(sizes)(
    'a plug, %s: circle, name, state line, readings and switch alike',
    async (size) => {
      const config = { type: 'custom:fluvy-tile-card', size, ...PLUG };
      const [live] = await drawn(config, LIVE);
      document.body.replaceChildren();
      const [dead] = await drawn(config, DEAD);
      expect(anatomy(dead!)).toEqual(anatomy(live!));
      expect(dead!.classList.contains('fv-tile--off')).toBe(true);
      if (size === 'large') {
        // the readings are dashes, the switch is there and does not move
        expect(
          [...dead!.querySelectorAll('.fv-readout__value')].map((v) => v.textContent?.trim()),
        ).toEqual(['—', '—']);
        expect(dead!.querySelector('.fv-hit')!.classList.contains('is-fixed')).toBe(true);
        expect(dead!.querySelector('.fv-tile__state')!.textContent).toContain('Unavailable');
      }
    },
  );

  it.each(sizes)('a missing entity, %s, is drawn the same', async (size) => {
    const config = { type: 'custom:fluvy-tile-card', size, ...PLUG };
    const [live] = await drawn(config, LIVE);
    document.body.replaceChildren();
    const rest = Object.fromEntries(Object.entries(LIVE).filter(([id]) => id !== 'switch.washer'));
    const [missing] = await drawn(config, rest);
    expect(anatomy(missing!)).toEqual(anatomy(live!));
  });

  it('a dimmable light keeps its ruler, at rest and out of reach', async () => {
    const config = { type: 'custom:fluvy-tile-card', entity: 'light.desk' };
    const [live] = await drawn(config, LIVE);
    document.body.replaceChildren();
    const [dead] = await drawn(config, DEAD);
    expect(anatomy(dead!)).toEqual(anatomy(live!));
    expect(anatomy(dead!)).toContain('ruler');
    expect(dead!.querySelector('fluvy-ruler')!.hasAttribute('inert')).toBe(true);
  });

  it('a sensor keeps its reading in the head, as a dash', async () => {
    const config = { type: 'custom:fluvy-tile-card', entity: 'sensor.office' };
    const [live] = await drawn(config, LIVE);
    document.body.replaceChildren();
    const [dead] = await drawn(config, DEAD);
    expect(anatomy(dead!)).toEqual(anatomy(live!));
    expect(dead!.querySelector('.fv-tile__value')?.textContent?.trim()).toBe('—');
  });

  it('four large tiles, one unavailable: the same parts in every one', async () => {
    const tiles = await drawn(
      {
        type: 'custom:fluvy-tiles-card',
        size: 'large',
        columns: 2,
        tiles: [PLUG, { ...PLUG, entity: 'switch.printer' }, PLUG, PLUG],
      },
      { ...LIVE, 'switch.printer': DEAD['switch.printer'] },
    );
    expect(tiles).toHaveLength(4);
    for (const tile of tiles) expect(anatomy(tile)).toEqual(anatomy(tiles[0]!));
    expect(tiles[1]!.classList.contains('fv-tile--off')).toBe(true);
  });

  it('a room’s inner tiles: an unavailable one keeps the live one’s parts', async () => {
    const tiles = await drawn(
      {
        type: 'custom:fluvy-room-card',
        area: 'office',
        variant: 'tile',
        controls: 'tiles',
        tiles: [{ entity: 'switch.washer' }, { entity: 'switch.printer' }],
      },
      { ...LIVE, 'switch.printer': DEAD['switch.printer'] },
    );
    expect(tiles).toHaveLength(2);
    expect(anatomy(tiles[1]!)).toEqual(anatomy(tiles[0]!));
  });

  it('a large tile’s surface holds, and its switch is beside its button, never inside it', async () => {
    const [tile] = await drawn({ type: 'custom:fluvy-tile-card', ...PLUG }, LIVE);
    const tap = tile!.querySelector<HTMLElement & { fvHold?: () => void }>('.fv-tile__tap')!;
    expect(tap.tagName).toBe('BUTTON');
    expect(typeof tap.fvHold).toBe('function');
    expect(tap.querySelector('.fv-hit, button')).toBeNull();
    expect(tile!.hasAttribute('role')).toBe(false);
  });
});

describe('a number’s large tile keeps its figure: the room gives way where both do not hold (#77)', () => {
  const NUMBER = {
    'number.offset': state('number.offset', '-1', {
      friendly_name: 'Offset',
      min: -2,
      max: 2,
      step: 0.5,
      unit_of_measurement: '°C',
    }),
    'input_number.pump': state('input_number.pump', '65', {
      friendly_name: 'Pool pump',
      min: 0,
      max: 100,
      step: 5,
      unit_of_measurement: '%',
    }),
    'light.desk': LIVE['light.desk'],
  };
  // rooms a 172 tile's line cannot hold beside the figure (by the widths' model), and the figure each language writes
  const ROOM = { en: 'Living room', de: 'Arbeitszimmer', ja: 'リビングルーム' } as const;
  const FIGURE = { en: '−1.0 °C', de: '−1,0 °C', ja: '−1.0 °C' } as const;
  const speaking = (language: keyof typeof ROOM): HomeAssistant =>
    ({
      ...house(NUMBER),
      language,
      locale: { language, number_format: 'language', time_format: '24' },
      entities: Object.fromEntries(
        Object.keys(NUMBER).map((id) => [id, { entity_id: id, area_id: 'room', device_id: null }]),
      ),
      areas: { room: { area_id: 'room', name: ROOM[language], picture: null } },
    }) as unknown as HomeAssistant;
  const lines = (tiles: readonly HTMLElement[]): string[] =>
    tiles.map((tile) => tile.querySelector('.fv-tile__state')!.textContent!.trim());

  let restore: () => void;
  beforeAll(() => {
    restore = stateLineWidths();
  });
  afterAll(() => restore());
  afterEach(() => document.body.replaceChildren());

  describe.each(['en', 'de', 'ja'] as const)('in %s', (language) => {
    it.each([156, 172])('a tile card of %i px says the figure alone', async (width) => {
      const tiles = await drawn(
        { type: 'custom:fluvy-tile-card', entity: 'number.offset' },
        NUMBER,
        width,
        speaking(language),
      );
      expect(lines(tiles)).toEqual([FIGURE[language]]);
    });

    it.each([156, 172])('a group’s tiles of %i px each keep their figure', async (width) => {
      const tiles = await drawn(
        {
          type: 'custom:fluvy-tiles-card',
          size: 'large',
          columns: 2,
          tiles: ['number.offset', 'input_number.pump'],
        },
        NUMBER,
        2 * width + 16,
        speaking(language),
      );
      const [offset, pump] = lines(tiles);
      expect(offset).toBe(FIGURE[language]);
      // the pump's shorter line holds whole where its room and figure fit, else its figure alone
      expect(pump).toMatch(new RegExp(`^(${ROOM[language]} · )?65 %$`));
    });

    it('a tile of 360 px holds the room and the figure', async () => {
      const tiles = await drawn(
        { type: 'custom:fluvy-tile-card', entity: 'number.offset' },
        NUMBER,
        360,
        speaking(language),
      );
      expect(lines(tiles)).toEqual([`${ROOM[language]} · ${FIGURE[language]}`]);
    });

    it.each(['compact', 'mini'] as const)(
      'a %s tile writes the large tile’s figure, its minus a minus',
      async (size) => {
        const tiles = await drawn(
          { type: 'custom:fluvy-tile-card', entity: 'number.offset', size },
          NUMBER,
          172,
          speaking(language),
        );
        expect(lines(tiles)).toEqual([FIGURE[language]]);
      },
    );
  });

  it.each(['large', 'compact'] as const)(
    'a muted player’s %s tile says so before its volume, as the Slider card’s tile does',
    async (size) => {
      const PLAYER = {
        'media_player.soundbar': state('media_player.soundbar', 'on', {
          friendly_name: 'Soundbar',
          supported_features: 4 | 8, // its volume set and muted
          volume_level: 0.3,
          is_volume_muted: true,
        }),
      };
      const tiles = await drawn(
        { type: 'custom:fluvy-tile-card', entity: 'media_player.soundbar', size },
        PLAYER,
        360,
      );
      expect(lines(tiles)).toEqual(['Muted · 30 %']);
    },
  );

  it('a lit light’s line is as it was: its state first, its level after where it holds', async () => {
    const tiles = await drawn(
      { type: 'custom:fluvy-tile-card', entity: 'light.desk' },
      NUMBER,
      156,
      speaking('en'),
    );
    expect(lines(tiles)).toEqual(['On · 50 %']);
  });
});

describe('a reading too long for its tile says itself shorter, never goes (#93)', () => {
  const BOOT = new Date(Date.now() - 12 * 86_400_000).toISOString();
  const STATES = {
    'sensor.dns_queries': state('sensor.dns_queries', '5114200', {
      friendly_name: 'Queries',
      unit_of_measurement: 'queries',
    }),
    'sensor.rules_count': state('sensor.rules_count', '420995', {
      friendly_name: 'Rules count',
      unit_of_measurement: 'rules',
    }),
    'sensor.last_boot': state('sensor.last_boot', BOOT, {
      friendly_name: 'Last boot',
      device_class: 'timestamp',
    }),
    // a meter whose two decimals the person asked for: never in short words
    'sensor.meter': state('sensor.meter', '12345.67', {
      friendly_name: 'Meter',
      unit_of_measurement: 'kWh',
    }),
  };
  /** The house as Home Assistant writes its states: figures grouped, a moment in full. */
  const writing: HomeAssistant = {
    ...house(STATES),
    entities: { 'sensor.meter': { entity_id: 'sensor.meter', display_precision: 2 } },
    formatEntityState: (s: { state: string; attributes: Record<string, unknown> }) => {
      if (s.attributes['device_class'] === 'timestamp')
        return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(
          new Date(s.state),
        );
      const unit = s.attributes['unit_of_measurement'] as string;
      return `${Number(s.state).toLocaleString('en', { maximumFractionDigits: 2 })} ${unit}`;
    },
  } as unknown as HomeAssistant;
  const lines = async (width: number): Promise<string[]> =>
    (
      await drawn(
        {
          type: 'custom:fluvy-tiles-card',
          size: 'compact',
          columns: 2,
          tiles: Object.keys(STATES),
        },
        STATES,
        2 * width + 16,
        writing,
      )
    ).map((tile) => tile.querySelector('.fv-tile__state')!.textContent!.trim());

  let restore: () => void;
  beforeAll(() => {
    restore = stateLineWidths();
  });
  afterAll(() => restore());
  afterEach(() => document.body.replaceChildren());

  it('half a phone of 412: a count in short words, a moment as long ago as it was', async () => {
    expect(await lines(182)).toEqual([
      '5.1M queries',
      '420,995 rules',
      '12 days ago',
      '12,345.67 kWh',
    ]);
  });

  it('half a phone of 360: the unit goes, then the moment’s short form', async () => {
    expect(await lines(156)).toEqual(['5.1M', '421K', '12 d ago', '12,345.67']);
  });

  it('a whole tile says it whole', async () => {
    const [queries, , boot] = await lines(360);
    expect(queries).toBe('5,114,200 queries');
    expect(boot).toMatch(/^[A-Z][a-z]+ \d+, \d{4} at /);
  });
});

describe('the tile’s circle: what opens drawn as it stands, Home Assistant’s icon where Fluvy has none', () => {
  afterEach(() => document.body.replaceChildren());

  const STATES = {
    'cover.gate': state('cover.gate', 'open', { friendly_name: 'Gate', device_class: 'gate' }),
    'cover.garage': state('cover.garage', 'closed', {
      friendly_name: 'Garage',
      device_class: 'garage',
    }),
    'binary_sensor.door': state('binary_sensor.door', 'on', {
      friendly_name: 'Front door',
      device_class: 'door',
    }),
    'sensor.air': state('sensor.air', '12', { friendly_name: 'Air', device_class: 'pm25' }),
    // the person's icon, which Home Assistant writes into the state too
    'sensor.lux': state('sensor.lux', '300', { friendly_name: 'Lux', icon: 'mdi:brightness-5' }),
  };

  /** The circle of the tile of `entity`; the person set `sensor.lux`'s icon in Home Assistant. */
  async function circle(entity: string): Promise<HTMLElement> {
    const card = document.createElement('fluvy-tile-card') as CardElement;
    card.setConfig({ type: 'custom:fluvy-tile-card', entity });
    card.hass = {
      ...house(STATES),
      entities: { 'sensor.lux': { entity_id: 'sensor.lux', icon: 'mdi:brightness-5' } },
    } as unknown as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    return card.shadowRoot!.querySelector<HTMLElement>('.fv-tile .fv-ico')!;
  }

  it('a gate open, a garage shut, a door open: Fluvy’s glyphs as they stand', async () => {
    expect((await circle('cover.gate')).innerHTML).toContain('M4 7l10-3v16.5L4 17');
    document.body.replaceChildren();
    expect((await circle('cover.garage')).innerHTML).toContain('M7.5 12h9v9h-9Z');
    document.body.replaceChildren();
    expect((await circle('binary_sensor.door')).innerHTML).toContain('M6 3.5l7 2.5v13l-7 2');
  });

  it('the icon the person set in Home Assistant', async () => {
    const icon = (await circle('sensor.lux')).querySelector<HTMLElement & { icon?: string }>(
      'ha-icon',
    );
    expect(icon?.icon).toBe('mdi:brightness-5');
  });

  it('Home Assistant’s own icon for the state where Fluvy has no glyph for the kind', async () => {
    const icon = (await circle('sensor.air')).querySelector<HTMLElement & { stateObj?: unknown }>(
      'ha-state-icon',
    );
    expect(icon?.classList.contains('fv-haicon')).toBe(true);
    expect(icon?.stateObj).toBe(STATES['sensor.air']);
  });
});

describe('the tile’s editor offers what acts for its entity and its size (#58)', () => {
  const STATES = {
    ...LIVE,
    'light.plug': state('light.plug', 'on', {
      friendly_name: 'Salt lamp',
      supported_color_modes: ['onoff'],
    }),
  };
  const shown = async (config: Record<string, unknown>): Promise<string[]> => {
    const editor = await FluvyTileCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house(STATES);
    const drawnEditor = await drawEditor(editor, { type: 'custom:fluvy-tile-card', ...config });
    return shownNames(cardForm(drawnEditor).schema);
  };
  afterEach(() => document.body.replaceChildren());

  it('a light’s colours for a light alone, how its whites show while it shows its colour', async () => {
    expect(await shown({ entity: 'switch.washer' })).not.toContain('light_colors');
    expect(await shown({ entity: 'light.desk' })).toContain('light_colors');
    // the house says none (off), the card none: no whites to choose
    expect(await shown({ entity: 'light.desk' })).not.toContain('light_whites');
    expect(await shown({ entity: 'light.desk', light_colors: true })).toContain('light_whites');
  });

  it('readouts where they are drawn: never under a large tile’s ruler', async () => {
    expect(await shown({ entity: 'light.desk' })).not.toContain('readouts');
    expect(await shown({ entity: 'light.desk', size: 'compact' })).toContain('readouts');
    expect(await shown({ entity: 'light.plug' })).toContain('readouts');
    expect(await shown({ entity: 'switch.washer' })).toContain('readouts');
  });

  it('offers a name in two lines to a compact or a mini tile alone (#100)', async () => {
    expect(await shown({ entity: 'light.desk', size: 'compact' })).toContain('name_lines');
    expect(await shown({ entity: 'light.desk', size: 'mini' })).toContain('name_lines');
    expect(await shown({ entity: 'light.desk' })).not.toContain('name_lines');
  });
});

describe('a small tile’s name in two lines, the tile a line taller (#100)', () => {
  afterEach(() => document.body.replaceChildren());

  it('declares the taller height from its config alone: compact 88, mini 124', () => {
    for (const name_lines of [2, '2'] as const) {
      const tile = { type: 'custom:fluvy-tile-card', entity: 'light.desk', name_lines };
      expect(FluvyTileCard.layoutHeight({ ...tile, size: 'compact' })).toBe(88);
      expect(FluvyTileCard.layoutHeight({ ...tile, size: 'mini' })).toBe(124);
      // a large tile already gives a name the foot's room where it has none: one line more is not its
      expect(FluvyTileCard.layoutHeight({ ...tile, size: 'large' })).toBe(168);
    }
    const group = {
      type: 'custom:fluvy-tiles-card',
      entities: ['light.a', 'light.b', 'light.c'],
      name_lines: 2,
    };
    expect(FluvyTilesCard.layoutHeight(group)).toBe(2 * 96 - 8);
    expect(FluvyTilesCard.layoutHeight({ ...group, size: 'mini' })).toBe(132 - 8);
    expect(FluvyTilesCard.layoutHeight({ ...group, size: 'large' })).toBe(2 * 176 - 8);
    expect(FluvyTilesCard.layoutHeight({ ...group, name_lines: 1 })).toBe(2 * 84 - 8);
  });

  it('draws a compact and a mini tile’s name to two lines, a large one’s as it was', async () => {
    const lines = async (size: string, more: Record<string, unknown> = {}): Promise<boolean> => {
      const [tile] = await drawn(
        { type: 'custom:fluvy-tile-card', entity: 'light.desk', size, ...more },
        LIVE,
      );
      return tile!.classList.contains('fv-tile--lines');
    };
    expect(await lines('compact', { name_lines: 2 })).toBe(true);
    expect(await lines('mini', { name_lines: '2' })).toBe(true);
    expect(await lines('large', { name_lines: 2 })).toBe(false);
    expect(await lines('compact')).toBe(false);
  });
});

describe('a large tile without its switch: its circle is the switch (#160)', () => {
  afterEach(() => document.body.replaceChildren());

  const LAMP = { type: 'custom:fluvy-tile-card', entity: 'light.desk' };
  const OFF = {
    ...LIVE,
    'light.desk': state('light.desk', 'off', {
      friendly_name: 'Desk lamp',
      supported_color_modes: ['brightness'],
    }),
  };
  /** The house with the calls it is sent kept. */
  const calling = (states: Record<string, unknown>) => {
    const calls: unknown[][] = [];
    const hass = {
      ...house(states),
      callService: (...call: unknown[]) => (calls.push(call), Promise.resolve()),
    } as unknown as HomeAssistant;
    return { hass, calls };
  };
  const circle = (tile: HTMLElement): HTMLElement =>
    tile.querySelector<HTMLElement>('.fv-tile__head > .fv-ico')!;
  const figure = (tile: HTMLElement): string | undefined =>
    tile.querySelector('.fv-tile__value')?.textContent?.replace(/\s+/g, ' ').trim();
  const line = (tile: HTMLElement): string =>
    tile.querySelector('.fv-tile__state')!.textContent!.trim();

  it('shows its switch unless it is asked not to, whatever else a config writes', async () => {
    for (const show_switch of [undefined, true, 'yes', 0, null]) {
      const [tile] = await drawn({ ...LAMP, show_switch }, LIVE);
      expect(tile!.querySelector('.fv-hit [role="switch"]'), String(show_switch)).not.toBeNull();
      expect(circle(tile!).tagName).toBe('SPAN');
      document.body.replaceChildren();
    }
  });

  it('declares the height it did: the option moves nothing', () => {
    for (const show_switch of [false, 'value'] as const) {
      expect(FluvyTileCard.layoutHeight({ ...LAMP, show_switch })).toBe(168);
      expect(
        FluvyTilesCard.layoutHeight({
          type: 'custom:fluvy-tiles-card',
          size: 'large',
          show_switch,
          entities: ['light.desk', 'switch.washer'],
        }),
      ).toBe(168);
    }
  });

  it('hidden: no switch beside the circle, the circle a switch a reader hears by the tile’s name', async () => {
    const [on] = await drawn({ ...LAMP, show_switch: false }, LIVE);
    expect(on!.querySelector('.fv-hit')).toBeNull();
    expect(circle(on!).tagName).toBe('BUTTON');
    expect(circle(on!).getAttribute('role')).toBe('switch');
    expect(circle(on!).getAttribute('aria-checked')).toBe('true');
    expect(circle(on!).getAttribute('aria-label')).toBe('Desk lamp');
    // the head is left clean, and the line says the state and the level as it did
    expect(figure(on!)).toBeUndefined();
    expect(line(on!)).toBe('On · 50 %');
    document.body.replaceChildren();
    const [off] = await drawn({ ...LAMP, show_switch: false }, OFF);
    expect(circle(off!).getAttribute('aria-checked')).toBe('false');
    expect(anatomy(off!)).toEqual(anatomy(on!));
  });

  it('a tap on the circle switches it, a tap on the tile opens its details, a hold runs its hold action', async () => {
    const { hass, calls } = calling(LIVE);
    const [tile] = await drawn(
      { ...LAMP, show_switch: false, hold_action: { action: 'toggle' } },
      LIVE,
      360,
      hass,
    );
    // the details are asked of Home Assistant from the card itself
    const opened: string[] = [];
    (tile!.getRootNode() as ShadowRoot).host.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    circle(tile!).click();
    expect(calls).toEqual([['light', 'turn_off', {}, { entity_id: 'light.desk' }]]);
    expect(opened).toEqual([]);
    // the tile's own button is beside the circle, never around it
    const tap = tile!.querySelector<HTMLElement & { fvHold?: () => void }>('.fv-tile__tap')!;
    expect(tap.contains(circle(tile!))).toBe(false);
    tap.click();
    expect(opened).toEqual(['light.desk']);
    expect(calls).toHaveLength(1);
    tap.fvHold?.();
    expect(calls).toHaveLength(2);
  });

  it('a tile asked to toggle on its tap does, beside its circle (tap_action: toggle)', async () => {
    const { hass, calls } = calling(LIVE);
    const [tile] = await drawn(
      { ...LAMP, show_switch: false, tap_action: { action: 'toggle' } },
      LIVE,
      360,
      hass,
    );
    tile!.querySelector<HTMLElement>('.fv-tile__tap')!.click();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.slice(0, 2)).toEqual(['light', 'turn_off']);
  });

  it('out of reach it keeps its anatomy and its size: a circle that is not pressed, its ruler at rest', async () => {
    for (const show_switch of [false, 'value'] as const) {
      const [off] = await drawn({ ...LAMP, show_switch }, OFF);
      document.body.replaceChildren();
      const [dead] = await drawn({ ...LAMP, show_switch }, DEAD);
      expect(anatomy(dead!)).toEqual(anatomy(off!));
      expect(dead!.classList.contains('fv-tile--off')).toBe(true);
      expect(circle(dead!).tagName).toBe('SPAN');
      expect(dead!.querySelector('.fv-hit')).toBeNull();
      expect(dead!.querySelector('fluvy-ruler')!.hasAttribute('inert')).toBe(true);
      expect(figure(dead!)).toBeUndefined();
      document.body.replaceChildren();
    }
  });

  it('value: the level’s figure ends the head and the line says the state alone', async () => {
    const [on] = await drawn({ ...LAMP, show_switch: 'value' }, LIVE);
    expect(on!.querySelector('.fv-hit')).toBeNull();
    expect(circle(on!).getAttribute('role')).toBe('switch');
    expect(figure(on!)).toBe('50 %');
    expect(on!.querySelector('.fv-tile__value .fv-unit')!.textContent).toBe('%');
    expect(line(on!)).toBe('On');
    document.body.replaceChildren();
    // off there is no figure to say, on the line or in the head
    const [off] = await drawn({ ...LAMP, show_switch: 'value' }, OFF);
    expect(figure(off!)).toBeUndefined();
    expect(line(off!)).toBe('Off');
  });

  it('value: a muted player says so on its line, its volume in the head; a plug has no level to show', async () => {
    const PLAYER = {
      'media_player.soundbar': state('media_player.soundbar', 'on', {
        friendly_name: 'Soundbar',
        supported_features: 4 | 8,
        volume_level: 0.3,
        is_volume_muted: true,
      }),
    };
    const [player] = await drawn(
      { type: 'custom:fluvy-tile-card', entity: 'media_player.soundbar', show_switch: 'value' },
      PLAYER,
    );
    expect(figure(player!)).toBe('30 %');
    expect(line(player!)).toBe('Muted');
    document.body.replaceChildren();
    const [plug] = await drawn(
      { type: 'custom:fluvy-tile-card', ...PLUG, show_switch: 'value' },
      LIVE,
    );
    expect(figure(plug!)).toBeUndefined();
    expect(plug!.querySelector('.fv-hit')).toBeNull();
    expect(circle(plug!).getAttribute('role')).toBe('switch');
    expect(line(plug!)).toBe('On');
  });

  it('value: where the scale’s widest figure would not hold beside the circle, it stays on the line', async () => {
    // "100 %" is 40 by the test page's widths: beside the circle and its 8 of air it asks for an inner 92
    const [narrow] = await drawn({ ...LAMP, show_switch: 'value' }, LIVE, 123);
    expect(figure(narrow!)).toBeUndefined();
    expect(line(narrow!)).toBe('On · 50 %');
    document.body.replaceChildren();
    const [wide] = await drawn({ ...LAMP, show_switch: 'value' }, LIVE, 124);
    expect(figure(wide!)).toBe('50 %');
  });

  it('a tile too narrow for a switch beside its circle is as it was, whatever is asked', async () => {
    for (const show_switch of [true, false] as const) {
      const [tile] = await drawn({ ...LAMP, show_switch }, LIVE, 131);
      expect(tile!.querySelector('.fv-hit')).toBeNull();
      expect(circle(tile!).getAttribute('role')).toBe('switch');
      document.body.replaceChildren();
    }
  });

  it('a sensor never had a switch: its reading ends its head as it did', async () => {
    const [tile] = await drawn(
      { type: 'custom:fluvy-tile-card', entity: 'sensor.office', show_switch: false },
      LIVE,
    );
    expect(circle(tile!).tagName).toBe('SPAN');
    expect(figure(tile!)).toBe('21.5 °C');
  });

  it('a group says it for its tiles, and a tile’s own word wins', async () => {
    const group = { type: 'custom:fluvy-tiles-card', size: 'large', columns: 2 };
    const switches = (tiles: readonly HTMLElement[]): boolean[] =>
      tiles.map((tile) => tile.querySelector('.fv-hit') !== null);
    expect(
      switches(
        await drawn(
          {
            ...group,
            show_switch: false,
            tiles: ['light.desk', { entity: 'switch.washer', show_switch: true }],
          },
          LIVE,
        ),
      ),
    ).toEqual([false, true]);
    document.body.replaceChildren();
    const tiles = await drawn(
      { ...group, tiles: [{ entity: 'light.desk', show_switch: 'value' }, 'switch.washer'] },
      LIVE,
    );
    expect(switches(tiles)).toEqual([false, true]);
    expect(figure(tiles[0]!)).toBe('50 %');
  });

  it('a compact and a mini tile never drew one: they are as they were', async () => {
    for (const size of ['compact', 'mini'] as const) {
      const [asked] = await drawn({ ...LAMP, size, show_switch: false }, LIVE);
      const html = asked!.outerHTML;
      document.body.replaceChildren();
      const [plain] = await drawn({ ...LAMP, size }, LIVE);
      expect(plain!.outerHTML).toBe(html);
      document.body.replaceChildren();
    }
  });
});

describe('the tile’s editor offers its switch where it has one (#160)', () => {
  afterEach(() => document.body.replaceChildren());

  const edited = async (config: Record<string, unknown>) => {
    const editor = await FluvyTileCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house(LIVE);
    return drawEditor(editor, { type: 'custom:fluvy-tile-card', ...config });
  };

  it('to a large tile of an entity that switches, never to a small one nor to a sensor', async () => {
    const shown = async (config: Record<string, unknown>): Promise<boolean> =>
      shownNames(cardForm(await edited(config)).schema).includes('show_switch');
    expect(await shown({ entity: 'light.desk' })).toBe(true);
    expect(await shown({ entity: 'switch.washer', size: 'large' })).toBe(true);
    expect(await shown({ entity: 'light.desk', size: 'compact' })).toBe(false);
    expect(await shown({ entity: 'light.desk', size: 'mini' })).toBe(false);
    expect(await shown({ entity: 'sensor.office' })).toBe(false);
  });

  it('shows it shown until chosen, and writes hidden as the toggle the config holds, the value as its word', async () => {
    const editor = await edited({ entity: 'light.desk' });
    expect(cardForm(editor).data['show_switch']).toBe('true');
    let next = nextConfig(editor);
    cardForm(editor).change('show_switch', 'false');
    expect(await next).toEqual({
      type: 'custom:fluvy-tile-card',
      entity: 'light.desk',
      show_switch: false,
    });
    await editor.updateComplete;
    expect(cardForm(editor).data['show_switch']).toBe('false');
    next = nextConfig(editor);
    cardForm(editor).change('show_switch', 'value');
    expect((await next)['show_switch']).toBe('value');
  });
});
