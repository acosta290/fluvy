// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../chart/engine/__fixtures__/classic-1.10.json' with { type: 'json' };
import { familiesDefined } from '../index.js';
import { FluvySensorCard, type SensorCardConfig } from './sensor-card.js';

// the chart engine lands with the families: the card draws its chart from its first render after the history
await familiesDefined;

const { TEMP, HUM } = fixtures.inputs;

/** A house whose recorder answers every window with the readings, one in the middle of each of its 48 slots. */
const house = (): HomeAssistant => {
  const readings: Record<string, readonly number[]> = { 'sensor.temp': TEMP, 'sensor.hum': HUM };
  const sensor = (name: string, values: readonly number[], unit: string, deviceClass: string) => ({
    entity_id: name,
    state: String(values[values.length - 1]),
    attributes: {
      friendly_name: name,
      unit_of_measurement: unit,
      device_class: deviceClass,
      state_class: 'measurement',
    },
    last_changed: '',
    last_updated: '',
  });
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: {},
    themes: { darkMode: false },
    states: {
      'sensor.temp': sensor('sensor.temp', TEMP, '°C', 'temperature'),
      'sensor.hum': sensor('sensor.hum', HUM, '%', 'humidity'),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      const id = (message['entity_ids'] as string[])[0] as string;
      const values = readings[id] ?? [];
      return {
        [id]: values.map((v, i) => ({
          s: String(v),
          lu: (start + ((i + 0.5) / 48) * (end - start)) / 1000,
        })),
      };
    },
    callService: async () => undefined,
  } as unknown as HomeAssistant;
};

const settle = async (card: FluvySensorCard): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

async function mount(config: Partial<SensorCardConfig>): Promise<FluvySensorCard> {
  const card = document.createElement('fluvy-sensor-card') as FluvySensorCard;
  card.setConfig({ type: 'custom:fluvy-sensor-card', entity: 'sensor.temp', ...config });
  card.hass = house();
  document.body.append(card);
  await settle(card);
  return card;
}

const ds = (card: FluvySensorCard, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(selector)].map((el) => el.getAttribute('d') ?? '');

afterEach(() => document.body.replaceChildren());

describe('the sensor’s chart, drawn by the engine', () => {
  it('draws one sensor classic, as 1.10 did, path for path, while the house keeps its factory style', async () => {
    const card = await mount({});
    expect(ds(card, '.am-chart .curve-line')).toEqual([fixtures.curveGeometry.sensor.line]);
    expect(ds(card, '.am-chart .curve-area')).toEqual([fixtures.curveGeometry.sensor.area]);
    expect(card.shadowRoot!.querySelectorAll('.am-chart .curve-dot').length).toBe(1);
    expect(card.shadowRoot!.querySelector('.am-chart svg')?.getAttribute('data-measure')).toBe(
      'drawn',
    );
    // the bubble at now, on the line's end
    expect(card.shadowRoot!.querySelector('.am-chart .fv-bubble b')?.textContent).toBe(
      String(TEMP[47]),
    );
  });

  it('draws several sensors classic, each on its own scale, as 1.10 did', async () => {
    const card = await mount({ entities: ['sensor.hum'] });
    expect(ds(card, '.am-chart--several .curve-line')).toEqual([
      fixtures.seriesPath.sensorSmooth,
      fixtures.seriesPath.humSmooth,
    ]);
    expect(ds(card, '.am-chart--several .curve-area')[0]).toBe(fixtures.areaUnder.sensor);
    expect(card.shadowRoot!.querySelector('.am-multi')).not.toBeNull();
  });

  it('draws the style the card names: the soft line, its copy and Fluvy’s knob at its end', async () => {
    const card = await mount({ chart: 'soft' });
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.fc-line').length).toBe(1);
    expect(root.querySelectorAll('.fc-glow').length).toBe(1);
    expect(root.querySelectorAll('.am-chart .fv-knob').length).toBe(1);
    expect(root.querySelector('.curve-line')).toBeNull();
  });

  it('puts a stepped chart on a nice scale, its ticks in a column the axis row starts after', async () => {
    const card = await mount({ chart: 'step' });
    const root = card.shadowRoot!;
    expect([...root.querySelectorAll('.fc-tick')].map((t) => t.textContent)).toEqual([
      '0',
      '10',
      '20',
      '30',
    ]);
    const axis = root.querySelector('.am-chart + div') as HTMLElement;
    expect(parseFloat(axis.style.marginInlineStart)).toBeGreaterThan(0);
  });

  it('draws the tile’s spark classic, or minimal where the card says so', async () => {
    const classic = await mount({ variant: 'tile' });
    expect(classic.shadowRoot!.querySelectorAll('.am-spark .curve-line').length).toBe(1);
    const minimal = await mount({ variant: 'tile', chart: 'minimal' });
    expect(minimal.shadowRoot!.querySelectorAll('.am-spark .fc-line').length).toBe(1);
    expect(minimal.shadowRoot!.querySelectorAll('.am-spark .fc-area').length).toBe(0);
  });
});

describe('the sensor’s editor', () => {
  const section = (FluvySensorCard.getConfigForm().schema as HaFormSchemaItem[]).find(
    (item) => item.type === 'expandable' && item.schema?.some((field) => field.name === 'chart'),
  ) as HaFormSchemaItem;
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const all = fields(section.schema ?? []);
  const shown = (data: Record<string, unknown>): string[] =>
    (section.schema ?? [])
      .filter((item) => !item.when || item.when(data))
      .flatMap((item) => fields([item]).filter((field) => !field.when || field.when(data)))
      .map(
        (field) =>
          `${field.name}${field.name === 'chart' ? `:${JSON.stringify((field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value))}` : ''}`,
      );

  it('offers every key the sensor can draw, and never now (its window ends there)', () => {
    expect(new Set(all.map((field) => field.name))).toEqual(
      new Set([
        'chart',
        'curve',
        'fill',
        'line_width',
        'glow',
        'show_points',
        'show_grid',
        'show_axis',
        'highlight',
        'animate',
      ]),
    );
  });

  it('shows only what the chosen style acts on: no soft shadow in classic, the highlight in steps', () => {
    expect(shown({})).not.toContain('glow');
    expect(shown({ chart: 'soft' })).toContain('glow');
    expect(shown({ chart: 'step' })).toContain('highlight');
    expect(shown({ chart: 'bars' })).not.toContain('curve');
  });

  it('offers bars to one sensor, the lines only to several, and no highlight over several', () => {
    expect(shown({})[0]).toBe('chart:["classic","soft","glow","minimal","step","bars","columns"]');
    const several = shown({ entities: ['sensor.hum'], chart: 'step' });
    expect(several[0]).toBe('chart:["classic","soft","glow","minimal","step"]');
    expect(several).not.toContain('highlight');
  });
});
