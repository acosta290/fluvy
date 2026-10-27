// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { periodHeight } from '../energy-family.js';
import type {
  CompareMode,
  EnergyCollectionLike,
  EnergyDataLike,
} from '../energy-model/collection.js';
import { familiesDefined } from '../index.js';
import { FluvyEnergyPeriodCard } from './energy-period-card.js';
import { presetSpan, shiftSpan, type Preset, type Span } from './picker.js';

// the card's chunk lands with the index, the energy family's words with it
await familiesDefined;

/** Thursday 17 September 2026, 21:47 in Madrid. */
const NOW = '2026-09-17T19:47:12Z';
const KEY = 'energy_energy-test';

const HOUSE = {
  language: 'en',
  locale: { language: 'en', time_zone: 'server', first_weekday: 'monday' },
  config: { time_zone: 'Europe/Madrid' },
  panelUrl: 'energy-test',
  states: {},
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  callWS: async () => ({ energy_sources: [], device_consumption: [] }),
};

const span = (preset: Preset): Span => presetSpan(HOUSE as never, preset, new Date(NOW));

/** A collection as Home Assistant keeps one: it moves when set, tells its subscribers when refreshed. */
function collectionOn(at: Span) {
  const subscribers = new Set<(data: EnergyDataLike) => void>();
  const periods: Span[] = [];
  const compares: CompareMode[] = [];
  let refreshed = 0;
  const collection = {
    start: at.start,
    end: at.end as Date | undefined,
    compare: '' as CompareMode | undefined,
    get state(): EnergyDataLike {
      return {
        start: collection.start,
        ...(collection.end ? { end: collection.end } : {}),
        prefs: { energy_sources: [] },
        stats: {},
      };
    },
    subscribe(subscriber: (data: EnergyDataLike) => void) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    setPeriod(start: Date, end?: Date) {
      collection.start = start;
      collection.end = end;
      periods.push({ start, end: end as Date });
    },
    setCompare(compare: CompareMode) {
      collection.compare = compare;
      compares.push(compare);
    },
    refresh() {
      refreshed++;
      for (const subscriber of subscribers) subscriber(collection.state);
    },
    periods,
    compares,
    get refreshed() {
      return refreshed;
    },
    get subscribers() {
      return subscribers.size;
    },
  } satisfies EnergyCollectionLike & Record<string, unknown>;
  return collection;
}

type Collection = ReturnType<typeof collectionOn>;

const hassWith = (connection: Record<string, unknown>, more: object = {}): HomeAssistant =>
  ({ ...HOUSE, connection, ...more }) as unknown as HomeAssistant;

