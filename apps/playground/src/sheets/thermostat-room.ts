import { FluvyThermostatCard } from '../../../../packages/cards/src/thermostat/thermostat-card.js';
import { CLIMATE, speakingAttributes } from '../attribute-words.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the climate sheet does
if (!customElements.get('fluvy-thermostat-card'))
  customElements.define('fluvy-thermostat-card', FluvyThermostatCard);

/**
 * The room first (#215, after @waphbs's sketch): a living room's heat pump at 20.5° heating to 24°, four modes and
 * five fan speeds, as it draws today and as `focus: current`, `modes_style: icons`, `fan_style: chips` and its
 * readings draw it — on a 360 phone (a 328 card) and on the energy page's grid (407); then the ruler, a range, a
 * humidifier, no stepper, half a section (where a 0.5 step gives the row back to the target), seven modes as icons, a
 * water heater's as glyphs alone, the mode chips in their tones, the readings under a dial, off and out of reach.
 */

const THERMOSTAT = 'custom:fluvy-thermostat-card';
const PUMP = 'climate.tr_heat_pump';

/** The heat pump's integration words its quiet speed, as the reporter's does; Home Assistant's own the rest. */
const WORDS = {
  ...CLIMATE,
  en: { ...CLIMATE['en'], 'fan_mode.quiet': 'Quiet' },
  'zh-Hans': { ...CLIMATE['zh-Hans'], 'fan_mode.quiet': '静音' },
  'zh-Hant': { ...CLIMATE['zh-Hant'], 'fan_mode.quiet': '靜音' },
};
const speaking = speakingAttributes(WORDS);

const HEAT_PUMP = {
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 1,
  hvac_modes: ['off', 'heat', 'cool', 'dry'],
  fan_modes: ['quiet', 'low', 'medium', 'high', 'auto'],
};

/** The readings a person adds under the heat pump's value: how long it ran today, the room's humidity, its power. */
const READINGS = [
  'sensor.tr_heat_pump_on_today',
  'sensor.tr_heat_pump_humidity',
  'sensor.tr_heat_pump_power',
];

/** The issue's card, as it draws today. */
const today = { type: THERMOSTAT, entity: PUMP, variant: 'compact' };
/** …and with the room first, its modes in one row of icons, its fan speeds as chips and its readings. */
const roomFirst = {
  ...today,
  focus: 'current',
  modes_style: 'icons',
  fan_style: 'chips',
  readouts: READINGS,
};

const sensor = (name: string, unit: string, device_class: string) => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class,
  state_class: 'measurement',
});

