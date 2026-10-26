// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { balanceHeight, flowHeight, sankeyHeight, scoreHeight } from '../energy-family.js';
import type { EnergyCollectionLike, EnergyDataLike } from '../energy-model/collection.js';
import { allocatePeriod, houseMidnight } from '../energy-model/period.js';
import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import { familiesDefined } from '../index.js';

// the energy family lands with the index: the cards' tags are defined before a page needs them
await familiesDefined;

/** The flow sheet's Energy dashboard: a grid with import and export, an array, a battery. */
const PREFS: EnergyPrefs = {
  energy_sources: [
    { type: 'grid', stat_energy_from: 'sensor.in', stat_energy_to: 'sensor.out' },
    { type: 'solar', stat_energy_from: 'sensor.sun' },
    { type: 'battery', stat_energy_from: 'sensor.discharged', stat_energy_to: 'sensor.charged' },
  ],
  device_consumption: [],
};

/** A day in four buckets (night, morning, afternoon, evening), as Home Assistant fetched them for the picker. */
const DAY = Date.parse('2026-09-16T22:00:00Z');
const rows = (values: readonly number[]) =>
  values.map((change, i) => ({
    start: DAY + i * 6 * 3_600_000,
    end: DAY + (i + 1) * 6 * 3_600_000,
    change,
  }));
const STATS = {
  'sensor.in': rows([2.0, 0.3, 0, 1.8]),
  'sensor.out': rows([0, 0.4, 0.9, 0]),
  'sensor.sun': rows([0, 4.0, 7.2, 0]),
  'sensor.discharged': rows([1.4, 0, 0, 1.0]),
  'sensor.charged': rows([0, 1.6, 1.4, 0]),
};

type Element = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** The meters as sensors, so no card reports one unavailable. */
const meter = (id: string, state: string) => ({
  entity_id: id,
  state,
  attributes: {
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  },
  last_changed: new Date().toISOString(),
  last_updated: new Date().toISOString(),
});

const HOUSE = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
  config: { time_zone: 'Europe/Madrid', currency: 'EUR' },
  states: Object.fromEntries(Object.keys(STATS).map((id, i) => [id, meter(id, String(100 + i))])),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  callWS: async (message: { type: string }) => (message.type === 'energy/get_prefs' ? PREFS : {}),
};

/** A picker's collection on today, holding Home Assistant's figures, counting who holds it. */
function picker() {
  const now = new Date();
  const start = houseMidnight(HOUSE as unknown as HomeAssistant, now);
  const state: EnergyDataLike = {
    start,
    end: new Date(start.getTime() + 86_400_000 - 1),
    prefs: PREFS,
    info: { cost_sensors: {} },
    stats: STATS,
  };
  const collection = {
    start: state.start,
    end: state.end,
    state,
    subscribed: 0,
    subscribe() {
      collection.subscribed++;
      return () => {};
    },
    setPeriod() {},
    setCompare() {},
    refresh() {},
  } satisfies EnergyCollectionLike & Record<string, unknown>;
  return collection;
}

const hassWith = (collection: unknown): HomeAssistant =>
  ({ ...HOUSE, connection: { _energy_t: collection } }) as unknown as HomeAssistant;

async function mount(tag: string, config: Record<string, unknown>, hass: HomeAssistant) {
  const card = document.createElement(tag) as Element;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  // the preferences arrive a tick later, then the picker's figures are allocated
  await new Promise((resolve) => setTimeout(resolve, 20));
  await card.updateComplete;
  return card;
}

const text = (card: Element): string =>
  (card.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => {
  document.body.innerHTML = '';
});

/** What the picker's figures add up to: the house used 13.4 kWh (the Energy dashboard's arithmetic). */
const EXPECTED = allocatePeriod(STATS, readPrefs(PREFS).sources);

describe('the period cards following a date picker', () => {
  it('the figures are allocatePeriod’s over the picker’s statistics, the chips are gone, the subtitle is the range', async () => {
    expect(EXPECTED.allocation.usedTotal).toBeCloseTo(13.4, 5);
    const collection = picker();
    const hass = hassWith(collection);
    for (const [tag, config] of [
      ['fluvy-energy-flow-card', { period: 'day', collection_key: 'energy_t' }],
      ['fluvy-energy-balance-card', { period: 'day', collection_key: 'energy_t' }],
      ['fluvy-energy-sankey-card', { collection_key: 'energy_t' }],
      ['fluvy-energy-score-card', { collection_key: 'energy_t' }],
    ] as const) {
      const card = await mount(tag, config, hass);
      expect(card.shadowRoot?.querySelector('.en-period'), `${tag}: no chips`).toBeNull();
      // the sankey's line carries its total after the range
      expect(card.shadowRoot?.querySelector('.fv-card__sub')?.textContent?.trim(), tag).toMatch(
        /^Today( · |$)/,
      );
      if (tag !== 'fluvy-energy-score-card')
        expect(text(card), `${tag}: the house's 13.4 kWh`).toMatch(/13[.,]4\s?kWh/);
    }
    // four cards, one subscription each, and nothing asked of our own for the figures
    expect(collection.subscribed).toBe(4);
  });

  it('a card keeps its one subscription across updates and lets it go off the page', async () => {
    const collection = picker();
    const card = await mount(
      'fluvy-energy-flow-card',
      { period: 'day', collection_key: 'energy_t' },
      hassWith(collection),
    );
    card.hass = hassWith(collection);
    await card.updateComplete;
    card.hass = hassWith(collection);
    await card.updateComplete;
    expect(collection.subscribed).toBe(1);
  });

  it('a key that is not a collection key is a readable error, as Home Assistant’s cards throw', () => {
    const card = document.createElement('fluvy-energy-flow-card') as Element;
    expect(() =>
      card.setConfig({ type: 'custom:fluvy-energy-flow-card', period: 'day', collection_key: 't' }),
    ).toThrow(/collection_key.*energy_/);
  });

  it('declares the chip-less height while following, whatever show_period says', () => {
    expect(flowHeight({ type: 'x', period: 'day', collection_key: 'energy_t' })).toBe(
      flowHeight({ type: 'x', period: 'day', show_period: false }),
    );
    expect(balanceHeight({ type: 'x', period: 'day', collection_key: 'energy_t' })).toBe(
      balanceHeight({ type: 'x', period: 'day', show_period: false }),
    );
    expect(sankeyHeight({ type: 'x', collection_key: 'energy_t' })).toBe(
      sankeyHeight({ type: 'x', show_period: false }),
    );
    expect(scoreHeight({ type: 'x', collection_key: 'energy_t' })).toBe(
      scoreHeight({ type: 'x', show_period: false }),
    );
    expect(flowHeight({ type: 'x', period: 'day' })).toBe(
      flowHeight({ type: 'x', period: 'day', collection_key: 'energy_t' }) + 60,
    );
  });
});
