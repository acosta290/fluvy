import type { HomeAssistant } from '@fluvy/core';
import type {
  CompareMode,
  EnergyCollectionLike,
  EnergyDataLike,
  Statistics,
} from '../../../packages/cards/src/energy-model/collection.js';
import { co2SignalOf } from '../../../packages/cards/src/energy-model/fossil.js';
import {
  fullDays,
  houseMidnight,
  stepFor,
  type Range,
} from '../../../packages/cards/src/energy-model/period.js';
import {
  measureIds,
  readPrefs,
  type EnergyPrefs,
} from '../../../packages/cards/src/energy-model/prefs.js';

/**
 * An Energy date picker's collection as Home Assistant makes one (`getEnergyDataCollection`), on the mock's
 * connection as `_<key>`: a card given the key finds it there, subscribes, and is handed an `EnergyData` built from
 * the sheet's preferences (`energy/get_prefs`) and its statistics (`recorder/statistics_during_period`, in the
 * buckets Home Assistant would ask for) over the range it holds — today unless `?period=` says otherwise — moved by
 * `setPeriod` and `refresh()` as a picker moves it.
 */

export type MockPeriod = 'today' | 'yesterday' | 'week' | 'month';
export const MOCK_PERIODS: readonly MockPeriod[] = ['today', 'yesterday', 'week', 'month'];

const DAY = 86_400_000;

export interface MockCollection extends EnergyCollectionLike {
  readonly key: string;
  /** How many cards hold it (Home Assistant's `_active`). */
  readonly active: number;
}

/** A preset's range on the house's clock, the last moment of its last day as Home Assistant sets it. */
export function presetRange(hass: HomeAssistant, period: MockPeriod, now: Date): Range {
  const midnight = houseMidnight(hass, now);
  const day = (back: number): Range => ({
    start: houseMidnight(hass, now, back),
    end: new Date(houseMidnight(hass, now, back).getTime() + DAY - 1),
  });
  if (period === 'today') return day(0);
  if (period === 'yesterday') return day(1);
  if (period === 'week') {
    // Monday to Sunday, as Home Assistant's own picker counts a week for the house's locale
    const weekday = (new Date(midnight.getTime() + 12 * 3_600_000).getDay() + 6) % 7;
    const start = houseMidnight(hass, now, weekday);
    return { start, end: new Date(start.getTime() + 7 * DAY - 1) };
  }
  const first = new Date(midnight.getTime() + 12 * 3_600_000);
  first.setDate(1);
  const start = houseMidnight(hass, first);
  const next = new Date(first);
  next.setMonth(next.getMonth() + 1);
  return { start, end: new Date(houseMidnight(hass, next).getTime() - 1) };
}

/** Home Assistant's `getSuggestedPeriod(start, end, true)`: the power sensors' buckets. */
const finePeriod = (range: Range): '5minute' | 'hour' | 'day' => {
  const days = fullDays(range.start, range.end ?? new Date());
  return days > 64 ? 'day' : days > 8 ? 'hour' : '5minute';
};

/** What Home Assistant's `getEnergyData` fetches for a range, from the sheet's answers. */
async function energyData(hass: HomeAssistant, range: Range): Promise<EnergyDataLike> {
  const prefs = (await hass
    .callWS<EnergyPrefs>({ type: 'energy/get_prefs' })
    .catch(() => null)) ?? {
    energy_sources: [],
  };
  const house = readPrefs(prefs);
  const energyIds = [
    ...new Set([
      ...house.sources.flatMap((s) => [...s.energyIn, ...s.energyOut, s.cost, s.compensation]),
      ...house.devices.map((d) => d.stat),
    ]),
  ].filter((id): id is string => typeof id === 'string' && id !== '');
  const powerIds = [...new Set(house.sources.flatMap((s) => measureIds(s.measure)))];
  const ask = (ids: readonly string[], period: string, types: readonly string[], units: object) =>
    ids.length
      ? hass
          .callWS<Statistics>({
            type: 'recorder/statistics_during_period',
            start_time: range.start.toISOString(),
            ...(range.end ? { end_time: range.end.toISOString() } : {}),
            statistic_ids: [...ids],
            period,
            types: [...types],
            units,
          })
          .catch(() => ({}))
      : Promise.resolve({});
  const co2 = co2SignalOf(hass);
  const imports = house.sources.filter((s) => s.kind === 'grid').flatMap((s) => s.energyIn);
  const [energy, power, fossil] = await Promise.all([
    ask(energyIds, stepFor(range), ['change'], { energy: 'kWh' }),
    ask(powerIds, finePeriod(range), ['mean'], { power: 'kW' }),
    co2 && imports.length
      ? hass
          .callWS<Record<string, number>>({
            type: 'energy/fossil_energy_consumption',
            start_time: range.start.toISOString(),
            end_time: (range.end ?? new Date()).toISOString(),
            energy_statistic_ids: imports,
            co2_statistic_id: co2,
            period: stepFor(range),
          })
          .catch(() => null)
      : Promise.resolve(undefined),
  ]);
  return {
    start: range.start,
    ...(range.end ? { end: range.end } : {}),
    prefs,
    stats: { ...energy, ...power },
    ...(co2 ? { co2SignalEntity: co2 } : {}),
    ...(fossil !== undefined ? { fossilEnergyConsumption: fossil } : {}),
  };
}

export function mockCollection(
  hass: () => HomeAssistant,
  key: string,
  range: Range,
): MockCollection {
  const subscribers = new Set<(data: EnergyDataLike) => void>();
  let state: EnergyDataLike | undefined;
  let active = 0;
  const collection: MockCollection = {
    key,
    start: range.start,
    ...(range.end ? { end: range.end } : {}),
    compare: '' as CompareMode,
    get state() {
      return state;
    },
    get active() {
      return active;
    },
    // as Home Assistant's collection: the first subscriber fetches, a later one gets what is there a moment later
    subscribe(subscriber) {
      subscribers.add(subscriber);
      active++;
      if (state) setTimeout(() => subscriber(state as EnergyDataLike), 0);
      else if (subscribers.size === 1) void collection.refresh();
      return () => {
        subscribers.delete(subscriber);
        active--;
      };
    },
    setPeriod(start, end) {
      collection.start = start;
      collection.end = end;
    },
    setCompare(compare) {
      collection.compare = compare;
    },
    async refresh() {
      const data = await energyData(hass(), { start: collection.start, end: collection.end });
      state = data;
      for (const subscriber of subscribers) subscriber(data);
    },
  };
  return collection;
}
