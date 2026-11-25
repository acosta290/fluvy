import { device, entriesFor, minutesFrom, type ApplianceFixture, type FixtureAt } from './house.js';

/*
 * Matter (Home Assistant's matter): an appliance's operational state, the phase it names itself and its estimated end
 * (sensor.py:1311-1385), its start, pause, resume and stop buttons (button.py:70-115), its power switch
 * (switch.py:301-330); a compartment's setpoint carries no word for what it is (number.py:616-636), so its range says
 * it; a robot vacuum shares the operational state, and an EV charger has its own keys.
 */

const PLATFORM = 'matter';

/** A dishwasher washing, half an hour to go. */
export const matterDishwasher: FixtureAt = (now) => {
  const e = entriesFor(PLATFORM, 'matter-dish');
  return {
    title: 'Matter dishwasher, washing',
    platform: PLATFORM,
    device: device('matter-dish', 'Spülmaschine Küche', 'DW-200', 'Acme'),
    entities: [
      e('sensor.spulmaschine_kuche_betriebszustand', 'operational_state'),
      e('sensor.spulmaschine_kuche_aktuelle_phase', 'current_phase'),
      e('sensor.spulmaschine_kuche_voraussichtliches_ende', 'estimated_end_time'),
      e('sensor.spulmaschine_kuche_betriebsfehler', 'operational_error', {
        entity_category: 'diagnostic',
      }),
      e('button.spulmaschine_kuche_start', 'start'),
      e('button.spulmaschine_kuche_pause', 'pause'),
      e('button.spulmaschine_kuche_fortsetzen', 'resume'),
      e('button.spulmaschine_kuche_stopp', 'stop'),
      e('binary_sensor.spulmaschine_kuche_zulauffehler', 'dishwasher_alarm_inflow'),
      e('select.spulmaschine_kuche_modus', 'mode'),
      e('switch.spulmaschine_kuche_strom', 'power'),
    ],
    states: [
      ['sensor.spulmaschine_kuche_betriebszustand', 'running', {}, 50 * 60],
      ['sensor.spulmaschine_kuche_aktuelle_phase', 'Washing'],
      [
        'sensor.spulmaschine_kuche_voraussichtliches_ende',
        minutesFrom(now, 30),
        { device_class: 'timestamp' },
      ],
      ['sensor.spulmaschine_kuche_betriebsfehler', 'no_error'],
      ['button.spulmaschine_kuche_start', 'unknown'],
      ['button.spulmaschine_kuche_pause', 'unknown'],
      ['button.spulmaschine_kuche_fortsetzen', 'unknown'],
      ['button.spulmaschine_kuche_stopp', 'unknown'],
      ['binary_sensor.spulmaschine_kuche_zulauffehler', 'off', { device_class: 'problem' }],
      ['select.spulmaschine_kuche_modus', 'Normal', { options: ['Normal', 'Heavy', 'Light'] }],
      ['switch.spulmaschine_kuche_strom', 'on'],
    ],
    expected: {
      kind: 'dishwasher',
      status: 'running',
      listed: true,
      roles: {
        state: 'sensor.spulmaschine_kuche_betriebszustand',
        phase: 'sensor.spulmaschine_kuche_aktuelle_phase',
        finish: 'sensor.spulmaschine_kuche_voraussichtliches_ende',
        start: 'button.spulmaschine_kuche_start',
        pause: 'button.spulmaschine_kuche_pause',
        resume: 'button.spulmaschine_kuche_fortsetzen',
        stop: 'button.spulmaschine_kuche_stopp',
        program: 'select.spulmaschine_kuche_modus',
        power: 'switch.spulmaschine_kuche_strom',
      },
    },
  };
};

