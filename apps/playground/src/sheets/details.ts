import '../details.js';
import type { StateSeed } from '../hass.js';
import { NOW } from '../now.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

/*
 * Our history in Home Assistant's details dialog (1.20, #162), on the sheets' evening (Thursday 17 September 2026,
 * 21:47), hosted as Home Assistant's dialog hosts its own block (`../details.ts`): an inverter's daily yield, a meter
 * reset at every midnight — its hours as bars, its total over a day broken where it was reset, a week of its days; the
 * living room's temperature, a measure, over the house's twelve hours and over a week of hourly averages; the front
 * door's stretches open and shut (and the half hour its sensor dropped out); and a reading lamp's, as the history view
 * a light's chart button opens shows them. A phone's dialog (360) and a desktop's (580), in the page's mode.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW_MS = NOW.getTime();
const NOW_ISO = NOW.toISOString();
/** The sheets' midnight, and the day a moment falls in (0: Thursday, −1: Wednesday …). */
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
const midnightOf = (t: number): number => {
  const date = new Date(t);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const dayOf = (t: number): number => Math.round((midnightOf(t) - TODAY) / DAY);
const hourOf = (t: number): number => (t - midnightOf(t)) / HOUR;

/* ---------- the inverter's daily yield: a meter of today's kWh, back to 0 at every midnight ---------- */

const YIELD = 'sensor.inverter_daily_yield';
/** Each day's yield (kWh), Thursday last: a grey Monday, a bright Tuesday. */
const DAYS = [10.42, 9.18, 11.86, 6.24, 12.31, 11.2, 8.63];
const SUNRISE = 7.2;
const SUNSET = 19.6;

/** How much of a day's yield the sun has given by an hour of it (0 … 1): a bell from sunrise to sunset. */
function share(hour: number): number {
  if (hour <= SUNRISE) return 0;
  if (hour >= SUNSET) return 1;
  const x = (hour - SUNRISE) / (SUNSET - SUNRISE);
  // the integral of sin²(πx), normalised: slow at dawn and dusk, steep at noon
  return x - Math.sin(2 * Math.PI * x) / (2 * Math.PI);
}

/** A day's yield (the day before the week began reads as the week's first). */
const yieldOf = (day: number): number => DAYS[Math.max(0, DAYS.length - 1 + day)] ?? 0;

/** The meter at a moment: what its day has given so far. */
const meter = (t: number): number => Math.round(yieldOf(dayOf(t)) * share(hourOf(t)) * 1000) / 1000;

/** Its sum, which a reset never takes back: every whole day before, and the day so far. */
const sum = (t: number): number => {
  let total = meter(t);
  for (let day = dayOf(t) - 1; day >= -DAYS.length; day--) total += yieldOf(day);
  return total;
};

/* ---------- the living room's temperature ---------- */

const TEMPERATURE = 'sensor.living_room_temperature';
/** The room through a day: cool at dawn, the afternoon sun on the window, the heating's evening. */
const temperature = (t: number): number => {
  const hour = hourOf(t);
  const day = dayOf(t);
  return (
    21.2 +
    0.9 * Math.sin(((hour - 10) / 24) * 2 * Math.PI) +
    0.45 * Math.exp(-((hour - 19.5) ** 2) / 3) +
    0.18 * Math.sin(day * 1.7) +
    0.06 * Math.sin(t / (17 * MINUTE))
  );
};

/* ---------- what the recorder answers ---------- */

const periodOf = (period: unknown): number => (period === '5minute' ? 5 * MINUTE : HOUR);
const time = (value: unknown, fallback: number): number => {
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : fallback;
};
const asked = (message: Record<string, unknown>, key: string): string[] =>
  Array.isArray(message[key]) ? (message[key] as string[]) : [];

/** A statistic's buckets that have been compiled (ended by now), from the window's start. */
function buckets(message: Record<string, unknown>): number[] {
  const step = periodOf(message['period']);
  const from = Math.ceil(time(message['start_time'], NOW_MS - DAY) / step) * step;
  const to = Math.min(time(message['end_time'], NOW_MS), NOW_MS);
  const starts: number[] = [];
  for (let t = from; t + step <= to; t += step) starts.push(t);
  return starts;
}

function statistics(message: Record<string, unknown>): Record<string, unknown[]> {
  const step = periodOf(message['period']);
  const out: Record<string, unknown[]> = {};
  for (const id of asked(message, 'statistic_ids')) {
    if (id === YIELD)
      out[id] = buckets(message).map((start) => ({
        start,
        end: start + step,
        state: meter(start + step - 1),
        change: Math.round((sum(start + step - 1) - sum(start - 1)) * 1000) / 1000,
      }));
    if (id === TEMPERATURE)
      out[id] = buckets(message).map((start) => {
        const samples = Array.from({ length: 6 }, (_unused, k) =>
          temperature(start + (k * step) / 6),
        );
        return {
          start,
          end: start + step,
          mean: samples.reduce((a, b) => a + b, 0) / samples.length,
          min: Math.min(...samples) - (step > 5 * MINUTE ? 0.12 : 0.02),
          max: Math.max(...samples) + (step > 5 * MINUTE ? 0.12 : 0.02),
        };
      });
  }
  return out;
}

/* ---------- the front door and the reading lamp: their stretches, day after day ---------- */

const DOOR = 'binary_sensor.front_door';
const LAMP = 'light.reading_lamp';

/** A day's openings of the front door: when (hours) and for how many minutes. */
const OPENINGS: ReadonlyArray<readonly [number, number]> = [
  [7.7, 2],
  [8.25, 1],
  [13.1, 4],
  [17.9, 2],
  [18.5, 7],
  [19.05, 1],
  [21.2, 3],
];
/** The lamp's evenings and mornings: on and off (hours). */
const LIT: ReadonlyArray<readonly [number, number]> = [
  [7, 7.6],
  [16.85, 24],
];

/** The changes of a thing over a window, as `history/history_during_period` sends them at their smallest. */
function changes(id: string, start: number, end: number): { s: string; lu: number }[] {
  const out: { s: string; lu: number }[] = [];
  for (let day = dayOf(start) - 1; day <= dayOf(end); day++) {
    const midnight = TODAY + day * DAY;
    const spans =
      id === DOOR
        ? OPENINGS.map(([hour, minutes]) => [hour, hour + minutes / 60] as const)
        : LIT.map(([on, off]) => [on, off] as const);
    for (const [on, off] of spans) {
      out.push({ s: 'on', lu: midnight + on * HOUR }, { s: 'off', lu: midnight + off * HOUR });
    }
    // Tuesday night the door's sensor dropped off its network for half an hour
    if (id === DOOR && day === -2)
      out.push(
        { s: 'unavailable', lu: midnight + 3.15 * HOUR },
        { s: 'off', lu: midnight + 3.65 * HOUR },
      );
  }
  const sorted = out.sort((a, b) => a.lu - b.lu).filter((change) => change.lu <= NOW_MS);
  // the state at the window's start first, then each change in it
  const before = sorted.filter((change) => change.lu <= start).pop();
  return [
    ...(before ? [{ s: before.s, lu: start }] : []),
    ...sorted.filter((change) => change.lu > start && change.lu <= end),
  ].map((change) => ({ s: change.s, lu: change.lu / 1000 }));
}

function history(message: Record<string, unknown>): Record<string, unknown[]> {
  const start = time(message['start_time'], NOW_MS - DAY);
  const end = Math.min(time(message['end_time'], NOW_MS), NOW_MS);
  const out: Record<string, unknown[]> = {};
  for (const id of asked(message, 'entity_ids'))
    if (id === DOOR || id === LAMP) out[id] = changes(id, start, end);
  return out;
}

/* ---------- the house ---------- */

const states: StateSeed[] = [
  [
    YIELD,
    String(meter(NOW_MS)),
    {
      friendly_name: 'Daily yield',
      unit_of_measurement: 'kWh',
      device_class: 'energy',
      state_class: 'total_increasing',
    },
  ],
  [
    TEMPERATURE,
    temperature(NOW_MS).toFixed(1),
    {
      friendly_name: 'Living room',
      unit_of_measurement: '°C',
      device_class: 'temperature',
      state_class: 'measurement',
    },
  ],
  [DOOR, 'off', { friendly_name: 'Front door', device_class: 'door' }],
  [LAMP, 'on', { friendly_name: 'Reading lamp', brightness: 158 }],
];

/** A dialog as a frame shows it: the entity, its width (a phone's 360, a desktop's 580), and the frame's moment. */
const dialog = (
  title: string,
  width: number,
  card: Record<string, unknown> & { entity: string },
): FrameSpec => ({
  title,
  width,
  cards: [{ type: 'custom:pg-details-dialog', now: NOW_ISO, ...card }],
});

export const sheet: SheetSpec = {
  states,
  registry: { entities: { [YIELD]: { entity_id: YIELD, display_precision: 2 } } },
  ws: {
    'recorder/statistics_during_period': statistics,
    'history/history_during_period': history,
  },
  frames: [
    dialog('Daily yield · what each hour gave, a phone', 360, {
      entity: YIELD,
      crumb: 'Inverter',
    }),
    dialog('Daily yield · its total over a day, broken at midnight', 580, {
      entity: YIELD,
      crumb: 'Inverter',
      hours: 24,
      mode: 'total',
    }),
    dialog('Daily yield · a week of its days', 580, {
      entity: YIELD,
      crumb: 'Inverter',
      hours: 168,
    }),
    dialog('Living room · a measure over the house’s twelve hours', 580, {
      entity: TEMPERATURE,
      crumb: 'Living room sensor',
    }),
    dialog('Living room · a week of hourly averages, a phone', 360, {
      entity: TEMPERATURE,
      crumb: 'Living room sensor',
      hours: 168,
    }),
    dialog('Front door · open and shut over a day', 360, {
      entity: DOOR,
      crumb: 'Hall',
      hours: 24,
    }),
    dialog('Reading lamp · the history view of a light', 580, {
      entity: LAMP,
      crumb: 'Reading lamp',
      view: 'history',
      hours: 24,
    }),
  ],
};
