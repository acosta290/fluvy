// the details sheet's chunk lands the first time one opens: the playground defines the sheets from their module
import '../../../../packages/cards/src/details/open.js';
import type { SheetSpec } from '../scenes.js';

/**
 * What a thermostat is doing (1.21, #185), on the valves a house heats with: a Zigbee valve as ZHA gives it (its
 * demand on the climate itself, its battery and its window sensor on its device), one as Zigbee2MQTT does (its
 * position a sensor of its own, a battery near its end), two rooms behind Better Thermostat (a window open, and no
 * call for heat: the valves it drives, their batteries, what holds the heating back), a floor preheating, a heat pump
 * defrosting, a thermostat that says no action beside the switch that does, and a humidifier. The word in its
 * action's tone, the valve's opening beside it, the warnings of an open window and a low battery, the word leading
 * the line in half a section; the tiles and a room's climate row as before and saying it; the details sheet's rows.
 */

const THERMOSTAT = 'custom:fluvy-thermostat-card';
const TRV = {
  min_temp: 5,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat', 'auto'],
};

const sensor = (name: string, more: Record<string, unknown> = {}) => ({
  friendly_name: name,
  unit_of_measurement: '%',
  state_class: 'measurement',
  ...more,
});

/** A compact thermostat in half a section, as a wall of radiator valves is laid out. */
const half = (entity: string, more: Record<string, unknown> = {}) => ({
  type: THERMOSTAT,
  entity,
  variant: 'compact',
  cols: 6,
  ...more,
});

/** A valve's own device, and the entities it carries. */
const device = (id: string, name: string, area_id: string | null = null) => ({
  id,
  name,
  name_by_user: null,
  area_id,
  model: null,
  manufacturer: null,
  via_device_id: null,
});
const on = (device_id: string, ...ids: readonly string[]) =>
  Object.fromEntries(ids.map((entity_id) => [entity_id, { entity_id, device_id }]));

const HOUR = 3_600_000;
/** A day of a room's temperature as the recorder keeps a climate's: a reading every ten minutes, ending where it is. */
const day =
  (middle: number, swing: number) =>
  (end: number): unknown[] =>
    Array.from({ length: 145 }, (_unused, i) => ({
      s: 'heat',
      lu: (end - (144 - i) * (HOUR / 6)) / 1000,
      a: {
        current_temperature:
          Math.round((middle + swing * Math.sin(((144 - i) / 144) * 2 * Math.PI)) * 10) / 10,
      },
    }));
/** What the recorder has of the thermostats whose sheets the page docks. */
const HISTORY: Readonly<Record<string, (end: number) => unknown[]>> = {
  'climate.ts_living': day(20.8, 1.1),
  'climate.ts_office': day(19.2, 1.4),
};

const TILES = [
  'climate.ts_living',
  'climate.ts_bedroom',
  'climate.ts_office',
  'humidifier.ts_nursery',
];

