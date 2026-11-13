// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from 'vitest';
import type { HomeAssistant } from '@fluvy/core';
import {
  DEMO_ENERGY_SOURCES,
  DEMO_EXTRAS,
  DEMO_HEAT_PUMP_READINGS,
  DEMO_ROOMS,
  demoHass,
  type DemoEntity,
} from '@fluvy/demo-home';
import {
  hcDishwasher,
  houseOf,
  lgFridge,
  plugWasher,
  tuyaKettle,
} from '../appliance/fixtures/index.js';
// the cards register their heights with core: the strategy lays columns out with them
import { familiesDefined } from '../index.js';
import { editOf, partOf, pinned } from './edit.js';
import { generateWith } from './generate.js';
import { TEMPLATES, templateById } from './templates.js';
import type { Card, FluvyStrategyConfig, MoreHost, TemplateId } from './types.js';

// the families' chunks are fetched as the module loads: they land before the file's environment goes
afterAll(() => familiesDefined);

const entity = (
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
  registry: Record<string, unknown> = {},
): DemoEntity => ({ id, state, attributes, registry });

/** The moment the appliances' fixtures are read at. */
const AT = Date.parse('2026-09-17T19:47:00Z');
/** The demo home's Energy dashboard with a forecast linked to its array: tomorrow's production has a card. */
const SOURCES: readonly Record<string, unknown>[] = DEMO_ENERGY_SOURCES.map((source) =>
  source['type'] === 'solar' ? { ...source, config_entry_solar_forecast: ['forecast'] } : source,
);
/** The demo home with one of everything the library has a card for, and what a test adds on top. */
const house = (more: readonly DemoEntity[] = [], sources = SOURCES) =>
  houseOf(
    [lgFridge(AT), hcDishwasher(AT), plugWasher(AT), tuyaKettle(AT)],
    AT,
    demoHass({
      more: [...DEMO_EXTRAS, ...DEMO_ROOMS, ...DEMO_HEAT_PUMP_READINGS, ...more],
      consumption: ['sensor.washing_machine_energy_today', 'sensor.dryer_energy_today'],
      sources,
    }) as unknown as Partial<HomeAssistant>,
  ) as never;

/** A template's dashboard on that house: its views, and each view as it was built (its parts). */
async function built(
  id: TemplateId,
  edit?: unknown,
  more: readonly DemoEntity[] = [],
  options: Partial<FluvyStrategyConfig> = {},
  sources = SOURCES,
) {
  const template = templateById(id);
  const hosts: MoreHost[] = [];
  const config = {
    type: template.type,
    ...options,
    ...(edit === undefined ? {} : { edit }),
  } as FluvyStrategyConfig;
  const { views } = await generateWith(
    template,
    config,
    house(more, sources),
    '/fluvy-test',
    hosts,
  );
  const view = (path: string) => views.find((v) => v.path === path)!;
  const cards = (path: string): Card[] => view(path).sections.flatMap((section) => section.cards);
  /** A view's cards in reading order, each by its part's id (the frame's greeting has none). */
  const laid = (path: string): string[] =>
    cards(path)
      .map((card) => partOf(card) ?? '')
      .filter(Boolean);
  const of = (path: string, part: string): Card[] =>
    cards(path).filter((card) => partOf(card) === part);
  const host = (path: string) => hosts.find((h) => h.path === path)!;
  /** The ids of a view's parts in the order they are read, drawn or not. */
  const ids = (path: string): string[] => host(path).parts.map((p) => p.id);
  return { views, hosts, view, cards, laid, of, host, ids };
}
const tabs = (views: readonly { path: string; subview?: boolean }[]): string[] =>
  views.filter((v) => !v.subview).map((v) => v.path);

