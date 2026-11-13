// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { FluvyRoomCard } from '../room/room-card.js';
import {
  cardForm,
  drawEditor,
  nextConfig,
  shownNames,
  type FormStub,
} from '../shared/fixtures/editor.js';
import type { FluvyRowsEditor } from '../shared/rows-editor.js';
import { FluvySliderCard } from '../slider/slider-card.js';
import { FluvyLightsCard } from '../lights/lights-card.js';
import { tileSwitch } from '../strategy/layout.js';
import { FluvyTemplateCard } from '../template/template-card.js';
import { FluvyTilesCard } from '../tiles/tiles-card.js';
import { FluvyTileCard } from './tile-card.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);

/**
 * A tile's switch as a wall rocker (`switch_style: rocker`, 1.20, #177): the tile keeps its size and its switch's
 * box while the rocker's chunk is on its way, then draws the rocker where its toggle stood — a large tile's beside
 * its circle down to 116, a compact one's at its row's end, a mini's nowhere — and switches and nothing more: no
 * ruler at its foot, no level on its line. This file never imports the chunk itself: the tile fetches it.
 */

const STAMP = '2026-09-17T19:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});
const DIMMER = { brightness: 128, supported_color_modes: ['brightness'] };
const LIVE = {
  'light.porch': state('light.porch', 'on', { friendly_name: 'Porch', ...DIMMER }),
  'light.drive': state('light.drive', 'off', { friendly_name: 'Driveway', ...DIMMER }),
  'light.shed': state('light.shed', 'unavailable', {
    friendly_name: 'Shed',
    supported_color_modes: ['brightness'],
  }),
  'switch.pump': state('switch.pump', 'on', { friendly_name: 'Pool pump' }),
  'cover.awning': state('cover.awning', 'closed', {
    friendly_name: 'Awning',
    supported_features: 15,
    current_position: 0,
  }),
  'media_player.speaker': state('media_player.speaker', 'playing', {
    friendly_name: 'Speaker',
    supported_features: 4 | 8,
    volume_level: 0.3,
  }),
  'sensor.pump_power': state('sensor.pump_power', '740', {
    friendly_name: 'Pool pump power',
    unit_of_measurement: 'W',
    device_class: 'power',
  }),
  'sensor.office': state('sensor.office', '21.5', {
    friendly_name: 'Office',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
};

/** The house, with the calls it is sent kept. */
const house = (states: Record<string, unknown> = LIVE) => {
  const calls: unknown[][] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states,
    entities: Object.fromEntries(
      Object.keys(states).map((id) => [id, { entity_id: id, area_id: 'terrace', device_id: null }]),
    ),
    devices: {},
    areas: { terrace: { area_id: 'terrace', name: 'Terrace', picture: null } },
    user: { id: 'u', is_admin: true },
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
};

const tilesOf = (card: CardElement): HTMLElement[] => [
  ...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-tile'),
];

/** The card on the page after its first frame: its rocker's chunk may still be on its way. */
async function mounted(config: LovelaceCardConfig, width = 360, hass = house().hass) {
  const card = document.createElement(String(config.type).replace('custom:', '')) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

/** …and once every rocker it asks for is drawn (or none is asked for: one turn of the page is given). */
async function drawn(config: LovelaceCardConfig, width = 360, hass = house().hass) {
  const card = await mounted(config, width, hass);
  const waiting = (): boolean =>
    [...card.shadowRoot!.querySelectorAll('.fv-hit--rocker')].some((hit) => !hit.firstElementChild);
  for (let turn = 0; turn < 200 && (turn === 0 || waiting()); turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await card.updateComplete;
  }
  return { card, tiles: tilesOf(card) };
}

const TILE = { type: 'custom:fluvy-tile-card', entity: 'light.porch' };
const ROCKER = { ...TILE, switch_style: 'rocker' };
const rockerOf = (tile: HTMLElement): HTMLElement | null =>
  tile.querySelector<HTMLElement>('.fv-hit--rocker > .fv-rocker');
const circle = (tile: HTMLElement): HTMLElement => tile.querySelector<HTMLElement>('.fv-ico')!;
const line = (tile: HTMLElement): string =>
  tile.querySelector('.fv-tile__state')!.textContent!.trim();
const parts = (tile: HTMLElement): string[] =>
  [...tile.children].map(
    (el) => el.tagName.toLowerCase() + (el.className ? `.${el.classList[0]}` : ''),
  );

afterEach(() => document.body.replaceChildren());

describe('the hook', () => {
  it('keeps the switch’s box while the rocker is on its way, then draws it there', async () => {
    const card = await mounted(ROCKER);
    const [tile] = tilesOf(card);
    // the first frame: the box alone, in the head beside the circle, the tile at its size
    const box = tile!.querySelector<HTMLElement>('.fv-tile__head > .fv-hit--rocker');
    expect(box).not.toBeNull();
    expect(box!.childElementCount).toBe(0);
    expect(tile!.querySelector('.fv-switch')).toBeNull();
    const before = parts(tile!);
    // the chunk lands: the rocker is drawn in that box, and nothing else of the tile changed
    const { tiles } = await drawn(ROCKER);
    document.body.firstElementChild!.remove();
    expect(rockerOf(tiles[0]!)).not.toBeNull();
    expect(parts(tiles[0]!)).toEqual(before);
  });

  it('wears the rocker’s sheet on the card that draws one, and no other', async () => {
    const { card } = await drawn(ROCKER);
    const plain = await drawn(TILE);
    const sheets = (el: HTMLElement): number => el.shadowRoot!.adoptedStyleSheets.length;
    expect(sheets(card)).toBe(sheets(plain.card) + 1);
  });

  it('declares the height it did in every size, on every card that draws a tile', () => {
    for (const size of ['large', 'compact', 'mini'] as const) {
      const tile = { type: 'custom:fluvy-tile-card', entity: 'light.porch', size };
      expect(FluvyTileCard.layoutHeight({ ...tile, switch_style: 'rocker' })).toBe(
        FluvyTileCard.layoutHeight(tile),
      );
      const group = {
        type: 'custom:fluvy-tiles-card',
        size,
        entities: ['light.porch', 'switch.pump'],
      };
      expect(FluvyTilesCard.layoutHeight({ ...group, switch_style: 'rocker' })).toBe(
        FluvyTilesCard.layoutHeight(group),
      );
      const template = { type: 'custom:fluvy-template-card', entity: 'light.porch', variant: size };
      expect(FluvyTemplateCard.layoutHeight({ ...template, switch_style: 'rocker' })).toBe(
        FluvyTemplateCard.layoutHeight(template),
      );
    }
    const room = { type: 'custom:fluvy-room-card', area: 'terrace', controls: 'tiles' } as const;
    expect(FluvyRoomCard.layoutHeight({ ...room, switch_style: 'rocker' })).toBe(
      FluvyRoomCard.layoutHeight(room),
    );
  });
});

describe('a large tile', () => {
  it('draws its rocker where its toggle stood: on, the lower half raised and the bar lit', async () => {
    const { tiles } = await drawn(ROCKER);
    const rocker = rockerOf(tiles[0]!)!;
    expect(rocker.parentElement!.parentElement!.classList.contains('fv-tile__head')).toBe(true);
    expect(rocker.getAttribute('role')).toBe('switch');
    expect(rocker.getAttribute('aria-checked')).toBe('true');
    expect(rocker.getAttribute('aria-label')).toBe('Porch');
    expect(['is-on', 'is-down'].map((cls) => rocker.classList.contains(cls))).toEqual([true, true]);
    // the circle beside it is no switch
    expect(circle(tiles[0]!).tagName).toBe('SPAN');
    const off = await drawn({ ...ROCKER, entity: 'light.drive' });
    const resting = rockerOf(off.tiles[0]!)!;
    expect(resting.getAttribute('aria-checked')).toBe('false');
    expect(['is-on', 'is-down'].map((cls) => resting.classList.contains(cls))).toEqual([
      false,
      false,
    ]);
  });

  it('switches and nothing more: a light that dims has no ruler at its foot and no level on its line', async () => {
    const plain = await drawn(TILE);
    expect(plain.tiles[0]!.querySelector('fluvy-ruler')).not.toBeNull();
    expect(line(plain.tiles[0]!)).toBe('On · 50 %');
    const { tiles } = await drawn(ROCKER);
    expect(tiles[0]!.querySelector('fluvy-ruler')).toBeNull();
    expect(line(tiles[0]!)).toBe('On');
    // its name may take the foot's room
    expect(tiles[0]!.classList.contains('fv-tile--footless')).toBe(true);
    // a plug's readings stand at its foot as they did
    const plug = await drawn({
      ...ROCKER,
      entity: 'switch.pump',
      readouts: ['sensor.pump_power'],
    });
    expect(plug.tiles[0]!.querySelectorAll('.fv-tile__foot .fv-readout')).toHaveLength(1);
  });

  it('flips at once under a finger, Space and Enter, and opens nothing', async () => {
    const { hass, calls } = house();
    const { card, tiles } = await drawn(ROCKER, 360, hass);
    const opened: unknown[] = [];
    card.addEventListener('hass-more-info', (event) => opened.push(event));
    rockerOf(tiles[0]!)!.parentElement!.click();
    expect(calls).toEqual([['light', 'turn_off', {}, { entity_id: 'light.porch' }]]);
    await card.updateComplete;
    // the state asked for shows before Home Assistant answers: the rocker and the tile's fill
    const [tile] = tilesOf(card);
    expect(rockerOf(tile!)!.getAttribute('aria-checked')).toBe('false');
    expect(rockerOf(tile!)!.classList.contains('is-down')).toBe(false);
    expect(tile!.classList.contains('is-on')).toBe(false);
    // Space flips it back and Enter again, each a call (the service is the house's state's, which this one keeps)
    for (const [key, checked] of [
      [' ', 'true'],
      ['Enter', 'false'],
    ] as const) {
      rockerOf(tilesOf(card)[0]!)!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await card.updateComplete;
      expect(rockerOf(tilesOf(card)[0]!)!.getAttribute('aria-checked')).toBe(checked);
    }
    expect(calls).toHaveLength(3);
    expect(opened).toEqual([]);
    // the tile's own button is beside the rocker, never around it: its tap opens the details
    const tap = tilesOf(card)[0]!.querySelector<HTMLElement>('.fv-tile__tap')!;
    expect(tap.contains(rockerOf(tilesOf(card)[0]!))).toBe(false);
    tap.click();
    expect(opened).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it('holds its plate beside its circle down to 116; under it the circle is the switch, as with the toggle', async () => {
    const at = async (width: number) => (await drawn(ROCKER, width)).tiles[0]!;
    const held = await at(116);
    expect(rockerOf(held)).not.toBeNull();
    expect(circle(held).getAttribute('role')).toBeNull();
    const narrow = await at(115);
    expect(narrow.querySelector('.fv-hit')).toBeNull();
    expect(circle(narrow).getAttribute('role')).toBe('switch');
    // …and still switches and nothing more
    expect(narrow.querySelector('fluvy-ruler')).toBeNull();
    // the toggle needs 132
    const toggle = (await drawn(TILE, 131)).tiles[0]!;
    expect(toggle.querySelector('.fv-hit')).toBeNull();
  });

  it('out of reach is the off skin: the rocker there, off and disabled, the tile at its anatomy', async () => {
    const live = await drawn({ ...ROCKER, entity: 'light.drive' });
    const { tiles } = await drawn({ ...ROCKER, entity: 'light.shed' });
    const rocker = rockerOf(tiles[0]!)!;
    expect(tiles[0]!.classList.contains('fv-tile--off')).toBe(true);
    expect(rocker.getAttribute('aria-disabled')).toBe('true');
    expect(rocker.getAttribute('aria-checked')).toBe('false');
    expect(rocker.parentElement!.classList.contains('is-fixed')).toBe(true);
    expect(rocker.classList.contains('is-on') || rocker.classList.contains('is-down')).toBe(false);
    expect(parts(tiles[0]!)).toEqual(parts(live.tiles[0]!));
    // quiet, the tile is marked for the rocker's sheet to draw it at full strength
    const quiet = await drawn({ ...ROCKER, entity: 'light.shed', unavailable: 'quiet' });
    expect(quiet.tiles[0]!.getAttribute('data-unavailable')).toBe('quiet');
    expect(rockerOf(quiet.tiles[0]!)!.getAttribute('aria-disabled')).toBe('true');
  });

  it('asked to hide its switch, or to say its value there, has no rocker and keeps its ruler', async () => {
    for (const show_switch of [false, 'value'] as const) {
      const { tiles } = await drawn({ ...ROCKER, show_switch });
      expect(tiles[0]!.querySelector('.fv-hit')).toBeNull();
      expect(tiles[0]!.querySelector('fluvy-ruler')).not.toBeNull();
      expect(circle(tiles[0]!).getAttribute('role')).toBe('switch');
    }
  });

  it('a cover’s rocker opens it, shows it on its way and stops it there', async () => {
    const { hass, calls } = house();
    const { card, tiles } = await drawn({ ...ROCKER, entity: 'cover.awning' }, 360, hass);
    const tapped = async (): Promise<HTMLElement> => {
      rockerOf(tilesOf(card)[0]!)!.parentElement!.click();
      await card.updateComplete;
      return rockerOf(tilesOf(card)[0]!)!;
    };
    expect(tiles[0]!.querySelector('fluvy-ruler')).toBeNull();
    expect(rockerOf(tiles[0]!)!.classList.contains('is-down')).toBe(false);
    const opening = await tapped();
    expect(calls).toEqual([['cover', 'open_cover', {}, { entity_id: 'cover.awning' }]]);
    expect(opening.classList.contains('is-moving')).toBe(true);
    expect(opening.getAttribute('aria-label')).toBe('Awning · Stop');
    const stopped = await tapped();
    expect(calls[1]).toEqual(['cover', 'stop_cover', {}, { entity_id: 'cover.awning' }]);
    expect(stopped.classList.contains('is-moving')).toBe(false);
  });

  it('is the tile’s own: the Slider card, whose head ends otherwise, keeps its ruler', async () => {
    if (!customElements.get('fluvy-slider-card'))
      customElements.define('fluvy-slider-card', FluvySliderCard);
    const { tiles } = await drawn({
      type: 'custom:fluvy-slider-card',
      entity: 'media_player.speaker',
      variant: 'tile',
      switch_style: 'rocker',
    });
    expect(tiles[0]!.querySelector('.fv-hit--rocker')).toBeNull();
    expect(tiles[0]!.querySelector('fluvy-ruler')).not.toBeNull();
  });
});

describe('the smaller tiles', () => {
  const COMPACT = { ...ROCKER, size: 'compact' };

  it('a compact tile’s rocker stands at its row’s end, and the tile’s tap opens its details', async () => {
    const { hass, calls } = house();
    const { card, tiles } = await drawn(COMPACT, 172, hass);
    const [tile] = tiles;
    expect(parts(tile!)).toEqual([
      'span.fv-ico',
      'div.fv-tile__text',
      'span.fv-hit',
      'button.fv-tile__tap',
    ]);
    expect(rockerOf(tile!)!.getAttribute('aria-checked')).toBe('true');
    expect(line(tile!)).toBe('On');
    const opened: unknown[] = [];
    card.addEventListener('hass-more-info', (event) => opened.push(event));
    tile!.querySelector<HTMLElement>('.fv-tile__tap')!.click();
    expect(opened).toHaveLength(1);
    expect(calls).toEqual([]);
    rockerOf(tile!)!.parentElement!.click();
    expect(calls.map((call) => call[1])).toEqual(['turn_off']);
    // asked otherwise, its tap is the one it is given
    const own = await drawn({ ...COMPACT, tap_action: { action: 'toggle' } }, 172, hass);
    own.tiles[0]!.querySelector<HTMLElement>('.fv-tile__tap')!.click();
    expect(calls).toHaveLength(2);
  });

  it('under 132 a compact tile has no room for it: the whole tile is the switch, as it was', async () => {
    const { hass, calls } = house();
    const held = await drawn(COMPACT, 132, hass);
    expect(rockerOf(held.tiles[0]!)).not.toBeNull();
    const { tiles } = await drawn(COMPACT, 131, hass);
    expect(tiles[0]!.querySelector('.fv-hit')).toBeNull();
    tiles[0]!.querySelector<HTMLElement>('.fv-tile__tap')!.click();
    expect(calls.map((call) => call[1])).toEqual(['turn_off']);
  });

  it('a mini tile keeps its circle and its tap: the option moves nothing but its level', async () => {
    const { hass, calls } = house();
    const mini = { ...TILE, size: 'mini' };
    const plain = await drawn(mini, 108, hass);
    const { tiles } = await drawn({ ...mini, switch_style: 'rocker' }, 108, hass);
    expect(parts(tiles[0]!)).toEqual(parts(plain.tiles[0]!));
    expect(tiles[0]!.querySelector('.fv-hit')).toBeNull();
    expect(line(tiles[0]!)).toBe('On');
    tiles[0]!.querySelector<HTMLElement>('.fv-tile__tap')!.click();
    expect(calls.map((call) => call[1])).toEqual(['turn_off']);
  });

  it('a sensor, which switches nothing, is the tile it was in every size', async () => {
    for (const size of ['large', 'compact', 'mini']) {
      const sensor = { type: 'custom:fluvy-tile-card', entity: 'sensor.office', size };
      const plain = await drawn(sensor);
      const { tiles } = await drawn({ ...sensor, switch_style: 'rocker' });
      expect(tiles[0]!.outerHTML).toBe(plain.tiles[0]!.outerHTML);
    }
  });
});

describe('the cards built on the tile', () => {
  const styled = (tiles: readonly HTMLElement[]): string[] =>
    tiles.map((tile) =>
      rockerOf(tile) ? 'rocker' : tile.querySelector('.fv-switch') ? 'toggle' : 'none',
    );

  it('a group says it for its tiles, and a tile answers otherwise', async () => {
    const group = { type: 'custom:fluvy-tiles-card', size: 'large', columns: 2 };
    const rockers = await drawn({
      ...group,
      switch_style: 'rocker',
      tiles: ['light.porch', { entity: 'switch.pump', switch_style: 'toggle' }, 'sensor.office'],
    });
    expect(styled(rockers.tiles)).toEqual(['rocker', 'toggle', 'none']);
    const toggles = await drawn({
      ...group,
      tiles: [{ entity: 'light.porch', switch_style: 'rocker' }, 'switch.pump'],
    });
    expect(styled(toggles.tiles)).toEqual(['rocker', 'toggle']);
    // a word that is no style is the toggle
    const other = await drawn({ ...group, switch_style: 'lever', tiles: ['light.porch'] });
    expect(styled(other.tiles)).toEqual(['toggle']);
  });

  it('the template card’s tile follows, large and compact', async () => {
    const template = {
      type: 'custom:fluvy-template-card',
      entity: 'light.porch',
      switch_style: 'rocker',
    };
    const large = await drawn({ ...template, variant: 'large' });
    expect(styled(large.tiles)).toEqual(['rocker']);
    expect(large.tiles[0]!.querySelector('fluvy-ruler')).toBeNull();
    const compact = await drawn(template);
    expect(parts(compact.tiles[0]!)).toContain('span.fv-hit');
  });

  it('the room card’s tiles each draw theirs at their end', async () => {
    const { tiles } = await drawn({
      type: 'custom:fluvy-room-card',
      area: 'terrace',
      variant: 'tile',
      controls: 'tiles',
      switch_style: 'rocker',
      tiles: [{ entity: 'light.porch' }, { entity: 'switch.pump', switch_style: 'toggle' }],
    });
    const inner = tiles.filter((tile) => tile.classList.contains('fv-tile--inner'));
    expect(inner.map((tile) => rockerOf(tile) !== null)).toEqual([true, false]);
  });

  it('the room lights card’s tiles follow, each line its state alone', async () => {
    const { tiles } = await drawn({
      type: 'custom:fluvy-lights-card',
      variant: 'tiles',
      switch_style: 'rocker',
      lights: ['light.porch', 'light.drive'],
    });
    expect(tiles.map((tile) => rockerOf(tile) !== null)).toEqual([true, true]);
    expect(tiles.map(line)).toEqual(['On', 'Off']);
  });

  it('a dashboard’s word for its tiles’ switches is the tile’s own', () => {
    expect(tileSwitch('rocker')).toEqual({ switch_style: 'rocker' });
    expect(tileSwitch('hide')).toEqual({ show_switch: false });
    expect(tileSwitch('value')).toEqual({ show_switch: 'value' });
    expect(tileSwitch('show')).toEqual({});
    expect(tileSwitch(undefined)).toEqual({});
  });
});

describe('the editors offer the style where a switch is drawn', () => {
  const editorOf = async (
    card: { getConfigElement(): Promise<HTMLElement> },
    config: LovelaceCardConfig,
  ): Promise<FluvyRowsEditor> => {
    const editor = await card.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house().hass;
    return drawEditor(editor, config);
  };
  const offers = (form: FormStub, name = 'switch_style'): boolean =>
    shownNames(form.schema).includes(name);
  const items = (editor: FluvyRowsEditor): FormStub[] => [
    ...editor.shadowRoot!.querySelectorAll<FormStub>('.item ha-form'),
  ];

  it('the tile’s: a large tile that shows its switch, a compact one, never a mini nor a sensor', async () => {
    const shown = async (config: Record<string, unknown>, name?: string): Promise<boolean> =>
      offers(cardForm(await editorOf(FluvyTileCard, { ...TILE, ...config })), name);
    expect(await shown({})).toBe(true);
    expect(await shown({ size: 'compact' })).toBe(true);
    expect(await shown({ size: 'mini' })).toBe(false);
    expect(await shown({ show_switch: false })).toBe(false);
    expect(await shown({ show_switch: 'value' })).toBe(false);
    expect(await shown({ entity: 'sensor.office' })).toBe(false);
    // a rocker's tile has no ruler: its slider's style has nothing to act on, and its foot is its readouts'
    expect(await shown({}, 'slider_style')).toBe(true);
    expect(await shown({ switch_style: 'rocker' }, 'slider_style')).toBe(false);
    expect(await shown({}, 'readouts')).toBe(false);
    expect(await shown({ switch_style: 'rocker' }, 'readouts')).toBe(true);
  });

  it('as a dropdown of the two styles, the toggle shown until the rocker is chosen and never written', async () => {
    const editor = await editorOf(FluvyTileCard, TILE);
    const field = cardForm(editor).schema.find((item) => item.name === 'switch_style')!;
    // the dropdown every editor's choice is, its words the editor's own
    expect(field.selector!['select']).toEqual({
      mode: 'dropdown',
      options: [
        { value: 'toggle', label: 'Toggle' },
        { value: 'rocker', label: 'Wall rocker' },
      ],
    });
    expect(cardForm(editor).data['switch_style']).toBe('toggle');
    let next = nextConfig(editor);
    cardForm(editor).change('switch_style', 'rocker');
    expect(await next).toEqual({ ...TILE, switch_style: 'rocker' });
    await editor.updateComplete;
    // the default, chosen back, stays written: the person chose it
    next = nextConfig(editor);
    cardForm(editor).change('switch_style', 'toggle');
    expect(await next).toEqual({ ...TILE, switch_style: 'toggle' });
  });

  it('the tiles card’s: the group’s, and a tile’s own where its entity switches', async () => {
    const TILES = ['switch.pump', 'sensor.office'];
    const edited = (config: Record<string, unknown>) =>
      editorOf(FluvyTilesCard, { type: 'custom:fluvy-tiles-card', tiles: TILES, ...config });
    // compact (the default) and large groups, never minis; a group of sensors has no switch
    expect(offers(cardForm(await edited({})))).toBe(true);
    expect(offers(cardForm(await edited({ size: 'large' })))).toBe(true);
    expect(offers(cardForm(await edited({ size: 'large', show_switch: false })))).toBe(false);
    expect(offers(cardForm(await edited({ size: 'mini' })))).toBe(false);
    expect(offers(cardForm(await edited({ tiles: ['sensor.office'] })))).toBe(false);
    // a tile's own: a compact one its style alone, a large one its switch too, its style while it shows it
    const fields = (form: FormStub) => [offers(form, 'show_switch'), offers(form)];
    expect(items(await edited({})).map(fields)).toEqual([
      [false, true],
      [false, false],
    ]);
    expect(items(await edited({ size: 'large' })).map(fields)).toEqual([
      [true, true],
      [false, false],
    ]);
    expect(items(await edited({ size: 'large', show_switch: 'value' })).map(fields)).toEqual([
      [true, false],
      [false, false],
    ]);
    expect(items(await edited({ size: 'mini' })).map(fields)).toEqual([
      [false, false],
      [false, false],
    ]);
    // empty until chosen (its group's), written as its word, and back to its id
    const editor = await edited({ switch_style: 'rocker' });
    expect(items(editor)[0]!.data['switch_style']).toBeUndefined();
    let next = nextConfig(editor);
    items(editor)[0]!.change('switch_style', 'toggle');
    expect(((await next)['tiles'] as unknown[])[0]).toEqual({
      entity: 'switch.pump',
      switch_style: 'toggle',
    });
    await editor.updateComplete;
    next = nextConfig(editor);
    items(editor)[0]!.change('switch_style', undefined);
    expect(((await next)['tiles'] as unknown[])[0]).toBe('switch.pump');
  });

  it('the template card’s and the room card’s', async () => {
    const template = (config: Record<string, unknown>) =>
      editorOf(FluvyTemplateCard, { type: 'custom:fluvy-template-card', ...config });
    expect(offers(cardForm(await template({ entity: 'light.porch' })))).toBe(true);
    expect(offers(cardForm(await template({ entity: 'light.porch', variant: 'large' })))).toBe(
      true,
    );
    expect(offers(cardForm(await template({ entity: 'light.porch', variant: 'mini' })))).toBe(
      false,
    );
    expect(offers(cardForm(await template({})))).toBe(false);
    const room = (config: Record<string, unknown>) =>
      editorOf(FluvyRoomCard, { type: 'custom:fluvy-room-card', area: 'terrace', ...config });
    expect(offers(cardForm(await room({ variant: 'tile', controls: 'tiles' })))).toBe(true);
    expect(offers(cardForm(await room({ variant: 'tile' })))).toBe(false);
    // the room lights card's, with its tiles
    const lights = (config: Record<string, unknown>) =>
      editorOf(FluvyLightsCard, {
        type: 'custom:fluvy-lights-card',
        lights: ['light.porch'],
        ...config,
      });
    expect(offers(cardForm(await lights({ variant: 'tiles' })))).toBe(true);
    expect(offers(cardForm(await lights({})))).toBe(false);
    // a room's tile says its own where its entity switches (its tiles' forms come first, before its quick actions')
    const tiles = await room({
      variant: 'tile',
      controls: 'tiles',
      tiles: [{ entity: 'light.porch' }, { entity: 'sensor.office' }],
    });
    expect(
      items(tiles)
        .slice(0, 2)
        .map((form) => offers(form)),
    ).toEqual([true, false]);
  });
});
