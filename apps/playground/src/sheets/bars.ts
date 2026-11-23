import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

const BARS = 'custom:fluvy-bars-card';

const HUMIDITY = { unit_of_measurement: '%', device_class: 'humidity', state_class: 'measurement' };
const MOISTURE = { unit_of_measurement: '%', device_class: 'moisture', state_class: 'measurement' };
const BATTERY = { unit_of_measurement: '%', device_class: 'battery', state_class: 'measurement' };
/** A helper of the house's: a percentage set on a slider. */
const LIMIT = { min: 0, max: 100, step: 1, mode: 'slider', unit_of_measurement: '%' };

/** A plant's soil and the limits Plant Monitor keeps for it, as its number entities. */
const plant = (
  id: string,
  name: string,
  moisture: string,
  min: string,
  max: string,
): StateSeed[] => [
  [`sensor.bt_${id}_moisture`, moisture, { ...MOISTURE, friendly_name: name }],
  [`number.bt_${id}_min_soil_moisture`, min, { ...LIMIT, friendly_name: `${name} min moisture` }],
  [`number.bt_${id}_max_soil_moisture`, max, { ...LIMIT, friendly_name: `${name} max moisture` }],
];

/** Each room's comfort band, its limits the helpers' (the bathroom may run ten points damper), said under its name. */
const HIGH = "{{ states('input_number.bt_humidity_high') }}";
const BATHROOM_HIGH = "{{ states('input_number.bt_humidity_high') | int + 10 }}";
const room = (id: string, icon: string, high = HIGH) => ({
  entity: `sensor.bt_${id}_humidity`,
  icon,
  low: 'input_number.bt_humidity_low',
  high,
  secondary: `Comfort {{ states('input_number.bt_humidity_low') }} to ${high} %`,
});
const ROOMS = [
  room('living', 'mdi:sofa'),
  room('kitchen', 'mdi:stove'),
  room('bedroom', 'mdi:bed'),
  room('bathroom', 'mdi:shower', BATHROOM_HIGH),
  room('study', 'mdi:desk'),
];
/** What the head says while the dehumidifier runs; the card's own words while it is off. */
const DRYING = "{{ 'Drying' if is_state('switch.bt_dehumidifier', 'on') else '' }}";
const HUMIDITY_CARD = {
  type: BARS,
  title: 'Humidity',
  subtitle: '5 rooms',
  icon: 'humid',
  tone: 'water',
  badge: DRYING,
  badge_warn: '{count} to air',
  rows: ROOMS,
};
/** Plant Monitor keeps each plant's limits as number entities: the fern is thirsty, the basil too wet. */
const PLANTS_CARD = {
  type: BARS,
  title: 'Plants',
  subtitle: 'Living room',
  icon: 'leaf',
  badge_warn: '{count} need care',
  rows: ['monstera', 'fern', 'olive', 'basil'].map((id) => ({
    entity: `sensor.bt_${id}_moisture`,
    low: `number.bt_${id}_min_soil_moisture`,
    high: `number.bt_${id}_max_soil_moisture`,
  })),
};

/**
 * The Bars card's band read from the house (#253, asked by @SentinelXS): each room's humidity against limits kept in
 * helpers — the low one an entity, the high one a template (the bathroom's ten points over) — and a badge that says
 * what the dehumidifier is doing, the card's own count while it rests; the plants' limits from Plant Monitor's number
 * entities; a range from an inverter's rating in kW for a string in W; limits that cannot be read, which keep their
 * defaults. `?template_delay=3000` holds every answer: a limit still to come warns of nothing, and the badge waits.
 */
export const sheet: SheetSpec = {
  states: [
    ['sensor.bt_living_humidity', '47', { ...HUMIDITY, friendly_name: 'Living room' }],
    ['sensor.bt_kitchen_humidity', '55', { ...HUMIDITY, friendly_name: 'Kitchen' }],
    ['sensor.bt_bedroom_humidity', '63', { ...HUMIDITY, friendly_name: 'Bedroom' }],
    ['sensor.bt_bathroom_humidity', '74', { ...HUMIDITY, friendly_name: 'Bathroom' }],
    ['sensor.bt_study_humidity', '36', { ...HUMIDITY, friendly_name: 'Study' }],
    ['input_number.bt_humidity_low', '40', { ...LIMIT, friendly_name: 'Humidity low' }],
    ['input_number.bt_humidity_high', '60', { ...LIMIT, friendly_name: 'Humidity high' }],
    ['switch.bt_dehumidifier', 'on', { friendly_name: 'Dehumidifier' }],
    ...plant('monstera', 'Monstera', '42', '20', '60'),
    ...plant('fern', 'Boston fern', '31', '40', '70'),
    ...plant('olive', 'Olive tree', '18', '15', '50'),
    ...plant('basil', 'Basil', '72', '30', '65'),
    [
      'sensor.bt_carport_power',
      '2300',
      { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Carport roof' },
    ],
    [
      'sensor.bt_inverter_rating',
      '3.68',
      { unit_of_measurement: 'kW', device_class: 'power', friendly_name: 'Inverter rating' },
    ],
    ['sensor.bt_hall_motion_battery', '12', { ...BATTERY, friendly_name: 'Hall motion' }],
    ['sensor.bt_front_door_battery', '64', { ...BATTERY, friendly_name: 'Front door lock' }],
    ['sensor.bt_smoke_battery', '17', { ...BATTERY, friendly_name: 'Smoke alarm' }],
    ['input_number.bt_battery_low', 'unavailable', { ...LIMIT, friendly_name: 'Battery low' }],
  ],
  frames: [
    { title: 'Bars · limits from the house (#253)', cards: [HUMIDITY_CARD] },
    { title: 'Bars · limits from the house · 266', width: 266, cards: [HUMIDITY_CARD] },
    {
      title: 'Bars · limits from the house · compact',
      cards: [{ ...HUMIDITY_CARD, variant: 'compact' }],
    },
    { title: 'Bars · a plant’s own limits', cards: [PLANTS_CARD] },
    // half a section on a phone and on a desktop: a room's comfort band under its name gives way before its figure
    {
      title: 'Bars · limits from the house · halves',
      heights: [152, 172],
      cards: [
        { ...HUMIDITY_CARD, cols: 6 },
        { ...PLANTS_CARD, cols: 6 },
      ],
    },
    // a string's range from its inverter's rating, read in kW for a row in W; limits that cannot be read (a template
    // that fails, a helper gone) keep a battery's 20 %
    {
      title: 'Bars · a range from an entity, limits that cannot be read',
      cards: [
        {
          type: BARS,
          title: 'Carport',
          icon: 'sun',
          tone: 'solar',
          rows: [
            {
              entity: 'sensor.bt_carport_power',
              icon: 'sun',
              tone: 'solar',
              max: 'sensor.bt_inverter_rating',
              secondary: 'Inverter rated 3.68 kW',
            },
          ],
        },
        {
          type: BARS,
          title: 'Batteries',
          icon: 'battery',
          rows: [
            { entity: 'sensor.bt_hall_motion_battery', low: '{{ nonsense( }}' },
            { entity: 'sensor.bt_front_door_battery', low: 'input_number.bt_battery_low' },
            { entity: 'sensor.bt_smoke_battery', low: "{{ states('sensor.bt_nowhere') }}" },
          ],
        },
      ],
    },
  ],
};
