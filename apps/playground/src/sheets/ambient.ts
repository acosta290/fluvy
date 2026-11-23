import { FluvyOpeningsCard } from '../../../../packages/cards/src/openings/openings-card.js';
import { FluvyPeopleCard } from '../../../../packages/cards/src/people/people-card.js';
import { FluvyMapCard } from '../../../../packages/cards/src/map/map-card.js';
import { FluvyScenesCard } from '../../../../packages/cards/src/scenes/scenes-card.js';
import { FluvySensorCard } from '../../../../packages/cards/src/sensor/sensor-card.js';
import { FluvyCompassCard } from '../../../../packages/cards/src/compass/compass-card.js';
import { FluvyWeatherCard } from '../../../../packages/cards/src/weather/weather-card.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import type { StateSeed } from '../hass.js';

if (!customElements.get('fluvy-weather-card'))
  customElements.define('fluvy-weather-card', FluvyWeatherCard);
if (!customElements.get('fluvy-compass-card'))
  customElements.define('fluvy-compass-card', FluvyCompassCard);
if (!customElements.get('fluvy-sensor-card'))
  customElements.define('fluvy-sensor-card', FluvySensorCard);
if (!customElements.get('fluvy-people-card'))
  customElements.define('fluvy-people-card', FluvyPeopleCard);
if (!customElements.get('fluvy-openings-card'))
  customElements.define('fluvy-openings-card', FluvyOpeningsCard);
if (!customElements.get('fluvy-map-card')) customElements.define('fluvy-map-card', FluvyMapCard);
if (!customElements.get('fluvy-scenes-card'))
  customElements.define('fluvy-scenes-card', FluvyScenesCard);

/*
 * The sheet's moment — Thursday 17 September 2026, 21:47 — is frozen into every card that reads a
 * clock (`_now`), and the forecast is dated from it, so a frame reads the same whenever it is shot.
 * Entity ids carry an `am_` prefix: every sheet shares one mock when the playground mounts them all.
 */
const NOW = new Date(2026, 8, 17, 21, 47, 12); // the playground's own `NOW` (scenes.ts imports this module, so it cannot be imported back)
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const _now = NOW.toISOString();
const at = (offset: number): string => new Date(NOW.getTime() + offset).toISOString();
const topOfHour = NOW.getTime() - (NOW.getTime() % HOUR);

const WEATHER_ATTRS = {
  temperature_unit: '°C',
  wind_speed_unit: 'km/h',
  precipitation_unit: 'mm',
  pressure_unit: 'hPa',
};

/** A face with no network behind it: a data URI, so a missing file can never colour the verify run. */
const FACE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='88' height='88'>" +
  "<rect width='88' height='88' fill='%23a8875a'/><circle cx='44' cy='33' r='15' fill='%23f4ead6'/>" +
  "<path d='M13 88a31 31 0 0 1 62 0z' fill='%23f4ead6'/></svg>";

const CONDITIONS = [
  'sunny',
  'clear-night',
  'partlycloudy',
  'cloudy',
  'rainy',
  'pouring',
  'snowy',
  'snowy-rainy',
  'fog',
  'hail',
  'lightning',
  'lightning-rainy',
  'windy',
  'windy-variant',
  'exceptional',
] as const;
const conditionId = (condition: string): string => `weather.am_c_${condition.replace(/-/g, '_')}`;

const conditionSeeds: StateSeed[] = CONDITIONS.map((condition, index) => [
  conditionId(condition),
  condition,
  {
    friendly_name: 'Outside',
    ...WEATHER_ATTRS,
    temperature: 20 - index,
    apparent_temperature: 18 - index,
    humidity: 50 + index,
    wind_speed: 8 + index,
    wind_bearing: index * 24,
  },
]);

const conditionFrame: FrameSpec = {
  title: 'Every condition',
  cards: CONDITIONS.map((condition) => ({
    type: 'custom:fluvy-weather-card',
    entity: conditionId(condition),
    forecast: 'none',
    _now,
  })),
};

/* The sheet's day of living-room temperature (19.2 … 22.4, mean 20.9) and humidity, at the 48 points a card asks for. */
const TEMPERATURE = [
  19.8, 19.74, 19.67, 19.58, 19.49, 19.4, 19.31, 19.23, 19.2, 19.2, 19.24, 19.32, 19.43, 19.61,
  19.82, 20.05, 20.27, 20.51, 20.75, 20.98, 21.18, 21.37, 21.55, 21.72, 21.89, 22.08, 22.26, 22.38,
  22.39, 22.31, 22.17, 22.04, 21.93, 21.83, 21.73, 21.63, 21.51, 21.39, 21.28, 21.21, 21.21, 21.27,
  21.34, 21.4, 21.41, 21.41, 21.4, 21.4,
];
const HUMIDITY = [
  52, 51.87, 51.69, 51.47, 51.24, 50.99, 50.73, 50.49, 50.26, 50.07, 49.91, 49.78, 49.68, 49.59,
  49.51, 49.43, 49.34, 49.24, 49.12, 48.97, 48.77, 48.54, 48.28, 48.01, 47.74, 47.5, 47.28, 47.12,
  47.01, 46.99, 47.05, 47.17, 47.34, 47.52, 47.7, 47.86, 47.97, 48.01, 47.97, 47.85, 47.65, 47.41,
  47.15, 46.87, 46.59, 46.35, 46.14, 46,
];
const POWER = [
  120, 118, 115, 112, 110, 108, 108, 110, 140, 180, 260, 340, 420, 510, 620, 700, 760, 800, 820,
  810, 780, 740, 690, 640, 600, 560, 520, 480, 450, 420, 400, 380, 360, 350, 340, 330, 320, 310,
  300, 300, 310, 330, 360, 400, 440, 470, 490, 505,
];
const PRESSURE = Array.from(
  { length: 48 },
  (_, index) => 1013.2 + Math.round(Math.sin(index / 7) * 38) / 10,
);