/** A washer paused mid-cycle. */
export const matterWasher: FixtureAt = () => {
  const e = entriesFor(PLATFORM, 'matter-washer');
  return {
    title: 'Matter washer, paused',
    platform: PLATFORM,
    device: device('matter-washer', 'Waschmaschine Bad', 'WM-100', 'Acme'),
    entities: [
      e('sensor.waschmaschine_bad_betriebszustand', 'operational_state'),
      e('select.waschmaschine_bad_schleuderdrehzahl', 'laundry_washer_spin_speed'),
      e('button.waschmaschine_bad_fortsetzen', 'resume'),
      e('button.waschmaschine_bad_stopp', 'stop'),
    ],
    states: [
      ['sensor.waschmaschine_bad_betriebszustand', 'paused'],
      ['select.waschmaschine_bad_schleuderdrehzahl', '1200', { options: ['800', '1200', '1400'] }],
      ['button.waschmaschine_bad_fortsetzen', 'unknown'],
      ['button.waschmaschine_bad_stopp', 'unknown'],
    ],
    expected: { kind: 'washer', status: 'paused', listed: true },
  };
};

/** A fridge: two compartments, each a setpoint named for nothing, told apart by their ranges. */
export const matterFridge: FixtureAt = () => {
  const e = entriesFor(PLATFORM, 'matter-fridge');
  return {
    title: 'Matter fridge, two compartments by their ranges',
    platform: PLATFORM,
    device: device('matter-fridge', 'Kühlschrank Garage', 'RF-300', 'Acme'),
    entities: [
      e('number.kuhlschrank_garage', 'temperature_setpoint'),
      e('number.kuhlschrank_garage_2', 'temperature_setpoint'),
      e('binary_sensor.kuhlschrank_garage_turalarm', 'alarm_door'),
      e('select.kuhlschrank_garage_modus', 'mode'),
    ],
    states: [
      ['number.kuhlschrank_garage', '4', { unit_of_measurement: '°C', min: 1, max: 7, step: 0.5 }],
      [
        'number.kuhlschrank_garage_2',
        '-18',
        { unit_of_measurement: '°C', min: -24, max: -15, step: 1 },
      ],
      ['binary_sensor.kuhlschrank_garage_turalarm', 'off', { device_class: 'problem' }],
      ['select.kuhlschrank_garage_modus', 'Normal', { options: ['Normal', 'Rapid cool'] }],
    ],
    expected: { kind: 'fridge', listed: true },
  };
};

/** An oven baking: its cavity's setpoint tops out where no compartment's does, and its mode is its programme. */
export const matterOven: FixtureAt = () => {
  const e = entriesFor(PLATFORM, 'matter-oven');
  return {
    title: 'Matter oven, baking',
    platform: PLATFORM,
    device: device('matter-oven', 'Backofen Küche', 'OV-500', 'Acme'),
    entities: [
      e('sensor.backofen_kuche_betriebszustand', 'operational_state'),
      e('sensor.backofen_kuche_temperatur'),
      e('number.backofen_kuche', 'temperature_setpoint'),
      e('select.backofen_kuche_modus', 'mode'),
    ],
    states: [
      ['sensor.backofen_kuche_betriebszustand', 'running', {}, 25 * 60],
      [
        'sensor.backofen_kuche_temperatur',
        '178',
        { device_class: 'temperature', unit_of_measurement: '°C' },
      ],
      ['number.backofen_kuche', '180', { unit_of_measurement: '°C', min: 30, max: 250, step: 5 }],
      ['select.backofen_kuche_modus', 'Bake', { options: ['Bake', 'Convection', 'Grill'] }],
    ],
    expected: {
      kind: 'oven',
      status: 'running',
      listed: true,
      roles: {
        state: 'sensor.backofen_kuche_betriebszustand',
        target: 'number.backofen_kuche',
        program: 'select.backofen_kuche_modus',
      },
    },
  };
};

/**
 * What Matter has that is not an appliance here: a robot vacuum, an EV charger, a light whose start-up colour
 * temperature is a number in kelvin (#263, the reporter's), a thermostat whose calibration offset is a number in °C.
 */
