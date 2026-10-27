// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { itemsHeight, itemsList } from '../items-family.js';
import { TextRuler } from '../shared/fit.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import type { FormHelper } from '../shared/rows-editor.js';
import { FluvyItemsCard, type ItemsCardConfig } from './items-card.js';

// the items family lands with the index: the card's tag is defined before a page needs it
await familiesDefined;

/*
 * The Items card (#66): the height it declares (its rows, never the list's length), its stub, the list cut to its
 * rows and sorted, the head's count, the empty panel, the rows at rest out of reach, a picture that falls back to the
 * glyph, the list a template gives, the sheet fetched on a tap, and its editor.
 */

const STAMP = '2026-10-26T09:00:00Z';
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: STAMP,
    last_updated: STAMP,
  }) as HassEntity;

const flight = (
  callsign: string,
  altitude: number,
  vertical: number,
  distance: number,
  extra: Record<string, unknown> = {},
) => ({
  callsign,
  airport_origin_code_iata: 'AMS',
  airport_destination_code_iata: 'BCN',
  aircraft_model: 'Boeing 737-800',
  aircraft_photo_small: `https://cdn.example/${callsign}.jpg`,
  altitude,
  vertical_speed: vertical,
  distance,
  on_ground: 0,
  ...extra,
});

const FLIGHTS = [
  flight('RYR4PV', 12_500, 2400, 14.1),
  flight('KLM1412', 0, 0, 3.2, { on_ground: 1 }),
  flight('VLG8012', 4200, -1100, 8.7),
];
const DEPARTURES = [
  { line: 'L3', destination: 'Trinitat Nova', due: 5 },
  { line: 'L5', destination: 'Cornellà', due: 2 },
];

const STATES = [
  state('sensor.flights', '3', { flights: FLIGHTS }),
  state('sensor.departures', '2', { departures: DEPARTURES }),
  // a list whose state is no count: the head counts the whole list
  state('sensor.board', 'updated', {
    departures: [...DEPARTURES, { line: 'L1', destination: 'Hospital de Bellvitge', due: 9 }],
  }),
  state('sensor.none', '0', { flights: [] }),
  state('sensor.plain', '7'),
  state('sensor.gone', 'unavailable'),
];

/** A socket that holds each `render_template` subscription, for the test to answer as Home Assistant would. */
function socket() {
  const open: Array<{ template: string; answer: (event: unknown) => void }> = [];
  const connection = {
    subscribeMessage: (answer: (event: unknown) => void, message: { template: string }) => {
      open.push({ template: message.template, answer });
      return Promise.resolve(() => undefined);
    },
  };
  return { connection, open };
}

const house = (
  connection: unknown = socket().connection,
  states: readonly HassEntity[] = STATES,
): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { time_zone: 'UTC' },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'Marta', is_admin: true },
    connection,
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => `https://home.example${path}`,
    callService: () => Promise.resolve(),
  }) as unknown as HomeAssistant;

type Inner = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  config: ItemsCardConfig;
  updateComplete: Promise<boolean>;
  getCardSize(): number;
};

async function draw(
  config: Record<string, unknown>,
  width = 360,
  hass: HomeAssistant = house(),
): Promise<Inner> {
  const card = document.createElement('fluvy-items-card') as Inner;
  card.setConfig({ type: 'custom:fluvy-items-card', entity: 'sensor.flights', ...config });
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
  return card;
}

const root = (card: Inner): ShadowRoot => card.shadowRoot!;
const texts = (card: Inner, selector: string): string[] =>
  [...root(card).querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? '');

afterEach(() => document.body.replaceChildren());

