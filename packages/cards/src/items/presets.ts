import { formatNumber, localize, type HomeAssistant, type MessageKey } from '@fluvy/core';
import type { IconRef } from '@fluvy/ui';
import {
  formatValue,
  labelOf,
  parsePattern,
  resolveField,
  valueAt,
  type FieldFormat,
  type Item,
  type Pattern,
  type SortOrder,
} from './fields.js';

/*
 * How an item is shown: by the fields the config maps (`item_name`, `item_value` …), or by a preset that knows the
 * integration's shape — the flights of FlightRadar24 (#66), detected or asked for. A preset says what a row shows,
 * what the sheet lists, how the list is sorted and what the head says.
 */

/** What a row (or a tile) shows of an item. */
export interface Shown {
  readonly name: string;
  readonly secondary: string;
  readonly value: string;
  /** A 16 glyph before the value (climbing, descending). */
  readonly glyph?: IconRef;
  /** The value is a state in words, in the secondary ink. */
  readonly quiet?: boolean;
  readonly icon: IconRef;
  /** The picture's URL; '' for none. */
  readonly image: string;
  /** Where the item's link goes; '' for none. */
  readonly url: string;
}

/** A line of the sheet: a label and what it says. */
export interface SheetRow {
  readonly label: string;
  readonly value: string;
}

export type PresetName = 'auto' | 'none' | 'flights';

/** A preset: an integration's shape, known. */
export interface Preset {
  readonly id: Exclude<PresetName, 'auto' | 'none'>;
  readonly icon: IconRef;
  readonly title: MessageKey;
  /** The head's count of the items, a plural. */
  readonly count: MessageKey;
  readonly empty: MessageKey;
  /** What the sheet's link round says. */
  readonly link: MessageKey;
  readonly sort: string;
  readonly order: SortOrder;
  row(item: Item, hass: HomeAssistant | undefined): Shown;
  sheet(item: Item, hass: HomeAssistant | undefined): SheetRow[];
}

/** The fields a config maps an item's row by (`item_*`), parsed once. */
export interface Mapping {
  readonly name: Pattern;
  readonly secondary: Pattern;
  readonly value: Pattern;
  readonly unit: Pattern;
  readonly icon: Pattern;
  readonly image: Pattern;
  readonly url: Pattern;
}

/** The name an item goes by where the config says nothing: the usual keys, in turn. */
const USUAL_NAME = '{name|title|label|id}';

/**
 * A config's `item_*` fields as patterns; a name left unmapped takes the usual keys. The unit is the words written
 * (`min`), a field of the item only with braces (`{unit}`).
 */
export function mappingOf(config: Readonly<Record<string, unknown>>): Mapping {
  const text = (key: string): string => {
    const value = config[`item_${key}`];
    return typeof value === 'string' ? value.trim() : '';
  };
  const pattern = (key: string, fallback = ''): Pattern => parsePattern(text(key) || fallback);
  const unit = text('unit');
  return {
    name: pattern('name', USUAL_NAME),
    secondary: pattern('secondary'),
    value: pattern('value'),
    unit: unit.includes('{') ? parsePattern(unit) : unit ? [unit] : [],
    icon: pattern('icon'),
    image: pattern('image'),
    url: pattern('url'),
  };
}

/** A value with its unit after it, where there is a value. */
const withUnit = (value: string, unit: string): string =>
  value && unit ? `${value}${unit.startsWith('°') ? '' : ' '}${unit}` : value;

/** An item's row by the config's mapping: its icon the mapped one, else the card's. */
export function rowOf(
  item: Item,
  mapping: Mapping,
  hass: HomeAssistant | undefined,
  icon: IconRef,
): Shown {
  const mapped = resolveField(item, mapping.icon, hass);
  return {
    name: resolveField(item, mapping.name, hass),
    secondary: resolveField(item, mapping.secondary, hass),
    value: withUnit(
      resolveField(item, mapping.value, hass),
      resolveField(item, mapping.unit, hass),
    ),
    icon: mapped.includes(':') ? (mapped as IconRef) : icon,
    image: resolveField(item, mapping.image, hass),
    url: resolveField(item, mapping.url, hass),
  };
}

/** An item's sheet without a preset: every field that is a line, labelled by its own name. */
export function sheetOf(item: Item, hass: HomeAssistant | undefined): SheetRow[] {
  return Object.entries(item)
    .map(([key, value]) => ({ label: labelOf(key), value: formatValue(hass, value) }))
    .filter((row) => row.value);
}

/* ---------- flights (FlightRadar24) ---------- */

/** A vertical speed from here, in ft/min, is a climb (or, below its negative, a descent). */
const CLIMB = 100;

/** The flight's name: its callsign, else its flight number. */
const FLIGHT_NAME = parsePattern('{callsign|flight_number}');
/** Its route by IATA codes, then its aircraft. */
const FLIGHT_LINE = parsePattern(
  '{airport_origin_code_iata} → {airport_destination_code_iata} · {aircraft_model}',
);
const FLIGHT_PHOTO = parsePattern('aircraft_photo_small');