async function mount(config: Record<string, unknown>, hass: HomeAssistant) {
  const card = document.createElement('fluvy-energy-period-card');
  card.setConfig({ type: 'custom:fluvy-energy-period-card', _now: NOW, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
  return card;
}

const root = (card: FluvyEnergyPeriodCard): ShadowRoot => card.shadowRoot as ShadowRoot;
/** A button by its name (the span's own words aside: "Today" is the Today button's). */
const button = (card: FluvyEnergyPeriodCard, label: string): HTMLButtonElement => {
  const found = [...root(card).querySelectorAll<HTMLButtonElement>('button:not(.ep-date)')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no button "${label}"`);
  return found;
};
const date = (card: FluvyEnergyPeriodCard): string =>
  root(card).querySelector('.ep-date')?.textContent?.trim() ?? '';
const iso = ({ start, end }: Span): [string, string] => [start.toISOString(), end.toISOString()];

async function tap(card: FluvyEnergyPeriodCard, label: string): Promise<void> {
  button(card, label).click();
  await card.updateComplete;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.innerHTML = '';
  delete (window as { loadCardHelpers?: unknown }).loadCardHelpers;
});

describe('the Energy period card drives the collection', () => {
  it('walks a day: ‹ to yesterday, › back, Today from anywhere — setPeriod, then refresh', async () => {
    const collection = collectionOn(span('today'));
    const card = await mount({}, hassWith({ [`_${KEY}`]: collection }));
    expect(date(card)).toBe('Today');
    // nothing after today to walk to
    expect(button(card, 'Next period').disabled).toBe(true);
    expect(button(card, 'Today').disabled).toBe(true);
    await tap(card, 'Previous period');
    expect(iso(collection.periods.at(-1)!)).toEqual(iso(span('yesterday')));
    expect(collection.refreshed).toBe(1);
    expect(date(card)).toBe('Yesterday');
    await tap(card, 'Previous period');
    await tap(card, 'Today');
    expect(iso(collection.periods.at(-1)!)).toEqual(iso(span('today')));
    expect(collection.refreshed).toBe(3);
    expect(localStorage.getItem(`energy-default-period-_${KEY}`)).toBe('today');
  });

  it('walks a week, a month and a year by their grain', async () => {
    for (const preset of ['this_week', 'this_month', 'this_year'] as const) {
      const collection = collectionOn(span(preset));
      const card = await mount({}, hassWith({ [`_${KEY}`]: collection }));
      await tap(card, 'Previous period');
      expect(iso(collection.periods.at(-1)!), preset).toEqual(
        iso(shiftSpan(HOUSE as never, span(preset), -1)),
      );
      await tap(card, 'Next period');
      expect(iso(collection.periods.at(-1)!), preset).toEqual(iso(span(preset)));
      card.remove();
    }
  });

  it('picks a grain’s current span from the stacked chips and remembers Home Assistant’s word for it', async () => {
    const collection = collectionOn(span('yesterday'));
    const card = await mount({ variant: 'stacked' }, hassWith({ [`_${KEY}`]: collection }));
    const chips = [...root(card).querySelectorAll('.fv-chip')].map((c) => c.textContent?.trim());
    expect(chips).toEqual(['Day', 'Week', 'Month', 'Year']);
    // yesterday is a day: Day is lit
    expect(root(card).querySelector('.fv-chip.is-active')?.textContent?.trim()).toBe('Day');
    await tap(card, 'Month');
    expect(iso(collection.periods.at(-1)!)).toEqual(iso(span('this_month')));
    expect(localStorage.getItem(`energy-default-period-_${KEY}`)).toBe('this_month');
    expect(root(card).querySelector('.fv-chip.is-active')?.textContent?.trim()).toBe('Month');
  });

  it('compares with the period before, and stops', async () => {
    const collection = collectionOn(span('today'));
    const card = await mount({ show_compare: true }, hassWith({ [`_${KEY}`]: collection }));
    await tap(card, 'Compare with the period before');
    expect(collection.compares).toEqual(['previous']);
    expect(button(card, 'Compare with the period before').getAttribute('aria-pressed')).toBe(
      'true',
    );
    await tap(card, 'Compare with the period before');
    expect(collection.compares).toEqual(['previous', '']);
    expect(collection.refreshed).toBe(2);
  });

  it('opens its sheet on the span: the presets of its periods, one tap picks and closes', async () => {
    const collection = collectionOn(span('today'));
    const card = await mount(
      { periods: ['week', 'month', 'custom'] },
      hassWith({ [`_${KEY}`]: collection }),
    );
    root(card).querySelector<HTMLButtonElement>('.ep-date')!.click();
    await card.updateComplete;
    const sheet = root(card).querySelector('dialog .ep-sheet')!;
    expect([...sheet.querySelectorAll('.fv-chip')].map((c) => c.textContent?.trim())).toEqual([
      'This week',
      'This month',
      'Custom',
    ]);
    [...sheet.querySelectorAll<HTMLButtonElement>('.fv-chip')][1]!.click();
    await card.updateComplete;
    expect(iso(collection.periods.at(-1)!)).toEqual(iso(span('this_month')));
    expect(localStorage.getItem(`energy-default-period-_${KEY}`)).toBe('this_month');
  });

  it('follows the collection when Home Assistant’s own picker moves it', async () => {
    const collection = collectionOn(span('today'));
    const card = await mount({}, hassWith({ [`_${KEY}`]: collection }));
    collection.setPeriod(span('this_month').start, span('this_month').end);
    collection.refresh();
    await card.updateComplete;
    expect(date(card)).toBe('September');
  });

  it('moves the cards that follow the key with one pick', async () => {
    const collection = collectionOn(span('today'));
    const hass = hassWith({ [`_${KEY}`]: collection });
    const card = await mount({}, hass);
    const followers = [
      'fluvy-energy-flow-card',
      'fluvy-energy-sankey-card',
      'fluvy-energy-score-card',
    ].map((tag) => {
      const follower = document.createElement(tag) as HTMLElement & {
        setConfig(config: LovelaceCardConfig): void;
        hass: HomeAssistant;
        updateComplete: Promise<boolean>;
      };
      follower.setConfig({ type: `custom:${tag}`, period: 'day', collection_key: KEY, _now: NOW });
      follower.hass = hass;
      document.body.append(follower);
      return follower;
    });
    await Promise.all(followers.map((f) => f.updateComplete));
    expect(collection.subscribers).toBe(4);
    await tap(card, 'Previous period');
    await Promise.all(followers.map((f) => f.updateComplete));
    for (const follower of followers)
      expect(
        follower.shadowRoot?.querySelector('.fv-card__sub')?.textContent?.trim(),
        follower.localName,
      ).toMatch(/^Yesterday/);
  });

  it('lets the collection go off the page', async () => {
    const collection = collectionOn(span('today'));
    const card = await mount({}, hassWith({ [`_${KEY}`]: collection }));
    expect(collection.subscribers).toBe(1);
    card.remove();
    expect(collection.subscribers).toBe(0);
  });
});

describe('the collection, made by Home Assistant when none holds the key', () => {
  /** Home Assistant's date card as its helpers make it: connected with its `hass`, it asks for the collection. */
  class DateSelection extends HTMLElement {
    hass: HomeAssistant | undefined;
    config: Record<string, unknown> = {};
    updateComplete = Promise.resolve(true);
    setConfig(config: Record<string, unknown>): void {
      this.config = config;
    }
    connectedCallback(): void {
      const connection = this.hass?.connection as unknown as Record<string, unknown>;
      connection[`_${String(this.config['collection_key'])}`] ??= collectionOn(span('today'));
    }
  }
  if (!customElements.get('hui-energy-date-selection-card'))
    customElements.define('hui-energy-date-selection-card', DateSelection);

  it('asks Home Assistant’s helpers for its date card, hidden in the card, and follows what it makes', async () => {
    const asked: Record<string, unknown>[] = [];
    (window as { loadCardHelpers?: unknown }).loadCardHelpers = async () => ({
      createCardElement: (config: Record<string, unknown>) => {
        asked.push(config);
        const element = document.createElement('hui-energy-date-selection-card') as DateSelection;
        element.setConfig(config);
        return element;
      },
    });
    const connection: Record<string, unknown> = {};
    const card = await mount({}, hassWith(connection));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;
    expect(asked).toEqual([
      { type: 'energy-date-selection', collection_key: KEY, disable_compare: true },
    ]);
    const hidden = root(card).querySelector('.ep-owner');
    expect(hidden?.getAttribute('aria-hidden')).toBe('true');
    expect(hidden?.querySelector('hui-energy-date-selection-card')).not.toBeNull();
    const collection = connection[`_${KEY}`] as Collection;
    expect(collection.subscribers).toBe(1);
    expect(button(card, 'Previous period').disabled).toBe(false);
    // once: another hass makes nothing more
    card.hass = hassWith(connection);
    await card.updateComplete;
    expect(asked.length).toBe(1);
  });

  it('says it works only on a dashboard where Home Assistant’s helpers are not, at its height, its buttons off', async () => {
    const card = await mount({ show_compare: true }, hassWith({}));
    expect(date(card)).toBe('Only on a dashboard');
    for (const b of root(card).querySelectorAll<HTMLButtonElement>('.ep-row button'))
      expect(b.disabled, b.textContent ?? '').toBe(true);
    const unkeyed = await mount({}, hassWith({}, { panelUrl: undefined }));
    expect(date(unkeyed)).toBe('Only on a dashboard');
  });

  it('refuses a key Home Assistant would refuse', () => {
    const card = document.createElement('fluvy-energy-period-card');
    expect(() =>
      card.setConfig({ type: 'custom:fluvy-energy-period-card', collection_key: 'dashboard' }),
    ).toThrow(/collection_key.*energy_/);
  });
});

describe('its size', () => {
  it('declares 84, 60 and 136 on the 4 grid, the stacked row only with a grain to chip', () => {
    expect(periodHeight({ type: 'x' })).toBe(84);
    expect(periodHeight({ type: 'x', variant: 'compact' })).toBe(60);
    expect(periodHeight({ type: 'x', variant: 'stacked' })).toBe(136);
    expect(periodHeight({ type: 'x', variant: 'stacked', periods: ['custom'] })).toBe(84);
    expect(FluvyEnergyPeriodCard.layoutHeight({ type: 'x', variant: 'stacked' })).toBe(136);
  });

  it('takes the section’s width, half of it at least, and its stub is the dashboard’s own picker', () => {
    const card = document.createElement('fluvy-energy-period-card');
    expect(card.getGridOptions()).toEqual({ columns: 12, rows: 'auto', min_columns: 6 });
    expect(FluvyEnergyPeriodCard.getStubConfig()).toEqual({
      type: 'custom:fluvy-energy-period-card',
    });
    expect(() => card.setConfig(FluvyEnergyPeriodCard.getStubConfig())).not.toThrow();
  });
});