export const matterNotAppliances: (now: number) => readonly ApplianceFixture[] = () => {
  const robot = entriesFor(PLATFORM, 'matter-robot');
  const charger = entriesFor(PLATFORM, 'matter-evse');
  const light = entriesFor(PLATFORM, 'matter-light');
  const thermostat = entriesFor(PLATFORM, 'matter-thermostat');
  return [
    {
      title: 'Matter robot vacuum',
      platform: PLATFORM,
      device: device('matter-robot', 'Saugroboter', 'RVC-1', 'Acme'),
      entities: [
        robot('vacuum.saugroboter'),
        robot('sensor.saugroboter_betriebszustand', 'operational_state'),
      ],
      states: [
        ['vacuum.saugroboter', 'cleaning'],
        ['sensor.saugroboter_betriebszustand', 'running'],
      ],
      expected: { excluded: 'vacuum', listed: false },
    },
    {
      title: 'Matter EV charger',
      platform: PLATFORM,
      device: device('matter-evse', 'Wallbox', 'EVSE-1', 'Acme'),
      entities: [
        charger('binary_sensor.wallbox_ladestatus', 'evse_charging_status'),
        charger('sensor.wallbox_betriebszustand', 'operational_state'),
      ],
      states: [
        ['binary_sensor.wallbox_ladestatus', 'on'],
        ['sensor.wallbox_betriebszustand', 'running'],
      ],
      expected: { excluded: 'charger', listed: false },
    },
    {
      title: 'Matter light, its start-up colour temperature in kelvin (#263)',
      platform: PLATFORM,
      device: device(
        'matter-light',
        'KAJPLATS E27 WS globe 1055lm',
        'KAJPLATS E27 WS globe 1055lm',
        'IKEA of Sweden',
      ),
      entities: [
        light('light.kajplats_e27_ws_globe_1055lm'),
        light(
          'number.kajplats_e27_ws_globe_1055lm_wiedereinschalt_farbtemperatur',
          'power_on_color_temperature',
          { entity_category: 'config' },
        ),
        light('number.kajplats_e27_ws_globe_1055lm_einschaltpegel', 'on_level', {
          entity_category: 'config',
        }),
      ],
      states: [
        ['light.kajplats_e27_ws_globe_1055lm', 'on', { color_temp_kelvin: 2700 }],
        [
          'number.kajplats_e27_ws_globe_1055lm_wiedereinschalt_farbtemperatur',
          '2700',
          { unit_of_measurement: 'K', min: 0, max: 6535, step: 1, mode: 'box' },
        ],
        [
          'number.kajplats_e27_ws_globe_1055lm_einschaltpegel',
          '255',
          { min: 0, max: 255, step: 1 },
        ],
      ],
      expected: { listed: false },
    },
    {
      title: 'Matter thermostat, its calibration offset in °C',
      platform: PLATFORM,
      device: device('matter-thermostat', 'Thermostat Wohnzimmer', 'TH-1', 'Acme'),
      entities: [
        thermostat('climate.thermostat_wohnzimmer'),
        thermostat('sensor.thermostat_wohnzimmer_temperatur'),
        thermostat('sensor.thermostat_wohnzimmer_luftfeuchtigkeit'),
        thermostat('number.thermostat_wohnzimmer_temperaturversatz', 'temperature_offset', {
          entity_category: 'config',
        }),
      ],
      states: [
        ['climate.thermostat_wohnzimmer', 'heat', { current_temperature: 20.5, temperature: 21 }],
        [
          'sensor.thermostat_wohnzimmer_temperatur',
          '20.5',
          { device_class: 'temperature', unit_of_measurement: '°C' },
        ],
        [
          'sensor.thermostat_wohnzimmer_luftfeuchtigkeit',
          '48',
          { device_class: 'humidity', unit_of_measurement: '%' },
        ],
        [
          'number.thermostat_wohnzimmer_temperaturversatz',
          '0',
          { unit_of_measurement: '°C', min: -2.5, max: 2.5, step: 0.1 },
        ],
      ],
      expected: { listed: false },
    },
  ];
};