describe('the Items card’s height at a 360 column', () => {
  it('is its rows (60, 48 compact, tiles of 76 two a row), never the list’s length', () => {
    const height = (config: Record<string, unknown>) =>
      itemsHeight({ type: 'custom:fluvy-items-card', ...config });
    expect(height({})).toBe(400);
    expect(height({ max_rows: 3 })).toBe(280);
    expect(height({ variant: 'compact' })).toBe(340);
    expect(height({ variant: 'tiles' })).toBe(344);
    expect(height({ variant: 'tiles', max_rows: 4 })).toBe(260);
    expect(height({ variant: 'tiles', max_rows: 1 })).toBe(176);
    // 1 to 20, five where it is no number
    expect(height({ max_rows: 0 })).toBe(160);
    expect(height({ max_rows: 99 })).toBe(1300);
    expect(height({ max_rows: 'many' })).toBe(400);
    expect(FluvyItemsCard.layoutHeight({ type: 'custom:fluvy-items-card', max_rows: 2 })).toBe(220);
  });

  it('holds its list’s box from the config at any width: tiles one a row hold their rows there', () => {
    const box = (config: Record<string, unknown>, columns?: number) =>
      itemsList({ type: 'custom:fluvy-items-card', ...config }, columns);
    expect(box({ max_rows: 3 })).toBe(180);
    expect(box({ max_rows: 3 }, 1)).toBe(180);
    expect(box({ variant: 'tiles', max_rows: 3 })).toBe(160);
    expect(box({ variant: 'tiles', max_rows: 3 }, 1)).toBe(244);
  });

  it('draws that box whatever the list holds — three aircraft, none or out of reach — at its width', async () => {
    const box = async (entity: string, width: number): Promise<string> => {
      const card = await draw({ entity, variant: 'tiles', max_rows: 3 }, width);
      return root(card).querySelector<HTMLElement>('.it-list')!.style.getPropertyValue('--it-min');
    };
    for (const [width, held] of [
      [360, '160px'],
      [328, '160px'],
      [211, '244px'],
    ] as const)
      for (const entity of ['sensor.flights', 'sensor.none', 'sensor.gone'])
        expect(await box(entity, width), `${entity} @ ${width}`).toBe(held);
  });

  it('says its size from it', async () => {
    expect((await draw({})).getCardSize()).toBe(8);
    expect((await draw({ max_rows: 2, variant: 'compact' })).getCardSize()).toBe(4);
  });
});

describe('the Items card’s stub', () => {
  it('takes a flights sensor, else the first sensor', () => {
    const stub = (ids: string[]) => FluvyItemsCard.getStubConfig(undefined, ids).entity;
    expect(stub(['light.a', 'sensor.temperature', 'sensor.flightradar24_current'])).toBe(
      'sensor.flightradar24_current',
    );
    expect(stub(['light.a', 'sensor.temperature'])).toBe('sensor.temperature');
    expect(stub(['light.a'])).toBe('');
  });
});

