import { FluvyItemsCard } from '../../../../packages/cards/src/items/items-card.js';
import type { StateSeed } from '../hass.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the template sheet does
if (!customElements.get('fluvy-items-card'))
  customElements.define('fluvy-items-card', FluvyItemsCard);

/**
 * The Items card (#66): a FlightRadar24 sensor as the integration writes it — the count as its state, the aircraft in
 * `flights` — with three aircraft (one on the ground, one descending, one climbing), two photos drawn as SVG data URIs
 * and one that never arrives; rows, compact rows and tiles; a departures board mapped field by field (`preset: none`);
 * a list given by a template; empty; out of reach; half a section; and the sheet docked.
 */

/** An aircraft's photo that needs no network: a silhouette on a sky, 4:3, drawn as an SVG data URI. */
const photo = (sky: string, plane: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="${sky}"/><path d="M30 96 L96 84 L150 40 L166 44 L132 88 L190 84 L206 92 L132 104 L104 136 L92 134 L104 108 L60 112 L48 122 L40 120 L46 108 L30 100 Z" fill="${plane}"/></svg>`,
  )}`;
const PHOTO_DAY = photo('#9ec5e8', '#f4f4f0');
const PHOTO_DUSK = photo('#e8b08a', '#3a3530');
/** A picture that never arrives: the item is there, its photo is not. */
const PHOTO_BROKEN = 'data:image/png;base64,iVBORw0KAAAA';

/** A moment some minutes from the sheets' clock, as the integration writes its times: a Unix time in seconds. */
const at = (minutes: number): number => Math.round(NOW.getTime() / 1000) + minutes * 60;

/** A flight as FlightRadar24 writes one (the fields the card and its sheet read). */
const flight = (
  callsign: string,
  number: string,
  airline: [name: string, short: string],
  route: [from: string, fromCity: string, to: string, toCity: string],
  aircraft: [model: string, registration: string, photo: string],
  motion: [altitude: number, groundSpeed: number, verticalSpeed: number, heading: number],
  distance: number,
  position: [latitude: number, longitude: number],
  onGround: 0 | 1,
  times: [departure: number, arrival: number],
): Record<string, unknown> => ({
  id: callsign.toLowerCase(),
  flight_number: number,
  callsign,
  airline: airline[0],
  airline_short: airline[1],
  airport_origin_code_iata: route[0],
  airport_origin_city: route[1],
  airport_destination_code_iata: route[2],
  airport_destination_city: route[3],
  aircraft_model: aircraft[0],
  aircraft_registration: aircraft[1],
  aircraft_photo_small: aircraft[2],
  altitude: motion[0],
  ground_speed: motion[1],
  vertical_speed: motion[2],
  heading: motion[3],
  distance,
  latitude: position[0],
  longitude: position[1],
  on_ground: onGround,
  time_scheduled_departure: times[0],
  time_scheduled_arrival: times[1],
});

/** Three aircraft over the house: one taxiing, one coming down into the airport, one climbing out. */
const FLIGHTS = [
  flight(
    'RYR4PV',
    'FR3271',
    ['Ryanair', 'Ryanair'],
    ['BCN', 'Barcelona', 'DUB', 'Dublin'],
    ['Boeing 737 MAX 8', 'EI-HAT', PHOTO_BROKEN],
    [12_500, 290, 2400, 330],
    14.1,
    [41.4412, 2.0521],
    0,
    [at(-9), at(135)],
  ),
  flight(
    'KLM1412',
    'KL1412',
    ['KLM Royal Dutch Airlines', 'KLM'],
    ['AMS', 'Amsterdam', 'BCN', 'Barcelona'],
    ['Boeing 737-800', 'PH-BXE', PHOTO_DAY],
    [0, 12, 0, 240],
    3.2,
    [41.2971, 2.0785],
    1,
    [at(-140), at(-2)],
  ),
  flight(
    'VLG8012',
    'VY8012',
    ['Vueling', 'Vueling'],
    ['LHR', 'London', 'BCN', 'Barcelona'],
    ['Airbus A320-232', 'EC-MJB', PHOTO_DUSK],
    [4200, 210, -1100, 95],
    8.7,
    [41.3505, 1.9872],
    0,
    [at(-128), at(6)],
  ),
];

/** A metro departures board: a list of plain items, no preset knows them. */
const DEPARTURES = [
  { line: 'L3', destination: 'Zona Universitària', platform: '1', due: 2 },
  { line: 'L3', destination: 'Trinitat Nova', platform: '2', due: 5 },
  { line: 'L5', destination: 'Cornellà Centre', platform: '3', due: 7 },
  { line: 'L5', destination: 'Vall d’Hebron', platform: '4', due: 11 },
];

/** Parcels on their way: the list a template gives. */
const PARCELS = [
  {
    item: 'Running shoes',
    carrier: 'DHL',
    status: 'Out for delivery',
    eta: '2026-09-17T18:30:00+02:00',
  },
  { item: 'Desk lamp', carrier: 'UPS', status: 'In transit', eta: '2026-09-19T12:00:00+02:00' },
];

const sensor = (
  id: string,
  state: string,
  name: string,
  attributes: Record<string, unknown> = {},
): StateSeed => [id, state, { friendly_name: name, icon: 'mdi:airplane', ...attributes }];

const card = (extra: Record<string, unknown>) => ({
  type: 'custom:fluvy-items-card',
  entity: 'sensor.it_flights',
  ...extra,
});

/** The departures board, mapped by hand. */
const BOARD = {
  type: 'custom:fluvy-items-card',
  entity: 'sensor.it_departures',
  title: 'Next trains',
  icon: 'mdi:train',
  attribute: 'departures',
  preset: 'none',
  item_name: '{line} → {destination}',
  item_secondary: 'Platform {platform}',
  item_value: 'due',
  item_unit: 'min',
  sort: 'due',
};

export const sheet: SheetSpec = {
  states: [
    sensor('sensor.it_flights', '3', 'FlightRadar24 Current in area', { flights: FLIGHTS }),
    sensor('sensor.it_one', '1', 'FlightRadar24 Current in area', { flights: [FLIGHTS[1]] }),
    sensor('sensor.it_none', '0', 'FlightRadar24 Current in area', { flights: [] }),
    ['sensor.it_gone', 'unavailable', { friendly_name: 'FlightRadar24 Current in area' }],
    ['sensor.it_departures', '4', { friendly_name: 'Sants station', departures: DEPARTURES }],
    ['sensor.it_parcels', '2', { friendly_name: 'Parcels', parcels: PARCELS }],
  ],
  frames: [
    // the issue's card: the three aircraft, nearest first, their photos (one never loads) and their arrows
    { title: 'Items · flights', cards: [card({})] },
    { title: 'Items · compact', cards: [card({ variant: 'compact', max_rows: 3 })] },
    { title: 'Items · tiles', cards: [card({ variant: 'tiles', max_rows: 4 })] },
    // a list of the person's own, each field mapped
    { title: 'Items · a mapping', cards: [BOARD] },
    // the list a template gives: any sensor becomes a list
    {
      title: 'Items · from a template',
      cards: [
        {
          type: 'custom:fluvy-items-card',
          entity: 'sensor.it_parcels',
          title: 'Parcels',
          icon: 'mdi:package-variant-closed',
          items_template: "{{ state_attr('sensor.it_parcels', 'parcels') }}",
          item_name: 'item',
          item_secondary: '{carrier} · {status}',
          item_value: 'eta',
          max_rows: 2,
        },
      ],
    },
    // more items than rows: the list is cut to the rows, the head still counts them all
    {
      title: 'Items · two rows',
      cards: [card({ max_rows: 2, sort: 'altitude', sort_order: 'descending' })],
    },
    { title: 'Items · one aircraft', cards: [card({ entity: 'sensor.it_one', max_rows: 3 })] },
    { title: 'Items · empty', cards: [card({ entity: 'sensor.it_none', max_rows: 3 })] },
    // a box shorter than the empty panel: its words alone, at the box's height
    {
      title: 'Items · empty · one row',
      cards: [card({ entity: 'sensor.it_none', variant: 'compact', max_rows: 1 })],
    },
    {
      title: 'Items · out of reach',
      cards: [card({ entity: 'sensor.it_gone', max_rows: 3 })],
    },
    {
      title: 'Items · half a section',
      cards: [
        card({ cols: 6, max_rows: 3 }),
        { ...BOARD, cols: 6, variant: 'compact', max_rows: 3 },
      ],
    },
    {
      title: 'Items · half a section · tiles',
      cards: [
        card({ cols: 6, variant: 'tiles', max_rows: 3 }),
        { ...BOARD, cols: 6, variant: 'tiles', max_rows: 3 },
      ],
    },
    // a row's sheet: the flight's fields in order and the link to flightradar24.com (docked, at the sheet's 392)
    { title: 'Items · sheet', width: 392, cards: [card({ _sheet: true })] },
  ],
};
