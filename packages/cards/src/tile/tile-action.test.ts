// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { roomHeight, type RoomCardConfig } from '../room/room-card.js';
import * as roomEditor from '../room/room-editor.js';
import { shownNames } from '../shared/fixtures/editor.js';
import { stateLineWidths } from '../shared/fixtures/widths.js';
import { visibleFields } from '../shared/form.js';
import { FluvyTilesCard } from '../tiles/tiles-card.js';
import * as tilesEditor from '../tiles/tiles-editor.js';
import { FluvyTileCard } from './tile-card.js';
import * as tileEditor from './tile-editor.js';

// the index fetches the lazy families, and with them what says what a thermostat is doing: a tile says it once it
// has landed
beforeAll(() => familiesDefined);

/*
 * A thermostat's tile says what it is doing where it is asked (`show_action`, #185): a climate's or a humidifier's, a
 * lone tile's, a group's and a room's, and the room's climate row. Not asked, each is the tile and the row it was.
 */

const STAMP = '2026-11-14T08:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

const STATES = {
  'climate.living': state('climate.living', 'heat', {
    friendly_name: 'Living room',
    hvac_action: 'heating',
    temperature: 21.5,
    current_temperature: 20.8,
    target_temp_step: 0.5,
  }),
  'climate.bedroom': state('climate.bedroom', 'heat', {
    friendly_name: 'Bedroom TRV',
    hvac_action: 'idle',
    temperature: 18,
    current_temperature: 18.4,
    target_temp_step: 0.5,
  }),
  'binary_sensor.bedroom_window': state('binary_sensor.bedroom_window', 'off', {
    friendly_name: 'Bedroom window',
    device_class: 'window',
  }),
  'climate.office': state('climate.office', 'heat', {
    friendly_name: 'Office',
    hvac_action: 'idle',
    temperature: 21,
    window_open: true,
  }),
  'humidifier.nursery': state('humidifier.nursery', 'on', {
    friendly_name: 'Nursery',
    action: 'humidifying',
    humidity: 50,
  }),
  'water_heater.tank': state('water_heater.tank', 'eco', {
    friendly_name: 'Tank',
    temperature: 50,
  }),
  'light.desk': state('light.desk', 'on', { friendly_name: 'Desk lamp' }),
};

const house = (states: Record<string, unknown> = STATES): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states,
    entities: {
      'climate.bedroom': { entity_id: 'climate.bedroom', device_id: 'valve', area_id: 'bedroom' },
      'binary_sensor.bedroom_window': {
        entity_id: 'binary_sensor.bedroom_window',
        device_id: 'valve',
      },
      'light.desk': { entity_id: 'light.desk', area_id: 'bedroom' },
    },
    devices: {},
    areas: { bedroom: { area_id: 'bedroom', name: 'Bedroom', picture: null, icon: null } },
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

async function draw(config: LovelaceCardConfig, width = 360, hass = house()): Promise<CardElement> {
  const card = document.createElement(String(config.type).replace('custom:', '')) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}
const tiles = (card: CardElement): HTMLElement[] => [
  ...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-tile'),
];
const line = (tile: HTMLElement | undefined): string =>
  tile?.querySelector('.fv-tile__state')?.textContent?.trim() ?? '';
const figure = (tile: HTMLElement | undefined): string | undefined =>
  tile?.querySelector('.fv-tile__value')?.textContent?.replace(/\s+/g, ' ').trim();

const tile = (entity: string, more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-tile-card',
  entity,
  size: 'compact',
  ...more,
});
const lineOf = async (entity: string, more: Record<string, unknown> = {}, width = 360) =>
  line(tiles(await draw(tile(entity, more), width))[0]);

afterEach(() => document.body.replaceChildren());

