// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { chartHeight } from '../chart-family.js';
import { familiesDefined } from '../index.js';
import { FluvyChartCard, type ChartCardConfig } from './chart-card.js';
import { capsIn, defaultWindows, isPrice, seriesOf, windowAt } from './config.js';
import type { Reading } from './data/attribute.js';
import { sourceOf } from './data/sources.js';
import { gains, slotted, spanOf, stepOf, windowOf } from './data/span.js';

// the chart family lands with the index: the card's tag is defined before a page needs it
await familiesDefined;

/*
 * The Chart card (#68): what it reads from (history, statistics, a list, a forecast) and the window it reads (a rolling
 * span, today, today and tomorrow until tomorrow is published), how readings lie on its slots, its thresholds and its
 * marked windows, its height by variant and series alone (empty and out of reach too), its stub and its editor.
 */

const HOUR = 3_600_000;
const QUARTER = HOUR / 4;
/** The sheets' evening, in UTC (the tests' clock has no zone of its own). */
const NOW = '2026-09-17T21:47:00Z';
const MIDNIGHT = Date.parse('2026-09-17T00:00:00Z');

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: NOW,
    last_updated: NOW,
  }) as HassEntity;

/** A day of Nordpool's quarters: a cheap afternoon, a dear evening. */
const quarters = (start: number, value: (q: number) => number) =>
  Array.from({ length: 96 }, (_unused, q) => ({
    start: new Date(start + q * QUARTER).toISOString(),
    end: new Date(start + (q + 1) * QUARTER).toISOString(),
    value: value(q),
  }));
const day = (q: number): number =>
  q >= 52 && q < 60 ? 0.02 : q >= 76 && q < 84 ? 0.34 : 0.12 + (q % 4) / 1000;

const STATES = [
  state('sensor.nordpool', '0.125', {
    unit_of_measurement: 'EUR/kWh',
    raw_today: quarters(MIDNIGHT, day),
    raw_tomorrow: quarters(MIDNIGHT + 24 * HOUR, day),
  }),
  state('sensor.nordpool_morning', '0.125', {
    unit_of_measurement: 'EUR/kWh',
    raw_today: quarters(MIDNIGHT, day),
    raw_tomorrow: [],
  }),
  state('sensor.temperature', '21.4', {
    unit_of_measurement: '°C',
    device_class: 'temperature',
    state_class: 'measurement',
  }),
  state('sensor.cellar', '14.2', { unit_of_measurement: '°C', state_class: 'measurement' }),
  state('weather.home', 'sunny', { temperature: 16.8, temperature_unit: '°C' }),
  state('sensor.gone', 'unavailable', { unit_of_measurement: 'EUR/kWh' }),
];

interface Asked {
  readonly messages: Array<Record<string, unknown>>;
  readonly subscriptions: Array<Record<string, unknown>>;
}

/** A house whose recorder spreads its readings across the window asked, and whose weather forecasts its next hours. */
function house(asked: Asked = { messages: [], subscriptions: [] }): HomeAssistant {
  const history: Record<string, readonly number[]> = {
    // yesterday a degree cooler: today's change on it is up
    'sensor.temperature': [
      ...Array.from({ length: 48 }, () => 20),
      ...Array.from({ length: 48 }, () => 21),
    ],
    'sensor.cellar': [],
  };
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
    config: { time_zone: 'UTC', unit_system: { temperature: '°C' } },
    states: Object.fromEntries(STATES.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'Marta', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService: () => Promise.resolve(),
    callWS: (message: Record<string, unknown>) => {
      asked.messages.push(message);
      if (message['type'] !== 'history/history_during_period') return Promise.resolve({});
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      const id = (message['entity_ids'] as string[])[0] as string;
      const values = history[id] ?? [];
      return Promise.resolve({
        [id]: values.map((v, i) => ({
          s: String(v),
          lu: (start + (i / Math.max(1, values.length - 1)) * (end - start)) / 1000,
        })),
      });
    },
    connection: {
      subscribeMessage: (answer: (event: unknown) => void, message: Record<string, unknown>) => {
        asked.subscriptions.push(message);
        const first = Date.parse(NOW) + 13 * 60_000;
        setTimeout(() =>
          answer({
            forecast: Array.from({ length: 24 }, (_unused, h) => ({
              datetime: new Date(first + h * HOUR).toISOString(),
              temperature: 15 + h / 4,
            })),
          }),
        );
        return Promise.resolve(() => undefined);
      },
    },
  } as unknown as HomeAssistant;
}

type Inner = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
  getCardSize(): number;
};