export const sheet: SheetSpec = {
  states: [
    [
      PUMP,
      'heat',
      {
        friendly_name: 'Heat pump',
        ...HEAT_PUMP,
        temperature: 24,
        current_temperature: 20.5,
        current_humidity: 46,
        hvac_action: 'heating',
        fan_mode: 'medium',
      },
    ],
    ['sensor.tr_heat_pump_on_today', '12', sensor('Heat pump on today', 'min', 'duration')],
    ['sensor.tr_heat_pump_humidity', '46', sensor('Heat pump humidity', '%', 'humidity')],
    ['sensor.tr_heat_pump_power', '1240', sensor('Heat pump power', 'W', 'power')],
    ['sensor.tr_outdoor', '6.5', sensor('Outdoor temperature', '°C', 'temperature')],
    [
      'climate.tr_upstairs',
      'heat_cool',
      {
        friendly_name: 'Upstairs',
        min_temp: 16,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        supported_features: 2,
        target_temp_low: 20,
        target_temp_high: 24,
        current_temperature: 22.4,
        hvac_action: 'idle',
      },
    ],
    [
      'climate.tr_office',
      'cool',
      {
        friendly_name: 'Office',
        min_temp: 16,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'],
        temperature: 22,
        current_temperature: 24.6,
        hvac_action: 'cooling',
      },
    ],
    [
      'climate.tr_bedroom',
      'off',
      {
        friendly_name: 'Bedroom',
        ...HEAT_PUMP,
        temperature: 22,
        current_temperature: 19.2,
        hvac_action: 'off',
        fan_mode: 'auto',
      },
    ],
    ['climate.tr_garage', 'unavailable', { friendly_name: 'Garage', ...HEAT_PUMP }],
    ['sensor.tr_garage_humidity', 'unavailable', sensor('Garage humidity', '%', 'humidity')],
    ['sensor.tr_garage_power', 'unavailable', sensor('Garage power', 'W', 'power')],
    [
      'water_heater.tr_tank',
      'heat_pump',
      {
        friendly_name: 'Hot water',
        min_temp: 40,
        max_temp: 65,
        temperature: 55,
        current_temperature: 48,
        operation_list: ['eco', 'heat_pump', 'electric', 'gas', 'performance', 'high_demand'],
      },
    ],
    [
      'humidifier.tr_nursery',
      'on',
      {
        friendly_name: 'Nursery',
        min_humidity: 30,
        max_humidity: 70,
        humidity: 50,
        current_humidity: 41,
        available_modes: ['normal', 'sleep', 'auto'],
        mode: 'normal',
        action: 'humidifying',
      },
    ],
  ],
  frames: [
    { title: 'Today · a 360 phone', width: 328, hass: speaking, cards: [today] },
    { title: 'Room first · a 360 phone', width: 328, hass: speaking, cards: [roomFirst] },
    { title: 'Today · the energy page’s grid', width: 407, hass: speaking, cards: [today] },
    {
      title: 'Room first · the energy page’s grid',
      width: 407,
      hass: speaking,
      cards: [roomFirst],
    },
    {
      title: 'Room first · ruler',
      hass: speaking,
      cards: [{ ...roomFirst, variant: 'ruler', readouts: READINGS.slice(0, 2) }],
    },
    // a range: both ends between the halves, the end the stepper drives in the accent's ink
    {
      title: 'Room first · a range',
      cards: [
        { type: THERMOSTAT, entity: 'climate.tr_upstairs', variant: 'compact', focus: 'current' },
      ],
    },
    {
      title: 'Room first · a humidifier',
      cards: [
        { type: THERMOSTAT, entity: 'humidifier.tr_nursery', variant: 'compact', focus: 'current' },
      ],
    },
    // without its stepper the target stands alone, and the row is the card's tap
    {
      title: 'Room first · without − and +',
      hass: speaking,
      cards: [{ ...roomFirst, show_stepper: false, readouts: undefined }],
    },
    // half a section cannot hold the pill: the target takes the row back, the room in its label
    {
      title: 'Room first · half a section',
      hass: speaking,
      cards: [
        { ...roomFirst, cols: 6, readouts: undefined, show_fan: false },
        { ...roomFirst, entity: 'climate.tr_office', cols: 6, readouts: undefined },
      ],
    },
    {
      title: 'Modes as icons · seven',
      cards: [
        { type: THERMOSTAT, entity: 'climate.tr_office', variant: 'compact', modes_style: 'icons' },
      ],
    },
    {
      title: 'Modes as icons · half a section',
      cards: [
        {
          type: THERMOSTAT,
          entity: PUMP,
          variant: 'compact',
          modes_style: 'icons',
          show_fan: false,
          cols: 6,
        },
        {
          type: THERMOSTAT,
          entity: 'climate.tr_office',
          variant: 'compact',
          modes_style: 'icons',
          cols: 6,
        },
      ],
    },
    // a cell too narrow for its word: the glyphs alone, each named for a reader
    {
      title: 'Modes as icons · the glyphs alone',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'water_heater.tr_tank',
          variant: 'compact',
          modes_style: 'icons',
        },
      ],
    },
    // a mode chosen in its own tone, as its tile is
    {
      title: 'Mode chips in their tones',
      cards: [
        {
          type: THERMOSTAT,
          entity: PUMP,
          variant: 'compact',
          modes_style: 'chips',
          show_fan: false,
        },
        { type: THERMOSTAT, entity: 'climate.tr_office', variant: 'compact', modes_style: 'full' },
      ],
    },
    {
      title: 'Readings · under the dial',
      hass: speaking,
      cards: [
        {
          type: THERMOSTAT,
          entity: PUMP,
          readouts: [
            ...READINGS,
            { entity: 'sensor.tr_outdoor', name: 'Outside', icon: 'mdi:home-thermometer-outline' },
          ],
          show_fan: false,
        },
      ],
    },
    {
      title: 'Room first · off',
      hass: speaking,
      cards: [{ ...roomFirst, entity: 'climate.tr_bedroom', readouts: undefined }],
    },
    {
      title: 'Room first · out of reach',
      hass: speaking,
      cards: [
        {
          ...roomFirst,
          entity: 'climate.tr_garage',
          readouts: ['sensor.tr_garage_humidity', 'sensor.tr_garage_power'],
        },
      ],
    },
  ],
  registry: {
    entities: {
      [PUMP]: { entity_id: PUMP, area_id: 'tr_living' },
    },
    areas: { tr_living: { area_id: 'tr_living', name: 'Living room' } },
  },
};
