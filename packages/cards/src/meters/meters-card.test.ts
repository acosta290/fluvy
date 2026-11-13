// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { clearMeterCache } from './today.js';

// the energy family lands with the index: the card's tag is defined before a page needs it
await familiesDefined;

const LITRES = { unit_of_measurement: 'L', device_class: 'water', state_class: 'total_increasing' };
const GAS = { unit_of_measurement: 'm³', device_class: 'gas', state_class: 'total_increasing' };

/** A water meter with a typical day and a gas meter without one, live or out of reach. */
const house = (state: 'live' | 'unavailable' | 'missing'): HomeAssistant => {
  const sensor = (id: string, value: string, attributes: Record<string, unknown>) => ({
    entity_id: id,
    state: state === 'live' ? value : 'unavailable',
    attributes:
      state === 'live' ? attributes : { unit_of_measurement: attributes['unit_of_measurement'] },
    last_changed: '',
    last_updated: '',
  });
  const states =
    state === 'missing'
      ? {}
      : {
          'sensor.water': sensor('sensor.water', '48210', LITRES),
          'sensor.gas': sensor('sensor.gas', '1529.9', GAS),
        };
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { time_zone: 'Europe/Madrid' },
    states,
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    // the recorder never answers: the rows wait alike
    callWS: () => new Promise(() => undefined),
  } as unknown as HomeAssistant;
};

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** Each meter's row: its classes' parts (no state, no modifier), whether it has a bar, its note, its figure's line. */
async function rows(state: 'live' | 'unavailable' | 'missing', width: number) {
  const card = document.createElement('fluvy-meters-card') as CardElement;
  card.setConfig({
    type: 'custom:fluvy-meters-card',
    meters: [{ entity: 'sensor.water', typical: 150 }, 'sensor.gas'],
  });
  card.hass = house(state);
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  return [...card.shadowRoot!.querySelectorAll('.ef-meter')].map((row) => ({
    bar: row.querySelector('.ef-bar') !== null,
    note: row.querySelector('.ef-meter__note')?.textContent?.trim() ?? '',
    figure: row.querySelector('.fv-readout__value')?.textContent?.replace(/\s+/g, ' ').trim(),
    stacked: row.classList.contains('ef-meter--stack'),
  }));
}

afterEach(() => {
  document.body.replaceChildren();
  clearMeterCache();
});

describe('a meter out of reach keeps its lines (1.9)', () => {
  it('keeps its bar, empty, where it has a typical day, its state in the note', async () => {
    const [water] = await rows('unavailable', 360);
    expect(water).toMatchObject({ bar: true, note: 'Unavailable', stacked: false });
  });

  it('stacked with no note of its own, says its state beside the dash, on the figure’s line', async () => {
    const live = await rows('live', 152);
    const away = await rows('unavailable', 152);
    const gone = await rows('missing', 152);
    expect(live.map((r) => [r.stacked, r.bar, Boolean(r.note)])).toEqual([
      [true, true, true],
      [true, false, false],
    ]);
    for (const twin of [away, gone])
      expect(twin.map((r) => [r.stacked, r.bar, Boolean(r.note)])).toEqual(
        live.map((r) => [r.stacked, r.bar, Boolean(r.note)]),
      );
    expect(away[1]?.figure).toBe('—Unavailable');
    expect(gone[1]?.figure).toBe('—Not found');
  });
});

describe('a meter that is a statistic a utility imports (#181)', () => {
  const DAY = 86_400_000;
  /** Thursday 13 November 2026 at 14:00, on the clock the house reads. */
  const NOW = '2026-11-13T14:00:00Z';
  const midnight = Date.parse('2026-11-13T00:00:00Z');
  /** The Energy dashboard's gas, an imported statistic in CCF whose last figure is `last` days back. */
  const utility = (last: number, asked: Record<string, unknown>[] = []): HomeAssistant =>
    ({
      ...house('live'),
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        switch (message['type']) {
          case 'energy/get_prefs':
            return { energy_sources: [{ type: 'gas', stat_energy_from: 'opower:pge_gas' }] };
          case 'recorder/get_statistics_metadata':
            return [
              {
                statistic_id: 'opower:pge_gas',
                name: 'PG&E gas consumption',
                has_sum: true,
                statistics_unit_of_measurement: 'CCF',
              },
            ];
          default:
            return {
              'opower:pge_gas': [2.4, 1.8, 2.0, 2.2, 1.9, 2.3, 2.1, 1.6].map((change, i) => ({
                start: midnight - (last + 7 - i) * DAY,
                change,
              })),
            };
        }
      },
    }) as unknown as HomeAssistant;

  const mount = async (hass: HomeAssistant) => {
    const card = document.createElement('fluvy-meters-card') as CardElement;
    card.setConfig({ type: 'custom:fluvy-meters-card', _now: NOW });
    card.hass = hass;
    card.width = 360;
    document.body.append(card);
    for (let i = 0; i < 6; i++) {
      await card.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const root = card.shadowRoot!;
    const row = root.querySelector('.ef-meter');
    return {
      sub: root.querySelector('.fv-card__sub')?.textContent?.trim(),
      figure: row?.querySelector('.fv-readout__value')?.textContent?.replace(/\s+/g, ' ').trim(),
      note: row?.querySelector('.ef-meter__note')?.textContent?.trim(),
      bar: row?.querySelector('.ef-bar') !== null,
      button: row?.getAttribute('role'),
    };
  };

  it('reads its latest day with its date, against its typical day, in its own unit, with nothing to open', async () => {
    const asked: Record<string, unknown>[] = [];
    // its last figure on Tuesday the 11th, two days behind
    expect(await mount(utility(2, asked))).toEqual({
      sub: 'Latest figures · vs a typical day',
      figure: '1.6CCF',
      note: 'Nov 11 · typical 2.1 CCF',
      bar: true,
      button: null,
    });
    expect(asked.find((m) => m['period'] === 'day')).toMatchObject({
      statistic_ids: ['opower:pge_gas'],
      types: ['change'],
      units: { volume: 'CCF' },
    });
    // never its hours since midnight: it has none
    expect(asked.some((m) => m['period'] === 'hour')).toBe(false);
  });

  it('says since when it has no figures once they are older than its week, keeping its size', async () => {
    expect(await mount(utility(10))).toEqual({
      sub: 'Latest figures · vs a typical day',
      figure: '—',
      note: 'No figures since Nov 3',
      bar: true,
      button: null,
    });
  });
});