describe('the Items card’s list', () => {
  it('is the flights nearest first, cut to its rows, the head counting them all from the state', async () => {
    const card = await draw({ max_rows: 2 });
    expect(texts(card, '.fv-row__title')).toEqual(['KLM1412', 'VLG8012']);
    expect(texts(card, '.fv-card__title')).toEqual(['Flights nearby']);
    expect(texts(card, '.fv-card__sub')).toEqual(['3 aircraft']);
    // a state that is no count: the whole list's length, not the rows'
    const board = await draw({ entity: 'sensor.board', item_name: 'line', max_rows: 1 });
    expect(texts(board, '.fv-row__title')).toEqual(['L3']);
    expect(texts(board, '.fv-card__sub')).toEqual(['3 items']);
  });

  it('is sorted as asked, with the sensor’s order where no field is named', async () => {
    const card = await draw({ sort: 'altitude', sort_order: 'descending' });
    expect(texts(card, '.fv-row__title')).toEqual(['RYR4PV', 'VLG8012', 'KLM1412']);
    expect(texts(card, '.fv-row__value')).toEqual(['12,500 ft', '4,200 ft', 'On ground']);
    // the arrows: climbing, descending, none on the ground
    expect(
      [...root(card).querySelectorAll('.fv-row__value')].map((value) =>
        Boolean(value.querySelector('svg')),
      ),
    ).toEqual([true, true, false]);
    const kept = await draw({ sort: '' });
    expect(texts(kept, '.fv-row__title')).toEqual(['RYR4PV', 'KLM1412', 'VLG8012']);
  });

  it('is a list of the person’s own, mapped field by field, counted as items', async () => {
    const card = await draw({
      entity: 'sensor.departures',
      item_name: '{line} → {destination}',
      item_value: 'due',
      item_unit: 'min',
      sort: 'due',
    });
    expect(texts(card, '.fv-row__title')).toEqual(['L5 → Cornellà', 'L3 → Trinitat Nova']);
    expect(texts(card, '.fv-row__value')).toEqual(['2 min', '5 min']);
    expect(texts(card, '.fv-card__title')).toEqual(['departures']);
    expect(texts(card, '.fv-card__sub')).toEqual(['2 items']);
    expect(
      texts(await draw({ entity: 'sensor.departures', show_count: false }), '.fv-card__sub'),
    ).toEqual([]);
    expect(texts(await draw({ subtitle: 'Overhead' }), '.fv-card__sub')).toEqual(['Overhead']);
  });

  it('is the list a template gives, nothing while Home Assistant has not answered', async () => {
    const { connection, open } = socket();
    const card = await draw(
      {
        entity: 'sensor.plain',
        items_template: "{{ state_attr('sensor.departures', 'departures') }}",
        item_name: 'line',
        item_value: 'due',
      },
      360,
      house(connection),
    );
    expect(open.map((entry) => entry.template)).toEqual([
      "{{ state_attr('sensor.departures', 'departures') }}",
    ]);
    expect(root(card).querySelectorAll('.fv-row')).toHaveLength(0);
    expect(root(card).querySelector('.fv-empty-state')).toBeNull();
    open[0]!.answer({ result: DEPARTURES });
    await card.updateComplete;
    expect(texts(card, '.fv-row__title')).toEqual(['L3', 'L5']);
    // the sensor's state is the count, as the card is told
    expect(texts(card, '.fv-card__sub')).toEqual(['7 items']);
    open[0]!.answer({ result: 'not a list' });
    await card.updateComplete;
    expect(root(card).querySelector('.fv-empty-state')).not.toBeNull();
  });

  it('shows the empty panel where nothing is listed, in the preset’s words or the config’s', async () => {
    const card = await draw({ entity: 'sensor.none' });
    expect(texts(card, '.fv-empty-state__text')).toEqual(['No aircraft nearby']);
    expect(root(card).querySelector('.it-list.is-empty')).not.toBeNull();
    expect(texts(card, '.fv-card__sub')).toEqual(['0 aircraft']);
    const own = await draw({ entity: 'sensor.none', empty_text: 'Clear skies' });
    expect(texts(own, '.fv-empty-state__text')).toEqual(['Clear skies']);
    const plain = await draw({ entity: 'sensor.plain' });
    expect(texts(plain, '.fv-empty-state__text')).toEqual(['Nothing listed']);
    expect(texts(plain, '.fv-card__sub')).toEqual(['7 items']);
  });

  it('sets the panel in the middle of the box on the 4 grid, and its words alone in a box shorter than it', async () => {
    const box = async (config: Record<string, unknown>) => {
      const list = root(
        await draw({ entity: 'sensor.none', ...config }),
      ).querySelector<HTMLElement>('.it-list')!;
      return [list.classList.contains('is-short'), list.style.getPropertyValue('--it-inset')];
    };
    // three rows (180): 30 above the 120 panel would leave the grid, 28 does not
    expect(await box({ max_rows: 3 })).toEqual([false, '28px']);
    expect(await box({ max_rows: 4 })).toEqual([false, '60px']);
    // one compact row (48): the words alone
    expect(await box({ variant: 'compact', max_rows: 1 })).toEqual([true, '0px']);
  });
});

