// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usageHeight } from '../energy-family.js';
import type { EnergyCollectionLike, EnergyDataLike } from '../energy-model/collection.js';
import type { HeadFit } from '../energy/head.js';
import { allocatePeriod, clearPeriodCache } from '../energy-model/period.js';
import { readPrefs } from '../energy-model/prefs.js';
import { familiesDefined } from '../index.js';
import { FluvyEnergyUsageCard, type EnergyUsageCardConfig } from './energy-usage-card.js';

// the card's chunk lands with the index, the energy family's words with it
await familiesDefined;

const HOUR = 3_600_000;
/** Thursday 17 September 2026, 21:47 in Madrid: today from its midnight, the day before from the one before. */
const NOW = '2026-09-17T19:47:12Z';
const TODAY = Date.parse('2026-09-16T22:00:00Z');
const YESTERDAY = TODAY - 24 * HOUR;

const PREFS = {
  energy_sources: [
    { type: 'grid', stat_energy_from: 'sensor.in', stat_energy_to: 'sensor.out' },
    { type: 'solar', stat_energy_from: 'sensor.sun' },
    { type: 'battery', stat_energy_from: 'sensor.discharged', stat_energy_to: 'sensor.charged' },
  ],
  device_consumption: [],
};

/** What each meter gained in four hours of a day: the night on the grid, the sun at noon, the battery at dusk. */
const HOURS: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  'sensor.in': { 2: 0.5, 20: 0.4 },
  'sensor.out': { 13: 0.6 },
  'sensor.sun': { 12: 1.2, 13: 2.0 },
  'sensor.discharged': { 20: 0.7 },
  'sensor.charged': { 12: 0.3, 13: 0.5 },
};

/** A day's rows of a meter from its midnight: the day before has half of each. */
const rows = (id: string, midnight: number) =>
  Object.entries(HOURS[id] ?? {}).map(([hour, change]) => ({
    start: midnight + Number(hour) * HOUR,
    end: midnight + (Number(hour) + 1) * HOUR,
    change: midnight === TODAY ? change : change / 2,
  }));

const statistics = (message: Record<string, unknown>) => {
  const start = Date.parse(String(message['start_time']));
  return Object.fromEntries(
    ((message['statistic_ids'] as string[]) ?? []).map((id) => [id, rows(id, start)]),
  );
};

const meter = (id: string) => ({
  entity_id: id,
  state: '100',
  attributes: {
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  },
  last_changed: NOW,
  last_updated: NOW,
});

const HOUSE = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
  config: { time_zone: 'Europe/Madrid' },
  states: Object.fromEntries(Object.keys(HOURS).map((id) => [id, meter(id)])),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
};

/** The house on a connection of its own: the cards keep its preferences per connection. */
const hassWith = (more: object = {}, prefs: object = PREFS): HomeAssistant =>
  ({
    ...HOUSE,
    connection: {},
    callWS: async (message: Record<string, unknown>) =>
      message['type'] === 'energy/get_prefs'
        ? prefs
        : message['type'] === 'recorder/statistics_during_period'
          ? statistics(message)
          : {},
    ...more,
  }) as unknown as HomeAssistant;

type Card = FluvyEnergyUsageCard & { width: number };