// six are the sheet's columns, the rest what a step of hours reads
const SHEET_HOURS = [
  ...['sunny', 'sunny', 'cloudy', 'cloudy', 'rainy', 'rainy'],
  ...['rainy', 'cloudy', 'cloudy', 'partlycloudy', 'partlycloudy', 'sunny'],
];
const SHEET_TEMPERATURES = [18, 16.4, 15.2, 14, 13.1, 12.6, 12.1, 11.8, 11.5, 11.2, 11, 10.9]; // the card rounds a forecast to whole degrees
const CLEAR_HOURS = ['sunny', 'sunny', 'sunny', 'partlycloudy', 'sunny', 'partlycloudy'];
const DAYS = [
  { condition: 'partlycloudy', temperature: 21.6, templow: 13.2, precipitation_probability: 0 },
  { condition: 'sunny', temperature: 23, templow: 12, precipitation_probability: 0 },
  { condition: 'cloudy', temperature: 20, templow: 13, precipitation_probability: 5 },
  { condition: 'rainy', temperature: 17, templow: 11, precipitation_probability: 60 },
  { condition: 'lightning-rainy', temperature: 19, templow: 12, precipitation: 7.4 },
  { condition: 'snowy', temperature: 2, templow: -3, precipitation_probability: 80 },
];
/** The cabin's week: figures below zero, the widest a day column has to hold. */
const COLD_DAYS = [
  { condition: 'snowy', temperature: -4, templow: -12, precipitation_probability: 80 },
  { condition: 'snowy-rainy', temperature: -1, templow: -9, precipitation_probability: 60 },
  { condition: 'cloudy', temperature: -13, templow: -21, precipitation_probability: 10 },
  { condition: 'sunny', temperature: -8, templow: -19, precipitation_probability: 0 },
  { condition: 'fog', temperature: -3, templow: -11, precipitation_probability: 20 },
  { condition: 'windy', temperature: 1, templow: -6, precipitation_probability: 5 },
];

const TILE_TEMPERATURE = {
  type: 'custom:fluvy-sensor-card',
  entity: 'sensor.am_living_temperature',
  variant: 'tile',
  name: 'Temperature',
  _now,
  cols: 6,
};
const TILE_HUMIDITY = {
  type: 'custom:fluvy-sensor-card',
  entity: 'sensor.am_living_humidity',
  variant: 'tile',
  name: 'Humidity',
  icon: 'drop',
  _now,
  cols: 6,
};

/** A weather station's wind on the Compass card (#209): its speed in the ring, its 10-minute average beside it. */
const COMPASS_WIND = {
  type: 'custom:fluvy-compass-card',
  name: 'Wind',
  entity: 'sensor.am_wind_speed',
  direction_entity: 'sensor.am_wind_bearing',
  secondary_direction_entity: 'sensor.am_wind_bearing_avg',
};

/** The station with its readouts under the ring. */
const COMPASS_STATION = {
  ...COMPASS_WIND,
  name: 'Garden station',
  stats: [
    { entity: 'sensor.am_wind_gust', name: 'Gusts' },
    { entity: 'sensor.am_wind_max_today', name: 'Max today' },
    { entity: 'sensor.am_wind_bearing_avg', name: '10-min avg' },
  ],
};

/** The sun's azimuth: the bearing itself is the figure. */
const COMPASS_SUN = {
  type: 'custom:fluvy-compass-card',
  name: 'Sun',
  direction_entity: 'sun.sun',
  label: 'Azimuth',
};

/** A car's heading, read from its tracker's attribute, its speed in the ring. */
const COMPASS_CAR = {
  type: 'custom:fluvy-compass-card',
  entity: 'sensor.am_model_y_speed',
  name: 'Model Y',
  direction_entity: 'device_tracker.am_model_y',
  direction_attribute: 'heading',
  indicator: 'ticks',
};