export const sheet: SheetSpec = {
  states: [
    [
      'climate.ts_living',
      'heat',
      {
        friendly_name: 'Living room',
        ...TRV,
        temperature: 21.5,
        current_temperature: 20.8,
        current_humidity: 46,
        hvac_action: 'heating',
        pi_heating_demand: 42,
      },
    ],
    ['sensor.ts_living_battery', '86', sensor('Living room battery', { device_class: 'battery' })],
    [
      'binary_sensor.ts_living_window',
      'off',
      { friendly_name: 'Living room window', device_class: 'window' },
    ],
    [
      'climate.ts_bedroom',
      'heat',
      {
        friendly_name: 'Bedroom TRV',
        ...TRV,
        temperature: 18,
        current_temperature: 18.4,
        hvac_action: 'idle',
      },
    ],
    ['sensor.ts_bedroom_position', '0', sensor('Bedroom TRV position')],
    ['sensor.ts_bedroom_battery', '8', sensor('Bedroom TRV battery', { device_class: 'battery' })],
    [
      'climate.ts_office',
      'heat',
      {
        friendly_name: 'Office',
        ...TRV,
        temperature: 21,
        current_temperature: 19.2,
        current_humidity: 52,
        hvac_action: 'idle',
        window_open: true,
        door_open: false,
        call_for_heat: true,
        heating_blocked_by: 'window',
        batteries: JSON.stringify({
          'climate.ts_office_valve': { battery_id: 'sensor.ts_office_valve_battery', battery: 64 },
        }),
      },
    ],
    [
      'climate.ts_office_valve',
      'heat',
      {
        friendly_name: 'Office valve',
        ...TRV,
        temperature: 5,
        current_temperature: 21.6,
        hvac_action: 'idle',
        valve_position: 0,
      },
    ],
    ['light.ts_office_desk', 'on', { friendly_name: 'Desk lamp', brightness: 180 }],
    [
      'climate.ts_kitchen',
      'heat',
      {
        friendly_name: 'Kitchen',
        ...TRV,
        temperature: 19,
        current_temperature: 21.3,
        hvac_action: 'idle',
        window_open: false,
        door_open: false,
        call_for_heat: false,
        heating_blocked_by: 'no_call_for_heat',
        batteries: JSON.stringify({
          'climate.ts_kitchen_valve': {
            battery_id: 'sensor.ts_kitchen_valve_battery',
            battery: 71,
          },
        }),
      },
    ],
    [
      'climate.ts_kitchen_valve',
      'heat',
      {
        friendly_name: 'Kitchen valve',
        ...TRV,
        temperature: 19,
        current_temperature: 22,
        hvac_action: 'idle',
        valve_position: 0,
      },
    ],
    [
      'climate.ts_bathroom',
      'heat',
      {
        friendly_name: 'Bathroom floor',
        ...TRV,
        temperature: 24,
        current_temperature: 21.9,
        hvac_action: 'preheating',
      },
    ],
    [
      'climate.ts_heat_pump',
      'heat',
      {
        friendly_name: 'Heat pump',
        ...TRV,
        hvac_modes: ['off', 'heat', 'cool'],
        temperature: 21,
        current_temperature: 20.4,
        hvac_action: 'defrosting',
      },
    ],
    [
      'climate.ts_hallway',
      'heat',
      {
        friendly_name: 'Hallway',
        ...TRV,
        temperature: 19.5,
        current_temperature: 18.7,
      },
    ],
    ['switch.ts_hallway_heater', 'on', { friendly_name: 'Hallway heater' }],
    ['sensor.ts_hallway_humidity', '58', sensor('Hallway humidity', { device_class: 'humidity' })],
    [
      'humidifier.ts_nursery',
      'on',
      {
        friendly_name: 'Nursery',
        min_humidity: 30,
        max_humidity: 70,
        humidity: 50,
        current_humidity: 44,
        available_modes: ['auto', 'sleep'],
        mode: 'auto',
        action: 'humidifying',
      },
    ],
  ],
  frames: [
    // the valve's opening beside the word, in the action's tone
    {
      title: 'Heating · the valve’s opening',
      cards: [{ type: THERMOSTAT, entity: 'climate.ts_living', show_valve: true }],
    },
    // idle is quiet, whatever the mode: the circle and the readout keep the heat's
    {
      title: 'Idle · the quiet word',
      cards: [
        { type: THERMOSTAT, entity: 'climate.ts_bedroom', variant: 'compact', show_valve: true },
      ],
    },
    {
      title: 'Window open',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.ts_office',
          variant: 'compact',
          show_window: true,
          show_valve: true,
        },
      ],
    },
    {
      title: 'Low battery',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.ts_bedroom',
          variant: 'compact',
          show_valve: true,
          show_battery: true,
        },
      ],
    },
    // what else Better Thermostat says holds the heating back, in its word
    {
      title: 'Held back · no call for heat',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.ts_kitchen',
          variant: 'compact',
          show_window: true,
          show_valve: true,
        },
      ],
    },
    // half a section: the badge has no room beside the name, and the word leads the line
    {
      title: 'Half a section · the word leads the line',
      cards: [
        half('climate.ts_living', { show_valve: true }),
        half('climate.ts_bedroom', { show_valve: true }),
      ],
    },
    {
      title: 'Half a section · window open, low battery',
      cards: [
        half('climate.ts_office', { show_window: true }),
        half('climate.ts_bedroom', { show_battery: true }),
      ],
    },
    // every action Home Assistant knows is said, in the heating tone
    {
      title: 'Preheating · defrosting',
      cards: [half('climate.ts_bathroom'), half('climate.ts_heat_pump')],
    },
    // a thermostat that says no action: its heater's switch says it, and the hallway's sensor its humidity
    {
      title: 'The action from another entity',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.ts_hallway',
          variant: 'compact',
          state_entity: 'switch.ts_hallway_heater',
          humidity_entity: 'sensor.ts_hallway_humidity',
        },
      ],
    },
    {
      title: 'Humidifier · its action',
      cards: [{ type: THERMOSTAT, entity: 'humidifier.ts_nursery', variant: 'compact' }],
    },
    {
      title: 'The word hidden',
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.ts_living',
          variant: 'compact',
          show_state: false,
          show_modes: false,
        },
      ],
    },
    // the tiles as before, then saying what they are doing and what they are set to
    {
      title: 'Tiles · their mode, as before',
      cards: [{ type: 'custom:fluvy-tiles-card', tiles: TILES }],
    },
    {
      title: 'Tiles · what they are doing',
      cards: [{ type: 'custom:fluvy-tiles-card', tiles: TILES, show_action: true }],
    },
    {
      title: 'Large tile · as before, and what it is doing',
      cards: [
        { type: 'custom:fluvy-tile-card', entity: 'climate.ts_living', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'climate.ts_living', show_action: true, cols: 6 },
      ],
    },
    {
      title: 'Large tiles · idle, window open',
      cards: [
        {
          type: 'custom:fluvy-tile-card',
          entity: 'climate.ts_bedroom',
          show_action: true,
          cols: 6,
        },
        { type: 'custom:fluvy-tile-card', entity: 'climate.ts_office', show_action: true, cols: 6 },
      ],
    },
    {
      title: 'Room · its climate row says it',
      cards: [
        { type: 'custom:fluvy-room-card', area: 'ts_office', variant: 'tile', show_action: true },
      ],
    },
    // the sheet a card opens: the same word, and a row for each reading the card asked for
    {
      title: 'Details · valve, window and battery',
      cards: [
        {
          type: 'custom:fluvy-details-climate',
          entity: 'climate.ts_living',
          _docked: true,
          show_valve: true,
          show_window: true,
          show_battery: true,
        },
      ],
    },
    {
      title: 'Details · a window open',
      cards: [
        {
          type: 'custom:fluvy-details-climate',
          entity: 'climate.ts_office',
          _docked: true,
          show_valve: true,
          show_window: true,
          show_battery: true,
        },
      ],
    },
  ],
  ws: {
    'history/history_during_period': (message) => {
      const ids = (message['entity_ids'] as readonly string[]).filter((id) => HISTORY[id]);
      if (!ids.length) return undefined;
      const end = Date.parse(String(message['end_time']));
      return Object.fromEntries(ids.map((id) => [id, HISTORY[id]?.(end) ?? []]));
    },
  },
  registry: {
    entities: {
      ...on(
        'ts-living-valve',
        'climate.ts_living',
        'sensor.ts_living_battery',
        'binary_sensor.ts_living_window',
      ),
      ...on(
        'ts-bedroom-valve',
        'climate.ts_bedroom',
        'sensor.ts_bedroom_position',
        'sensor.ts_bedroom_battery',
      ),
      'climate.ts_office': { entity_id: 'climate.ts_office', area_id: 'ts_office' },
      'light.ts_office_desk': { entity_id: 'light.ts_office_desk', area_id: 'ts_office' },
    },
    devices: {
      'ts-living-valve': device('ts-living-valve', 'Living room valve'),
      'ts-bedroom-valve': device('ts-bedroom-valve', 'Bedroom valve'),
    },
    areas: { ts_office: { area_id: 'ts_office', name: 'Office', icon: 'mdi:desk' } },
  },
};