describe('the Items card drawn', () => {
  it('keeps its rows out of reach: dashes in resting rings, as many as it declares', async () => {
    const card = await draw({ entity: 'sensor.gone', max_rows: 4 });
    expect(root(card).querySelector('.fv-card')!.classList.contains('is-unavailable')).toBe(true);
    expect(root(card).querySelectorAll('.fv-row.is-unavailable')).toHaveLength(4);
    expect(root(card).querySelectorAll('.fv-row .fv-ico--off')).toHaveLength(4);
    expect(texts(card, '.fv-row__value')).toEqual(['—', '—', '—', '—']);
    expect(texts(card, '.fv-card__sub')).toEqual(['Unavailable']);
    expect(root(card).querySelector('.fv-empty-state')).toBeNull();
    const tiles = await draw({ entity: 'sensor.gone', variant: 'tiles', max_rows: 3 });
    expect(tiles.shadowRoot!.querySelectorAll('.it-tile.is-unavailable')).toHaveLength(3);
  });

  it('shows a flight’s photo in its circle, and its glyph where the photo will not load', async () => {
    const card = await draw({ max_rows: 1 });
    const img = root(card).querySelector<HTMLImageElement>('.it-pic img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example/KLM1412.jpg');
    img.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(root(card).querySelector('.it-pic')).toBeNull();
    expect(root(card).querySelector('.fv-row .fv-ico')).not.toBeNull();
    const hidden = await draw({ max_rows: 1, show_image: false });
    expect(root(hidden).querySelector('.it-pic')).toBeNull();
    // Home Assistant's own paths go through `hassUrl`
    const own = await draw({
      entity: 'sensor.departures',
      item_image: 'picture',
      items_template: undefined,
      max_rows: 1,
    });
    expect(root(own).querySelector('.it-pic')).toBeNull();
  });

  it('draws compact rows of the name and the value, and tiles of its circle, name and value', async () => {
    const compact = await draw({ variant: 'compact' });
    expect(root(compact).querySelectorAll('.fv-row--compact')).toHaveLength(3);
    expect(root(compact).querySelectorAll('.fv-row__sub')).toHaveLength(0);
    expect(root(compact).querySelectorAll('.it-pic')).toHaveLength(0);
    const tiles = await draw({ variant: 'tiles' });
    expect(root(tiles).querySelectorAll('.it-tile')).toHaveLength(3);
    expect(texts(tiles, '.fv-tile__name')).toEqual(['KLM1412', 'VLG8012', 'RYR4PV']);
    expect(texts(tiles, '.fv-tile__state')).toEqual(['On ground', '4,200 ft', '12,500 ft']);
    expect(root(tiles).querySelectorAll('.it-tile[role="button"]')).toHaveLength(3);
    expect(
      root(await draw({ variant: 'tiles', item_tap: 'none' })).querySelectorAll('[role="button"]'),
    ).toHaveLength(0);
  });

  it('gives its tiles’ arrows away before their circles, and the arrows back once the circles have gone', async () => {
    // happy-dom lays nothing out: words of 7 a letter
    const width = vi
      .spyOn(TextRuler.prototype, 'width')
      .mockImplementation((_cls: string, text: string) => text.length * 7);
    const glyphs = (card: Inner): number =>
      root(card).querySelectorAll('.fv-tile__state > svg').length;
    // two a row at 360: each tile's value holds beside its photo only without its arrow
    const wide = await draw({ variant: 'tiles' }, 360);
    expect(root(wide).querySelectorAll('.it-tile .it-pic')).toHaveLength(3);
    expect(glyphs(wide)).toBe(0);
    // one a row in a narrow column: the words take the tile, the arrows are back
    const narrow = await draw({ variant: 'tiles' }, 160);
    expect(root(narrow).querySelectorAll('.it-tile .it-pic, .it-tile .fv-ico')).toHaveLength(0);
    expect(glyphs(narrow)).toBe(2);
    width.mockRestore();
  });

  it('opens an item’s sheet on a tap, its chunk fetched the first time, unless the tap does nothing', async () => {
    const card = await draw({});
    root(card).querySelector<HTMLElement>('.fv-row--tap')!.click();
    await vi.waitFor(() =>
      expect(
        root(card).querySelector('fluvy-items-sheet')?.shadowRoot?.querySelector('dialog'),
      ).toBeTruthy(),
    );
    expect(
      root(card).querySelector('fluvy-items-sheet')!.shadowRoot!.querySelector('.fv-sheet__title')!
        .textContent,
    ).toBe('KLM1412');
    const still = await draw({ item_tap: 'none' });
    expect(root(still).querySelector('.fv-row--tap')).toBeNull();
  });

  it('keeps its item while the list moves under it, and says so once the item has left', async () => {
    const card = await draw({ max_rows: 2 });
    root(card).querySelectorAll<HTMLElement>('.fv-row--tap')[1]!.click();
    const title = (): string | null | undefined =>
      root(card)
        .querySelector('fluvy-items-sheet')
        ?.shadowRoot?.querySelector('.fv-sheet__title')
        ?.textContent?.trim();
    await vi.waitFor(() => expect(title()).toBe('VLG8012'));
    // VLG8012 flies off, past the rows the card shows: the sheet still shows it
    const moved = STATES.map((s) =>
      s.entity_id === 'sensor.flights'
        ? state('sensor.flights', '3', {
            flights: FLIGHTS.map((f) => (f.callsign === 'VLG8012' ? { ...f, distance: 21.4 } : f)),
          })
        : s,
    );
    card.hass = house(undefined, moved);
    await card.updateComplete;
    expect(texts(card, '.fv-row__title')).toEqual(['KLM1412', 'RYR4PV']);
    await vi.waitFor(() => expect(title()).toBe('VLG8012'));
    // gone from the sensor's list: the sheet says nothing is listed
    const gone = STATES.map((s) =>
      s.entity_id === 'sensor.flights'
        ? state('sensor.flights', '2', {
            flights: FLIGHTS.filter((f) => f.callsign !== 'VLG8012'),
          })
        : s,
    );
    card.hass = house(undefined, gone);
    await card.updateComplete;
    await vi.waitFor(() => expect(title()).toBe('Flights nearby'));
  });

  it('is the head’s own button for the sensor’s details', async () => {
    const card = await draw({});
    expect(root(card).querySelector('.fv-card__head .fv-card__tap')).not.toBeNull();
  });
});