export const sheet: SheetSpec = {
  states: [
    // the sheet draws a sun at 21:47: the mock's sun sets at 22:30, so the hours after it show the night rule
    [
      'sun.sun',
      'above_horizon',
      {
        friendly_name: 'Sun',
        azimuth: 291.4,
        elevation: -5.8,
        next_setting: at(43 * 60_000),
        next_rising: at(9 * HOUR + 44 * 60_000),
      },
    ],

    [
      'weather.am_home',
      'sunny',
      {
        friendly_name: 'Outside',
        ...WEATHER_ATTRS,
        temperature: 18,
        apparent_temperature: 16,
        humidity: 62,
        wind_speed: 12,
        wind_bearing: 315,
        pressure: 1014,
        uv_index: 3,
      },
    ],
    [
      'weather.am_evening',
      'partlycloudy',
      {
        friendly_name: 'Terrace',
        ...WEATHER_ATTRS,
        temperature: 17.6,
        apparent_temperature: 16.4,
        humidity: 58,
        wind_speed: 9,
        wind_bearing: 'ssw',
      },
    ],
    [
      'weather.am_night',
      'clear-night',
      {
        friendly_name: 'Outside',
        ...WEATHER_ATTRS,
        temperature: 11,
        apparent_temperature: 9,
        humidity: 78,
        wind_speed: 6,
        wind_bearing: 200,
      },
    ],
    [
      'weather.am_basic',
      'cloudy',
      { friendly_name: 'Rooftop', ...WEATHER_ATTRS, temperature: 14.3, humidity: 71 },
    ],
    [
      'weather.am_cold',
      'snowy',
      {
        friendly_name: 'Cabin',
        ...WEATHER_ATTRS,
        temperature: -4.5,
        apparent_temperature: -9.4,
        wind_speed: 46,
        wind_bearing: 90,
      },
    ],
    [
      'weather.am_unknown',
      'unknown',
      { friendly_name: 'Outside', ...WEATHER_ATTRS, temperature: 15, temperature_unit: '°C' },
    ],
    ['weather.am_gone', 'unavailable', { friendly_name: 'Outside' }],
    ...conditionSeeds,

    [
      'sensor.am_living_temperature',
      '21.4',
      {
        friendly_name: 'Living room temperature',
        unit_of_measurement: '°C',
        device_class: 'temperature',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_living_humidity',
      '46',
      {
        friendly_name: 'Living room humidity',
        unit_of_measurement: '%',
        device_class: 'humidity',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_house_power',
      '505',
      {
        friendly_name: 'House power',
        unit_of_measurement: 'W',
        device_class: 'power',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_pressure',
      '1013.2',
      {
        friendly_name: 'Barometer',
        unit_of_measurement: 'hPa',
        device_class: 'atmospheric_pressure',
        state_class: 'measurement',
      },
    ],
    // the Compass card's houses (#209): a weather station's wind, its 10-minute average, its gusts and the day's
    // highest; a pier's anemometer that says its direction in letters; a car and its heading; a station out of reach
    [
      'sensor.am_wind_speed',
      '14.2',
      {
        friendly_name: 'Wind speed',
        unit_of_measurement: 'km/h',
        device_class: 'wind_speed',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_wind_bearing',
      '248',
      {
        friendly_name: 'Wind direction',
        unit_of_measurement: '°',
        device_class: 'wind_direction',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_wind_bearing_avg',
      '236',
      {
        friendly_name: 'Wind direction, 10-minute average',
        unit_of_measurement: '°',
        device_class: 'wind_direction',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_wind_gust',
      '23.8',
      {
        friendly_name: 'Wind gust',
        unit_of_measurement: 'km/h',
        device_class: 'wind_speed',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_wind_max_today',
      '41.0',
      {
        friendly_name: 'Highest gust today',
        unit_of_measurement: 'km/h',
        device_class: 'wind_speed',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_pier_wind_speed',
      '52.6',
      {
        friendly_name: 'Pier wind speed',
        unit_of_measurement: 'km/h',
        device_class: 'wind_speed',
        state_class: 'measurement',
      },
    ],
    ['sensor.am_pier_wind_direction', 'wsw', { friendly_name: 'Pier wind direction' }],
    [
      'sensor.am_wind_speed_gone',
      'unavailable',
      { friendly_name: 'Wind speed', unit_of_measurement: 'km/h', device_class: 'wind_speed' },
    ],
    [
      'sensor.am_wind_bearing_gone',
      'unavailable',
      { friendly_name: 'Wind direction', unit_of_measurement: '°', device_class: 'wind_direction' },
    ],
    [
      'device_tracker.am_model_y',
      'not_home',
      { friendly_name: 'Model Y', source_type: 'gps', heading: 47 },
    ],
    [
      'sensor.am_model_y_speed',
      '64',
      {
        friendly_name: 'Model Y Speed',
        unit_of_measurement: 'km/h',
        device_class: 'speed',
        state_class: 'measurement',
      },
    ],
    // a room's pair as an integration names them: the readouts say "Temperature" and "Humidity" with nothing set
    [
      'sensor.am_office_temperature',
      '24.5',
      {
        friendly_name: 'Office climate temperature',
        unit_of_measurement: '°C',
        device_class: 'temperature',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_office_humidity',
      '40.9',
      {
        friendly_name: 'Office climate humidity',
        unit_of_measurement: '%',
        device_class: 'humidity',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.am_no_history',
      '17.2',
      { friendly_name: 'Garden', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    ['sensor.am_washer', 'Rinsing', { friendly_name: 'Washer' }],
    [
      'sensor.am_broken',
      'unavailable',
      { friendly_name: 'Loft sensor', unit_of_measurement: '°C', device_class: 'temperature' },
    ],

    [
      'person.am_marta',
      'home',
      {
        friendly_name: 'Marta',
        entity_picture: FACE,
        source: 'device_tracker.marta_phone',
        latitude: 41.39,
        longitude: 2.16,
      },
    ],
    [
      'person.am_pau',
      'home',
      { friendly_name: 'Pau', entity_picture: FACE, source: 'device_tracker.pau_phone' },
    ],
    [
      'person.am_ona',
      'School',
      { friendly_name: 'Ona', source: 'device_tracker.ona_phone', latitude: 41.4, longitude: 2.17 },
    ],
    [
      'person.am_jan',
      'not_home',
      { friendly_name: 'Jan Oliver', latitude: 41.6, longitude: 2.3, gps_accuracy: 30 },
    ],
    [
      'zone.home',
      '2',
      { friendly_name: 'Home', latitude: 41.39, longitude: 2.16, radius: 100, icon: 'mdi:home' },
    ],
    [
      'zone.am_school',
      '1',
      { friendly_name: 'School', latitude: 41.4, longitude: 2.17, radius: 150, icon: 'mdi:school' },
    ],
    ['zone.am_work', '0', { friendly_name: 'Work', latitude: 41.5, longitude: 2.2, radius: 200 }],
    ['person.am_noa', 'unknown', { friendly_name: 'Noa' }],
    ['person.am_guest', 'unavailable', { friendly_name: 'Guest' }],
    /* the family's phones: a tracker each and its battery on the same device (the registry below ties them) */
    ['device_tracker.marta_phone', 'home', { friendly_name: 'Marta’s phone', source_type: 'gps' }],
    ['device_tracker.pau_phone', 'home', { friendly_name: 'Pau’s phone', source_type: 'gps' }],
    ['device_tracker.ona_phone', 'not_home', { friendly_name: 'Ona’s phone', source_type: 'gps' }],
    [
      'sensor.marta_phone_battery',
      '78',
      { friendly_name: 'Marta’s phone battery', unit_of_measurement: '%', device_class: 'battery' },
    ],
    [
      'sensor.pau_phone_battery',
      '18',
      { friendly_name: 'Pau’s phone battery', unit_of_measurement: '%', device_class: 'battery' },
    ],
    [
      'sensor.ona_phone_battery',
      'unavailable',
      { friendly_name: 'Ona’s phone battery', unit_of_measurement: '%', device_class: 'battery' },
    ],
    // Marta's phone is on its charger (Android's charging sensor, on its device)
    [
      'binary_sensor.marta_phone_is_charging',
      'on',
      { friendly_name: 'Marta’s phone is charging', device_class: 'battery_charging' },
    ],
    // a tracker that keeps its battery as an attribute (Life360, iCloud3), with no sensor of its own
    [
      'device_tracker.lia_phone',
      'home',
      { friendly_name: 'Lia', source_type: 'gps', battery_level: 54 },
    ],
    [
      'sensor.jan_watch_battery',
      '64',
      { friendly_name: 'Jan’s watch', unit_of_measurement: '%', device_class: 'battery' },
    ],

    ['binary_sensor.am_front_door', 'off', { friendly_name: 'Front door', device_class: 'door' }],
    [
      'binary_sensor.am_kitchen_window',
      'on',
      { friendly_name: 'Kitchen window', device_class: 'window' },
    ],
    [
      'binary_sensor.am_hallway_motion',
      'off',
      { friendly_name: 'Hallway motion', device_class: 'motion' },
    ],
    [
      'binary_sensor.am_kitchen_leak',
      'off',
      { friendly_name: 'Kitchen leak', device_class: 'moisture' },
    ],
    [
      'binary_sensor.am_garage_door',
      'off',
      { friendly_name: 'Garage door', device_class: 'garage_door' },
    ],
    ['binary_sensor.am_smoke', 'off', { friendly_name: 'Smoke', device_class: 'smoke' }],
    ['binary_sensor.am_attic_smoke', 'on', { friendly_name: 'Attic smoke', device_class: 'smoke' }],
    [
      'binary_sensor.am_basement_leak',
      'on',
      { friendly_name: 'Basement leak', device_class: 'moisture' },
    ],
    [
      'binary_sensor.am_porch_motion',
      'on',
      { friendly_name: 'Porch motion', device_class: 'motion' },
    ],
    ['binary_sensor.am_shed', 'unavailable', { friendly_name: 'Shed door', device_class: 'door' }],
    // #102: a Shelly BLU Door/Window on ZHA, its contact a window and its tilt of no class; a side door's contact of
    // none
    [
      'binary_sensor.am_bedroom_window',
      'off',
      { friendly_name: 'Bedroom window', device_class: 'window' },
    ],
    ['binary_sensor.am_bedroom_window_tilt', 'on', { friendly_name: 'Bedroom window tilt' }],
    ['binary_sensor.am_side_door_contact', 'off', { friendly_name: 'Side door contact' }],
    ['lock.am_back_door', 'locked', { friendly_name: 'Back door lock' }],
    // #105's curtains, as the reporter listed them: three open, one shut; a blind a third up by its position, and a
    // garage door shut
    [
      'cover.am_bank',
      'open',
      { friendly_name: 'Bank', device_class: 'curtain', current_position: 100 },
    ],
    [
      'cover.am_schuifpui',
      'open',
      { friendly_name: 'Schuifpui', device_class: 'curtain', current_position: 100 },
    ],
    ['cover.am_kantoor', 'opening', { friendly_name: 'Kantoor', device_class: 'curtain' }],
    [
      'cover.am_slaapkamer',
      'closed',
      { friendly_name: 'Slaapkamer', device_class: 'curtain', current_position: 0 },
    ],
    [
      'cover.am_study_blind',
      'closed',
      { friendly_name: 'Study blind', device_class: 'blind', current_position: 30 },
    ],
    [
      'cover.am_garage',
      'closed',
      { friendly_name: 'Garage door', device_class: 'garage', current_position: 0 },
    ],
    // #67: the real last change — a door Home Assistant says changed just now (a restart) beside the helper that
    // kept it, a window whose own attribute holds when it opened (an epoch), a door whose helper says nothing yet
    [
      'binary_sensor.am_cellar_door',
      'off',
      { friendly_name: 'Cellar door', device_class: 'door' },
      0,
    ],
    [
      'sensor.am_cellar_door_real_last_changed',
      at(-4 * HOUR),
      { friendly_name: 'Cellar door · real last change', device_class: 'timestamp' },
    ],
    [
      'binary_sensor.am_loft_window',
      'on',
      {
        friendly_name: 'Loft window',
        device_class: 'window',
        opened_at: Math.round((NOW.getTime() - 3 * HOUR) / 1000),
      },
      0,
    ],
    ['binary_sensor.am_side_gate', 'off', { friendly_name: 'Side gate', device_class: 'door' }, 0],
    [
      'sensor.am_side_gate_real_last_changed',
      'unknown',
      { friendly_name: 'Side gate · real last change', device_class: 'timestamp' },
    ],

    [
      'scene.am_morning',
      at(-14 * HOUR),
      {
        friendly_name: 'Morning',
        entity_id: ['light.a', 'light.b', 'light.c', 'light.d', 'switch.e', 'cover.f', 'climate.g'],
      },
    ],
    [
      'scene.am_cinema',
      at(-25 * HOUR),
      { friendly_name: 'Cinema', entity_id: ['light.a', 'light.b', 'media_player.c', 'cover.d'] },
    ],
    ['scene.am_night', at(-22 * HOUR), { friendly_name: 'Night', entity_id: ['light.a'] }],
    ['scene.am_away', 'unknown', { friendly_name: 'Away' }],
    ['script.am_goodnight', 'off', { friendly_name: 'Good night', last_triggered: at(-46 * HOUR) }],
    ['scene.am_gone', 'unavailable', { friendly_name: 'Holiday' }],
  ],

  // the phones' devices: a person's battery is found on the device of the tracker they are seen by
  registry: {
    entities: Object.fromEntries(
      (['marta', 'pau', 'ona'] as const)
        .flatMap((who) => [
          [
            `device_tracker.${who}_phone`,
            {
              entity_id: `device_tracker.${who}_phone`,
              device_id: `d-${who}-phone`,
              labels: [],
              platform: 'mobile_app',
            },
          ],
          [
            `sensor.${who}_phone_battery`,
            {
              entity_id: `sensor.${who}_phone_battery`,
              device_id: `d-${who}-phone`,
              labels: [],
              platform: 'mobile_app',
            },
          ],
        ])
        .concat([
          [
            'binary_sensor.marta_phone_is_charging',
            {
              entity_id: 'binary_sensor.marta_phone_is_charging',
              device_id: 'd-marta-phone',
              labels: [],
              platform: 'mobile_app',
            },
          ],
        ]),
    ),
    devices: Object.fromEntries(
      (['marta', 'pau', 'ona'] as const).map((who) => [
        `d-${who}-phone`,
        {
          id: `d-${who}-phone`,
          name: `${who}'s phone`,
          name_by_user: null,
          area_id: null,
          labels: [],
        },
      ]),
    ),
  },

  history: {
    'sensor.am_living_temperature': TEMPERATURE,
    'sensor.am_living_humidity': HUMIDITY,
    // the office runs warmer and drier than the living room, by the same day
    'sensor.am_office_temperature': TEMPERATURE.map((v) => Math.round((v + 2.6) * 10) / 10),
    'sensor.am_office_humidity': HUMIDITY.map((v) => Math.round((v - 5.5) * 10) / 10),
    'sensor.am_house_power': POWER,
    'sensor.am_pressure': PRESSURE,
    'sensor.am_no_history': [],
  },

  ws: {
    'weather/subscribe_forecast': (message: Record<string, unknown>) => {
      const entity = String(message['entity_id'] ?? '');
      // the cabin forecasts its days only
      if (entity === 'weather.am_cold')
        return {
          type: message['forecast_type'],
          forecast:
            message['forecast_type'] === 'daily'
              ? COLD_DAYS.map((day, index) => ({ datetime: at(index * DAY), ...day }))
              : null,
        };
      // Home Assistant refuses the subscription of an entity without forecasts; the mock can only stay silent or say "none"
      if (
        entity !== 'weather.am_home' &&
        entity !== 'weather.am_evening' &&
        entity !== 'weather.am_night'
      )
        return { type: message['forecast_type'], forecast: null };
      if (message['forecast_type'] === 'hourly') {
        const conditions = entity === 'weather.am_home' ? SHEET_HOURS : CLEAR_HOURS;
        return {
          type: 'hourly',
          forecast: conditions.map((condition, index) => ({
            datetime: new Date(topOfHour + index * HOUR).toISOString(),
            condition,
            temperature: SHEET_TEMPERATURES[index] ?? 12,
            precipitation_probability: condition === 'rainy' ? 60 : 5,
          })),
        };
      }
      return {
        type: 'daily',
        forecast: DAYS.map((day, index) => ({ datetime: at(index * DAY), ...day })),
      };
    },
  },

  frames: [
    /* --- the design sheet, in its own order --- */
    {
      title: 'Weather',
      cards: [
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          forecast: 'both',
          days: 3,
          _now,
        },
      ],
    },
    {
      title: 'Sensors',
      width: 360, // the sheet's own width: two 172 tiles (a half column is only on the 4 px grid at some frame widths — see the tile frames below)
      cards: [
        TILE_TEMPERATURE,
        TILE_HUMIDITY,
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_living_temperature',
          name: 'Living room',
          subtitle: 'Temperature',
          _now,
        },
      ],
    },
    {
      title: 'Openings · each its own name',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          _now,
          rows: [
            { entity: 'binary_sensor.am_front_door', name: 'Front door' },
            { entity: 'binary_sensor.am_kitchen_window', name: 'Kitchen', icon: 'blinds' },
            { entity: 'binary_sensor.am_garage_door', name: 'Garage', color: 'purple' },
            'binary_sensor.am_hallway_motion',
          ],
        },
      ],
    },
    {
      title: 'Openings · compact, no times',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          variant: 'compact',
          show_time: false,
          _now,
          rows: [
            { entity: 'binary_sensor.am_front_door', name: 'Front door', color: 'teal' },
            { entity: 'binary_sensor.am_kitchen_window', name: 'Kitchen', icon: 'blinds' },
            {
              entity: 'binary_sensor.am_garage_door',
              name: 'Garage',
              icon: 'car',
              color: 'purple',
            },
            'binary_sensor.am_kitchen_leak',
          ],
        },
      ],
    },
    {
      title: 'Openings · tiles',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          variant: 'tiles',
          _now,
          rows: [
            { entity: 'binary_sensor.am_front_door', name: 'Front door', color: 'teal' },
            { entity: 'binary_sensor.am_kitchen_window', name: 'Kitchen' },
            {
              entity: 'binary_sensor.am_garage_door',
              name: 'Garage',
              icon: 'car',
              color: 'purple',
            },
            'binary_sensor.am_kitchen_leak',
          ],
        },
      ],
    },
    // compact with a sensor gone and more than fit: a value never wraps, the "all sensors" row says "+n"
    {
      title: 'Openings · compact, one gone, folded',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          variant: 'compact',
          max_rows: 2,
          _now,
          rows: [
            'binary_sensor.am_missing_window',
            'binary_sensor.am_front_door',
            'binary_sensor.am_kitchen_window',
            'binary_sensor.am_garage_door',
          ],
        },
      ],
    },
    {
      title: 'Sensors · two on one chart',
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_living_temperature',
          name: 'Living room',
          entities: ['sensor.am_living_humidity'],
          _now,
        },
      ],
    },
    {
      title: 'Sensors · the measures name themselves',
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_office_temperature',
          name: 'Office',
          entities: ['sensor.am_office_humidity'],
          _now,
        },
      ],
    },
    {
      title: 'Sensors · three, named and coloured',
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_living_temperature',
          name: 'Living room',
          label: 'Inside',
          entities: [
            { entity: 'sensor.am_house_power', name: 'Power', color: '#e07a1f' },
            'sensor.am_washer',
          ],
          _now,
        },
      ],
    },
    {
      title: 'Sensors · three, one a word, one gone',
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_living_temperature',
          name: 'Living room',
          entities: [{ entity: 'sensor.am_house_power', name: 'Power' }, 'sensor.am_washer'],
          _now,
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_pressure',
          entities: ['sensor.am_living_temperature', 'sensor.am_broken'],
          hours: 72,
          _now,
        },
      ],
    },
    {
      title: 'Openings & motion',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          _now,
          entities: [
            'binary_sensor.am_front_door',
            'binary_sensor.am_kitchen_window',
            'binary_sensor.am_hallway_motion',
            'binary_sensor.am_kitchen_leak',
            'binary_sensor.am_garage_door',
            'binary_sensor.am_smoke',
          ],
        },
      ],
    },
    // #67: where a row's last change is really read from — the card's pattern names a helper for every row (the
    // cellar door's 4 h old, where Home Assistant's own says just now; the side gate's says nothing yet, so the row
    // keeps Home Assistant's), and the loft window reads an attribute of its own (an epoch): open for 3 h
    {
      title: 'Since · a helper',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          _now,
          since_pattern: 'sensor.{id}_real_last_changed',
          rows: [
            'binary_sensor.am_cellar_door',
            { entity: 'binary_sensor.am_loft_window', since: 'attribute:opened_at' },
            'binary_sensor.am_side_gate',
          ],
        },
      ],
    },
    // the smoke folded under "all sensors": its row says it before its count, whatever the width
    {
      title: 'Openings · smoke under the fold',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          _now,
          entities: [
            'binary_sensor.am_front_door',
            'binary_sensor.am_kitchen_window',
            'binary_sensor.am_hallway_motion',
            'binary_sensor.am_kitchen_leak',
            'binary_sensor.am_garage_door',
            'binary_sensor.am_attic_smoke',
          ],
        },
      ],
    },
    {
      title: 'Who is home',
      cards: [
        {
          type: 'custom:fluvy-people-card',
          entities: ['person.am_marta', 'person.am_pau', 'person.am_ona'],
          _now,
        },
      ],
    },
    // their phones' batteries, found from the trackers they are seen by (Pau's is low; Ona's cannot be read)
    {
      title: 'Who is home · batteries',
      cards: [
        {
          type: 'custom:fluvy-people-card',
          entities: ['person.am_marta', 'person.am_pau', 'person.am_ona'],
          show_battery: true,
          _now,
        },
      ],
    },
    // each person their own: a name, a battery named by hand, a colour, and a page of their own on a tap
    {
      title: 'Who is home · each their own',
      cards: [
        {
          type: 'custom:fluvy-people-card',
          variant: 'rows',
          show_battery: true,
          people: [
            {
              entity: 'person.am_marta',
              tap_action: { action: 'navigate', navigation_path: '/fluvy-home/marta' },
            },
            { entity: 'person.am_pau', color: 'teal' },
            { entity: 'person.am_jan', name: 'Jan', battery: 'sensor.jan_watch_battery' },
            { entity: 'device_tracker.lia_phone', color: 'purple' },
          ],
          _now,
        },
      ],
    },
    // where everyone is: the zones as columns (nothing fetched), a row a person, and Home Assistant's map (which
    // the playground cannot make: the zones stand in, silently)
    {
      title: 'Map · zones',
      cards: [
        {
          type: 'custom:fluvy-map-card',
          entities: [
            'person.am_marta',
            'person.am_pau',
            'person.am_ona',
            'person.am_jan',
            'person.am_noa',
          ],
        },
      ],
    },
    {
      title: 'Map · rows',
      cards: [
        {
          type: 'custom:fluvy-map-card',
          variant: 'rows',
          show_distance: true,
          entities: [
            'person.am_marta',
            'person.am_ona',
            'person.am_jan',
            'person.am_noa',
            'person.am_guest',
          ],
        },
      ],
    },
    {
      title: 'Map · map',
      cards: [
        {
          type: 'custom:fluvy-map-card',
          variant: 'map',
          entities: ['person.am_marta', 'person.am_ona'],
        },
      ],
    },
    {
      title: 'Map · chosen zones, empty ones kept',
      cards: [
        {
          type: 'custom:fluvy-map-card',
          entities: ['person.am_marta', 'person.am_ona'],
          zones: [{ entity: 'zone.am_work', name: 'Office', icon: 'briefcase' }, 'zone.am_school'],
          show_empty: true,
        },
      ],
    },
    {
      title: 'Scenes',
      cards: [
        {
          type: 'custom:fluvy-scenes-card',
          _now,
          scenes: [
            { entity: 'scene.am_morning', icon: 'sun' },
            { entity: 'scene.am_cinema', icon: 'film' },
            { entity: 'scene.am_night', icon: 'moon', meta: 'All off' },
            { entity: 'scene.am_away', icon: 'away', meta: 'Lock & arm' },
          ],
        },
      ],
    },

    /* --- the hard states --- */
    {
      title: 'Weather · modes',
      cards: [
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_home', _now },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_evening',
          forecast: 'hourly',
          _now,
        },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_night', forecast: 'none', _now },
      ],
    },
    // the hero alone
    {
      title: 'Weather · no forecast',
      cards: [
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          show_forecast: false,
          _now,
        },
      ],
    },
    // the name asked away (#145): the hero's label says the condition, the compact head its one line
    {
      title: 'Weather · no name',
      cards: [
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_home', show_name: false, _now },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          show_name: false,
          _now,
        },
      ],
    },
    // every second hour (#146): the forecast's own entries, "Now" first
    {
      title: 'Weather · hours two apart',
      cards: [
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          forecast: 'hourly',
          hourly_step: 2,
          _now,
        },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          forecast: 'hourly',
          hourly_step: 2,
          _now,
        },
      ],
    },
    {
      title: 'Weather · edges',
      cards: [
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_basic', forecast: 'both', _now },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_cold', forecast: 'none', _now },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_unknown', forecast: 'none', _now },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_gone', _now },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_missing' },
      ],
    },
    conditionFrame,
    /* --- the compact card (1.5): one head row, the hours and the days ahead as columns --- */
    {
      title: 'Weather · compact',
      cards: [
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_home', variant: 'compact', _now },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_evening',
          variant: 'compact',
          forecast: 'hourly',
          _now,
        },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          forecast: 'both',
          days: 3,
          _now,
        },
      ],
    },
    {
      title: 'Weather · compact · desktop',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          forecast: 'both',
          _now,
        },
      ],
    },
    // half a column: as many day columns as fit (two of the seven asked), the name ends in an ellipsis
    {
      title: 'Weather · compact · half a column',
      width: 360, // the sheet's own width: two 172 cards (a half column shrinks with a narrower frame)
      cards: [
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          days: 7,
          _now,
          cols: 6,
        },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_night',
          variant: 'compact',
          forecast: 'hourly',
          _now,
          cols: 6,
        },
      ],
    },
    // figures below zero take wider columns (four, not five); no forecast at all; a long name; unknown, unavailable, missing
    {
      title: 'Weather · compact · edges',
      cards: [
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_cold', variant: 'compact', _now },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_basic',
          variant: 'compact',
          forecast: 'both',
          _now,
        },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_home',
          variant: 'compact',
          show_forecast: false,
          name: 'Barcelona El Prat airport weather station',
          _now,
        },
        {
          type: 'custom:fluvy-weather-card',
          entity: 'weather.am_unknown',
          variant: 'compact',
          _now,
        },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_gone', variant: 'compact', _now },
        { type: 'custom:fluvy-weather-card', entity: 'weather.am_missing', variant: 'compact' },
      ],
    },
    {
      title: 'Sensors · edges',
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_living_temperature',
          name: 'Living room',
          subtitle: 'Temperature',
          _now,
        },
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.am_house_power', hours: 12, _now },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_pressure',
          hours: 72,
          show_stats: false,
          _now,
        },
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.am_no_history', _now },
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.am_washer', _now },
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.am_broken', _now },
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.am_missing' },
      ],
    },
    {
      title: 'Sensor tiles · 148',
      width: 312,
      cards: [
        TILE_TEMPERATURE,
        TILE_HUMIDITY,
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_broken',
          variant: 'tile',
          _now,
          cols: 6,
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_washer',
          variant: 'tile',
          _now,
          cols: 6,
        },
      ],
    },
    {
      title: 'Sensor tiles · 236',
      width: 488,
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_house_power',
          variant: 'tile',
          hours: 12,
          _now,
          cols: 6,
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.am_no_history',
          variant: 'tile',
          _now,
          cols: 6,
        },
      ],
    },
    // half a section: the count stays whole in the head, whoever is away beside their face
    {
      title: 'Who is home · half a column',
      cards: [
        {
          type: 'custom:fluvy-people-card',
          entities: ['person.am_marta', 'person.am_pau', 'person.am_ona'],
          _now,
          cols: 6,
        },
        {
          type: 'custom:fluvy-people-card',
          entities: ['person.am_pau', 'person.am_ona'],
          _now,
          cols: 6,
        },
      ],
    },
    {
      title: 'Who is home · edges',
      cards: [
        {
          type: 'custom:fluvy-people-card',
          entities: ['person.am_jan', 'person.am_noa', 'person.am_guest'],
          _now,
        },
        {
          type: 'custom:fluvy-people-card',
          title: 'Family',
          layout: 'rows',
          entities: [
            'person.am_marta',
            'person.am_ona',
            'person.am_jan',
            'person.am_noa',
            'person.am_guest',
          ],
          _now,
        },
        {
          type: 'custom:fluvy-people-card',
          entities: [
            'person.am_marta',
            'person.am_pau',
            'person.am_ona',
            'person.am_jan',
            'person.am_noa',
          ],
          _now,
        },
      ],
    },
    {
      title: 'Openings · edges',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          title: 'Safety',
          icon: 'shield',
          max_rows: 6,
          _now,
          entities: [
            'binary_sensor.am_basement_leak',
            'binary_sensor.am_kitchen_window',
            'binary_sensor.am_porch_motion',
            'lock.am_back_door',
            'binary_sensor.am_shed',
            'binary_sensor.am_missing',
          ],
        },
        {
          type: 'custom:fluvy-openings-card',
          entities: ['binary_sensor.am_front_door', 'binary_sensor.am_garage_door'],
          _now,
        },
      ],
    },
    // one a row when asked, with the second lines and a tap of their own
    {
      title: 'Scenes · one column',
      cards: [
        {
          type: 'custom:fluvy-scenes-card',
          _now,
          columns: 1,
          scenes: [
            { entity: 'scene.am_morning', icon: 'sun', subtitle: 'Blinds up, radio on' },
            {
              entity: 'scene.am_cinema',
              icon: 'film',
              tap_action: { action: 'navigate', navigation_path: '/fluvy-auto/media' },
            },
          ],
        },
      ],
    },
    {
      title: 'Scenes · edges',
      cards: [
        {
          type: 'custom:fluvy-scenes-card',
          _now,
          entities: ['script.am_goodnight', 'scene.am_gone', 'scene.am_away'],
        },
      ],
    },
    // #102: a row read as a class of its own, in words of its own: a tilt sensor of no class says "Tilted" and never
    // counts; read as a window it counts as open; a contact of no class read as a door
    {
      title: 'Openings · a class and words of their own (#102)',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          title: 'Bedroom',
          _now,
          rows: [
            { entity: 'binary_sensor.am_bedroom_window', name: 'Window' },
            {
              entity: 'binary_sensor.am_bedroom_window_tilt',
              name: 'Tilt',
              icon: 'windowOpen',
              states: { on: 'Tilted', off: 'Closed' },
            },
            {
              entity: 'binary_sensor.am_bedroom_window_tilt',
              name: 'Tilt, as a window',
              device_class: 'window',
              states: { on: 'Tilted' },
            },
            {
              entity: 'binary_sensor.am_side_door_contact',
              name: 'Side door',
              device_class: 'door',
            },
          ],
        },
        {
          type: 'custom:fluvy-openings-card',
          title: 'Bedroom',
          variant: 'tiles',
          _now,
          rows: [
            { entity: 'binary_sensor.am_bedroom_window', name: 'Window' },
            {
              entity: 'binary_sensor.am_bedroom_window_tilt',
              name: 'Tilt',
              icon: 'windowOpen',
              states: { on: 'Tilted', off: 'Closed' },
            },
          ],
        },
      ],
    },
    // the same words from a dashboard in YAML mode: Home Assistant reads an unquoted on: and off: as true and false,
    // which reach the card as "true" and "false" keys
    {
      title: 'Openings · words for on and off from YAML mode',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          title: 'Bedroom',
          _now,
          rows: [
            {
              entity: 'binary_sensor.am_bedroom_window_tilt',
              name: 'Tilt',
              icon: 'windowOpen',
              states: { true: 'Tilted', false: 'Closed' },
            },
            {
              entity: 'binary_sensor.am_side_door_contact',
              name: 'Side door',
              device_class: 'door',
              states: { true: 'Ajar', false: 'Shut' },
            },
          ],
        },
      ],
    },
    // #105: covers count in the head and light up while open, as a window does: open, on their way, or partly open by
    // their position
    {
      title: 'Openings · covers (#105)',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          title: 'Gordijnen',
          _now,
          entities: [
            'cover.am_bank',
            'cover.am_schuifpui',
            'cover.am_kantoor',
            'cover.am_slaapkamer',
          ],
        },
        {
          type: 'custom:fluvy-openings-card',
          title: 'Blinds',
          variant: 'tiles',
          _now,
          entities: ['cover.am_study_blind', 'cover.am_garage'],
        },
      ],
    },

    /* the Compass card (#209, by @twodrops): a weather station's wind with its 10-minute average beside it and its
       readouts, the sun, a car's heading, a weather entity's wind on a balcony facing east, a pier past its warning,
       half a section, and a station out of reach */
    { title: 'Compass · a weather station', cards: [COMPASS_STATION] },
    {
      title: 'Compass · the sun',
      cards: [
        {
          type: 'custom:fluvy-compass-card',
          direction_entity: 'sun.sun',
          label: 'Azimuth',
        },
      ],
    },
    { title: 'Compass · a car’s heading', cards: [COMPASS_CAR] },
    {
      title: 'Compass · a weather entity on a balcony facing east',
      cards: [
        {
          type: 'custom:fluvy-compass-card',
          name: 'Balcony',
          direction_entity: 'weather.am_home',
          north_offset: -90,
          secondary_direction_entity: 'sun.sun',
          secondary_indicator: 'knob',
        },
      ],
    },
    {
      title: 'Compass · past its warning',
      cards: [
        {
          type: 'custom:fluvy-compass-card',
          name: 'Pier',
          entity: 'sensor.am_pier_wind_speed',
          direction_entity: 'sensor.am_pier_wind_direction',
          indicator: 'ticks',
          thresholds: [
            { value: 40, tone: 'warning', label: 'Strong wind' },
            { value: 62, tone: 'danger', label: 'Gale' },
          ],
          tint: 'on',
        },
      ],
    },
    {
      title: 'Compass · half a section',
      cards: [
        { ...COMPASS_WIND, cols: 6 },
        { ...COMPASS_CAR, cols: 6 },
      ],
    },
    {
      title: 'Compass · out of reach',
      cards: [
        {
          ...COMPASS_STATION,
          entity: 'sensor.am_wind_speed_gone',
          direction_entity: 'sensor.am_wind_bearing_gone',
          secondary_direction_entity: 'sensor.am_wind_bearing_gone',
          stats: [
            { entity: 'sensor.am_wind_speed_gone', name: 'Gusts' },
            { entity: 'sensor.am_wind_max_today', name: 'Max today' },
          ],
        },
      ],
    },

    /* its four pointers: the arrow (the default; the 10-minute average's a smaller one in the secondary ink), the
       thermostat's knob, the ticks lit across the bearing, the dial's dot */
    {
      title: 'Compass · four pointers',
      cards: [
        { ...COMPASS_WIND, name: 'Garden', secondary_indicator: 'arrow' },
        {
          type: 'custom:fluvy-compass-card',
          name: 'Balcony',
          direction_entity: 'weather.am_home',
          indicator: 'knob',
        },
        COMPASS_CAR,
        {
          type: 'custom:fluvy-compass-card',
          name: 'Sun',
          direction_entity: 'sun.sun',
          label: 'Azimuth',
          indicator: 'dot',
        },
      ].map((card) => ({ ...card, cols: 6 })),
    },

    /* the arrow pointing in where it is asked to (`arrow_points: inward`): at the figure from the bearing, as the wind
       blows from it, the 10-minute average's outline with it; the sun's light falling in */
    {
      title: 'Compass · arrow inward',
      cards: [
        { ...COMPASS_WIND, name: 'Garden', arrow_points: 'inward', secondary_indicator: 'arrow' },
        {
          type: 'custom:fluvy-compass-card',
          name: 'Sun',
          direction_entity: 'sun.sun',
          label: 'Azimuth',
          arrow_points: 'inward',
        },
      ].map((card) => ({ ...card, cols: 6 })),
    },

    /* its two other layouts: compact (the head, a small ring beside its figure, the readouts at the extra-small size)
       and one row (its circle ringed by the bearing), in a section and in half of one */
    { title: 'Compass · compact', cards: [{ ...COMPASS_STATION, variant: 'compact' }] },
    {
      title: 'Compass · compact · half a section',
      heights: [152, 172],
      cards: [
        { ...COMPASS_WIND, variant: 'compact', cols: 6, grid_options: { columns: 6 } },
        { ...COMPASS_CAR, variant: 'compact', cols: 6, grid_options: { columns: 6 } },
      ],
    },
    /* the compact card out of reach beside the live one: the reading under the ring in both, as tall */
    {
      title: 'Compass · compact · half a section, one out of reach',
      heights: [152, 172],
      cards: [
        { ...COMPASS_WIND, variant: 'compact', cols: 6, grid_options: { columns: 6 } },
        {
          ...COMPASS_WIND,
          variant: 'compact',
          entity: 'sensor.am_wind_speed_gone',
          direction_entity: 'sensor.am_wind_bearing_gone',
          secondary_direction_entity: 'sensor.am_wind_bearing_gone',
          cols: 6,
          grid_options: { columns: 6 },
        },
      ],
    },
    {
      title: 'Compass · rows',
      heights: [152, 172],
      cards: [
        { ...COMPASS_WIND, variant: 'row' },
        { ...COMPASS_CAR, variant: 'row' },
        {
          type: 'custom:fluvy-compass-card',
          variant: 'row',
          name: 'Pier',
          entity: 'sensor.am_pier_wind_speed',
          direction_entity: 'sensor.am_pier_wind_direction',
          indicator: 'ticks',
          thresholds: [{ value: 40, tone: 'warning', label: 'Strong wind' }],
        },
        {
          type: 'custom:fluvy-compass-card',
          variant: 'row',
          direction_entity: 'sun.sun',
          indicator: 'dot',
        },
      ].map((card) => ({ ...card, cols: 6 })),
    },
    {
      title: 'Compass · a row in a section',
      cards: [{ ...COMPASS_WIND, variant: 'row', cols: 12 }],
    },
    {
      title: 'Compass · compact and a row out of reach',
      cards: [
        {
          ...COMPASS_WIND,
          variant: 'compact',
          entity: 'sensor.am_wind_speed_gone',
          direction_entity: 'sensor.am_wind_bearing_gone',
          secondary_direction_entity: 'sensor.am_wind_bearing_gone',
          stats: [{ entity: 'sensor.am_wind_speed_gone', name: 'Gusts' }],
        },
        {
          ...COMPASS_WIND,
          variant: 'row',
          entity: 'sensor.am_wind_speed_gone',
          direction_entity: 'sensor.am_wind_bearing_gone',
          cols: 12,
        },
      ],
    },

    /* the classic face (#247, the default) beside 1.24's ring (`face: ring`): a section each, the wind and the sun;
       then half a section and the narrow columns, where the letters step down together (Polish's "Wsch" and "Zach"
       stand in the band's place where no size holds them outside it, `&lang=pl`) */
    {
      title: 'Compass · classic and ring',
      width: 736,
      cards: [COMPASS_STATION, { ...COMPASS_STATION, face: 'ring' }].map((card) => ({
        ...card,
        cols: 6,
      })),
    },
    {
      title: 'Compass · classic and ring · the sun',
      width: 736,
      cards: [COMPASS_SUN, { ...COMPASS_SUN, face: 'ring' }].map((card) => ({ ...card, cols: 6 })),
    },
    ...[266, 211, 172, 152].map((column) => ({
      title: `Compass · classic and ring at ${column}`,
      width: column * 2 + 16,
      cards: [COMPASS_WIND, { ...COMPASS_WIND, face: 'ring' }].map((card) => ({
        ...card,
        cols: 6,
      })),
    })),

    /* the chevron (#247): a ringed circle riding the band, pointing out from the centre, or in at the figure as the
       wind blows (`arrow_points: inward`), the 10-minute average's in the secondary ink; on a face without its ticks,
       on the compact card's small ring and in a row */
    {
      title: 'Compass · chevron',
      cards: [
        {
          ...COMPASS_STATION,
          indicator: 'chevron',
          arrow_points: 'inward',
          secondary_indicator: 'chevron',
        },
      ],
    },
    {
      title: 'Compass · chevron · half a section',
      cards: [
        { ...COMPASS_WIND, name: 'Garden', indicator: 'chevron' },
        { ...COMPASS_SUN, indicator: 'chevron', arrow_points: 'inward', show_ticks: false },
      ].map((card) => ({ ...card, cols: 6 })),
    },
    {
      title: 'Compass · chevron · compact and a row',
      cards: [
        { ...COMPASS_WIND, variant: 'compact', indicator: 'chevron', arrow_points: 'inward' },
        { ...COMPASS_WIND, variant: 'row', indicator: 'chevron', arrow_points: 'inward', cols: 6 },
        { ...COMPASS_SUN, variant: 'row', indicator: 'chevron', cols: 6 },
      ],
    },
  ],
};
