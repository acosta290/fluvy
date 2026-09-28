// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
// the cards register their heights with core: the strategy lays columns out with them
import '../index.js';
import { FluvyHomeStrategy } from './home-strategy.js';

import { DEMO_EXTRAS, DEMO_HEAT_PUMP_READINGS, demoHass, type DemoEntity } from '@fluvy/demo-home';

/** The demo home as a strategy sees it, with what a test adds on top. */
function house(more: readonly DemoEntity[] = [], consumption?: readonly string[]) {
  return demoHass({ more, ...(consumption ? { consumption } : {}) }) as never;
}

const entity = (
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
  registry: Record<string, unknown> = {},
): DemoEntity => ({ id, state, attributes, registry });

const types = (cards: readonly { type: string }[]): string[] =>
  cards.map((c) => c.type.replace('custom:fluvy-', '').replace('-card', ''));

describe("custom:fluvy-home strategy — the grid meter's sign", () => {
  /** A grid meter found by its words, negative while the house imports at night. */
  const withMeter = (hourly: number) => {
    const hass = house([
      entity('sensor.solar_inverter_power', '0', {
        unit_of_measurement: 'W',
        device_class: 'power',
        friendly_name: 'Solar inverter power',
      }),
      entity('sensor.grid_meter_power', '-1286', {
        unit_of_measurement: 'W',
        device_class: 'power',
        friendly_name: 'Grid meter power',
      }),
    ]) as unknown as { callWS: (msg: { type: string }) => Promise<unknown> };
    const prefs = hass.callWS;
    hass.callWS = async (msg) =>
      msg.type === 'recorder/statistics_during_period'
        ? {
            'sensor.grid_meter_power': Array.from({ length: 24 }, (_, i) => ({
              start: i,
              mean: hourly,
            })),
            'sensor.solar_inverter_power': Array.from({ length: 24 }, (_, i) => ({
              start: i,
              mean: 0,
            })),
          }
        : prefs(msg);
    return hass as never;
  };
  const flow = (views: Awaited<ReturnType<typeof FluvyHomeStrategy.generate>>['views']) =>
    views
      .flatMap((v) => v.sections.flatMap((s) => s.cards))
      .find((c) => c.type === 'custom:fluvy-energy-flow-card') as unknown as Record<
      string,
      unknown
    >;

  it('inverts a meter that reads negative through the dark hours', async () => {
    const { views } = await FluvyHomeStrategy.generate(
      { type: 'custom:fluvy-home' },
      withMeter(-1200),
    );
    expect(flow(views)).toMatchObject({
      grid_power: 'sensor.grid_meter_power',
      grid_invert: true,
    });
  });

  it('keeps a meter that imports as positive', async () => {
    const { views } = await FluvyHomeStrategy.generate(
      { type: 'custom:fluvy-home' },
      withMeter(1200),
    );
    expect(flow(views)?.['grid_invert']).toBeUndefined();
  });
});

/** The demo home with one of everything the library has a card for. */
const everything = () =>
  house(DEMO_EXTRAS, ['sensor.washing_machine_energy_today', 'sensor.dryer_energy_today']);

