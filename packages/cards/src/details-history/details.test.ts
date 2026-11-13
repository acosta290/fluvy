// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  HOUSE_DEFAULTS,
  ORIGINAL_DETAILS,
  parseHouse,
  PERSONAL_DEFAULTS,
  resolveSettings,
  setChartDefaults,
  type HomeAssistant,
} from '@fluvy/core';
import { html, LitElement, type PropertyDeclarations } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  breakAt,
  bucketsOf,
  gainedSince,
  gainsIn,
  kindOf,
  reachOf,
  resetsOf,
  stretchesOf,
  timeOn,
  windowsOf,
} from './reads.js';
import { takeOverDetails } from './takeover.js';
import { FluvyDetailsHistory } from './view.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** The block's evening: Thursday 17 September 2026, 21:45 (UTC, the tests' zone). */
const NOW = Date.UTC(2026, 8, 17, 21, 45);
const TODAY = Date.UTC(2026, 8, 17);

/* ---------- a house: a meter reset at every midnight, a room's temperature, a door ---------- */

/** The meter at a moment: 0.1 kWh an hour from 08:00 to 18:00, back to 0 at midnight; yesterday's day gave 2. */
const meter = (t: number): number => {
  const hour = (t - (t >= TODAY ? TODAY : TODAY - 24 * HOUR)) / HOUR;
  const day = Math.min(10, Math.max(0, hour - 8)) / 10;
  return Math.round((t >= TODAY ? 1 : 2) * day * 1000) / 1000;
};
/** Its sum, which a reset never takes back. */
const sum = (t: number): number => meter(t) + (t >= TODAY ? 2 : 0);
const temperature = (t: number): number => 21 + Math.sin((t - TODAY) / (4 * HOUR));

/** The statistics of a window's buckets that have been compiled by now. */
function statistics(message: Record<string, unknown>): Record<string, unknown[]> {
  const step = message['period'] === '5minute' ? 5 * MINUTE : HOUR;
  const from = Math.ceil(Date.parse(String(message['start_time'])) / step) * step;
  const to = Math.min(Date.parse(String(message['end_time'])), NOW);
  const starts: number[] = [];
  for (let t = from; t + step <= to; t += step) starts.push(t);
  const id = (message['statistic_ids'] as string[])[0] as string;
  if (id === 'sensor.yield')
    return {
      [id]: starts.map((start) => ({
        start,
        end: start + step,
        state: meter(start + step - 1),
        change: Math.round((sum(start + step - 1) - sum(start - 1)) * 1000) / 1000,
      })),
    };
  if (id === 'sensor.room')
    return {
      [id]: starts.map((start) => ({
        start,
        end: start + step,
        mean: temperature(start),
        min: temperature(start) - 0.1,
        max: temperature(start) + 0.1,
      })),
    };
  return {};
}

/** The door: open twice today, for 10 minutes at 08:00 and 30 at 18:00. */
const door = (start: number): { s: string; lu: number }[] =>
  [
    { s: 'off', lu: start },
    { s: 'on', lu: TODAY + 8 * HOUR },
    { s: 'off', lu: TODAY + 8 * HOUR + 10 * MINUTE },
    { s: 'on', lu: TODAY + 18 * HOUR },
    { s: 'off', lu: TODAY + 18.5 * HOUR },
  ]
    .filter((row) => row.lu >= start)
    .map((row) => ({ s: row.s, lu: row.lu / 1000 }));

const asked: Record<string, unknown>[] = [];
const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { components: ['history', 'recorder'] },
    themes: { darkMode: false },
    states: {
      'sensor.yield': {
        entity_id: 'sensor.yield',
        state: '1.00',
        attributes: {
          friendly_name: 'Daily yield',
          unit_of_measurement: 'kWh',
          device_class: 'energy',
          state_class: 'total_increasing',
        },
        last_changed: '',
        last_updated: '',
      },
      'sensor.room': {
        entity_id: 'sensor.room',
        state: temperature(NOW).toFixed(1),
        attributes: {
          friendly_name: 'Living room',
          unit_of_measurement: '°C',
          device_class: 'temperature',
          state_class: 'measurement',
        },
        last_changed: '',
        last_updated: '',
      },
      'binary_sensor.door': {
        entity_id: 'binary_sensor.door',
        state: 'off',
        attributes: { friendly_name: 'Front door', device_class: 'door' },
        last_changed: new Date(TODAY + 18.5 * HOUR).toISOString(),
        last_updated: '',
      },
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      asked.push(message);
      if (message['type'] === 'recorder/statistics_during_period') return statistics(message);
      if (message['type'] === 'history/history_during_period')
        return { 'binary_sensor.door': door(Date.parse(String(message['start_time']))) };
      return {};
    },
    callService: async () => undefined,
  }) as unknown as HomeAssistant;

