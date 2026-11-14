// @vitest-environment happy-dom
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { setCardDefaults, type HomeAssistant } from '@fluvy/core';
import { familiesDefined } from '../index.js';
import {
  cardForm,
  drawEditor,
  nextConfig,
  shownNames,
  type FormStub,
} from '../shared/fixtures/editor.js';
import type { FluvyRowsEditor } from '../shared/rows-editor.js';
import { FluvyTilesCard } from './tiles-card.js';

// the index fetches the media and energy families: they land before this file's page goes
afterAll(() => familiesDefined);

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  states: {
    'switch.kitchen': {
      entity_id: 'switch.kitchen',
      state: 'off',
      attributes: { friendly_name: 'Kitchen' },
      last_changed: '',
      last_updated: '',
    },
    'switch.porch': {
      entity_id: 'switch.porch',
      state: 'on',
      attributes: { friendly_name: 'Porch' },
      last_changed: '',
      last_updated: '',
    },
  },
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
} as unknown as HomeAssistant;

async function group(config: Record<string, unknown>) {
  const card = document.createElement('fluvy-tiles-card') as HTMLElement & {
    setConfig(config: unknown): void;
    hass: HomeAssistant;
    updateComplete: Promise<boolean>;
    getCardSize(): number;
  };
  card.setConfig({
    type: 'custom:fluvy-tiles-card',
    entities: ['switch.kitchen', 'switch.porch'],
    ...config,
  });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('a group of tiles', () => {
  afterEach(() => document.body.replaceChildren());

  it('stays compact by default: one row each, the tile itself the button', async () => {
    const card = await group({});
    const tiles = card.shadowRoot!.querySelectorAll('.fv-tile');
    expect(tiles.length).toBe(2);
    expect(tiles[0]!.classList.contains('fv-tile--compact')).toBe(true);
    expect(card.getCardSize()).toBe(1);
  });

  it('draws large tiles when asked: icon circle and a switch of their own, as a lone large tile', async () => {
    const card = await group({ size: 'large' });
    const root = card.shadowRoot!;
    expect(root.querySelector('.fv-tiles--large')).not.toBeNull();
    expect(root.querySelector('.fv-tile--compact')).toBeNull();
    expect(root.querySelectorAll('.fv-tile .fv-ico').length).toBe(2);
    expect(card.getCardSize()).toBe(3);
  });

  it('lays out fewer mini columns than asked while the group cannot hold 84 px tiles', async () => {
    const card = await group({
      size: 'mini',
      columns: 4,
      entities: ['switch.kitchen', 'switch.porch', 'switch.kitchen', 'switch.porch'],
    });
    const sized = card as unknown as { width: number };
    const grid = (): string => card.shadowRoot!.querySelector('.fv-tiles')!.className;
    sized.width = 360;
    await card.updateComplete;
    expect(grid()).toContain('fv-tiles--3');
    sized.width = 412;
    await card.updateComplete;
    expect(grid()).toContain('fv-tiles--4');
  });
});

/*
 * A tile out of reach (#126): dashed, as before, the house's until it says otherwise; quiet, the same anatomy as it rests
 * — its own glyph, its words and its dashes, its switch still — marked for the quiet sheet, the group's or its own.
 */
describe('a tile out of reach', () => {
  const away = {
    ...hass,
    states: {
      ...hass.states,
      'switch.printer': {
        entity_id: 'switch.printer',
        state: 'unavailable',
        attributes: { friendly_name: '3D printer' },
        last_changed: '',
        last_updated: '',
      },
    },
  } as unknown as HomeAssistant;
  /** The ban glyph, by its stroke. */
  const BAN = 'path[d="m6.5 6.5 11 11"]';
  async function tiles(config: Record<string, unknown>) {
    const card = await group({ entities: undefined, ...config });
    card.hass = away;
    await card.updateComplete;
    return [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-tile')];
  }
  const printer = (all: HTMLElement[]): HTMLElement => all.at(-1)!;

  afterEach(() => {
    setCardDefaults({ opacity: 100, blur: true, unavailable: 'dashed', border: true });
    document.body.replaceChildren();
  });

  it('is dashed by default, as before: its classes, the ban glyph, its words, no mark', async () => {
    for (const size of ['large', 'compact'] as const) {
      const tile = printer(await tiles({ size, tiles: ['switch.kitchen', 'switch.printer'] }));
      expect(tile.className).toBe(
        size === 'large'
          ? 'fv-tile fv-tile--off fv-tile--tap fv-tile--footless'
          : 'fv-tile fv-tile--off fv-tile--tap fv-tile--compact',
      );
      expect(tile.querySelector('.fv-ico')!.className).toBe('fv-ico fv-ico--off');
      expect(tile.querySelector(BAN)).not.toBeNull();
      expect(tile.querySelector('.fv-tile__state')!.textContent!.trim()).toMatch(/^Unavailable/);
      expect(tile.hasAttribute('data-unavailable')).toBe(false);
    }
  });

  it('is quiet where the group says so: its anatomy, its own glyph in its resting circle, its switch still', async () => {
    const tile = printer(
      await tiles({
        size: 'large',
        unavailable: 'quiet',
        tiles: ['switch.kitchen', 'switch.printer'],
      }),
    );
    expect(tile.getAttribute('data-unavailable')).toBe('quiet');
    expect(tile.className).toBe('fv-tile fv-tile--off fv-tile--tap fv-tile--footless');
    expect(tile.querySelector(BAN)).toBeNull();
    expect(tile.querySelector('.fv-ico')!.className).toBe('fv-ico fv-ico--accent');
    expect(tile.querySelector('.fv-tile__state')!.textContent!.trim()).toMatch(/^Unavailable/);
    expect(tile.querySelector('.fv-switch')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('takes a tile’s own word over its group’s, and the house’s where neither says one', async () => {
    const own = await tiles({
      unavailable: 'quiet',
      tiles: ['switch.kitchen', { entity: 'switch.printer', unavailable: 'dashed' }],
    });
    expect(own.map((tile) => tile.getAttribute('data-unavailable'))).toEqual(['quiet', null]);
    expect(printer(own).querySelector(BAN)).not.toBeNull();
    setCardDefaults({ opacity: 100, blur: true, unavailable: 'quiet', border: true });
    const house = await tiles({
      tiles: ['switch.kitchen', { entity: 'switch.printer', unavailable: 'dashed' }],
    });
    expect(house.map((tile) => tile.getAttribute('data-unavailable'))).toEqual(['quiet', null]);
  });
});

/*
 * Tiles in groups (#189): the list's own sections, or the house's rooms and floors, each under a quiet label; a
 * config without them draws as 1.20 did.
 */
describe('a group of tiles in groups', () => {
  const rooms = {
    ...hass,
    states: Object.fromEntries(
      [
        ['light.kitchen_pendant', 'Kitchen Pendant'],
        ['light.kitchen_counter', 'Kitchen Counter'],
        ['light.kitchen_hob', 'Kitchen Hob'],
        ['light.living_floor', 'Living room Floor lamp'],
        ['light.porch', 'Porch'],
      ].map(([entity_id, friendly_name]) => [
        entity_id,
        {
          entity_id,
          state: 'off',
          attributes: { friendly_name },
          last_changed: '',
          last_updated: '',
        },
      ]),
    ),
    entities: {
      'light.kitchen_pendant': { entity_id: 'light.kitchen_pendant', area_id: 'kitchen' },
      'light.kitchen_counter': { entity_id: 'light.kitchen_counter', area_id: 'kitchen' },
      'light.kitchen_hob': { entity_id: 'light.kitchen_hob', area_id: 'kitchen' },
      'light.living_floor': { entity_id: 'light.living_floor', area_id: 'living' },
    },
    areas: {
      living: { area_id: 'living', name: 'Living room', floor_id: 'ground' },
      kitchen: { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground' },
    },
    floors: { ground: { floor_id: 'ground', name: 'Ground floor', level: 0 } },
  } as unknown as HomeAssistant;
  const LIGHTS = [
    'light.porch',
    'light.kitchen_pendant',
    'light.living_floor',
    'light.kitchen_counter',
    'light.kitchen_hob',
  ];

  /** The card on the house of rooms, once what lays its groups out has landed. */
  async function grouped(config: Record<string, unknown>) {
    const card = await group({ entities: undefined, ...config });
    card.hass = rooms;
    await import('../shared/groups.js');
    await new Promise((resolve) => setTimeout(resolve));
    await card.updateComplete;
    return card;
  }
  /** What the grid holds, in its order: a label's words, or a tile's name. */
  const drawn = (card: HTMLElement): string[] =>
    [...card.shadowRoot!.querySelectorAll('.fv-tiles > .fv-group, .fv-tiles > .fv-tile')].map(
      (el) =>
        el.classList.contains('fv-group')
          ? `# ${el.textContent}`
          : el.querySelector('.fv-tile__name')!.textContent!,
    );
  const height = (config: Record<string, unknown>): number =>
    FluvyTilesCard.layoutHeight({ type: 'custom:fluvy-tiles-card', ...config });

  afterEach(() => document.body.replaceChildren());

  it('draws a plain list as it always did: no label, every tile in the list’s order', async () => {
    const card = await grouped({ tiles: LIGHTS });
    expect(card.shadowRoot!.querySelector('.fv-group')).toBeNull();
    expect(drawn(card)).toEqual([
      'Porch',
      'Kitchen Pendant',
      'Living room Floor lamp',
      'Kitchen Counter',
      'Kitchen Hob',
    ]);
    // five compact tiles two a row: three rows of 76, 8 apart
    expect(height({ tiles: LIGHTS })).toBe(3 * 76 + 2 * 8);
  });

  it('labels its own sections, each a label across the grid over its tiles', async () => {
    const tiles = [
      'light.porch',
      { section: 'Kitchen' },
      'light.kitchen_pendant',
      { entity: 'light.kitchen_counter', name: 'Kitchen Counter' },
      { section: 'Evening' },
      'light.living_floor',
      { section: 'Nothing under it' },
    ];
    const card = await grouped({ tiles });
    // short under a room of the house, whole where the config names the tile and under words of its own
    expect(drawn(card)).toEqual([
      'Porch',
      '# Kitchen',
      'Pendant',
      'Kitchen Counter',
      '# Evening',
      'Living room Floor lamp',
    ]);
    const label = card.shadowRoot!.querySelector('.fv-group')!;
    expect(label.localName).toBe('h3');
    expect(label.hasAttribute('data-name')).toBe(true);
    // a row a group, a label 28 each, 16 over each label: 76 + (16 + 28 + 76) × 2
    expect(height({ tiles })).toBe(76 + 2 * (16 + 28 + 76));
    // the same list without its sections is two rows shorter in labels, and one row longer in tiles
    expect(
      height({ tiles: tiles.filter((entry) => typeof entry === 'string' || 'entity' in entry) }),
    ).toBe(2 * 76 + 8);
  });

  it('groups by the house’s rooms and floors where asked, the names short under each', async () => {
    const byArea = await grouped({ tiles: LIGHTS, group_by: 'area' });
    expect(drawn(byArea)).toEqual([
      '# Kitchen',
      'Pendant',
      'Counter',
      'Hob',
      '# Living room',
      'Floor lamp',
      '# Other',
      'Porch',
    ]);
    const whole = await grouped({ tiles: LIGHTS, group_by: 'floor', short_names: false });
    expect(drawn(whole)).toEqual([
      '# Ground floor',
      'Kitchen Pendant',
      'Living room Floor lamp',
      'Kitchen Counter',
      'Kitchen Hob',
      '# Other',
      'Porch',
    ]);
    // `none` is none: the list as it stands
    expect(drawn(await grouped({ tiles: LIGHTS, group_by: 'none' }))).toHaveLength(5);
  });

  it('declares its groups’ rows from its config, and the house’s where the house is read', async () => {
    const { houseHeightOf } = await import('../house-heights.js');
    const config = { type: 'custom:fluvy-tiles-card', tiles: LIGHTS, group_by: 'area' };
    // by its config alone a card cannot know the rooms: the list as it stands, as with a house that has nothing to say
    expect(FluvyTilesCard.layoutHeight(config)).toBe(3 * 76 + 2 * 8);
    expect(houseHeightOf(config, -1, {} as HomeAssistant)).toBe(3 * 76 + 2 * 8);
    // with the house: Kitchen's three (two rows), Living room's one, Other's one, a label each
    expect(houseHeightOf(config, -1, rooms)).toBe(
      28 + (2 * 76 + 8) + (16 + 28 + 76) + (16 + 28 + 76),
    );
    // large tiles: 168 a row, the section's 16 between two rows of a group
    expect(houseHeightOf({ ...config, size: 'large' }, -1, rooms)).toBe(
      28 + (2 * 168 + 16) + (16 + 28 + 168) + (16 + 28 + 168),
    );
    // a mini's three a row
    expect(houseHeightOf({ ...config, size: 'mini' }, -1, rooms)).toBe(
      28 + 108 + (16 + 28 + 108) + (16 + 28 + 108),
    );
    for (const size of ['compact', 'mini', 'large'])
      expect(houseHeightOf({ ...config, size }, -1, rooms) % 4).toBe(0);
  });

  it('labels a section in a house that has no rooms: the label is the list’s own', async () => {
    const card = await group({
      entities: undefined,
      tiles: [{ section: 'Kitchen' }, 'switch.kitchen'],
    });
    await import('../shared/groups.js');
    await new Promise((resolve) => setTimeout(resolve));
    await card.updateComplete;
    expect(drawn(card)).toEqual(['# Kitchen', 'Kitchen']);
  });

  it('offers the groups in its editor: the house’s, their order where it makes them, the short names in a group', async () => {
    const editor = await FluvyTilesCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = rooms;
    const shown = async (config: Record<string, unknown>): Promise<string[]> =>
      shownNames(
        cardForm(await drawEditor(editor, { type: 'custom:fluvy-tiles-card', ...config })).schema,
      );
    const plain = await shown({ tiles: LIGHTS });
    expect(plain).toContain('group_by');
    expect(plain).not.toContain('group_order');
    expect(plain).not.toContain('short_names');
    const house = await shown({ tiles: LIGHTS, group_by: 'area' });
    expect(house).toEqual(expect.arrayContaining(['group_by', 'group_order', 'short_names']));
    // its own sections make groups too: their names may be short, their order is the list's
    const own = await shown({ tiles: [{ section: 'Kitchen' }, ...LIGHTS] });
    expect(own).toContain('short_names');
    expect(own).not.toContain('group_order');
  });
});

describe('the group’s editor offers its large tiles’ switches where they have one (#160)', () => {
  afterEach(() => document.body.replaceChildren());

  const edited = async (config: Record<string, unknown>) => {
    const editor = await FluvyTilesCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = hass;
    return drawEditor(editor, { type: 'custom:fluvy-tiles-card', ...config });
  };
  const items = (editor: FluvyRowsEditor): FormStub[] => [
    ...editor.shadowRoot!.querySelectorAll<FormStub>('.item ha-form'),
  ];
  const offers = (form: FormStub): boolean => shownNames(form.schema).includes('show_switch');
  const TILES = ['switch.kitchen', 'sensor.office'];

  it('the group’s own, to large tiles where one of them switches', async () => {
    expect(offers(cardForm(await edited({ size: 'large', tiles: TILES })))).toBe(true);
    expect(offers(cardForm(await edited({ size: 'large', entities: TILES })))).toBe(true);
    // compact tiles (the default) and minis draw no switch, and a sensor has none
    expect(offers(cardForm(await edited({ tiles: TILES })))).toBe(false);
    expect(offers(cardForm(await edited({ size: 'mini', tiles: TILES })))).toBe(false);
    expect(offers(cardForm(await edited({ size: 'large', tiles: ['sensor.office'] })))).toBe(false);
  });

  it('a tile’s own, to a large tile whose entity switches', async () => {
    expect(items(await edited({ size: 'large', tiles: TILES })).map(offers)).toEqual([true, false]);
    expect(items(await edited({ tiles: TILES })).map(offers)).toEqual([false, false]);
  });

  it('shows a tile’s own word and writes its pick as the toggle the config holds, empty back to its id', async () => {
    const editor = await edited({
      size: 'large',
      tiles: [{ entity: 'switch.kitchen', show_switch: false }, 'switch.porch'],
    });
    const written = async (pick: unknown): Promise<unknown> => {
      const next = nextConfig(editor);
      items(editor)[1]!.change('show_switch', pick);
      const tiles = (await next)['tiles'] as unknown[];
      await editor.updateComplete;
      return tiles[1];
    };
    expect(items(editor)[0]!.data['show_switch']).toBe('false');
    // a tile that says nothing shows nothing: its group's
    expect(items(editor)[1]!.data['show_switch']).toBeUndefined();
    expect(await written('false')).toEqual({ entity: 'switch.porch', show_switch: false });
    expect(await written('true')).toEqual({ entity: 'switch.porch', show_switch: true });
    expect(await written('value')).toEqual({ entity: 'switch.porch', show_switch: 'value' });
    expect(await written(undefined)).toBe('switch.porch');
  });
});
