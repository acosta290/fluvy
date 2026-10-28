// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  setChartDefaults,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { fitSet } from '../chart/engine/index.js';
import { familiesDefined } from '../index.js';
import { FluvyProductionCard, type ProductionCardConfig } from './production-card.js';

// the energy family lands with the index: the card's tag is defined before a page needs it
await familiesDefined;

/** The house's moment, in UTC (the house's zone): 14:30, the day's fourteenth hour in progress. */
const NOW = '2026-09-17T14:30:00Z';
const MIDNIGHT = Date.parse('2026-09-17T00:00:00Z');
const HOUR = 3_600_000;
/** A sunny day's hours so far (kWh): nothing before six, a peak at noon. */
const DAY = [0, 0, 0, 0, 0, 0, 0.1, 0.4, 0.9, 1.4, 1.8, 2.1, 2.3, 2.0];

const meter = (name: string, state: number) => ({
  entity_id: name,
  state: String(state),
  attributes: {
    friendly_name: name,
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  },
  last_changed: '',
  last_updated: '',
});

/** A house whose recorder keeps every meter's hours (the day's, the second roof's at half of it), each read a little past its last hour now. */
const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
    config: { time_zone: 'UTC' },
    themes: { darkMode: false },
    states: {
      'sensor.pv': meter('sensor.pv', 103.4),
      'sensor.east': meter('sensor.east', 103.3),
      'sensor.west': meter('sensor.west', 96.6),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      const id = (message['statistic_ids'] as string[] | undefined)?.[0] ?? '';
      const share = id === 'sensor.west' ? 0.5 : 1;
      let state = 90;
      const rows = [-1, ...DAY.keys()].map((hour) => {
        const change = hour < 0 ? 0 : (DAY[hour] ?? 0) * share;
        state += change;
        return { start: MIDNIGHT + hour * HOUR, change, state };
      });
      return { [id]: rows };
    },
    callService: async () => undefined,
  }) as unknown as HomeAssistant;

const settle = async (card: FluvyProductionCard): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

async function mount(config: Partial<ProductionCardConfig>): Promise<FluvyProductionCard> {
  const card = document.createElement('fluvy-production-card') as FluvyProductionCard;
  card.setConfig({
    type: 'custom:fluvy-production-card',
    entity: 'sensor.pv',
    _now: NOW,
    ...config,
  });
  card.hass = house();
  document.body.append(card);
  await settle(card);
  return card;
}

const ARRAYS = { arrays: ['sensor.east', 'sensor.west'] };

afterEach(() => document.body.replaceChildren());