/** Our block for an entity, at the evening's clock, drawn once the recorder has answered. */
async function mount(
  entityId: string,
  o: { hours?: number; mode?: 'gains' | 'total' } = {},
): Promise<FluvyDetailsHistory> {
  const block = document.createElement('fluvy-details-history');
  block.now = NOW;
  if (o.hours) block.hours = o.hours;
  if (o.mode) block.mode = o.mode;
  block.hass = house();
  block.entityId = entityId;
  document.body.append(block);
  await block.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await block.updateComplete;
  return block;
}

const text = (root: ParentNode, selector: string): string[] =>
  [...root.querySelectorAll(selector)].map(
    (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute(ORIGINAL_DETAILS);
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('what the details dialog reads of an entity', () => {
  it('tells a measure, a meter and a thing’s states apart, as Home Assistant’s own block does', () => {
    const state = (attributes: Record<string, unknown>) =>
      ({ entity_id: 'x', state: '1', attributes, last_changed: '', last_updated: '' }) as never;
    expect(kindOf('sensor.room', state({ unit_of_measurement: '°C' }))).toBe('measure');
    expect(kindOf('sensor.yield', state({ state_class: 'total_increasing' }))).toBe('counter');
    expect(kindOf('sensor.grid', state({ state_class: 'total', unit_of_measurement: 'kWh' }))).toBe(
      'counter',
    );
    expect(kindOf('input_number.target', state({}))).toBe('measure');
    expect(kindOf('binary_sensor.door', state({ device_class: 'door' }))).toBe('states');
    expect(kindOf('sensor.weather_words', state({}))).toBe('states');
  });

  it('offers the house’s window, a day and a week, each once', () => {
    expect(windowsOf(12)).toEqual([12, 24, 168]);
    expect(windowsOf(24)).toEqual([24, 168]);
    expect(windowsOf(48)).toEqual([24, 48, 168]);
  });

  it('adds a meter’s buckets into its slots, the running one brought up to the reading now', () => {
    const buckets = [
      { t: 0, change: 1, state: 1 },
      { t: 30, change: 2, state: 3 },
      { t: 60, change: 0.5, state: 3.5 },
    ];
    // two slots of an hour (in tens of a minute here): the second still running, 0.25 gained since its last bucket
    expect(gainsIn(buckets, [0, 60, 120], true, 0.25)).toEqual([3, 0.75]);
    // a slot no bucket starts in is a gap, never a zero
    expect(gainsIn(buckets, [-60, 0, 60], false, 0)).toEqual([null, 3]);
    expect(gainedSince(buckets, 30, 0.25)).toBe(2.75);
    expect(gainedSince([], 0, 0)).toBeNull();
  });

  it('reads a reset where the state fell but what was gained did not, and a meter read from its states by its fall', () => {
    // a daily meter: 7.9 at 23:55, 0.1 at 00:05 — its change follows the sum, which a reset never takes back
    expect(
      resetsOf(
        [
          { t: 1, v: 7.9, change: 0.1 },
          { t: 2, v: 0.1, change: 0.1 },
        ],
        true,
      ),
    ).toEqual([2]);
    // a net meter (`total`) that fell: its change fell with it, no reset
    expect(
      resetsOf(
        [
          { t: 1, v: 5, change: 1 },
          { t: 2, v: 4, change: -1 },
        ],
        false,
      ),
    ).toEqual([]);
    // read from its states alone: only a meter that grows resets where it falls
    const states = [
      { t: 1, v: 7.9 },
      { t: 2, v: 0.2 },
    ];
    expect(
      resetsOf(
        bucketsOf(states, true).map((b) => ({ t: b.t, v: b.state as number, change: b.change })),
        true,
      ),
    ).toEqual([2]);
    expect(bucketsOf(states, true)[1]?.change).toBe(0.2);
  });

  it('breaks a line at a reset: a gap at the reset, and the mean point that holds it a gap too', () => {
    const line = { values: [1, 2, 3, 0, 0.5], at: [0, 0.25, 0.5, 0.75, 1] };
    // the reset at 0.55: nearest the point at 0.5, whose mean would mix both days
    expect(breakAt(line, [0.55], true)).toEqual({
      values: [1, 2, null, null, 0, 0.5],
      at: [0, 0.25, 0.5, 0.55, 0.75, 1],
    });
    // a line of readings held at their times keeps its points: only the gap at the reset
    expect(breakAt(line, [0.55], false).values).toEqual([1, 2, 3, null, 0, 0.5]);
  });

  it('lays a thing’s states as stretches, brought up to its state now, and says how long it was on', () => {
    const rows = [
      { s: 'off', lu: 0 },
      { s: 'on', lu: 10 },
      { s: 'on', lu: 20 },
      { s: 'off', lu: 30 },
    ];
    const stretches = stretchesOf(rows, 5_000, 100_000, { state: 'on', since: 90_000 });
    expect(stretches).toEqual([
      { from: 5_000, to: 10_000, state: 'off' },
      { from: 10_000, to: 30_000, state: 'on' },
      { from: 30_000, to: 90_000, state: 'off' },
      { from: 90_000, to: 100_000, state: 'on' },
    ]);
    expect(timeOn('binary_sensor', stretches)).toEqual({ state: 'on', ms: 30_000 });
    // a select's options are all "on": no one of them is the thing being on
    expect(
      timeOn('select', [
        { from: 0, to: 1, state: 'eco' },
        { from: 1, to: 2, state: 'comfort' },
      ]),
    ).toBeNull();
  });

  it('reads what a window reached, weighted by how long each reading held', () => {
    const reach = reachOf(
      [
        { t: 0, v: 20, low: 19.5, high: 20.5 },
        { t: 60, v: 30 },
      ],
      0,
      61,
    );
    expect(reach).toMatchObject({ min: 19.5, max: 30, first: 20, last: 30 });
    expect(reach?.average).toBeCloseTo((20 * 60 + 30) / 61);
  });
});

describe('the details dialog’s history drawn', () => {
  it('draws a meter’s hours as bars and says what it gained today, the window’s total, its best hour', async () => {
    const block = await mount('sensor.yield', { hours: 24 });
    const root = block.shadowRoot as ShadowRoot;
    expect(root.querySelectorAll('.fc-bar').length).toBe(10);
    expect(text(root, '.dh-lead .fv-readout__value')).toEqual(['+1.00kWh']);
    // gained in the window, the best hour, and an hour's mean over the whole hours (1 kWh in 23)
    expect(text(root, '.dh-cols .fv-readout__value')).toEqual(['1.00kWh', '0.10kWh', '0.04kWh']);
    // the chips: the house's twelve hours, a day (chosen), a week; then the meter's two readings
    expect(text(root, '.fv-chip')).toEqual(['12 h', '24 h', '7 d', 'Per hour', 'Total']);
    expect(root.querySelector('.fv-chip.is-active')?.textContent?.trim()).toBe('24 h');
    // read from the recorder's five-minute buckets, back to the day's midnight and the window's first hour
    const read = asked.find((m) => m['type'] === 'recorder/statistics_during_period');
    expect(read).toMatchObject({ period: '5minute', types: ['change', 'state'] });
    // the way on to the History page with the same window
    const open = root.querySelector('a.dh-open') as HTMLAnchorElement;
    expect(open.getAttribute('href')).toBe(
      `/history?entity_id=sensor.yield&start_date=${encodeURIComponent(new Date(NOW - 24 * HOUR).toISOString())}&back=1`,
    );
  });

  it('draws a meter’s running total as a line that breaks at its reset, never one down a cliff', async () => {
    const block = await mount('sensor.yield', { hours: 24, mode: 'total' });
    const root = block.shadowRoot as ShadowRoot;
    const d = root.querySelector('.curve-line')?.getAttribute('d') ?? '';
    // two runs: yesterday's evening, and today from midnight
    expect(d.match(/M/g)?.length).toBe(2);
    expect(root.querySelectorAll('.dh-reset')).toHaveLength(1);
  });

  it('draws a measure’s line with how much it moved, and its lowest, highest and mean', async () => {
    const block = await mount('sensor.room');
    const root = block.shadowRoot as ShadowRoot;
    expect(root.querySelector('.curve-line')).not.toBeNull();
    expect(text(root, '.dh-lead .fv-readout__label')).toEqual(['Change']);
    expect(text(root, '.dh-cols .fv-readout__label')).toEqual(['Min', 'Max', 'Average']);
    expect(text(root, '.fv-card__sub')).toEqual(['5-minute averages']);
  });

  it('draws a thing’s states as stretches on one track, and how long it was open', async () => {
    const block = await mount('binary_sensor.door', { hours: 24 });
    const root = block.shadowRoot as ShadowRoot;
    expect(root.querySelectorAll('.dh-track .fv-stretch.is-on')).toHaveLength(2);
    // the state in the house's words (Home Assistant's formatter; this house has none: the state's own)
    expect(text(root, '.fv-card__sub')).toEqual(['On for 40 min']);
    // no readout and no row: the state is the dialog's own, said once
    expect(root.querySelector('.dh-lead')).toBeNull();
    expect(root.querySelector('.dh-cols')).toBeNull();
  });

  it('opens on the house’s window, and a window chosen opens the next dialog on it', async () => {
    setChartDefaults({ settings: { ...CHART_DEFAULTS, window: 4 }, sets: [] });
    const first = await mount('sensor.room');
    const chips = [
      ...(first.shadowRoot as ShadowRoot).querySelectorAll<HTMLButtonElement>('.fv-chip'),
    ];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['4 h', '24 h', '7 d']);
    expect(chips[0]?.classList.contains('is-active')).toBe(true);
    chips[2]?.click();
    await first.updateComplete;
    const next = await mount('sensor.room');
    expect(
      (next.shadowRoot as ShadowRoot).querySelector('.fv-chip.is-active')?.textContent?.trim(),
    ).toBe('7 d');
  });
});

describe('our history in place of Home Assistant’s', () => {
  /** Home Assistant's block as a release shapes it: what it declares, and its own render. */
  const shaped = (properties: PropertyDeclarations) =>
    class Block extends LitElement {
      static override properties = properties;
      declare hass: HomeAssistant | undefined;
      declare entityId: string | undefined;
      override render() {
        return html`<p class="stock">Home Assistant’s history</p>`;
      }
    };

  it('is ours while the page wears Fluvy, and Home Assistant’s where it does not, the house keeps it, or it draws a climate', async () => {
    customElements.define(
      'ha-more-info-history',
      shaped({ hass: { attribute: false }, entityId: { attribute: false } }),
    );
    expect(await takeOverDetails(customElements, document)).toBe(true);
    const element = document.createElement('ha-more-info-history') as LitElement & {
      hass?: HomeAssistant;
      entityId?: string;
    };
    element.hass = house();
    element.entityId = 'sensor.room';
    document.body.append(element);
    await element.updateComplete;
    const root = element.shadowRoot as ShadowRoot;
    expect(root.querySelector('.stock')).not.toBeNull();

    // Home Assistant applies the Fluvy theme: its sentinel is on <html>
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    const ours = root.querySelector('fluvy-details-history');
    expect(ours).not.toBeNull();
    expect(root.querySelector('.stock')).toBeNull();
    expect((ours as FluvyDetailsHistory).entityId).toBe('sensor.room');

    // a climate's history is its attributes through time: Home Assistant's block draws it
    element.entityId = 'climate.living';
    await element.updateComplete;
    expect(root.querySelector('.stock')).not.toBeNull();
    element.entityId = 'sensor.room';
    await element.updateComplete;
    expect(root.querySelector('fluvy-details-history')).not.toBeNull();

    // the house keeps Home Assistant's (Scope › Everywhere): its block comes back at once
    document.documentElement.setAttribute(ORIGINAL_DETAILS, '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(root.querySelector('.stock')).not.toBeNull();
  });

  it('keeps Home Assistant’s block where it no longer declares what ours reads, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // a release that renamed `entityId`, in a registry of its own
    const Reshaped = shaped({ hass: { attribute: false }, entity: { attribute: false } });
    customElements.define('ha-more-info-history-reshaped', Reshaped);
    const render = Reshaped.prototype.render;
    const registry = {
      whenDefined: async () => Reshaped,
      get: () => Reshaped,
    } as unknown as CustomElementRegistry;
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    expect(await takeOverDetails(registry, document)).toBe(false);
    // nothing of Home Assistant's was wrapped
    expect(Reshaped.prototype.render).toBe(render);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /^\[fluvy\] fluvy-details-history stepped aside: ha-more-info-history has no entityId/,
    );
    warn.mockRestore();
  });

  it('is on from the factory, kept by the house as a setting of its own', () => {
    expect(HOUSE_DEFAULTS.details).toBe(true);
    expect(parseHouse({ version: 4, palette: 'volt' }).details).toBe(true);
    expect(parseHouse({ details: false }).details).toBe(false);
    expect(parseHouse({ details: 'no' }).details).toBe(true);
    expect(resolveSettings(parseHouse({ details: false }), PERSONAL_DEFAULTS).details).toBe(false);
  });
});