describe('the Items card’s editor', () => {
  const shown = async (config: Record<string, unknown>): Promise<string[]> =>
    shownNames(
      cardForm(
        await drawEditor(await FluvyItemsCard.getConfigElement(), {
          type: 'custom:fluvy-items-card',
          ...config,
        }),
      ).schema,
    );

  it('hides the mapped fields under a preset, and the pictures in compact rows', async () => {
    expect(await shown({ preset: 'flights' })).not.toContain('item_name');
    expect(await shown({ preset: 'none' })).toContain('item_name');
    expect(await shown({})).toContain('item_url');
    expect(await shown({ variant: 'compact' })).not.toContain('show_image');
    expect(await shown({ variant: 'tiles' })).toContain('show_image');
  });

  it('offers the sensor’s lists as the attribute, and says what automatic found', async () => {
    const choices = FluvyItemsCard.choices!({ type: '', entity: 'sensor.flights' }, house());
    expect(choices['attribute']?.map((option) => option.value)).toEqual(['auto', 'flights']);
    expect(FluvyItemsCard.choices!({ type: '', entity: 'sensor.plain' }, house())).toEqual({});
    // the card's helper is told what the form holds and the house (the base editor hands both over)
    const helper = FluvyItemsCard.getConfigForm().computeHelper as FormHelper;
    const key = (k: string) => k;
    expect(helper({ name: 'preset' }, key, { entity: 'sensor.flights' }, house())).toBe(
      'Automatic found flights: a FlightRadar24 sensor',
    );
    expect(helper({ name: 'preset' }, key, { entity: 'sensor.departures' }, house())).toBe(
      'Automatic found no preset: the fields below map the items',
    );
    expect(helper({ name: 'preset' }, key, { preset: 'none' }, house())).toBeUndefined();
    expect(helper({ name: 'item_value' }, key, {}, house())).toContain('{a|b}');
  });
});