async function mount(config: Record<string, unknown>, hass = hassWith()): Promise<Card> {
  const card = document.createElement('fluvy-energy-usage-card') as Card;
  card.setConfig({ type: 'custom:fluvy-energy-usage-card', _now: NOW, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  // the preferences, then the statistics, each a tick later
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await card.updateComplete;
  }
  return card;
}

const root = (card: Card): ShadowRoot => card.shadowRoot as ShadowRoot;
const legend = (card: Card) =>
  [...root(card).querySelectorAll('.en-legend__item')].map((item) => ({
    name: item.querySelector('.en-legend__text')?.textContent?.trim(),
    ink: [...(item.querySelector('.en-sq')?.classList ?? [])].find((c) => c.startsWith('en-ink--')),
    accent: item.getAttribute('data-accent'),
    out: item.querySelector('.en-sq')?.classList.contains('is-out') ?? false,
  }));
const badge = (card: Card): string =>
  root(card).querySelector('.fv-badge')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

afterEach(() => {
  document.body.innerHTML = '';
  clearPeriodCache();
});

describe('the Energy usage card', () => {
  it('draws today in hours from the Energy dashboard: the chips, the scale, the legend in the sources’ inks', async () => {
    const card = await mount({});
    expect(root(card).querySelector('.en-period')).not.toBeNull();
    expect(root(card).querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Today');
    // 24 hour slots, the columns stacked by source
    expect(root(card).querySelectorAll('.eu-chart .fc-bar').length).toBeGreaterThan(0);
    expect(root(card).querySelectorAll('.eu-chart .fc-bar--hanging').length).toBeGreaterThan(0);
    // one column a slot, its parts flush whatever the house's bars' ends: at 20:00 the battery's part under the grid's,
    // at 13:00 the charge between the line and the export, end square; only the outer ends are rounded
    const parts = [...root(card).querySelectorAll('.eu-chart .fc-bar')].map(
      (bar) => bar.getAttribute('d') ?? '',
    );
    expect(parts.filter((d) => d.includes('a0,0')).length).toBe(2);
    expect(parts.filter((d) => /a[1-9]/.test(d)).length).toBe(parts.length - 2);
    expect(legend(card)).toEqual([
      { name: 'Solar', ink: 'en-ink--solar', accent: null, out: false },
      { name: 'Battery', ink: 'en-ink--battery', accent: null, out: false },
      { name: 'Grid', ink: 'en-ink--grid', accent: null, out: false },
      { name: 'Charged', ink: 'en-ink--battery', accent: null, out: true },
      { name: 'Exported', ink: 'en-ink--grid', accent: null, out: true },
    ]);
    // what the house used today, the dashboard's arithmetic: 0.5 + 1.2 − 0.3 + 2.0 − 0.6 − 0.5 + 0.4 + 0.7
    expect(badge(card)).toBe('3.4 kWh');
    expect(root(card).querySelector('.eu-ghost')).toBeNull();
  });

  it('a source of the card’s own: its name, its colour, its place; a kind shown false is left out', async () => {
    const card = await mount({
      show_period: false,
      sources: [
        { type: 'grid', name: 'Utility', color: '#7c5cff' },
        { type: 'solar', show: false },
        'battery',
      ],
    });
    const items = legend(card);
    expect(items.map((item) => item.name)).toEqual(['Utility', 'Battery', 'Charged', 'Exported']);
    expect(items[0]?.ink).toBe('en-ink--accent');
    expect(items[0]?.accent).toBeTruthy();
    // the export wears the grid's colour too
    expect(items[3]?.accent).toBe(items[0]?.accent);
    expect(root(card).querySelector('.en-period')).toBeNull();
  });

  it('a source in a colour of the palette’s wears its token, its columns and its squares, what it exported too (1.11)', async () => {
    const card = await mount({
      show_period: false,
      sources: [{ type: 'grid', color: 'graph-5' }, 'solar', 'battery'],
    });
    const token = 'var(--fluvy-graph-5)';
    const squares = [...root(card).querySelectorAll('.en-legend__item')].map((item) => [
      item.querySelector('.en-legend__text')?.textContent?.trim(),
      item.querySelector('.en-sq')?.getAttribute('style') ?? null,
    ]);
    expect(squares).toEqual([
      ['Grid', `--ink:${token}`],
      ['Solar', null],
      ['Battery', null],
      ['Charged', null],
      ['Exported', `--ink:${token}`],
    ]);
    expect(
      [...root(card).querySelectorAll('.eu-chart g[style]')].some(
        (g) => g.getAttribute('style') === `--tone-ink:${token}`,
      ),
    ).toBe(true);
    // the editor offers the palette's colours by their words, and keeps a colour typed
    const field = JSON.stringify(FluvyEnergyUsageCard.lists[0]?.schema).match(
      /\{"name":"color".*?"helper":"[^"]+"\}/,
    )?.[0];
    const { selector, helper } = JSON.parse(field ?? '{}') as {
      selector: { select: { custom_value: boolean; options: { value: string }[] } };
      helper: string;
    };
    expect(selector.select.custom_value).toBe(true);
    expect(selector.select.options).toHaveLength(24);
    expect(helper).toBe('energy-usage.editor_color_helper');
  });

  it('offers classic and soft, and draws a config that names columns — the same look — as classic', async () => {
    const chart = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
      schema.flatMap((item) =>
        item.schema ? chart(item.schema) : item.name === 'chart' ? [item] : [],
      );
    const offered = chart(FluvyEnergyUsageCard.getConfigForm().schema).map((field) =>
      (field.selector?.['select'] as { options: { value: string }[] }).options.map(
        (option) => option.value,
      ),
    );
    // one select for the chart and the strip alike
    expect(offered).toEqual([['classic', 'soft']]);
    const drawn = async (style: string): Promise<string> =>
      (root(await mount({ chart: style })).querySelector('.eu-chart') as HTMLElement).outerHTML;
    expect(await drawn('columns')).toBe(await drawn('classic'));
  });

  it('draws the period before as ghost columns only when asked to compare', async () => {
    const plain = await mount({});
    expect(root(plain).querySelector('.eu-ghost')).toBeNull();
    const compared = await mount({ compare: true });
    // yesterday's four hours of use, and the two whose sun went out
    expect(root(compared).querySelectorAll('.eu-ghost').length).toBe(6);
  });

  it('reads a slot by the keys: its whole stack in the bubble, the slot before the period’s', async () => {
    const card = await mount({ compare: true });
    const chart = root(card).querySelector<HTMLElement>('.eu-chart') as HTMLElement;
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await card.updateComplete;
    for (let i = 0; i < 13; i++)
      chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await card.updateComplete;
    const lines = [...root(card).querySelectorAll('.eu-bubble__line')].map((line) =>
      [...line.children].map((part) => part.textContent?.trim()).join(' '),
    );
    // at one, the sun ran the house (2.0 less 0.6 exported and 0.5 charged), and half that the day before
    expect(lines).toEqual([
      '13:00 – 14:00 0.9 kWh',
      'Solar 0.9 kWh',
      'Charged 0.5 kWh',
      'Exported 0.6 kWh',
      'Yesterday 0.45 kWh',
    ]);
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await card.updateComplete;
    expect(root(card).querySelector('.eu-bubble')).toBeNull();
  });

  it('keeps its bubble inside a card of half a section: the time over its total, the parts’ figures bare', async () => {
    const card = await mount({ compare: true });
    // seven pixels a character, whatever the face: the layout is what is read here, not the font
    vi.spyOn((card as unknown as { head: HeadFit }).head.ruler, 'width').mockImplementation(
      (_cls, text) => text.length * 7,
    );
    card.width = 152;
    card.requestUpdate();
    await card.updateComplete;
    const chart = root(card).querySelector<HTMLElement>('.eu-chart') as HTMLElement;
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await card.updateComplete;
    for (let i = 0; i < 13; i++)
      chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await card.updateComplete;
    const bubble = root(card).querySelector<HTMLElement>('.eu-bubble') as HTMLElement;
    const lines = [...bubble.querySelectorAll('.eu-bubble__line')].map((line) => ({
      text: [...line.children].map((part) => part.textContent?.trim()).join(' '),
      stacked: line.classList.contains('is-stacked'),
    }));
    // the time over the slot's use, its unit said there once; "Charged 0.5 kWh" would not hold 120, so every part's
    // figure goes bare beside its name — and the day before, still too wide, puts its figure under its words
    expect(lines).toEqual([
      { text: '13:00 – 14:00 0.9 kWh', stacked: true },
      { text: 'Solar 0.9', stacked: false },
      { text: 'Charged 0.5', stacked: false },
      { text: 'Exported 0.6', stacked: false },
      { text: 'Yesterday 0.45', stacked: true },
    ]);
    // 112 of content: the bubble (24 + "Exported 0.6", 109) leans into the padding, never past 16 of it
    const left = parseFloat(bubble.style.left);
    expect(bubble.style.width).toBe('133px');
    expect(left).toBeGreaterThanOrEqual(-16);
    expect(left + 133).toBeLessThanOrEqual(128);
    // a reader still hears every figure with its unit
    expect(chart.getAttribute('aria-label')).toBe(
      '13:00 – 14:00: 0.9 kWh, Solar 0.9 kWh, Charged 0.5 kWh, Exported 0.6 kWh, Yesterday 0.45 kWh',
    );
  });

  it('writes two months under a year at least, however narrow: the first and the middle, else the ends', async () => {
    // the words `per` pixels a character
    const months = async (width: number, per = 7): Promise<string[]> => {
      const card = await mount({ period: 'year', variant: 'compact' });
      vi.spyOn((card as unknown as { head: HeadFit }).head.ruler, 'width').mockImplementation(
        (_cls, text) => text.length * per,
      );
      card.width = width;
      card.requestUpdate();
      await card.updateComplete;
      return [...root(card).querySelectorAll('.eu-axis span')].map(
        (label) => label.textContent?.trim() ?? '',
      );
    };
    // a full column: every other month, twelve slots of 24
    expect(await months(360)).toEqual(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
    // half a section: not even the first and the middle stand 12 apart, so the ends; where even those would crowd
    // (a wider face), their initials
    expect(await months(152)).toEqual(['Jan', 'Dec']);
    expect(await months(152, 10)).toEqual(['J', 'D']);
  });

  it('asks for the unit and the decimals the card asks for', async () => {
    const card = await mount({ unit: 'Wh', decimals: 0 });
    expect(badge(card)).toBe('3,400 Wh');
  });

  it('with no Energy dashboard says so', async () => {
    const card = await mount({}, hassWith({}, { energy_sources: [] }));
    expect(root(card).querySelector('.fv-empty-state')).not.toBeNull();
    expect(root(card).querySelector('.eu-chart')).toBeNull();
  });
});

describe('following a date picker', () => {
  /** A picker's collection on today, with Home Assistant's figures and, compared, the day before's. */
  function picker(compare: boolean) {
    const stats = Object.fromEntries(Object.keys(HOURS).map((id) => [id, rows(id, TODAY)]));
    const statsCompare = Object.fromEntries(
      Object.keys(HOURS).map((id) => [id, rows(id, YESTERDAY)]),
    );
    const state: EnergyDataLike = {
      start: new Date(TODAY),
      end: new Date(TODAY + 24 * HOUR - 1),
      prefs: PREFS,
      stats,
      ...(compare
        ? {
            startCompare: new Date(YESTERDAY),
            endCompare: new Date(TODAY - 1),
            statsCompare,
          }
        : {}),
    };
    return {
      start: state.start,
      end: state.end,
      compare: compare ? ('previous' as const) : ('' as const),
      state,
      subscribe: () => () => {},
      setPeriod: () => {},
      setCompare: () => {},
      refresh: () => {},
    } satisfies EnergyCollectionLike;
  }

  it('draws Home Assistant’s figures for the picker’s range, without its own chips, at the chip-less height', async () => {
    const asked: string[] = [];
    const hass = hassWith({ connection: { _energy_t: picker(false) } });
    const callWS = hass.callWS.bind(hass);
    hass.callWS = (async (message: Record<string, unknown>) => {
      asked.push(String(message['type']));
      return callWS(message as never);
    }) as typeof hass.callWS;
    const card = await mount({ collection_key: 'energy_t' }, hass);
    expect(root(card).querySelector('.en-period')).toBeNull();
    expect(root(card).querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Today');
    const used = allocatePeriod(picker(false).state.stats, readPrefs(PREFS).sources).allocation
      .usedTotal;
    expect(badge(card)).toBe(`${used.toFixed(1)} kWh`);
    // the picker's statistics are the card's: it asks the recorder nothing
    expect(asked).not.toContain('recorder/statistics_during_period');
    expect(FluvyEnergyUsageCard.layoutHeight({ type: '', collection_key: 'energy_t' })).toBe(
      usageHeight({ type: '', show_period: false }),
    );
  });

  it('draws the picker’s period before as ghosts while it compares, whatever the card’s own compare says', async () => {
    const card = await mount(
      { collection_key: 'energy_t', compare: false },
      hassWith({ connection: { _energy_t: picker(true) } }),
    );
    expect(root(card).querySelectorAll('.eu-ghost').length).toBe(6);
  });

  it('refuses a key that is not an Energy date picker’s', () => {
    const card = document.createElement('fluvy-energy-usage-card') as Card;
    expect(() =>
      card.setConfig({ type: 'custom:fluvy-energy-usage-card', collection_key: 'dashboard' }),
    ).toThrow(/energy_/);
  });
});

describe('its height and its stub', () => {
  it('declares what usageHeight counts, and draws from its stub', async () => {
    const configs: Partial<EnergyUsageCardConfig>[] = [
      {},
      { variant: 'compact' },
      { variant: 'mini' },
      { show_legend: false },
    ];
    for (const config of configs)
      expect(FluvyEnergyUsageCard.layoutHeight({ type: '', ...config })).toBe(
        usageHeight({ type: '', ...config }),
      );
    const card = await mount(FluvyEnergyUsageCard.getStubConfig() as Record<string, unknown>);
    expect(root(card).querySelector('.eu-chart')).not.toBeNull();
  });
});