describe('the automatic dashboards’ parts (#170)', () => {
  it('stand every card of every view of every template in a part, each id once in its view', async () => {
    for (const template of TEMPLATES) {
      const { views, hosts } = await built(template.id);
      expect(hosts.length).toBeGreaterThan(0);
      for (const host of hosts) {
        const view = views.find((v) => v.path === host.path);
        const ids = host.parts.map((p) => p.id);
        expect(new Set(ids).size, `${template.id}/${host.path}`).toBe(ids.length);
        // none is the head of another's: `lights:light.sofa` is a card of the list `lights`, never a part beside it
        for (const id of ids)
          expect(
            ids.filter((other) => other.startsWith(`${id}:`)),
            `${template.id}/${host.path}/${id}`,
          ).toEqual([]);
        // every card is a part's, but the greeting the frame opens a view with
        for (const card of view?.sections.flatMap((section) => section.cards) ?? [])
          expect(
            partOf(card) ?? (card.type === 'custom:fluvy-hello-card' ? 'frame' : undefined),
            `${template.id}/${host.path}: ${card.type}`,
          ).toBeDefined();
      }
    }
  });

  it('keep their ids for a house with one of everything (golden file)', async () => {
    const all: Record<string, Record<string, string[]>> = {};
    for (const template of TEMPLATES) {
      const { hosts, views } = await built(template.id);
      all[template.id] = Object.fromEntries(
        hosts
          .filter((host) => views.some((v) => v.path === host.path))
          .map((host) => [host.path, host.parts.filter((p) => p.cards.length).map((p) => p.id)]),
      );
    }
    expect(all).toMatchSnapshot();
  });

  it('move none of them when a device is added elsewhere', async () => {
    const before = await built('home');
    const after = await built('home', undefined, [
      entity('light.attic_lamp', 'on', { friendly_name: 'Attic lamp' }),
      entity('sensor.attic_temperature', '19', {
        friendly_name: 'Attic temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      }),
      entity('lock.side_door', 'locked', { friendly_name: 'Side door' }),
      entity('media_player.attic_speaker', 'idle', { friendly_name: 'Attic speaker' }),
    ]);
    for (const host of before.hosts) {
      const was = host.parts.map((p) => p.id);
      // a light in no room makes a group of its own: every part that was there is, in its order
      expect(
        after.ids(host.path).filter((id) => was.includes(id)),
        host.path,
      ).toEqual(was);
    }
    expect(after.ids('home')).toEqual(before.ids('home'));
  });

  it('never write an id into a card’s config', async () => {
    const plain = await built('home');
    const { views } = await built('home', { cards: { 'home/clock': { order: 0 } } });
    for (const card of views.flatMap((v) => v.sections.flatMap((section) => section.cards)))
      expect(Object.keys(card).filter((key) => /^(id|part)$/.test(key))).toEqual([]);
    // a dashboard nobody changed is the house's alone, card for card
    expect((await built('home', {})).views).toEqual(plain.views);
  });
});

describe('a dashboard’s `edit` (#170)', () => {
  it('hides a part, and a list with its heading and its "N more" row', async () => {
    const caps = { caps: { lights: 2 } } as const;
    const plain = await built('home', undefined, [], caps);
    expect(plain.laid('home')).toEqual(expect.arrayContaining(['flow', 'lights', 'clock']));
    expect(plain.views.some((v) => v.path === 'home-lights')).toBe(true);
    const { laid, views, ids } = await built(
      'home',
      { cards: { 'home/flow': { hidden: true }, 'home/lights': { hidden: true } } },
      [],
      caps,
    );
    expect(laid('home')).not.toContain('flow');
    expect(laid('home')).not.toContain('lights');
    expect(laid('home')).toContain('clock');
    // a hidden list opens no subview of every one, and keeps its place among the view's parts
    expect(views.some((v) => v.path === 'home-lights')).toBe(false);
    expect(ids('home')).toEqual(plain.ids('home'));
    // the same card on another view stays
    expect(laid('energy')).toContain('flow');
  });

  it('lays a person’s options over a card’s config, takes a key away with null and never changes its type', async () => {
    const { of } = await built('home', {
      cards: {
        'home/clock': { options: { variant: 'analog', weather: null, type: 'custom:other' } },
        'home/lights': { options: { size: 'compact' } },
      },
    });
    const [clock] = of('home', 'clock');
    expect(clock).toMatchObject({ type: 'custom:fluvy-clock-card', variant: 'analog' });
    expect('weather' in clock!).toBe(false);
    // a list's options are its cards': every tile, never the heading that rides with them
    const tiles = of('home', 'lights').filter((c) => c.type === 'custom:fluvy-tile-card');
    expect(tiles.length).toBeGreaterThan(1);
    for (const tile of tiles) expect(tile['size']).toBe('compact');
    const heading = of('home', 'lights').find((c) => c.type === 'custom:fluvy-heading-card');
    expect(heading).toBeDefined();
    expect(heading?.['size']).toBeUndefined();
  });

  it('gives one card of a list options of its own', async () => {
    const plain = await built('home');
    const id = String(
      plain.of('home', 'lights').find((c) => c.type === 'custom:fluvy-tile-card')?.['entity'],
    );
    const { of } = await built('home', {
      cards: { [`home/lights:${id}`]: { options: { name: 'Reading lamp', icon: 'mdi:lamp' } } },
    });
    const tiles = of('home', 'lights').filter((c) => c.type === 'custom:fluvy-tile-card');
    expect(tiles.find((c) => c['entity'] === id)).toMatchObject({
      name: 'Reading lamp',
      icon: 'mdi:lamp',
    });
    expect(tiles.filter((c) => c['name'] === 'Reading lamp')).toHaveLength(1);
  });

  it('drops, adds and orders a list’s entities before its cards are made', async () => {
    const plain = await built('home');
    const lights = plain.host('home').lists.get('lights')!;
    expect(lights.takes).toContain('switch');
    const [first, second, third] = lights.items as [string, string, string];
    const more = [
      entity('switch.desk_socket', 'on', { friendly_name: 'Desk socket' }),
      entity('camera.driveway_extra', 'idle', { friendly_name: 'Driveway' }),
    ];
    const { of, host } = await built(
      'home',
      {
        entities: {
          'home/lights': {
            drop: [first],
            // a switch fits a tile; a camera does not, and an entity the house has not is no one's
            add: ['switch.desk_socket', 'camera.driveway_extra', 'light.nowhere', second],
            order: [third, 'switch.desk_socket'],
          },
        },
      },
      more,
    );
    const shown = of('home', 'lights')
      .filter((c) => c.type === 'custom:fluvy-tile-card')
      .map((c) => c['entity']);
    expect(shown.slice(0, 2)).toEqual([third, 'switch.desk_socket']);
    expect(shown).not.toContain(first);
    expect(shown.filter((id) => id === second)).toHaveLength(1);
    // the heading counts the list as the person left it
    const heading = of('home', 'lights').find((c) => c.type === 'custom:fluvy-heading-card')!;
    const counted = heading['entities'] as string[];
    expect(counted).not.toContain(first);
    expect(counted).toContain('switch.desk_socket');
    expect(counted).not.toContain('camera.driveway_extra');
    expect(counted).not.toContain('light.nowhere');
    // the house's own list is what Customise offers
    expect(host('home').lists.get('lights')?.items).toContain(first);
  });

  it('thins out and orders a band’s appliances, which are devices', async () => {
    const plain = await built('home');
    const devices = plain.host('home').lists.get('large')!.items;
    expect(devices.length).toBeGreaterThan(1);
    const [first, second] = devices as [string, string];
    const { of } = await built('home', {
      entities: { 'home/large': { drop: [first], add: ['light.sofa'], order: [second] } },
    });
    const card = of('home', 'large').find((c) => c.type === 'custom:fluvy-appliances-card')!;
    const shown = (card['appliances'] as { device: string }[]).map((a) => a.device);
    expect(shown).not.toContain(first);
    expect(shown[0]).toBe(second);
    expect(shown).not.toContain('light.sofa');
  });

  it('puts a part first, last or on a place, the others round it in the house’s order', async () => {
    const plain = await built('home');
    const rooms = plain.laid('rooms');
    expect(rooms.length).toBeGreaterThan(3);
    const [a, b, c, ...rest] = rooms as [string, string, string, ...string[]];
    const { laid } = await built('home', {
      cards: { [`rooms/${c}`]: { order: 0 }, [`rooms/${a}`]: { order: -1 } },
    });
    expect(laid('rooms')).toEqual([c, b, ...rest, a]);
    const middle = await built('home', { cards: { [`rooms/${a}`]: { order: 2 } } });
    expect(middle.laid('rooms')).toEqual([b, c, a, ...rest]);
  });

  it('cuts a view’s columns again round a part that moved, each still filled', async () => {
    const plain = await built('home');
    // the scenes close the columns' feet as the house lays them
    expect(plain.laid('home').indexOf('scenes')).toBeGreaterThan(8);
    const { view, laid, host } = await built('home', { cards: { 'home/scenes': { order: 1 } } });
    const columns = view('home').sections.filter((section) => !section.column_span);
    expect(columns).toHaveLength(3);
    for (const column of columns) expect(column.cards.length).toBeGreaterThan(0);
    // read second: in the first column, under what leads it
    expect(laid('home').slice(0, 2)).toEqual(['attention', 'scenes']);
    // every card of the view is still there, once
    expect([...laid('home')].sort()).toEqual([...plain.laid('home')].sort());
    // the appliances' bands stay bands
    expect(view('home').sections.filter((section) => section.column_span)).toHaveLength(1);
    expect(host('home').flow?.sections).toHaveLength(3);
  });

  it('keeps a balanced view balanced where its lead changes', async () => {
    const plain = await built('home');
    expect(plain.laid('climate')[0]).toBe('thermostats');
    const { view, laid } = await built('home', { cards: { 'climate/weather': { order: 0 } } });
    expect(laid('climate')[0]).toBe('weather');
    const columns = view('climate').sections.filter((section) => !section.column_span);
    for (const column of columns) expect(column.cards.length).toBeGreaterThan(0);
    expect([...laid('climate')].sort()).toEqual([...plain.laid('climate')].sort());
  });

  it('moves a card of the wall into the column of the card it follows', async () => {
    const plain = await built('wall');
    const [left, right] = plain.view('wall').sections;
    expect(left!.cards.map((c) => partOf(c)).slice(0, 2)).toEqual(['hello', 'clock']);
    expect(right!.cards.map((c) => partOf(c))).toContain('people');
    const { view } = await built('wall', { cards: { 'wall/people': { order: 1 } } });
    const [first, second] = view('wall').sections;
    expect(first!.cards.map((c) => partOf(c)).slice(0, 3)).toEqual(['hello', 'people', 'clock']);
    expect(second!.cards.map((c) => partOf(c))).not.toContain('people');
    // first of all, it leads the column of the card it now stands before
    const lead = await built('wall', { cards: { 'wall/people': { order: 0 } } });
    expect(lead.view('wall').sections[0]!.cards.map((c) => partOf(c))[0]).toBe('people');
  });

  it('moves a band into the columns, and a card into a band', async () => {
    const plain = await built('home');
    expect(plain.laid('home').at(-1)).toBe('small');
    const up = await built('home', { cards: { 'home/large': { order: 1 } } });
    const columns = up.view('home').sections.filter((section) => !section.column_span);
    expect(columns[0]!.cards.map((c) => partOf(c)).slice(0, 4)).toEqual(
      ['frame', 'attention', 'large', 'large'].map((id) => (id === 'frame' ? undefined : id)),
    );
    const down = await built('home', { cards: { 'home/clock': { order: -1 } } });
    const band = down.view('home').sections.find((section) => section.column_span)!;
    expect(partOf(band.cards.at(-1)!)).toBe('clock');
  });

  it('hides and tunes what the range charts, each usage a part of its own under the period bar', async () => {
    const plain = await built('energy');
    expect(plain.ids('today')).toEqual([
      'period',
      'day_flow',
      'sankey',
      'score',
      'day_balance',
      'usage',
      'usage_water',
      'usage_gas',
    ]);
    expect(plain.of('today', 'period')[0]).toMatchObject({ variant: 'bar' });
    expect(plain.of('today', 'usage_water')[0]).toMatchObject({ kind: 'water' });
    const { of, view } = await built('energy', {
      cards: {
        'today/period': { options: { variant: 'stacked' } },
        'today/usage': { order: 2 },
        'today/usage_water': { hidden: true },
        'today/usage_gas': { options: { show_legend: false } },
      },
    });
    // the bar keeps the view's width and the picker every card follows, whatever a person makes of it
    expect(of('today', 'period')).toEqual([
      { ...plain.of('today', 'period')[0], variant: 'stacked' },
    ]);
    expect(view('today').sections[0]).toMatchObject({ column_span: 3 });
    expect(of('today', 'usage')).toEqual(plain.of('today', 'usage'));
    expect(of('today', 'usage_water')).toEqual([]);
    expect(of('today', 'usage_gas')).toEqual([
      { ...plain.of('today', 'usage_gas')[0], show_legend: false },
    ]);
    // the electricity's usage moved up after the day's flow: among the columns' cards still, the bar alone in its band
    const [band, ...columns] = view('today').sections;
    expect(band!.cards.map((card) => partOf(card))).toEqual(['period']);
    const read = columns.flatMap((section) => section.cards.map((card) => partOf(card) ?? ''));
    expect(read.filter(Boolean).sort()).toEqual(
      ['day_balance', 'day_flow', 'sankey', 'score', 'usage', 'usage_gas'].sort(),
    );
    expect(columns[0]!.cards.map((card) => partOf(card)).filter(Boolean)[0]).toBe('day_flow');
  });

  it('keeps tomorrow’s production under today’s, each hidden, tuned and moved alone', async () => {
    for (const [template, path] of [
      ['energy', 'production'],
      ['home', 'energy'],
    ] as const) {
      const plain = await built(template);
      const column = (cards: (path: string) => Card[], of: string): (string | undefined)[] =>
        cards(of).map((card) => partOf(card));
      const order = column(plain.cards, path);
      const at = order.indexOf('production');
      expect(order[at + 1], template).toBe('tomorrow');
      expect(plain.of(path, 'tomorrow')).toEqual([
        { ...plain.of(path, 'production')[0], day: 'tomorrow' },
      ]);
      // in one column: the pair is a block the columns never cut
      const together = plain
        .view(path)
        .sections.find((section) => section.cards.some((card) => partOf(card) === 'production'))!;
      expect(together.cards.map((card) => partOf(card))).toContain('tomorrow');

      const edited = await built(template, {
        cards: {
          [`${path}/production`]: { hidden: true },
          [`${path}/tomorrow`]: { options: { name: 'Next day' } },
          [`${path}/history`]: { options: { color: null } },
        },
      });
      expect(edited.of(path, 'production')).toEqual([]);
      // tomorrow's is built from the house's, never from what a person made of today's
      expect(edited.of(path, 'tomorrow')).toEqual([
        { ...plain.of(path, 'tomorrow')[0], name: 'Next day' },
      ]);
      expect(edited.of(path, 'history')[0]).not.toHaveProperty('color');
      expect(edited.ids(path)).toEqual(plain.ids(path));

      const moved = await built(template, { cards: { [`${path}/tomorrow`]: { order: -1 } } });
      expect(column(moved.cards, path).filter(Boolean).sort()).toEqual(
        order.filter(Boolean).sort(),
      );
      expect(moved.ids(path)).toEqual(plain.ids(path));
    }
    // a house whose Energy dashboard links no forecast has no card for tomorrow, and the part keeps its place
    const none = await built('energy', undefined, [], {}, DEMO_ENERGY_SOURCES);
    expect(none.of('production', 'tomorrow')).toEqual([]);
    expect(none.ids('production')).toEqual((await built('energy')).ids('production'));
  });

  it('reads every array on Production and the History bars, the arrays still the house’s', async () => {
    const second = entity('sensor.garage_roof_daily_yield', '3.2', {
      friendly_name: 'Garage roof daily yield',
      device_class: 'energy',
      state_class: 'total_increasing',
      unit_of_measurement: 'kWh',
    });
    const sources = [
      ...SOURCES,
      { type: 'solar', stat_energy_from: 'sensor.garage_roof_daily_yield' },
    ];
    const { of } = await built(
      'energy',
      { cards: { 'production/production': { options: { show_forecast: false } } } },
      [second],
      {},
      sources,
    );
    const [today] = of('production', 'production');
    expect(today).toMatchObject({ show_forecast: false });
    expect((today!['arrays'] as { entity: string }[]).map((array) => array.entity)).toEqual([
      'sensor.solar_inverter_daily_yield',
      'sensor.garage_roof_daily_yield',
    ]);
    expect(of('production', 'tomorrow')[0]).not.toHaveProperty('show_forecast');
    expect(of('production', 'history')[0]).toMatchObject({
      entities: ['sensor.solar_inverter_daily_yield', 'sensor.garage_roof_daily_yield'],
    });
  });

  it('keeps a meter’s kind where a utility imports it, however its list is left', async () => {
    const sources = [
      ...SOURCES.filter((source) => source['type'] !== 'gas'),
      { type: 'gas', stat_energy_from: 'utility:gas' },
    ];
    const plain = await built('energy', undefined, [], {}, sources);
    expect(plain.of('water', 'water')[0]!['meters']).toEqual([
      { entity: 'sensor.water_meter' },
      { entity: 'utility:gas', kind: 'gas' },
    ]);
    expect(plain.host('water').lists.get('water')).toMatchObject({
      items: ['sensor.water_meter', 'utility:gas'],
      takes: ['sensor'],
    });
    const { of } = await built(
      'energy',
      {
        entities: {
          'water/water': {
            order: ['utility:gas'],
            // a sensor is taken; a light is no meter, and a statistic the house does not read cannot be added
            add: ['sensor.gas_meter', 'light.sofa', 'utility:water'],
          },
        },
      },
      [],
      {},
      sources,
    );
    expect(of('water', 'water')[0]!['meters']).toEqual([
      { entity: 'utility:gas', kind: 'gas' },
      { entity: 'sensor.water_meter' },
      { entity: 'sensor.gas_meter' },
    ]);
  });

  it('tells two alike apart among what a list is left with', async () => {
    const twins = [
      entity(
        'light.hall_ceiling',
        'on',
        { friendly_name: 'Ceiling light' },
        { area_id: 'living_room' },
      ),
      entity(
        'light.study_ceiling',
        'on',
        { friendly_name: 'Ceiling light' },
        { area_id: 'kitchen' },
      ),
    ];
    const names = (cards: readonly Card[]): unknown[] =>
      cards.filter((card) => card['entity']).map((card) => card['name']);
    const plain = await built('home', undefined, twins, { caps: 'none' });
    const both = names(plain.of('home', 'lights')).filter(Boolean);
    expect(new Set(both).size).toBe(both.length);
    expect(both.length).toBeGreaterThanOrEqual(2);
    // one of the two dropped: the other is alone, and reads as its card names it
    const { of } = await built(
      'home',
      { entities: { 'home/lights': { drop: ['light.study_ceiling'] } } },
      twins,
      { caps: 'none' },
    );
    const left = of('home', 'lights').find((card) => card['entity'] === 'light.hall_ceiling');
    const before = plain
      .of('home', 'lights')
      .find((card) => card['entity'] === 'light.hall_ceiling');
    expect(left).toBeDefined();
    expect(left!['name']).not.toBe(before!['name']);
  });

  it('ignores an id the house does not have, and a malformed edit', async () => {
    const plain = await built('home');
    const odd = await built('home', {
      views: { 'room-gone': { hidden: true }, home: 5 },
      cards: { 'rooms/room:gone': { hidden: true }, 'home/nothing': { order: 0 } },
      entities: { 'home/nothing': { drop: ['light.x'] }, 'home/lights': 'all' },
    });
    expect(odd.views).toEqual(plain.views);
    for (const edit of [
      5,
      'reset',
      [],
      null,
      { cards: [] },
      { views: 'x' },
      { cards: { 'home/clock': { order: 'first', hidden: 'yes', options: [1] } } },
      { entities: { 'home/lights': { drop: 'light.sofa', add: 7, order: {} } } },
    ])
      expect((await built('home', edit)).views, JSON.stringify(edit)).toEqual(plain.views);
    expect(editOf({ cards: { a: { hidden: true }, b: 1 }, views: {}, other: 2 })).toEqual({
      cards: { a: { hidden: true } },
    });
  });

  it('hides and orders views, the first always kept', async () => {
    const plain = await built('home');
    expect(tabs(plain.views).slice(0, 3)).toEqual(['home', 'rooms', 'lights']);
    const { views } = await built('home', {
      views: {
        home: { hidden: true },
        lights: { hidden: true },
        energy: { order: 0 },
        rooms: { order: -1 },
      },
    });
    expect(tabs(views)[0]).toBe('energy');
    expect(tabs(views).at(-1)).toBe('rooms');
    expect(tabs(views)).toContain('home');
    expect(tabs(views)).not.toContain('lights');
    expect([...tabs(views), 'lights'].sort()).toEqual([...tabs(plain.views)].sort());
  });

  it('lays a person’s own cards after a view’s, each a part that can be moved', async () => {
    const note = { type: 'markdown', content: 'Bins on Tuesday' };
    const clock = { type: 'custom:fluvy-clock-card', variant: 'analog' };
    const added = await built('home', {
      views: { climate: { add: [note, 'x', { content: 'no type' }, clock] } },
    });
    // each by its place in the list: what is no card leaves the others their names
    expect(added.ids('climate').slice(-2)).toEqual(['own:0', 'own:3']);
    expect(added.of('climate', 'own:0')).toEqual([note]);
    expect(added.of('climate', 'own:3')).toEqual([clock]);
    const first = await built('home', {
      views: { climate: { add: [note] } },
      cards: { 'climate/own:0': { order: 0 } },
    });
    expect(first.laid('climate')[0]).toBe('own:0');
    // on a wall they close its last column
    const wall = await built('wall', { views: { wall: { add: [note] } } });
    expect(partOf(wall.view('wall').sections.at(-1)!.cards.at(-1)!)).toBe('own:0');
  });

  it('keeps the dashboard’s other options working beside it', async () => {
    const { views, cards } = await built(
      'home',
      { cards: { 'home/clock': { hidden: true } } },
      [],
      { hide: ['media'], tile_size: 'compact' },
    );
    expect(views.some((v) => v.path === 'media')).toBe(false);
    expect(cards('home').some((c) => c.type === 'custom:fluvy-clock-card')).toBe(false);
    const tiles = cards('home').filter((c) => c.type === 'custom:fluvy-tile-card');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((c) => c['size'] === 'compact')).toBe(true);
  });
});

describe('pinned', () => {
  const order =
    (pins: Record<string, number>) =>
    (item: string): unknown =>
      pins[item];
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('leaves a list nobody ordered as it is', () => {
    expect(pinned(items, order({}))).toEqual(items);
  });

  it('counts from the first, and from the last when negative', () => {
    expect(pinned(items, order({ e: 0 }))).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(pinned(items, order({ a: -1 }))).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(pinned(items, order({ a: 2 }))).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(pinned(items, order({ a: -2, e: 1 }))).toEqual(['b', 'e', 'c', 'a', 'd']);
  });

  it('keeps a place past either end inside the list, and two on one place side by side', () => {
    expect(pinned(items, order({ a: 99 }))).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(pinned(items, order({ e: -99 }))).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(pinned(items, order({ d: 1, e: 1 }))).toEqual(['a', 'd', 'e', 'b', 'c']);
    expect(pinned(items, order({ a: 0, b: 1, c: 2, d: 3, e: 4 }))).toEqual(items);
    expect(pinned(['a'], (item) => (item === 'a' ? 1.5 : undefined))).toEqual(['a']);
  });
});