async function draw(
  config: Partial<ChartCardConfig> & Record<string, unknown>,
  hass: HomeAssistant = house(),
  width = 360,
): Promise<Inner> {
  const card = document.createElement('fluvy-chart-card') as Inner;
  card.setConfig({ type: 'custom:fluvy-chart-card', _now: NOW, ...config });
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  for (let i = 0; i < 3; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await card.updateComplete;
  return card;
}

const root = (card: Inner): ShadowRoot => card.shadowRoot!;
const texts = (card: Inner, selector: string): string[] =>
  [...root(card).querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? '');

afterEach(() => document.body.replaceChildren());

const NORDPOOL = {
  series: [{ entity: 'sensor.nordpool', tone: 'ok' as const }],
  span: 'today+tomorrow',
  chart: 'step' as const,
  thresholds: [
    { tone: 'warning' as const, value: 0.2 },
    { tone: 'danger' as const, value: 0.3 },
  ],
  highlight: 'both' as const,
  highlight_hours: 2,
};

describe('where a series is read from', () => {
  it('is what it names, else a weather’s forecast, a list it names or holds, else its history', () => {
    const attributes = STATES[0]!.attributes;
    expect(sourceOf({ entity: 'weather.home' })).toBe('forecast');
    expect(sourceOf({ entity: 'sensor.solcast', attribute: 'detailedForecast' })).toBe('attribute');
    expect(sourceOf({ entity: 'sensor.nordpool' }, attributes)).toBe('attribute');
    expect(sourceOf({ entity: 'sensor.temperature' }, {})).toBe('history');
    expect(sourceOf({ entity: 'sensor.nordpool', source: 'statistics' }, attributes)).toBe(
      'statistics',
    );
  });

  it('reads a config’s series as items, six at most, an id alone as its entity', () => {
    const series = seriesOf({
      series: ['sensor.a', { entity: 'sensor.b', name: 'B' }, '', { name: 'no entity' }, 7],
    });
    expect(series).toEqual([{ entity: 'sensor.a' }, { entity: 'sensor.b', name: 'B' }]);
    expect(seriesOf({ series: Array.from({ length: 9 }, (_u, i) => `sensor.${i}`) })).toHaveLength(
      6,
    );
  });

  it('knows a price by its unit or its class', () => {
    expect(isPrice('EUR/kWh')).toBe(true);
    expect(isPrice('€/kWh')).toBe(true);
    expect(isPrice('c/kWh')).toBe(true);
    expect(isPrice('kWh')).toBe(false);
    expect(isPrice('°C')).toBe(false);
    expect(isPrice('', 'monetary')).toBe(true);
  });
});

describe('the window', () => {
  const now = new Date(NOW);
  const hass = house();

  it('reads a span as the card says it, else the last 24 hours', () => {
    expect(spanOf('today')).toEqual({ kind: 'today', hours: 24 });
    expect(spanOf('today + tomorrow')).toEqual({ kind: 'today+tomorrow', hours: 48 });
    expect(spanOf('7d')).toEqual({ kind: 'rolling', hours: 168 });
    expect(spanOf('12h')).toEqual({ kind: 'rolling', hours: 12 });
    expect(spanOf('nonsense')).toEqual({ kind: 'rolling', hours: 24 });
    expect(spanOf('5000d').hours).toBe(90 * 24);
  });

  it('rolls up to now, or runs over the house’s day — today and tomorrow once tomorrow is published', () => {
    expect(windowOf(spanOf('24h'), now, hass)).toEqual({
      start: now.getTime() - 24 * HOUR,
      end: now.getTime(),
      now: now.getTime(),
    });
    expect(windowOf(spanOf('today'), now, hass)).toMatchObject({
      start: MIDNIGHT,
      end: MIDNIGHT + 24 * HOUR,
    });
    const both = spanOf('today+tomorrow');
    expect(windowOf(both, now, hass, MIDNIGHT + 30 * HOUR).end).toBe(MIDNIGHT + 48 * HOUR);
    expect(windowOf(both, now, hass, MIDNIGHT + 23 * HOUR).end).toBe(MIDNIGHT + 24 * HOUR);
    expect(windowOf(both, now, hass).end).toBe(MIDNIGHT + 24 * HOUR);
  });
});

describe('the slots', () => {
  const window = { start: MIDNIGHT, end: MIDNIGHT + 4 * HOUR };
  const prices: Reading[] = [0.1, 0.2, 0.3, 0.4].map((v, q) => ({
    t: MIDNIGHT + q * QUARTER,
    v,
    end: MIDNIGHT + (q + 1) * QUARTER,
  }));

  it('read what was in force across each: an hour’s quarters their mean, a gap where nothing was', () => {
    expect(slotted(prices, window, 4, { hold: QUARTER })).toEqual([0.25, null, null, null]);
    expect(slotted(prices, window, 16, { hold: QUARTER }).slice(0, 5)).toEqual([
      0.1,
      0.2,
      0.3,
      0.4,
      null,
    ]);
  });

  it('hold the recorder’s readings until the next, never past now', () => {
    const states: Reading[] = [
      { t: MIDNIGHT, v: 20 },
      { t: MIDNIGHT + 2 * HOUR, v: 22 },
    ];
    expect(slotted(states, window, 4, { hold: Infinity, until: MIDNIGHT + 3 * HOUR })).toEqual([
      20,
      20,
      22,
      null,
    ]);
  });

  it('read a meter’s gain in each, a reset as what it shows since', () => {
    const meter: Reading[] = [10, 11, 13, 1].map((v, h) => ({ t: MIDNIGHT + h * HOUR, v }));
    expect(gains(meter, window, 3, { hold: Infinity, until: window.end }, true)).toEqual([1, 2, 1]);
  });

  it('know a list’s step: its entries’ own end, else the usual distance between them', () => {
    expect(stepOf(prices)).toBe(QUARTER);
    expect(stepOf([0, 1, 2, 4].map((h) => ({ t: h * HOUR, v: 1 })))).toBe(HOUR);
  });
});

describe('the marked windows', () => {
  it('find the lowest and the highest mean of a run of whole readings, from a slot on', () => {
    const values = [5, 1, 1, 4, null, 0, 9, 9];
    expect(windowAt(values, 2, 'min')).toEqual({ start: 1, mean: 1 });
    expect(windowAt(values, 2, 'max')).toEqual({ start: 6, mean: 9 });
    expect(windowAt(values, 2, 'min', 3)).toEqual({ start: 5, mean: 4.5 });
    expect(windowAt(values, 9, 'min')).toBeNull();
  });

  it('are the style’s where the card names none: step marks both, the others none', () => {
    expect(defaultWindows('step')).toBe('both');
    expect(defaultWindows('soft')).toBe('none');
    expect(defaultWindows(undefined)).toBe('none');
  });
});

describe('the Chart card’s height at a 360 column', () => {
  it('is its variant’s and its series count’s alone: 320, 364 with a legend of four or more, 240, 168', () => {
    const height = (config: Record<string, unknown>) =>
      chartHeight({ type: 'custom:fluvy-chart-card', ...config });
    const four = { series: ['a', 'b', 'c', 'd'] };
    expect(height({})).toBe(320);
    expect(height({ series: ['a', 'b', 'c'] })).toBe(320);
    expect(height(four)).toBe(364);
    expect(height({ ...four, show_legend: false })).toBe(320);
    expect(height({ ...four, variant: 'compact' })).toBe(240);
    expect(height({ ...four, variant: 'tile' })).toBe(168);
    expect(FluvyChartCard.layoutHeight({ type: 'custom:fluvy-chart-card' })).toBe(320);
  });

  it('keeps it loading, empty and out of reach, the chart’s room its 120', async () => {
    for (const series of [['sensor.cellar'], ['sensor.gone'], ['sensor.temperature']]) {
      const card = await draw({ series });
      expect(card.getCardSize()).toBe(6);
      const chart = root(card).querySelector<HTMLElement>('.ch-chart');
      expect(chart?.style.height).toBe('120px');
    }
  });
});

describe('the Chart card’s stub', () => {
  it('takes a sensor that holds a list (its day and tomorrow), else the first sensor', () => {
    const hass = house();
    expect(
      FluvyChartCard.getStubConfig(hass, ['light.a', 'sensor.temperature', 'sensor.nordpool']),
    ).toEqual({
      type: 'custom:fluvy-chart-card',
      series: ['sensor.nordpool'],
      span: 'today+tomorrow',
    });
    expect(FluvyChartCard.getStubConfig(hass, ['light.a', 'sensor.temperature']).series).toEqual([
      'sensor.temperature',
    ]);
    expect(FluvyChartCard.getStubConfig(hass, ['light.a']).series).toEqual([]);
  });
});

describe('a price list: Nordpool today and tomorrow', () => {
  it('draws its line again in each threshold’s tone where it crosses it', async () => {
    const card = await draw(NORDPOOL);
    const runs = [...root(card).querySelectorAll('.fc-run')].map(
      (run) => run.parentElement?.getAttribute('class') ?? '',
    );
    expect(new Set(runs)).toEqual(new Set(['fv-tone--warning', 'fv-tone--danger']));
    // the past solid, what is to come dashed from now
    expect(root(card).querySelector('.fc-line')).not.toBeNull();
    expect(root(card).querySelector('.fc-future')).not.toBeNull();
    expect(root(card).querySelector('.fc-now')).not.toBeNull();
  });

  it('steps never narrower than 6: a phone’s card reads the quarters by the hour, a wide one keeps them', async () => {
    const steps = async (width: number): Promise<number[]> => {
      const card = await draw(NORDPOOL, house(), width);
      const d = root(card).querySelector('.fc-line:not(.fc-run)')?.getAttribute('d') ?? '';
      expect(d.match(/M/g)).toHaveLength(1);
      const xs = (d.match(/H[\d.]+/g) ?? []).map((h) => Number(h.slice(1)));
      return xs.slice(1).map((x, i) => x - (xs[i] as number));
    };
    const phone = await steps(360);
    expect(Math.min(...phone)).toBeGreaterThanOrEqual(6);
    // two days of quarters across a wide card: 192 slots, each still 6 or more
    const wide = await steps(1400);
    expect(Math.min(...wide)).toBeGreaterThanOrEqual(6);
    expect(wide.length).toBeGreaterThan(3 * phone.length);
  });

  it('says the day of a midnight between its axis’s ends', async () => {
    // the axis's marks are the browser's clock: a house on it, not the server's
    const local = {
      ...house(),
      locale: { language: 'en', number_format: 'language', time_format: '24' },
    };
    const card = await draw(NORDPOOL, local as HomeAssistant);
    expect(texts(card, '.ch-axis .fv-axis > *')).toEqual(['Thu 00:00', 'Fri 00:00', 'Sat 00:00']);
  });

  it('raises its plot under the value row, which reads the chart with it: no bubble over the row', async () => {
    // the chart read at its start by the keys: where the plot's top is, what says the moment
    const read = async (config: Record<string, unknown>) => {
      const card = await draw(config);
      root(card)
        .querySelector('.ch-chart')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
      await card.updateComplete;
      const grid = [...root(card).querySelectorAll('.fc-grid')].map((g) =>
        Number(g.getAttribute('y1')),
      );
      return {
        top: Math.min(...grid),
        label: texts(card, '.ch-now .fv-readout__label'),
        bubble: texts(card, '.ch-chart > .fv-bubble'),
        when: texts(card, '.ch-axis.is-reading > .ch-when'),
      };
    };
    const head = await read(NORDPOOL);
    expect(head).toMatchObject({ label: ['00:00'], bubble: [], when: [] });
    expect(head.top).toBeLessThan(16);
    // the marked windows' pills alone leave the bubble its room, under them; without a row, the chart's own
    for (const bare of [{ show_head: false }, { show_head: false, highlight: 'none' }]) {
      const got = await read({ ...NORDPOOL, ...bare });
      expect(got.bubble).toHaveLength(1);
      expect(got.bubble[0]).toMatch(/00:00$/);
      expect(got.top).toBeGreaterThanOrEqual(44);
    }
    // two series' lines in the row read each: when that is goes on the axis, under the cursor
    const two = await read({ ...NORDPOOL, series: ['sensor.nordpool', 'sensor.temperature'] });
    expect(two).toMatchObject({ bubble: [], when: ['00:00'] });
  });

  it('marks the cheapest and the dearest two hours of what is to come, and names them', async () => {
    const card = await draw(NORDPOOL);
    const stretches = [...root(card).querySelectorAll('.fc-stretch')];
    expect(stretches.map((s) => s.parentElement?.getAttribute('class'))).toEqual([
      'fv-tone--ok',
      'fv-tone--danger',
    ]);
    // tomorrow's 13:00 and 19:00: past today's, which have happened
    expect(texts(card, '.ch-side .fc-pill')).toEqual([
      'Cheapest Fri 13:00–15:00 · 0.020 EUR/kWh',
      'Priciest Fri 19:00–21:00 · 0.340 EUR/kWh',
    ]);
    // the reading now (its quarter's, 21:45), big, in the list's own decimals
    expect(texts(card, '.ch-now .fv-readout__value')[0]?.replace(/\s+/g, '')).toBe('0.123EUR/kWh');
  });

  it('before tomorrow is published: today alone, marked across the whole of it', async () => {
    const card = await draw({
      ...NORDPOOL,
      series: [{ entity: 'sensor.nordpool_morning', tone: 'ok' }],
    });
    expect(texts(card, '.fv-card__sub')).toEqual(['Today']);
    expect(texts(card, '.ch-side .fc-pill')).toEqual([
      'Cheapest 13:00–15:00 · 0.020 EUR/kWh',
      'Priciest 19:00–21:00 · 0.340 EUR/kWh',
    ]);
  });

  it('marks nothing over several series, whose legend says each', async () => {
    const card = await draw({
      ...NORDPOOL,
      series: ['sensor.nordpool', 'sensor.temperature'],
    });
    expect(root(card).querySelector('.fc-stretch')).toBeNull();
    expect(texts(card, '.ch-lines .fc-legend__name')).toEqual(['nordpool', 'temperature']);
  });
});

describe('a sensor’s history', () => {
  it('is asked from as far before its window as the period it is compared with, and says its change', async () => {
    const asked: Asked = { messages: [], subscriptions: [] };
    // a moment of its own: the page's one cache has the sheets' evening already
    const at = '2026-09-18T09:00:00Z';
    const card = await draw({ series: ['sensor.temperature'], _now: at }, house(asked));
    const history = asked.messages.find((m) => m['type'] === 'history/history_during_period');
    expect(Date.parse(String(history?.['start_time']))).toBe(Date.parse(at) - 48 * HOUR);
    expect(texts(card, '.ch-delta')).toEqual(['+5 %']);
    expect(root(card).querySelector('.curve-line')).not.toBeNull();
  });

  it('with nothing in its window: the empty panel in the chart’s room', async () => {
    const card = await draw({ series: ['sensor.cellar'] });
    expect(texts(card, '.ch-empty .fv-empty')).toEqual(['Nothing to chart in this window']);
  });
});

describe('a weather’s forecast', () => {
  it('is subscribed by the hour and drawn as what is to come', async () => {
    const asked: Asked = { messages: [], subscriptions: [] };
    const card = await draw(
      { series: ['weather.home'], span: 'today+tomorrow', chart: 'soft' },
      house(asked),
    );
    expect(asked.subscriptions).toContainEqual({
      type: 'weather/subscribe_forecast',
      forecast_type: 'hourly',
      entity_id: 'weather.home',
    });
    expect(root(card).querySelector('.fc-future')).not.toBeNull();
    // the reading now is the weather's own
    expect(texts(card, '.ch-now .fv-readout__value')[0]?.replace(/\s+/g, '')).toBe('16.8°C');
  });
});

describe('out of reach', () => {
  it('keeps its anatomy in the off skin: the state under the title, the reading a dash', async () => {
    const card = await draw({ series: ['sensor.gone'], span: 'today' });
    expect(root(card).querySelector('.fv-card.is-unavailable')).not.toBeNull();
    expect(texts(card, '.fv-card__sub')).toEqual(['Unavailable']);
    expect(texts(card, '.ch-now .fv-readout__value')).toEqual(['—']);
    expect(root(card).querySelector('.ch-empty')).not.toBeNull();
    expect(root(card).querySelector('.ch-axis .fv-axis')).not.toBeNull();
  });
});

describe('the variants', () => {
  it('compact: the head, the chart and its axis; the tile: the reading over its spark', async () => {
    const compact = await draw({ ...NORDPOOL, variant: 'compact' });
    expect(root(compact).querySelector('.ch-top')).toBeNull();
    expect(root(compact).querySelector('.ch-chart')).not.toBeNull();
    const tile = await draw({ series: ['sensor.temperature'], variant: 'tile' });
    expect(root(tile).querySelector('.fv-tile .ch-spark svg')).not.toBeNull();
    expect(texts(tile, '.fv-readout__value')[0]?.replace(/\s+/g, '')).toBe('21.4°C');
  });

  it('gives the chart the value row’s room where the row has nothing to say', async () => {
    const card = await draw({ series: ['sensor.temperature'], show_head: false });
    expect(root(card).querySelector('.ch-top')).toBeNull();
    expect(root(card).querySelector<HTMLElement>('.ch-chart')?.style.height).toBe('200px');
  });
});

describe('the Chart card’s editor', () => {
  it('offers the now marker only where the window runs past now', () => {
    expect(capsIn({ series: ['sensor.temperature'] }).now).toBe(false);
    expect(capsIn({ series: ['sensor.temperature'], span: 'today' }).now).toBe(true);
    expect(capsIn({ series: ['weather.home'] }).now).toBe(true);
    expect(capsIn({ series: ['a', 'b'] }).several).toBe(true);
  });

  it('shows the windows a stepped chart marks by default, and the style’s highlight never', () => {
    const defaults = FluvyChartCard.defaults?.({ type: 'x', chart: 'step' }, undefined) ?? {};
    expect(defaults['highlight']).toBe('both');
    const names = JSON.stringify(FluvyChartCard.getConfigForm().schema);
    expect(names.match(/"name":"highlight"/g)).toHaveLength(1);
  });
});
