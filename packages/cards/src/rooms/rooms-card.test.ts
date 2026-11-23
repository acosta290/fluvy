// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { roomsHeight } from '../rooms-family.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { visibleFields } from '../shared/form.js';
import { entryOf, itemOf } from '../shared/rows-editor.js';
import { FluvyRoomsCard } from './rooms-card.js';
import * as roomsEditor from './rooms-editor.js';

// the index fetches the lazy families, the rooms among them: the card's tag is defined before a page needs it
beforeAll(() => familiesDefined);
afterEach(() => document.body.replaceChildren());

/*
 * The Rooms card (#225, requested by @xoatrash): every room of the house in one card, a row each — its glyph, its
 * name, its temperature and humidity, its rounds at its end — opening the room's page. A house of three rooms with
 * something to show (a bedroom with only its thermostat, a kitchen whose thermometer is out of reach, a living room
 * with a lamp, a thermostat, blinds and both sensors) and a store room with nothing in it.
 */

const STAMP = '2026-11-19T08:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});
const sensor = (id: string, value: string, kind: 'temperature' | 'humidity') =>
  state(id, value, {
    device_class: kind,
    unit_of_measurement: kind === 'temperature' ? '°C' : '%',
  });

const STATES = {
  'light.living_lamp': state('light.living_lamp', 'on', {
    friendly_name: 'Living lamp',
    brightness: 128,
    supported_color_modes: ['brightness'],
    color_mode: 'brightness',
  }),
  'climate.living': state('climate.living', 'heat', {
    friendly_name: 'Living room',
    current_temperature: 21.3,
    temperature: 21.5,
    hvac_action: 'heating',
  }),
  'cover.living_blinds': state('cover.living_blinds', 'open', {
    friendly_name: 'Living blinds',
    current_position: 70,
    supported_features: 15,
  }),
  'sensor.living_temperature': sensor('sensor.living_temperature', '21.4', 'temperature'),
  'sensor.living_humidity': sensor('sensor.living_humidity', '48', 'humidity'),
  'light.kitchen': state('light.kitchen', 'off', { friendly_name: 'Kitchen light' }),
  'sensor.kitchen_temperature': sensor('sensor.kitchen_temperature', 'unavailable', 'temperature'),
  'sensor.kitchen_humidity': sensor('sensor.kitchen_humidity', '57', 'humidity'),
  'climate.bedroom': state('climate.bedroom', 'off', {
    friendly_name: 'Bedroom',
    current_temperature: 18.8,
  }),
  'media_player.tv': state('media_player.tv', 'off', { friendly_name: 'TV' }),
};
const IN = {
  'light.living_lamp': 'living',
  'climate.living': 'living',
  'cover.living_blinds': 'living',
  'sensor.living_temperature': 'living',
  'sensor.living_humidity': 'living',
  'light.kitchen': 'kitchen',
  'sensor.kitchen_temperature': 'kitchen',
  'sensor.kitchen_humidity': 'kitchen',
  'climate.bedroom': 'bedroom',
};
const AREAS = {
  living: { area_id: 'living', name: 'Living room', icon: 'mdi:sofa' },
  kitchen: { area_id: 'kitchen', name: 'Kitchen', icon: 'mdi:stove' },
  bedroom: { area_id: 'bedroom', name: 'Bedroom' },
  store: { area_id: 'store', name: 'Store room' },
};

/** The house, with the calls it is sent and the dashboards it answers for (`dashboards`: url path → strategy). */
const house = ({
  admin = true,
  dashboards = {},
}: { admin?: boolean; dashboards?: Record<string, Record<string, unknown>> } = {}) => {
  const calls: unknown[][] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states: STATES,
    entities: Object.fromEntries(
      Object.entries(IN).map(([entity_id, area_id]) => [entity_id, { entity_id, area_id }]),
    ),
    devices: {},
    areas: AREAS,
    user: { id: 'u', is_admin: admin },
    panels: Object.fromEntries(
      Object.keys(dashboards).map((url_path) => [
        url_path,
        { component_name: 'lovelace', url_path, title: url_path, icon: null },
      ]),
    ),
    callWS: ({ url_path }: { url_path: string }) =>
      dashboards[url_path]
        ? Promise.resolve({ strategy: dashboards[url_path] })
        : Promise.reject(new Error('no config')),
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: (...call: unknown[]) => (calls.push(call), Promise.resolve()),
  } as unknown as HomeAssistant;
  return { hass, calls };
};

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
  getCardSize(): number;
};
type Pressed = HTMLElement & { fvTap?: () => void; fvHold?: () => void };

