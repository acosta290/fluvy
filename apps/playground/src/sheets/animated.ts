import type { LovelaceCardConfig } from '@fluvy/core';
import type { StateSeed } from '../hass.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import './solar.js'; // the gauge and humidity cards' definitions

/*
 * The gauges that move with what they read (1.11): each on the gauge card's ring at the design page's values (its
 * Value buttons: low, mid, high, and the temperature's extreme), in a column of tiles (half a section), out of reach,
 * and told not to move (`animate: false`); the humidity's liquid in its band. Light and dark are the page's
 * (`&mode=dark`); the house's motion off is the page's too (`&charts={"animate":false}`): every gauge on its first
 * frame.
 */

const MEASURE = { state_class: 'measurement' };

/**
 * A day of readings ending on `now`, 49 of them, the window's last hour climbing `rise` to it (the tank filling, the
 * battery charging): flat before it, but for a slow sway, so a gauge's range is the day's.
 */
const day = (now: number, rise = 0, sway = 0): number[] =>
  Array.from({ length: 49 }, (_unused, i) => {
    const back = (48 - i) / 2; // hours before now: the window's last hour is its last two points
    const climb = back <= 1 ? rise * back : rise;
    return Math.round((now - climb + sway * Math.sin(i / 5)) * 100) / 100;
  });

interface Gauge {
  /** The gauge style. */
  readonly gauge: string;
  /** The frame's name for it, the card's subtitle. */
  readonly name: string;
  readonly place: string;
  /** The sensor's attributes. */
  readonly reads: Record<string, string>;
  /** The design page's values, low to high (the temperature's to its extreme), and how fast each climbs an hour. */
  readonly values: readonly (readonly [number, number?])[];
  /** The card's range, where the sensor's day would not give the one the design page reads on. */
  readonly max?: number;
  /** A word inside the ring that is not the device class's. */
  readonly label?: string;
}

const GAUGES: readonly Gauge[] = [
  {
    gauge: 'liquid',
    name: 'Humidity',
    place: 'Bathroom',
    reads: { unit_of_measurement: '%', device_class: 'humidity' },
    values: [[28], [52], [81]],
  },
  {
    gauge: 'thermo',
    name: 'Temperature',
    place: 'Terrace',
    reads: { unit_of_measurement: '°C', device_class: 'temperature' },
    values: [[2.4], [21.5], [29.4], [38.6]],
    max: 40,
  },
  {
    gauge: 'tank',
    name: 'Rain tank',
    place: 'Garden',
    reads: { unit_of_measurement: 'L', device_class: 'volume_storage' },
    // at rest, filling 4 L a minute, filling 12
    values: [[220], [580, 240], [880, 720]],
    max: 1000,
    label: 'Rain water',
  },
  {
    gauge: 'battery',
    name: 'Battery',
    place: 'House',
    reads: { unit_of_measurement: '%', device_class: 'battery' },
    // charging slowly, charging, full and resting
    values: [[17, 3], [62, 18], [96]],
  },
  {
    gauge: 'pulse',
    name: 'Power',
    place: 'House',
    reads: { unit_of_measurement: 'W', device_class: 'power' },
    values: [[200], [1800], [6400]],
    max: 8000,
  },
  {
    gauge: 'air',
    name: 'Wind',
    place: 'Terrace',
    reads: { unit_of_measurement: 'km/h', device_class: 'wind_speed' },
    values: [[4], [18], [46]],
    max: 60,
  },
  {
    gauge: 'sun',
    name: 'Solar',
    place: 'Roof',
    reads: { unit_of_measurement: 'W', device_class: 'power' },
    values: [[400], [2600], [5400]],
    max: 6000,
    label: 'Production',
  },
];

const LEVELS = ['low', 'mid', 'high', 'extreme'] as const;
const id = (g: Gauge, level: string): string => `sensor.am_${g.gauge}_${level}`;

/** A gauge card in a moving style on one of its sensors. */
const card = (g: Gauge, level: string, more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-gauge-card',
  entity: id(g, level),
  gauge: g.gauge,
  subtitle: g.place,
  ...(g.max === undefined ? {} : { max: g.max }),
  ...(g.label === undefined ? {} : { label: g.label }),
  ...more,
});

const states: StateSeed[] = GAUGES.flatMap((g) => [
  ...g.values.map(([value], i): StateSeed => [
    id(g, LEVELS[i] as string),
    String(value),
    { friendly_name: g.name, ...g.reads, ...MEASURE },
  ]),
  [id(g, 'away'), 'unavailable', { friendly_name: g.name, ...g.reads, ...MEASURE }],
]);

const history = Object.fromEntries(
  GAUGES.flatMap((g) =>
    g.values.map(([value, rise], i) => [
      id(g, LEVELS[i] as string),
      day(value, rise, rise ? 0 : value * 0.04),
    ]),
  ),
);

const frames: FrameSpec[] = [
  // each gauge at the design page's values, a card each
  ...GAUGES.map((g) => ({
    title: `Moving · ${g.gauge}`,
    cards: g.values.map((_value, i) => card(g, LEVELS[i] as string)),
  })),
  // a column of tiles: the middle value, two a row
  {
    title: 'Moving · tiles',
    cards: GAUGES.map((g) => ({ ...card(g, 'mid'), cols: 6 })),
  },
  // out of reach: each keeps its room and its anatomy, still and grey, its figure "—"
  {
    title: 'Moving · out of reach',
    cards: GAUGES.map((g) => ({ ...card(g, 'away'), cols: 6 })),
  },
  // told not to move: the first frame, a wave still a wave
  {
    title: 'Moving · still',
    cards: GAUGES.map((g) => ({ ...card(g, 'mid', { animate: false }), cols: 6 })),
  },
  // the humidity's band as the liquid: dry, comfortable, humid, with the dew point, out of reach
  {
    title: 'Moving · humidity · liquid',
    cards: [
      ...['low', 'mid', 'high'].map((level) => ({
        type: 'custom:fluvy-humidity-card',
        entity: `sensor.am_liquid_${level}`,
        gauge: 'liquid',
        show_trend: false,
      })),
      {
        type: 'custom:fluvy-humidity-card',
        entity: 'sensor.am_liquid_mid',
        gauge: 'liquid',
        temperature_entity: 'sensor.am_thermo_mid',
      },
      {
        type: 'custom:fluvy-humidity-card',
        entity: 'sensor.am_liquid_away',
        gauge: 'liquid',
        show_trend: false,
        cols: 6,
      },
      {
        type: 'custom:fluvy-humidity-card',
        entity: 'sensor.am_liquid_mid',
        gauge: 'liquid',
        animate: false,
        show_trend: false,
        cols: 6,
      },
    ],
  },
];

export const sheet: SheetSpec = { states, history, frames };