describe('the production card’s bars, in their styles', () => {
  it('draws classic as 1.10 did: the day’s bars, and the arrays’ stacks', async () => {
    const day = await mount({});
    const arrays = await mount(ARRAYS);
    // recorded on 1.10's card: each hour's bar, and each array's rectangle in its hour
    expect({
      day: [...day.shadowRoot!.querySelectorAll('.so-bar__fill')].map((b) =>
        b.getAttribute('style'),
      ),
      arrays: [...arrays.shadowRoot!.querySelectorAll('.pr-chart rect')].map((r) =>
        ['class', 'x', 'y', 'width', 'height', 'rx'].map((key) => r.getAttribute(key)).join(' '),
      ),
    }).toMatchSnapshot();
  });

  it('draws soft through the engine: an hour a bar, the best one in the ink and the rest quiet, now marked', async () => {
    const card = await mount({ chart: 'soft' });
    const root = card.shadowRoot!;
    expect(root.querySelector('.so-bars')).toBeNull();
    const bars = root.querySelectorAll('.pr-chart .fc-bar');
    // the finished hours with something in them, and the one in progress
    expect(bars.length).toBe(DAY.filter((kwh) => kwh > 0).length + 1);
    expect(root.querySelectorAll('.pr-chart .fc-bar--quiet').length).toBe(bars.length - 1);
    expect(root.querySelector('.pr-chart .fc-now')).not.toBeNull();
  });

  it('stacks the arrays as columns in the series’ colours, their legend’s squares in them', async () => {
    const card = await mount({ ...ARRAYS, chart: 'columns' });
    const root = card.shadowRoot!;
    const inks = [...root.querySelectorAll('.pr-chart g[style]')].map((g) =>
      g.getAttribute('style'),
    );
    expect(new Set(inks)).toEqual(
      new Set(['--tone-ink:var(--fluvy-graph-1)', '--tone-ink:var(--fluvy-graph-2)']),
    );
    expect(
      [...root.querySelectorAll('.pr-legend .en-sq')].map((sq) => sq.getAttribute('style')),
    ).toEqual([
      '--tone-ink:var(--fluvy-graph-1);background:var(--tone-ink)',
      '--tone-ink:var(--fluvy-graph-2);background:var(--tone-ink)',
    ]);
  });

  it('wears the house’s own set where it names one: each column and its square the set’s colour fitted to each mode', async () => {
    const colours = ['#1e3a8a', '#f4e9d0', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'] as const;
    setChartDefaults({
      settings: { ...CHART_DEFAULTS, style: 'columns', series: 'mine' },
      sets: [{ id: 'mine', name: 'Mine', colours }],
    });
    try {
      const root = (await mount(ARRAYS)).shadowRoot!;
      // no look runs here: the set is worn on the default palette
      const { light, dark } = fitSet(colours, 'linen');
      const worn = (n: number) => `--fc-light:${light[n]};--fc-dark:${dark[n]}`;
      expect(
        new Set(
          [...root.querySelectorAll('.pr-chart g.fc-set')].map((g) => g.getAttribute('style')),
        ),
      ).toEqual(new Set([worn(0), worn(1)]));
      expect(
        [...root.querySelectorAll('.pr-legend .en-sq.fc-set')].map((sq) =>
          sq.getAttribute('style'),
        ),
      ).toEqual([`${worn(0)};background:var(--tone-ink)`, `${worn(1)};background:var(--tone-ink)`]);
      // the navy lifted for the dark card, the cream deepened for the light one
      expect([dark[0] !== colours[0], light[1] !== colours[1]]).toEqual([true, true]);
    } finally {
      setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
    }
  });

  it('draws the arrays classic where the house is soft: soft is one meter’s', async () => {
    const card = await mount({ ...ARRAYS, chart: 'soft' });
    expect(card.shadowRoot!.querySelector('.pr-chart .fc-bar')).toBeNull();
    expect(card.shadowRoot!.querySelectorAll('.pr-chart rect.en-bar').length).toBeGreaterThan(0);
  });
});

describe('the production card’s editor', () => {
  const section = (FluvyProductionCard.getConfigForm().schema as HaFormSchemaItem[]).find(
    (item) => item.type === 'expandable' && item.schema?.some((field) => field.name === 'chart'),
  ) as HaFormSchemaItem;
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const shown = (data: Record<string, unknown>): string[] =>
    (section.schema ?? [])
      .filter((item) => !item.when || item.when(data))
      .flatMap((item) => fields([item]).filter((field) => !field.when || field.when(data)))
      .map(
        (field) =>
          `${field.name}${field.name === 'chart' ? `:${(field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value).join(',')}` : ''}`,
      );

  it('offers one meter classic, soft and columns, the arrays classic and columns, a highlight to soft alone', () => {
    expect(shown({})).toEqual(['chart:classic,soft,columns', 'animate']);
    expect(shown({ chart: 'soft' })).toEqual([
      'chart:classic,soft,columns',
      'show_now',
      'highlight',
      'animate',
    ]);
    expect(shown({ ...ARRAYS, chart: 'columns' })).toEqual([
      'chart:classic,columns',
      'show_now',
      'animate',
    ]);
  });
});