describe('a thermostat’s tile says what it is doing where it is asked (#185)', () => {
  it('not asked, is the tile it was: its mode on its line, its mode at a large one’s head', async () => {
    expect(await lineOf('climate.living')).toBe('Heat');
    expect(await lineOf('humidifier.nursery')).toBe('On');
    const plain = tiles(await draw(tile('climate.living', { size: 'large' })))[0]!;
    document.body.replaceChildren();
    const off = tiles(
      await draw(tile('climate.living', { size: 'large', show_action: false })),
    )[0]!;
    expect(off.outerHTML).toBe(plain.outerHTML);
    expect(figure(plain)).toBe('Heat');
  });

  it('asked, says the word and what it is set to; a window open alone', async () => {
    const asked = { show_action: true };
    expect(await lineOf('climate.living', asked)).toBe('Heating · 21.5°');
    expect(await lineOf('climate.bedroom', asked)).toBe('Idle · 18.0°');
    expect(await lineOf('climate.office', asked)).toBe('Window open');
    expect(await lineOf('humidifier.nursery', asked)).toBe('Humidifying · 50 %');
  });

  it('ends a large climate’s head with what it measures, its line the word, its fill its mode’s', async () => {
    const [large] = tiles(
      await draw(tile('climate.bedroom', { size: 'large', show_action: true })),
    );
    expect(figure(large)).toBe('18.4 °C');
    expect(line(large)).toBe('Idle · 18.0°');
    // idle, it is filled as the mode it is in, as before
    expect(large!.classList.contains('is-on')).toBe(true);
    expect(large!.classList.contains('fv-tile--heat')).toBe(true);
    document.body.replaceChildren();
    // a humidifier keeps its switch: its line alone changes
    const [humid] = tiles(
      await draw(tile('humidifier.nursery', { size: 'large', show_action: true })),
    );
    expect(humid!.querySelector('.fv-hit [role="switch"]')).not.toBeNull();
    expect(line(humid)).toBe('Humidifying · 50 %');
  });

  it('gives way by parts in a narrow tile: what it is set to, then the word to the mode, never a cut', async () => {
    const restore = stateLineWidths();
    try {
      // 172: 84 beside the circle hold "Heating" (49), not "Heating · 21.5°" (105)
      expect(await lineOf('climate.living', { show_action: true }, 172)).toBe('Heating');
      // 140: 52 hold neither "Window open" (77) nor any shorter word of it: the mode, "Heat" (28)
      expect(await lineOf('climate.office', { show_action: true }, 140)).toBe('Heat');
    } finally {
      restore();
    }
  });

  it('is asked of a climate or a humidifier alone, and says the state of one out of reach as before', async () => {
    expect(await lineOf('water_heater.tank', { show_action: true })).toBe('Eco');
    expect(await lineOf('light.desk', { show_action: true })).toBe('On');
    const gone = { ...STATES, 'climate.living': state('climate.living', 'unavailable') };
    const card = await draw(tile('climate.living', { show_action: true }), 360, house(gone));
    expect(line(tiles(card)[0])).toBe('Unavailable');
  });

  it('follows the window sensor on its device: the tile draws again as it opens', async () => {
    const card = await draw(tile('climate.bedroom', { show_action: true }));
    expect(line(tiles(card)[0])).toBe('Idle · 18.0°');
    const hass = card.hass;
    card.hass = {
      ...hass,
      states: {
        ...hass.states,
        'binary_sensor.bedroom_window': {
          ...STATES['binary_sensor.bedroom_window'],
          state: 'on',
        },
      },
    } as HomeAssistant;
    await card.updateComplete;
    expect(line(tiles(card)[0])).toBe('Window open');
  });

  it('a group says it for its tiles, a tile’s own word wins, and neither moves its height', async () => {
    const group = (more: Record<string, unknown>): LovelaceCardConfig => ({
      type: 'custom:fluvy-tiles-card',
      tiles: [
        { entity: 'climate.living' },
        { entity: 'climate.bedroom', show_action: false },
        { entity: 'light.desk' },
      ],
      ...more,
    });
    let card = await draw(group({ show_action: true }));
    expect(tiles(card).map(line)).toEqual(['Heating · 21.5°', 'Heat', 'On']);
    document.body.replaceChildren();
    card = await draw({
      type: 'custom:fluvy-tiles-card',
      tiles: [{ entity: 'climate.living', show_action: true }, { entity: 'climate.bedroom' }],
    });
    expect(tiles(card).map(line)).toEqual(['Heating · 21.5°', 'Heat']);
    expect(FluvyTilesCard.layoutHeight(group({ show_action: true }))).toBe(
      FluvyTilesCard.layoutHeight(group({})),
    );
    expect(FluvyTileCard.layoutHeight(tile('climate.living', { show_action: true }))).toBe(76);
  });
});