/**
 * The sheet's lines in order: a label, a pattern, the unit after the value (as the integration measures: feet,
 * knots, feet a minute, degrees, kilometres) and the figure's digits; the times are Unix times, the first known of the
 * real, the estimated and the scheduled.
 */
const FLIGHT_SHEET: ReadonlyArray<
  readonly [label: MessageKey, pattern: Pattern, unit?: string, format?: FieldFormat]
> = [
  ['flights.airline', parsePattern('{airline|airline_short}')],
  ['flights.flight_number', parsePattern('flight_number')],
  ['flights.callsign', parsePattern('callsign')],
  [
    'flights.route',
    parsePattern(
      '{airport_origin_city|airport_origin_code_iata} → {airport_destination_city|airport_destination_code_iata}',
    ),
  ],
  ['flights.model', parsePattern('aircraft_model')],
  ['flights.registration', parsePattern('aircraft_registration')],
  ['flights.altitude', parsePattern('altitude'), 'ft', { digits: 0 }],
  ['flights.ground_speed', parsePattern('ground_speed'), 'kt', { digits: 0 }],
  ['flights.vertical_speed', parsePattern('vertical_speed'), 'ft/min', { digits: 0 }],
  ['flights.heading', parsePattern('heading'), '°', { digits: 0 }],
  ['flights.distance', parsePattern('distance'), 'km', { digits: 1 }],
  ['flights.position', parsePattern('{latitude}, {longitude}'), '', { digits: 4 }],
  [
    'flights.departure',
    parsePattern('{time_real_departure|time_estimated_departure|time_scheduled_departure}'),
    '',
    { epoch: true },
  ],
  [
    'flights.arrival',
    parsePattern('{time_real_arrival|time_estimated_arrival|time_scheduled_arrival}'),
    '',
    { epoch: true },
  ],
];

/** Whether the aircraft is on the ground, as the integration writes it (1, or true). */
const onGround = (item: Item): boolean => {
  const value = valueAt(item, 'on_ground');
  return value === true || value === 1 || value === '1';
};

/** Climbing or descending, from the vertical speed; neither in level flight or where it is not said. */
const trend = (item: Item): IconRef | undefined => {
  const speed = valueAt(item, 'vertical_speed');
  if (typeof speed !== 'number') return undefined;
  return speed >= CLIMB ? 'trendUp' : speed <= -CLIMB ? 'trendDown' : undefined;
};

/** The flight on flightradar24.com, by its callsign (else its flight number); nowhere without either. */
const flightLink = (item: Item): string => {
  const id = [valueAt(item, 'callsign'), valueAt(item, 'flight_number')].find(
    (value) => typeof value === 'string' && value.trim(),
  ) as string | undefined;
  return id ? `https://www.flightradar24.com/${encodeURIComponent(id.trim())}` : '';
};

/**
 * The flights preset (FlightRadar24's shape, the OpenSky integration's alike): the callsign over the route and the
 * aircraft, the altitude in feet with a climb or descent arrow — or "On ground" — the aircraft's photo, the nearest
 * first; the sheet lists the flight and links it on flightradar24.com.
 */
export const FLIGHTS: Preset = {
  id: 'flights',
  icon: 'mdi:airplane',
  title: 'flights.title',
  count: 'flights.count',
  empty: 'flights.empty',
  link: 'flights.open',
  sort: 'distance',
  order: 'ascending',
  row: (item, hass) => {
    const altitude = valueAt(item, 'altitude');
    const grounded = onGround(item);
    const glyph = grounded ? undefined : trend(item);
    return {
      name: resolveField(item, FLIGHT_NAME, hass),
      secondary: resolveField(item, FLIGHT_LINE, hass),
      value: grounded
        ? localize(hass, 'flights.on_ground')
        : typeof altitude === 'number'
          ? `${formatNumber(hass, altitude, { digits: 0 })} ft`
          : '',
      ...(grounded ? { quiet: true } : {}),
      ...(glyph ? { glyph } : {}),
      icon: 'mdi:airplane',
      image: resolveField(item, FLIGHT_PHOTO, hass),
      url: flightLink(item),
    };
  },
  sheet: (item, hass) =>
    FLIGHT_SHEET.map(([label, pattern, unit = '', format]) => ({
      label: localize(hass, label),
      value: withUnit(resolveField(item, pattern, hass, format), unit),
    })).filter((row) => row.value),
};

/**
 * The preset a card draws by: the one asked for, none, or — `auto` — flights where the attribute is `flights` or the
 * items carry a callsign or a flight number.
 */
export function presetOf(
  config: Readonly<Record<string, unknown>>,
  attribute: string,
  items: readonly Item[],
): Preset | undefined {
  const asked = config['preset'] ?? 'auto';
  if (asked === 'flights') return FLIGHTS;
  if (asked !== 'auto') return undefined;
  return attribute === 'flights' ||
    items.some((item) => 'callsign' in item || 'flight_number' in item)
    ? FLIGHTS
    : undefined;
}
