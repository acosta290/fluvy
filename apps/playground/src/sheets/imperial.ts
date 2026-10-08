import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

/*
 * A house in Fahrenheit (and miles): Home Assistant hands a climate's and a water heater's temperatures in the house's
 * unit, a sensor its own; the cards follow both. A thermostat with no step of its own steps a whole degree, a water
 * heater reads three figures, a printer's heaters and chamber too.
 */

const NOW = '2026-09-17T21:47:12';
const at = (minutes: number): string => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();
const temp = (name: string) => ({
  friendly_name: name,
  unit_of_measurement: '°F',
  device_class: 'temperature',
  state_class: 'measurement',
});

const PRINTER: readonly StateSeed[] = [
  ['sensor.k1_current_print_state', 'printing', { friendly_name: 'K1 Current print state' }],
  ['sensor.k1_progress', '37', { friendly_name: 'K1 Progress', unit_of_measurement: '%' }],
  [
    'sensor.k1_print_time_left',
    '4980',
    { friendly_name: 'K1 Print time left', unit_of_measurement: 's', device_class: 'duration' },
  ],
  ['sensor.k1_print_eta', at(83), { friendly_name: 'K1 Print ETA', device_class: 'timestamp' }],
  ['sensor.k1_filename', 'phone_stand.gcode', { friendly_name: 'K1 Filename' }],
  ['sensor.k1_extruder_temperature', '437', temp('K1 Extruder temperature')],
  ['sensor.k1_extruder_target', '446', temp('K1 Extruder target')],
  ['sensor.k1_bed_temperature', '140', temp('K1 Bed temperature')],
  ['sensor.k1_bed_target', '140', temp('K1 Bed target')],
  ['sensor.k1_chamber_temperature', '104', temp('K1 Chamber temperature')],
  ['button.k1_pause_print', 'unknown', { friendly_name: 'K1 Pause print' }],
  ['button.k1_cancel_print', 'unknown', { friendly_name: 'K1 Cancel print' }],
];

/** Moonraker's own names for the printer's entities. */
const KEYS: Readonly<Record<string, string>> = {
  'sensor.k1_current_print_state': 'current_print_state',
  'sensor.k1_print_eta': 'print_eta',
  'sensor.k1_print_time_left': 'print_time_left',
  'sensor.k1_extruder_temperature': 'extruder_temperature',
  'sensor.k1_extruder_target': 'extruder_target',
  'sensor.k1_bed_temperature': 'bed_temperature',
  'sensor.k1_bed_target': 'bed_target',
  'button.k1_pause_print': 'pause_print',
  'button.k1_cancel_print': 'cancel_print',
};

export const sheet: SheetSpec = {
  units: 'imperial',
  states: [
    [
      'climate.us_living',
      'heat',
      {
        friendly_name: 'Living room',
        min_temp: 45,
        max_temp: 95,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        temperature: 70,
        current_temperature: 68,
        hvac_action: 'heating',
      },
    ],
    [
      'climate.us_range',
      'heat_cool',
      {
        friendly_name: 'Upstairs',
        min_temp: 45,
        max_temp: 95,
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        target_temp_low: 66,
        target_temp_high: 76,
        current_temperature: 73,
        hvac_action: 'idle',
      },
    ],
    [
      'water_heater.us_tank',
      'eco',
      {
        friendly_name: 'Water heater',
        min_temp: 110,
        max_temp: 140,
        temperature: 120,
        current_temperature: 117,
        operation_list: ['off', 'eco', 'electric', 'performance'],
        operation_mode: 'eco',
      },
    ],
    ['sensor.us_porch_temperature', '72.4', temp('Porch temperature')],
    ...PRINTER,
  ],
  registry: {
    entities: Object.fromEntries(
      PRINTER.map(([id]) => {
        const key = KEYS[id];
        return [
          id,
          {
            entity_id: id,
            device_id: 'd-k1',
            platform: 'moonraker',
            labels: [],
            ...(key ? { translation_key: key } : {}),
          },
        ];
      }),
    ),
    devices: {
      'd-k1': {
        id: 'd-k1',
        name: 'Creality K1',
        name_by_user: null,
        model: 'K1',
        manufacturer: '',
        area_id: null,
        labels: [],
      },
    },
  },
  history: {
    'sensor.us_porch_temperature': [
      61, 60, 59, 58, 58, 60, 63, 66, 69, 71, 73, 74, 74, 73, 72, 72.4,
    ],
  },
  frames: [
    {
      title: 'Fahrenheit · a thermostat stepping whole degrees',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.us_living' }],
    },
    {
      title: 'Fahrenheit · a range',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.us_range' }],
    },
    {
      title: 'Fahrenheit · a water heater in three figures',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'water_heater.us_tank' }],
    },
    {
      title: 'Fahrenheit · a sensor',
      cards: [
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.us_porch_temperature', _now: NOW },
      ],
    },
    {
      title: 'Fahrenheit · a printer',
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-k1', _now: NOW }],
    },
  ],
};