async function drawn(
  config: Partial<LovelaceCardConfig>,
  hass = house().hass,
  width = 360,
): Promise<CardElement> {
  const card = document.createElement('fluvy-rooms-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-rooms-card', ...config });
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  // what the house's dashboards say lands a moment later, and the card is drawn again
  await new Promise((resolve) => setTimeout(resolve));
  await card.updateComplete;
  return card;
}
const root = (card: CardElement): ShadowRoot => card.shadowRoot!;
const rows = (card: CardElement): Pressed[] => [
  ...root(card).querySelectorAll<Pressed>('.rs-rows > .fv-row'),
];
const text = (row: ParentNode, cls: string): string =>
  row.querySelector(`.${cls}`)?.textContent?.trim() ?? '';
const rounds = (row: Element): string[] =>
  [...row.querySelectorAll('.lt-bulb')].map((round) => round.getAttribute('aria-label') ?? '');

/** Where a tap took the page. */
async function tapped(target: Pressed): Promise<string> {
  history.replaceState(null, '', '/');
  target.click();
  await new Promise((resolve) => setTimeout(resolve));
  return location.pathname;
}

describe('the Rooms card (#225)', () => {
  it('lists every room with something to show, in the house’s order: its glyph, its name, its readings', async () => {
    const card = await drawn({});
    const all = rows(card);
    expect(all.map((row) => text(row, 'fv-row__title'))).toEqual([
      'Bedroom',
      'Kitchen',
      'Living room',
    ]);
    // a thermostat's own reading where the room has no sensor; a sensor out of reach a dash in its place
    expect(all.map((row) => text(row, 'fv-row__sub'))).toEqual([
      '18.8°',
      '— · 57 %',
      '21.4° · 48 %',
    ]);
    // an area's own icon drawn as Fluvy's room (a sofa, a pot), the house where it has none
    const [bedroom, kitchen, living] = all.map((row) => row.querySelector(':scope > .fv-ico'));
    expect(living!.querySelector('svg')).not.toBeNull();
    expect(kitchen!.querySelector('ha-icon')).toBeNull();
    expect(bedroom!.querySelector('svg')).not.toBeNull();
    // lit while anything in it is on: the lamp and the heating, nothing in the kitchen
    expect(all.map((row) => row.querySelector('.fv-ico--neutral') === null)).toEqual([
      false,
      false,
      true,
    ]);
    // no rounds until asked for
    expect(all.flatMap(rounds)).toEqual([]);
    // the head: its title, how many rooms and their average temperature
    expect(text(root(card), 'fv-card__title')).toBe('Rooms');
    expect(text(root(card), 'fv-card__sub')).toBe('3 rooms · 20.1° average');
  });

  it('draws the rounds asked for every room, and a room’s own over them, its climate its thermostat', async () => {
    const card = await drawn({
      default_actions: ['lights', 'climate', 'covers'],
      rooms: [
        'living',
        'kitchen',
        'bedroom',
        { area: 'living', name: 'Lounge', quick_actions: ['climate', 'media_player.tv'] },
        { area: 'kitchen', quick_actions: [] },
        { area: 'bedroom', quick_actions: [{ group: 'climate', name: 'Heating' }] },
        { area: 'kitchen', quick_actions: ['climate'] },
      ],
    });
    // a set the room does not hold has no round, nor a thermostat it does not have
    expect(rows(card).map(rounds)).toEqual([
      ['Lights', 'Living room', 'Blinds'],
      ['Lights'],
      ['Bedroom'],
      ['Living room', 'TV'],
      [],
      ['Heating'],
      [],
    ]);
    expect(text(rows(card)[3]!, 'fv-row__title')).toBe('Lounge');
  });

  it('stands every room’s rounds in columns, a kind a room lacks leaving its place empty, as the issue draws them', async () => {
    const card = await drawn({
      default_actions: ['lights', 'climate', 'covers'],
      rooms: ['living', 'kitchen', 'bedroom'],
    });
    // the lights under the lights, the thermostats under the thermostats; a place no room fills is drawn on none
    const places = (row: Element): string[] =>
      [...row.querySelectorAll('.lt-bulbs > *')].map(
        (place) => place.getAttribute('aria-label') ?? '·',
      );
    expect(rows(card).map(places)).toEqual([
      ['Lights', 'Living room', 'Blinds'],
      ['Lights', '·', '·'],
      ['·', 'Bedroom', '·'],
    ]);
    // a thermostat a room lacks keeps its place too, its lights under the others'; and a compact row's temperature
    // stands in one column, every row's rounds as wide
    document.body.replaceChildren();
    const compact = await drawn({
      default_actions: ['climate', 'lights'],
      rooms: ['living', 'kitchen'],
      variant: 'compact',
    });
    expect(rows(compact).map(places)).toEqual([
      ['Living room', 'Lights'],
      ['·', 'Lights'],
    ]);
  });

  it('flips a room’s lights at a round’s tap, the room’s own round, never the row', async () => {
    const { hass, calls } = house();
    const card = await drawn({ rooms: ['living'], default_actions: ['lights'] }, hass);
    const [round] = rows(card)[0]!.querySelectorAll<HTMLElement>('.lt-bulb');
    round!.click();
    expect(calls).toEqual([['light', 'turn_off', { entity_id: ['light.living_lamp'] }, undefined]]);
  });

  it('opens a room’s own path, else its page on the Rooms dashboard, else Home’s, else the area’s settings', async () => {
    const rooms = { rooms: ['living', 'store', { area: 'kitchen', path: '/lovelace/kitchen' }] };
    // the Rooms dashboard: every room's page there; a room with nothing to show has none, its own path first
    let card = await drawn(
      rooms,
      house({ dashboards: { 'fluvy-rooms': { type: 'custom:fluvy-rooms' } } }).hass,
    );
    let [living, store, kitchen] = rows(card);
    expect(await tapped(living!)).toBe('/fluvy-rooms/room-living');
    expect(await tapped(store!)).toBe('/config/areas/area/store');
    expect(await tapped(kitchen!)).toBe('/lovelace/kitchen');
    // and the head opens them all
    expect(await tapped(root(card).querySelector<Pressed>('.fv-head__open')!)).toBe('/fluvy-rooms');
    document.body.replaceChildren();
    // Home with its Rooms view; one that left it out opens none
    card = await drawn(
      rooms,
      house({
        dashboards: {
          'fluvy-auto': { type: 'custom:fluvy-home' },
          'fluvy-other': { type: 'custom:fluvy-home', hide: ['rooms'] },
        },
      }).hass,
    );
    [living] = rows(card);
    expect(await tapped(living!)).toBe('/fluvy-auto/room-living');
    document.body.replaceChildren();
    // no automatic dashboard: an administrator to the area's settings, anyone else nowhere
    card = await drawn(rooms, house({ dashboards: {} }).hass);
    expect(await tapped(rows(card)[0]!)).toBe('/config/areas/area/living');
    document.body.replaceChildren();
    card = await drawn(rooms, house({ admin: false }).hass);
    [living, store, kitchen] = rows(card);
    expect(living!.getAttribute('role')).toBeNull();
    expect(store!.getAttribute('role')).toBeNull();
    expect(await tapped(kitchen!)).toBe('/lovelace/kitchen');
    expect(root(card).querySelector('.fv-head__open')).toBeNull();
  });

  it('runs a room’s own tap and hold in their place; a chevron only where it opens a page', async () => {
    const hass = house({ dashboards: { 'fluvy-rooms': { type: 'custom:fluvy-rooms' } } }).hass;
    const opened: string[] = [];
    const open = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    document.addEventListener('hass-more-info', open);
    const card = await drawn(
      {
        rooms: [
          'living',
          {
            area: 'kitchen',
            tap_action: { action: 'more-info', entity: 'light.kitchen' },
            hold_action: { action: 'navigate', navigation_path: '/lovelace/kitchen' },
          },
        ],
      },
      hass,
      600,
    );
    const [living, kitchen] = rows(card);
    expect(living!.querySelector('.fv-row__chevron svg')).not.toBeNull();
    expect(kitchen!.querySelector('.fv-row__chevron svg')).toBeNull();
    history.replaceState(null, '', '/');
    kitchen!.fvTap?.();
    kitchen!.fvHold?.();
    document.removeEventListener('hass-more-info', open);
    expect(opened).toEqual(['light.kitchen']);
    expect(location.pathname).toBe('/lovelace/kitchen');
    // asked not to, none at all
    document.body.replaceChildren();
    const bare = await drawn({ rooms: ['living'], show_arrow: false }, hass, 600);
    expect(root(bare).querySelector('.fv-row__chevron, .fv-head__open')).toBeNull();
  });

  it('says how many are on where asked, its readings where they are not hidden, three rooms at most', async () => {
    const card = await drawn({ show_count: true, max_rooms: 2 });
    expect(rows(card).map((row) => text(row, 'fv-row__sub'))).toEqual([
      '18.8° · 1 device',
      '— · 57 % · 1 device',
    ]);
    document.body.replaceChildren();
    const quiet = await drawn({ show_climate: false, show_average: false, rooms: ['living'] });
    expect(text(rows(quiet)[0]!, 'fv-row__sub')).toBe('');
    expect(text(root(quiet), 'fv-card__sub')).toBe('1 room');
    document.body.replaceChildren();
    // compact: 48 rows, the temperature at the end, a dash in its place out of reach
    const compact = await drawn({ variant: 'compact' });
    expect(rows(compact).every((row) => row.classList.contains('fv-row--compact'))).toBe(true);
    expect(rows(compact).map((row) => text(row, 'fv-row__value'))).toEqual(['18.8°', '—', '21.4°']);
  });

  it('keeps an area the house no longer has as a row that says so, and a round out of reach dashed', async () => {
    const card = await drawn({
      rooms: [
        { area: 'attic', name: 'Attic' },
        { area: 'kitchen', quick_actions: ['light.gone'] },
      ],
    });
    const [attic, kitchen] = rows(card);
    expect(text(attic!, 'fv-row__title')).toBe('Attic');
    expect(text(attic!, 'fv-row__sub')).toBe('Not found');
    expect(attic!.querySelector('.fv-ico--off')).not.toBeNull();
    expect(attic!.getAttribute('role')).toBeNull();
    expect(kitchen!.querySelector('.lt-bulb')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('draws its tiles two a row from a column of 320, an odd last one taking the row', async () => {
    const card = await drawn({ variant: 'tiles', default_actions: ['lights'] });
    const tiles = [...root(card).querySelectorAll<HTMLElement>('.rs-tile')];
    expect(tiles.map((tile) => text(tile, 'rs-tile__name'))).toEqual([
      'Bedroom',
      'Kitchen',
      'Living room',
    ]);
    expect(tiles.map((tile) => tile.classList.contains('rs-span'))).toEqual([false, false, true]);
    expect(root(card).querySelector<HTMLElement>('.rs-tiles')!.style.cssText).toContain(
      '--rs-col: 156px',
    );
    expect(tiles[2]!.querySelector('.fv-tile__tap')).not.toBeNull();
    document.body.replaceChildren();
    // half a section: one a row
    const half = await drawn({ variant: 'tiles' }, house().hass, 172);
    expect(root(half).querySelector<HTMLElement>('.rs-tiles')!.style.cssText).toContain(
      '--rs-cols: 1',
    );
  });

  it('declares its height from its config, and the house’s rooms where it lists none', () => {
    const height = (config: Partial<LovelaceCardConfig>, count?: number): number =>
      roomsHeight({ type: 'custom:fluvy-rooms-card', ...config }, count);
    // four rooms where the house is not there to say: the head and its 8, a 60 row each
    expect(height({})).toBe(92 + 4 * 60);
    expect(height({}, 6)).toBe(92 + 6 * 60);
    expect(height({ rooms: ['a', 'b', { area: 'c' }, { name: 'no area' }] })).toBe(92 + 3 * 60);
    expect(height({ variant: 'compact', show_head: false }, 5)).toBe(24 + 5 * 48);
    expect(height({ max_rooms: 3 }, 6)).toBe(92 + 3 * 60);
    // tiles two a row, 144 tall and 8 apart, 16 under the head
    expect(height({ variant: 'tiles' }, 5)).toBe(100 + 3 * 144 + 2 * 8);
    expect(height({ variant: 'tiles', show_head: false }, 2)).toBe(40 + 144);
    // nothing to list: the panel and its hint
    expect(height({ rooms: [] })).toBe(232);
    expect(height({ rooms: [], show_head: false })).toBe(172);
    // the automatic dashboard counts the house's rooms with something to show, never the store room
    expect(houseHeightOf({ type: 'custom:fluvy-rooms-card' }, 0, house().hass as never)).toBe(
      92 + 3 * 60,
    );
  });

  it('draws what it declares: its rows, its tiles, its empty panel', async () => {
    for (const config of [
      {},
      { variant: 'compact' },
      { show_head: false, max_rooms: 2 },
      { variant: 'tiles' },
    ] as Partial<LovelaceCardConfig>[]) {
      const card = await drawn(config);
      expect(card.getCardSize(), JSON.stringify(config)).toBe(
        Math.ceil(roomsHeight({ type: '', ...config }, 3) / 50),
      );
      const shown = root(card).querySelectorAll('.fv-row, .rs-tile').length;
      expect(shown, JSON.stringify(config)).toBe(config.max_rooms ?? 3);
      document.body.replaceChildren();
    }
  });

  it('its editor: the house’s rooms as rows until touched, a room’s rounds a list in its form', async () => {
    const { hass } = house();
    const editor = await drawEditor(await FluvyRoomsCard.getConfigElement(), {
      type: 'custom:fluvy-rooms-card',
    });
    expect(listTitles(editor)).toEqual(['Rooms']);
    expect(roomsEditor.defaults({ type: '' }, hass)['rooms']).toEqual([
      'bedroom',
      'kitchen',
      'living',
    ]);
    const shown = (data: Record<string, unknown>): string[] =>
      shownNames(visibleFields(roomsEditor.getConfigForm().schema, data));
    expect(shown({})).toEqual(
      expect.arrayContaining(['variant', 'title', 'show_average', 'show_count', 'tap_action']),
    );
    expect(shown({ show_head: false })).not.toContain('title');
    expect(shown({ show_head: false })).not.toContain('tap_action');
    expect(shown({ variant: 'compact' })).not.toContain('show_count');
    expect(shown({})).not.toContain('light_colors');
    expect(shown({ default_actions: ['lights'] })).toContain('light_colors');
    expect(shown({ rooms: [{ area: 'living', quick_actions: ['light.lamp'] }] })).toContain(
      'light_colors',
    );
    expect(cardForm(editor).schema.length).toBeGreaterThan(0);
    // a room alone goes back as its area, a set alone as its word, an entity alone as its id
    const [list] = roomsEditor.lists;
    const entry = {
      area: 'living',
      quick_actions: [
        'lights',
        'climate.living',
        { entity: 'cover.living_blinds', icon: 'mdi:blinds' },
      ],
    };
    const item = itemOf(entry, list!)!;
    expect(item['quick_actions']).toEqual([
      { group: 'lights' },
      { entity: 'climate.living' },
      { entity: 'cover.living_blinds', icon: 'mdi:blinds' },
    ]);
    expect(entryOf(item, list!)).toEqual(entry);
    expect(entryOf(itemOf('kitchen', list!)!, list!)).toBe('kitchen');
  });

  it('its editor gives each quick action its tone, its state and its own tap, hold and double tap (#239)', () => {
    const [list] = roomsEditor.lists;
    const rounds = list!.schema.find((field) => field.name === 'quick_actions');
    const fields = (
      rounds?.selector as {
        object: { fields: Record<string, { selector: Record<string, unknown>; label: string }> };
      }
    ).object.fields;
    expect(Object.keys(fields)).toEqual([
      'entity',
      'group',
      'name',
      'icon',
      'tone',
      'color',
      'show_state',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ]);
    // a switch for its state (a choice's words would be written as they are), Home Assistant's actions for its taps,
    // a double tap nothing until set; each in its words
    expect(fields['show_state']?.selector).toEqual({ boolean: {} });
    expect(fields['tap_action']?.selector).toEqual({ ui_action: {} });
    expect(fields['hold_action']?.selector).toEqual({ ui_action: {} });
    expect(fields['double_tap_action']?.selector).toEqual({
      ui_action: { default_action: 'none' },
    });
    expect(fields['show_state']?.label).toBe('Show its state');
    expect(fields['tone']?.label).toBe('Tone');
    expect(fields['tap_action']?.label).toBe('Tap action');
    // what it is given is written back as it was, a set's word beside its own actions
    const entry = {
      area: 'living',
      quick_actions: [
        { group: 'covers', tap_action: { action: 'more-info' } },
        {
          entity: 'vacuum.downstairs',
          tone: 'info',
          show_state: true,
          tap_action: { action: 'toggle' },
          hold_action: { action: 'more-info' },
          double_tap_action: { action: 'navigate', navigation_path: '/fluvy-home/vacuum' },
        },
      ],
    };
    expect(entryOf(itemOf(entry, list!)!, list!)).toEqual(entry);
  });
});
