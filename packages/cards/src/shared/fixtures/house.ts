import type { HomeAssistant } from '@fluvy/core';

/*
 * The house the catalogue's tests draw every card in, from its own stub (`getStubConfig`): each in the living room,
 * Home Assistant's answers never coming, as on a slow house.
 */

const STAMP = '2026-09-17T19:00:00+00:00';
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id,
  state: value,
  attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
  last_changed: STAMP,
  last_updated: STAMP,
  context: { id: '', parent_id: null, user_id: null },
});

/** A house of every kind of thing a card is drawn from. */
const STATES = [
  state('light.living_room_ceiling', 'on', {
    brightness: 180,
    supported_color_modes: ['brightness'],
    color_mode: 'brightness',
  }),
  state('switch.kitchen_kettle', 'off'),
  state('fan.bedroom', 'on', { percentage: 50, supported_features: 1 }),
  state('cover.living_blind', 'open', { current_position: 70, supported_features: 15 }),
  state('lock.front_door', 'locked'),
  state('alarm_control_panel.house', 'disarmed', { supported_features: 3 }),
  state('climate.living', 'heat', {
    current_temperature: 20.5,
    temperature: 21,
    hvac_modes: ['off', 'heat'],
    min_temp: 7,
    max_temp: 30,
  }),
  state('humidifier.bedroom', 'on', { humidity: 45, min_humidity: 30, max_humidity: 70 }),
  state('water_heater.boiler', 'eco', { temperature: 50, min_temp: 30, max_temp: 70 }),
  state('vacuum.robot', 'docked', { supported_features: 12 }),
  state('camera.porch', 'idle', { entity_picture: '/api/camera_proxy/camera.porch' }),
  state('media_player.living_tv', 'playing', { media_title: 'News', supported_features: 152463 }),
  state('person.marta', 'home'),
  state('zone.home', '1', { latitude: 41.4, longitude: 2.17, radius: 100 }),
  state('todo.groceries', '2', { supported_features: 15 }),
  state('timer.oven', 'active', {
    duration: '0:10:00',
    remaining: '0:05:00',
    finishes_at: '2026-09-17T19:05:00+00:00',
  }),
  state('update.core', 'on', { title: 'Core', installed_version: '1', latest_version: '2' }),
  state('weather.home', 'sunny', { temperature: 21, temperature_unit: '°C' }),
  state('scene.evening', STAMP),
  state('script.goodnight', 'off'),
  state('automation.lights', 'on'),
  state('input_number.target', '20', { min: 0, max: 40, step: 1 }),
  state('input_boolean.guest', 'off'),
  state('binary_sensor.front_door', 'off', { device_class: 'door' }),
  state('calendar.home', 'off'),
  state('sensor.living_temperature', '21.4', {
    unit_of_measurement: '°C',
    device_class: 'temperature',
    state_class: 'measurement',
  }),
  state('sensor.living_humidity', '48', {
    unit_of_measurement: '%',
    device_class: 'humidity',
    state_class: 'measurement',
  }),
  state('sensor.solar_power', '1200', {
    unit_of_measurement: 'W',
    device_class: 'power',
    state_class: 'measurement',
  }),
  state('sensor.grid_energy', '12.4', {
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  }),
  state('sensor.phone_battery', '64', { unit_of_measurement: '%', device_class: 'battery' }),
  state('sun.sun', 'above_horizon'),
];

export const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24', first_weekday: 'monday' },
  states: Object.fromEntries(STATES.map((s) => [s.entity_id, s])),
  entities: Object.fromEntries(
    STATES.map((s) => [
      s.entity_id,
      { entity_id: s.entity_id, area_id: 'living', device_id: null },
    ]),
  ),
  devices: {},
  areas: { living: { area_id: 'living', name: 'Living room', picture: null, icon: null } },
  floors: {},
  user: { id: 'u1', name: 'Marta', is_admin: true, is_owner: true },
  config: {
    unit_system: { temperature: '°C', length: 'km' },
    time_zone: 'UTC',
    latitude: 41.4,
    longitude: 2.17,
  },
  themes: { darkMode: false, themes: {} },
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  hassUrl: (path: string) => path,
  callService: () => Promise.resolve(),
  callWS: () => new Promise(() => undefined),
  callApi: () => new Promise(() => undefined),
  connection: {
    subscribeMessage: () => new Promise(() => undefined),
    subscribeEvents: () => new Promise(() => undefined),
  },
} as unknown as HomeAssistant;