describe('custom:fluvy-home strategy', () => {
  it('writes only configs its cards accept', async () => {
    await import('../index.js');
    const rejected: string[] = [];
    for (const hass of [house(), everything()]) {
      const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, hass);
      for (const card of views.flatMap((v) => v.sections.flatMap((s) => s.cards))) {
        const Card = customElements.get(card.type.replace(/^custom:/, '')) as
          (new () => HTMLElement & { setConfig(config: unknown): void }) | undefined;
        if (!Card) {
          rejected.push(`${card.type}: not defined`);
          continue;
        }
        try {
          new Card().setConfig(card);
        } catch (error) {
          rejected.push(`${card.type}: ${(error as Error).message}`);
        }
      }
    }
    expect(rejected).toEqual([]);
  });

  it('draws the cards in the style the dashboard asks for', async () => {
    const { views } = await FluvyHomeStrategy.generate(
      {
        type: 'custom:fluvy-home',
        thermostat_variant: 'compact',
        tile_size: 'compact',
        flow_style: 'rail',
      },
      house(),
    );
    const cards = views.flatMap((v) => v.sections.flatMap((s) => s.cards));
    const of = (type: string) => cards.filter((c) => c.type === `custom:fluvy-${type}-card`);
    expect(of('thermostat').every((c) => c['variant'] === 'compact')).toBe(true);
    expect(of('energy-flow').every((c) => c['flow_style'] === 'rail')).toBe(true);
    const lights = views.find((v) => v.path === 'lights')!.sections.flatMap((s) => s.cards);
    const tiles = lights.filter((c) => c.type === 'custom:fluvy-tile-card');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((c) => c['size'] === 'compact')).toBe(true);
  });

  it('puts every card of the library to use in a house that has one of everything', async () => {
    const { CATALOGUE } = await import('../index.js');
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, everything());
    const used = new Set(
      views.flatMap((v) => v.sections.flatMap((s) => s.cards.map((c) => c.type))),
    );
    expect(CATALOGUE.map(([tag]) => `custom:${tag}`).filter((type) => !used.has(type))).toEqual([]);
  });

  it('builds a view for each thing the house has, with the greeting and the tabs on every one', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    expect(views.map((v) => v.path)).toEqual([
      'home',
      'lights',
      'climate',
      'energy',
      'media',
      'sensors',
    ]);
    for (const v of views)
      expect(types(v.sections[0]!.cards).slice(0, 2)).toEqual(['hello', 'chips']);
    const chips = views[0]!.sections[0]!.cards[1] as unknown as {
      chips: { label: string; path: string; icon: string }[];
    };
    expect(chips.chips.map((c) => c.label)).toEqual([
      'Home',
      'Lights',
      'Climate',
      'Energy',
      'Media',
      'Sensors',
    ]);
    expect(chips.chips[1]!.path.endsWith('/lights')).toBe(true);
    expect(chips.chips.every((c) => c.icon.startsWith('fluvy:'))).toBe(true);
  });

  it('generates the same dashboard for the demo home (golden file: a change here is a change of the dashboard)', async () => {
    const hass = house(DEMO_HEAT_PUMP_READINGS, [
      'sensor.washing_machine_energy_today',
      'sensor.heat_pump_energy_today',
    ]);
    expect(await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, hass)).toMatchSnapshot();
  });

  it('puts the running thermostat, the home forecast and the signed-in person first, and keeps valves out of appliances', async () => {
    const hass = house([
      entity('climate.aa_idle_ac', 'off', { temperature: 24 }),
      entity('weather.met_service', 'sunny'),
      entity('weather.forecast_house', 'sunny'),
      entity('person.me', 'home', { user_id: 'u-1' }),
      entity('switch.sink_water_valve', 'on', { friendly_name: 'Sink water valve' }),
      entity('update.zigbee', 'on', {}, { entity_category: 'config' }),
    ]) as unknown as Record<string, unknown>;
    hass['user'] = { id: 'u-1', name: 'Me', is_admin: true };
    const { views } = await FluvyHomeStrategy.generate(
      { type: 'custom:fluvy-home' },
      hass as never,
    );
    const home = views[0]!.sections.flatMap((section) => section.cards);
    expect(home.find((c) => c.type === 'custom:fluvy-thermostat-card')?.['entity']).toBe(
      'climate.heat_pump',
    );
    expect(home.find((c) => c.type === 'custom:fluvy-weather-card')?.['entity']).not.toBe(
      'weather.met_service',
    ); // the home's forecast (home / forecast_home) before the national service
    expect(home.find((c) => c.type === 'custom:fluvy-hello-card')?.['person']).toBe('person.me');
    expect(home.some((c) => c['entity'] === 'switch.sink_water_valve')).toBe(false);
    const sensors = views
      .find((v) => v.path === 'sensors')!
      .sections.flatMap((section) => section.cards);
    expect(
      (
        sensors.find((c) => c.type === 'custom:fluvy-updates-card')?.['entities'] as string[]
      ).includes('update.zigbee'),
    ).toBe(true);
  });

  it('gives every view three columns, so the header never moves between tabs', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    for (const v of views) {
      expect(v.max_columns).toBe(3);
      expect(v.sections.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('tells lights from appliances by their words and gives plugs their readings', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const home = views[0]!.sections.flatMap((section) => section.cards); // wherever the columns cut
    const lights = home.find((c) => c.type === 'custom:fluvy-heading-card') as unknown as {
      entities: string[];
    };
    expect(lights.entities).toEqual([
      'light.living_room_lamp',
      'switch.kitchen_light',
      'switch.patio_light',
    ]);
    const washer = home.find((c) => c['entity'] === 'switch.washing_machine') as unknown as {
      readouts?: string[];
    };
    expect(washer.readouts).toEqual([
      'sensor.washing_machine_power',
      'sensor.washing_machine_energy_today',
    ]);
    expect(
      home.some(
        (c) => c['entity'] === 'switch.heat_pump_boost' || c['entity'] === 'switch.plug_beep',
      ),
    ).toBe(false);
  });

  it('groups the lights by area, dimmable ones as light cards', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const lights = views[1]!;
    const headings = lights.sections.flatMap((s) =>
      s.cards.filter((c) => c.type === 'custom:fluvy-heading-card').map((c) => c['title']),
    );
    expect(headings).toEqual(['Living room', 'Kitchen', 'Outdoor']);
    expect(
      lights.sections[0]!.cards.some(
        (c) => c.type === 'custom:fluvy-light-card' && c['entity'] === 'light.living_room_lamp',
      ),
    ).toBe(true);
  });

  it('pairs the tiles and closes an odd run with a compact tile across the column', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const columns = (card: { grid_options?: unknown }) =>
      (card.grid_options as { columns?: number } | undefined)?.columns;
    const runs: number[] = [];
    for (const cards of views.flatMap((v) => v.sections.map((s) => s.cards))) {
      let run = 0;
      for (const card of [...cards, {}]) {
        if (columns(card) === 6) run++;
        else {
          if (run) runs.push(run);
          run = 0;
        }
      }
    }
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.filter((n) => n % 2)).toEqual([]);
    const compact = views.flatMap((v) =>
      v.sections.flatMap((s) => s.cards.filter((c) => c['size'] === 'compact')),
    );
    expect(compact.length).toBeGreaterThan(0);
    expect(compact.every((c) => columns(c) === 12)).toBe(true);
  });

  it("leaves the weather service's sensors out of the climate view and pairs humidity with its temperature", async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const climate = views[2]!.sections.flatMap((s) => s.cards);
    expect(climate.some((c) => c['entity'] === 'sensor.met_temperature')).toBe(false);
    const humidity = climate.find((c) => c.type === 'custom:fluvy-humidity-card') as unknown as {
      temperature_entity?: string;
    };
    expect(humidity.temperature_entity).toBe('sensor.garden_temperature');
  });

  it("finds solar and grid power for the flow and the energy dashboard's devices", async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const energy = views[3]!.sections.flatMap((s) => s.cards);
    const flow = energy.find((c) => c.type === 'custom:fluvy-energy-flow-card') as unknown as {
      solar_power: string;
      grid_power: string;
    };
    expect(flow.solar_power).toBe('sensor.solar_inverter_power');
    expect(flow.grid_power).toBe('sensor.grid_meter_power');
    expect(
      energy.some(
        (c) =>
          c.type === 'custom:fluvy-production-card' &&
          c['entity'] === 'sensor.solar_inverter_daily_yield',
      ),
    ).toBe(true);
    const devices = energy.find(
      (c) => c.type === 'custom:fluvy-energy-devices-card',
    ) as unknown as { rows: { entity: string }[] };
    expect(devices.rows.map((r) => r.entity)).toEqual(['sensor.washing_machine_energy_today']);
  });

  it("draws the distribution of the energy dashboard's devices from the power sensor beside each statistic", async () => {
    const hass = house(DEMO_HEAT_PUMP_READINGS, [
      'sensor.washing_machine_energy_today',
      'sensor.heat_pump_energy_today',
    ]);
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, hass);
    const energy = views.find((v) => v.path === 'energy')!.sections.flatMap((s) => s.cards);
    const distribution = energy.find(
      (c) => c.type === 'custom:fluvy-distribution-card',
    ) as unknown as { entities: string[] } | undefined;
    expect(distribution?.entities).toEqual([
      'sensor.washing_machine_power',
      'sensor.heat_pump_power',
    ]);
  });

  it('splits batteries into devices and phones, and keeps connectivity sensors out of openings', async () => {
    const { views } = await FluvyHomeStrategy.generate({ type: 'custom:fluvy-home' }, house());
    const sensors = views.find((v) => v.path === 'sensors')!.sections.flatMap((s) => s.cards);
    const bars = sensors.filter((c) => c.type === 'custom:fluvy-bars-card') as unknown as {
      title: string;
      rows: { entity: string }[];
    }[];
    expect(bars.map((b) => [b.title, b.rows.map((r) => r.entity)])).toEqual([
      ['Batteries', ['sensor.garden_battery']],
      ['Phones', ['sensor.phone_battery_level']],
    ]);
    const openings = sensors.find((c) => c.type === 'custom:fluvy-openings-card') as unknown as {
      entities: string[];
    };
    expect(openings.entities).toEqual(['binary_sensor.kitchen_leak']);
  });

  it("speaks the dashboard's language and leaves out hidden views", async () => {
    const hass = house() as unknown as { language: string };
    hass.language = 'es';
    const { views } = await FluvyHomeStrategy.generate(
      { type: 'custom:fluvy-home', hide: ['energy', 'media'] },
      hass as never,
    );
    expect(views.map((v) => v.title)).toEqual(['Inicio', 'Luces', 'Clima', 'Sensores']);
  });
});