describe('a room’s climate row says what its thermostat is doing where it is asked (#185)', () => {
  const room = (more: Partial<RoomCardConfig> = {}): RoomCardConfig => ({
    type: 'custom:fluvy-room-card',
    area: 'bedroom',
    variant: 'tile',
    ...more,
  });
  const climateRow = (card: CardElement): string =>
    [...card.shadowRoot!.querySelectorAll('.am-rows .fv-row')]
      .find((row) => row.querySelector('.fv-row__title')?.textContent === 'Climate')
      ?.querySelector('.fv-row__sub')
      ?.textContent?.trim() ?? '';

  it('says its mode as before, the word and what it is set to where asked, and keeps its height', async () => {
    expect(climateRow(await draw(room()))).toBe('Heat');
    document.body.replaceChildren();
    expect(climateRow(await draw(room({ show_action: true })))).toBe('Idle · 18.0°');
    expect(roomHeight(room({ show_action: true }))).toBe(roomHeight(room()));
  });

  it('says it on its thermostats’ tiles too, a tile’s own word first', async () => {
    const card = await draw(
      room({
        controls: 'tiles',
        show_action: true,
        tiles: [{ entity: 'climate.bedroom' }, { entity: 'climate.living', show_action: false }],
      }),
    );
    expect(tiles(card).map(line)).toEqual(['Idle · 18.0°', 'Heat']);
  });
});

describe('the editors offer it where it can act (#185)', () => {
  const names = (
    editor: { getConfigForm(): { schema: Parameters<typeof visibleFields>[0] } },
    data: Record<string, unknown>,
  ): string[] => shownNames(visibleFields(editor.getConfigForm().schema, data, house()));

  it('the tile’s: to a climate or a humidifier, off until asked', () => {
    expect(names(tileEditor, { entity: 'climate.living' })).toContain('show_action');
    expect(names(tileEditor, { entity: 'humidifier.nursery' })).toContain('show_action');
    expect(names(tileEditor, { entity: 'light.desk' })).not.toContain('show_action');
    expect(names(tileEditor, { entity: 'water_heater.tank' })).not.toContain('show_action');
    expect(tileEditor.defaults({ type: 'custom:fluvy-tile-card' }, undefined)['show_action']).toBe(
      false,
    );
  });

  it('the group’s: where it holds one, and on each such tile, empty until chosen', () => {
    expect(names(tilesEditor, { tiles: ['light.desk', 'climate.living'] })).toContain(
      'show_action',
    );
    expect(names(tilesEditor, { tiles: ['light.desk'] })).not.toContain('show_action');
    const list = tilesEditor.lists[0]!;
    const item = (entity: string): string[] =>
      shownNames(list.schemaOf?.({ entity }, { size: 'compact' }) ?? []);
    expect(item('climate.living')).toContain('show_action');
    expect(item('humidifier.nursery')).toEqual(
      expect.arrayContaining(['show_action', 'switch_style']),
    );
    expect(item('light.desk')).not.toContain('show_action');
    // one form a kind of tile: the same list for two tiles alike
    expect(list.schemaOf?.({ entity: 'climate.living' }, { size: 'compact' })).toBe(
      list.schemaOf?.({ entity: 'climate.bedroom' }, { size: 'compact' }),
    );
  });

  it('the room’s: where its rows hold a thermostat, or its tiles do', () => {
    expect(names(roomEditor, { area: 'bedroom', variant: 'tile' })).toContain('show_action');
    expect(names(roomEditor, { area: 'none', variant: 'tile' })).not.toContain('show_action');
    expect(names(roomEditor, { area: 'bedroom', variant: 'row' })).not.toContain('show_action');
    expect(
      names(roomEditor, {
        area: 'none',
        variant: 'tile',
        controls: 'tiles',
        tiles: [{ entity: 'climate.living' }],
      }),
    ).toContain('show_action');
    const list = roomEditor.lists[0]!;
    expect(shownNames(list.schemaOf?.({ entity: 'climate.living' }) ?? [])).toContain(
      'show_action',
    );
    expect(shownNames(list.schemaOf?.({ entity: 'light.desk' }) ?? [])).not.toContain(
      'show_action',
    );
  });
});
