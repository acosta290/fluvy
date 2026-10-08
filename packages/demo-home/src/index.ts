/**
 * The demo home — one fictional house (Marta's flat, the home every design sheet shows), in the registry form Home
 * Assistant hands a dashboard strategy: areas, devices and entities with a state. Nothing in it belongs to a real
 * installation. The automatic dashboard's tests build
 * their `hass` from it, the playground names its dashboards after it, and the documentation's examples speak of it.
 *
 * The house is shaped to exercise the strategy's word rules: lights that are switches (`kitchen_light`), a plug with
 * twin outlets and readings (`washing_machine`), a heat pump with a boost switch that is not an appliance, a weather
 * service beside the home forecast, solar and grid power found by their words, a phone's battery, a leak sensor.
 */

export interface DemoEntity {
  readonly id: string;
  readonly state: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  /** Entity-registry fields (device, area, platform, category). */
  readonly registry?: Readonly<Record<string, unknown>>;
}

export interface DemoArea {
  readonly area_id: string;
  readonly name: string;
  readonly floor_id?: string;
  readonly icon?: string;
  /** A photo of the room (a data URI here: nothing is fetched). */
  readonly picture?: string;
  readonly temperature_entity_id?: string;
  readonly humidity_entity_id?: string;
}

export interface DemoFloor {
  readonly floor_id: string;
  readonly name: string;
  readonly level: number;
}

export interface DemoDevice {
  readonly id: string;
  readonly area_id: string | null;
  readonly name?: string;
}

export interface DemoDashboard {
  readonly url_path: string;
  readonly title: string;
  readonly icon: string;
}

/** The living room's photo: a drawing, so the demo fetches nothing. */
export const LIVING_ROOM_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c7a8"/><stop offset="1" stop-color="#8c6f4e"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><rect x="40" y="110" width="150" height="50" rx="10" fill="#5b4632"/><circle cx="250" cy="70" r="30" fill="#f3e6c8" opacity="0.8"/></svg>',
)}`;

export const DEMO_FLOORS: readonly DemoFloor[] = [
  { floor_id: 'ground', name: 'Ground floor', level: 0 },
  { floor_id: 'upstairs', name: 'Upstairs', level: 1 },
];

export const DEMO_AREAS: readonly DemoArea[] = [
  {
    area_id: 'living_room',
    name: 'Living room',
    floor_id: 'ground',
    icon: 'mdi:sofa',
    picture: LIVING_ROOM_PICTURE,
  },
  { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground', icon: 'mdi:silverware-fork-knife' },
  { area_id: 'bedroom', name: 'Bedroom', floor_id: 'upstairs', icon: 'mdi:bed' },
  { area_id: 'garden', name: 'Garden', temperature_entity_id: 'sensor.garden_temperature' },
];

export const DEMO_DEVICES: readonly DemoDevice[] = [
  { id: 'd-living', area_id: 'living_room', name: 'Zigbee hub' },
  { id: 'd-washer', area_id: null },
  { id: 'd-garden', area_id: 'garden' },
  { id: 'd-printer', area_id: null, name: 'P1S' },
];

const power = { device_class: 'power', unit_of_measurement: 'W' } as const;
const energy = { device_class: 'energy', unit_of_measurement: 'kWh' } as const;

/** What the house has on an ordinary day. */
export const DEMO_HOME: readonly DemoEntity[] = [
  {
    id: 'light.living_room_lamp',
    state: 'on',
    attributes: {
      friendly_name: 'Zigbee hub Living room lamp',
      supported_color_modes: ['color_temp'],
      brightness: 120,
    },
    registry: { device_id: 'd-living', area_id: 'living_room' },
  },
  {
    id: 'switch.kitchen_light',
    state: 'off',
    attributes: { friendly_name: 'Kitchen light' },
    registry: { area_id: 'kitchen' },
  },
  { id: 'switch.patio_light', state: 'off', attributes: { friendly_name: 'Patio light' } },
  {
    id: 'switch.washing_machine',
    state: 'on',
    attributes: { friendly_name: 'Washing machine' },
    registry: { device_id: 'd-washer' },
  },
  {
    id: 'switch.washing_machine_outlet',
    state: 'on',
    attributes: { friendly_name: 'Washing machine outlet' },
    registry: { device_id: 'd-washer' },
  },
  {
    id: 'sensor.washing_machine_power',
    state: '120',
    attributes: power,
    registry: { device_id: 'd-washer' },
  },
  {
    id: 'sensor.washing_machine_energy_today',
    state: '1.2',
    attributes: energy,
    registry: { device_id: 'd-washer' },
  },
  {
    id: 'sensor.washing_machine_energy_month',
    state: '31',
    attributes: energy,
    registry: { device_id: 'd-washer' },
  },
  { id: 'switch.heat_pump_boost', state: 'off', attributes: { friendly_name: 'Boost hot water' } },
  { id: 'switch.plug_beep', state: 'off', registry: { entity_category: 'config' } },
  { id: 'climate.heat_pump', state: 'heat', attributes: { temperature: 21 } },
  { id: 'weather.home', state: 'sunny' },
  {
    id: 'sensor.garden_temperature',
    state: '23.1',
    attributes: { device_class: 'temperature' },
    registry: { device_id: 'd-garden' },
  },
  {
    id: 'sensor.garden_humidity',
    state: '55',
    attributes: { device_class: 'humidity' },
    registry: { device_id: 'd-garden' },
  },
  {
    id: 'sensor.met_temperature',
    state: '25',
    attributes: { device_class: 'temperature' },
    registry: { platform: 'met' },
  },
  { id: 'sensor.solar_inverter_power', state: '3200', attributes: power },
  { id: 'sensor.grid_meter_power', state: '-1200', attributes: power },
  { id: 'sensor.solar_inverter_daily_yield', state: '12.4', attributes: energy },
  {
    id: 'sensor.garden_battery',
    state: '67',
    attributes: { device_class: 'battery' },
    registry: { entity_category: 'diagnostic', device_id: 'd-garden' },
  },
  {
    id: 'sensor.phone_battery_level',
    state: '80',
    attributes: { device_class: 'battery' },
    registry: { entity_category: 'diagnostic', platform: 'mobile_app' },
  },
  { id: 'person.marta', state: 'home' },
  { id: 'binary_sensor.kitchen_leak', state: 'off', attributes: { device_class: 'moisture' } },
  { id: 'binary_sensor.zigbee_bridge', state: 'on', attributes: { device_class: 'connectivity' } },
  { id: 'update.core', state: 'off' },
  { id: 'media_player.tv', state: 'off' },
  { id: 'todo.groceries', state: '3' },
  { id: 'input_number.electricity_price', state: '0.11' },
];

/** One of everything the library has a card for, on top of the ordinary house. */
/** A 3D printer (Bambu Lab's words): its state, how far it is, its nozzle, its pause and stop. */
const printer = (
  id: string,
  state: string,
  translation_key: string,
  attributes = {},
): DemoEntity => ({
  id,
  state,
  attributes,
  registry: { device_id: 'd-printer', platform: 'bambu_lab', translation_key },
});

export const DEMO_EXTRAS: readonly DemoEntity[] = [
  printer('sensor.p1s_print_status', 'running', 'print_status', {
    friendly_name: 'P1S Print status',
  }),
  printer('sensor.p1s_print_progress', '62', 'print_progress', { unit_of_measurement: '%' }),
  printer('sensor.p1s_remaining_time', '72', 'remaining_time', {
    unit_of_measurement: 'min',
    device_class: 'duration',
  }),
  printer('sensor.p1s_nozzle_temperature', '220', 'nozzle_temp', {
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
  printer('button.p1s_pause_printing', 'unknown', 'pause'),
  printer('button.p1s_stop_printing', 'unknown', 'stop'),
  {
    id: 'cover.living_room_blinds',
    state: 'open',
    attributes: {
      friendly_name: 'Living room blinds',
      device_class: 'shutter',
      current_position: 60,
      supported_features: 15,
    },
  },
  {
    id: 'cover.garage_door',
    state: 'closed',
    attributes: { friendly_name: 'Garage door', device_class: 'garage', supported_features: 3 },
  },
  {
    id: 'fan.ceiling_fan',
    state: 'on',
    attributes: { friendly_name: 'Ceiling fan', percentage: 40, supported_features: 1 },
  },
  { id: 'lock.front_door', state: 'locked', attributes: { friendly_name: 'Front door' } },
  {
    id: 'alarm_control_panel.home',
    state: 'disarmed',
    attributes: { friendly_name: 'Alarm', supported_features: 3 },
  },
  { id: 'camera.garden', state: 'idle', attributes: { friendly_name: 'Garden' } },
  { id: 'calendar.family', state: 'off', attributes: { friendly_name: 'Family' } },
  { id: 'timer.oven', state: 'idle', attributes: { friendly_name: 'Oven', duration: '0:10:00' } },
  { id: 'scene.movie_night', state: 'unknown', attributes: { friendly_name: 'Movie night' } },
  { id: 'script.leave_home', state: 'off', attributes: { friendly_name: 'Leave home' } },
  { id: 'vacuum.robot', state: 'docked', attributes: { friendly_name: 'Robot' } },
  {
    id: 'media_player.kitchen_speaker',
    state: 'playing',
    attributes: { friendly_name: 'Kitchen speaker', media_title: 'Radio' },
  },
  {
    id: 'sensor.grid_energy_today',
    state: '4.1',
    attributes: { friendly_name: 'Grid today', ...energy },
  },
  {
    id: 'sensor.fern_moisture',
    state: '41',
    attributes: { friendly_name: 'Fern', device_class: 'moisture', unit_of_measurement: '%' },
  },
  { id: 'sensor.dryer_power', state: '300', attributes: power, registry: { device_id: 'd-dryer' } },
  // the energy system beyond the sun and the grid: a home battery with its charge, a car charger, water and gas
  { id: 'sensor.home_battery_power', state: '-600', attributes: power },
  {
    id: 'sensor.home_battery_level',
    state: '62',
    attributes: {
      device_class: 'battery',
      unit_of_measurement: '%',
      friendly_name: 'Home battery',
    },
  },
  {
    id: 'sensor.wallbox_power',
    state: '7400',
    attributes: { ...power, friendly_name: 'Wallbox power' },
  },
  {
    id: 'sensor.water_meter',
    state: '412.8',
    attributes: {
      friendly_name: 'Water meter',
      device_class: 'water',
      unit_of_measurement: 'm³',
      state_class: 'total_increasing',
    },
  },
  {
    id: 'sensor.gas_meter',
    state: '1830.2',
    attributes: {
      friendly_name: 'Gas meter',
      device_class: 'gas',
      unit_of_measurement: 'm³',
      state_class: 'total_increasing',
    },
  },
  {
    id: 'sensor.dryer_energy_today',
    state: '0.8',
    attributes: energy,
    registry: { device_id: 'd-dryer' },
  },
];

/** The heat pump's own readings, when the energy dashboard lists it as a device. */
export const DEMO_HEAT_PUMP_READINGS: readonly DemoEntity[] = [
  {
    id: 'sensor.heat_pump_power',
    state: '900',
    attributes: power,
    registry: { device_id: 'd-heat-pump' },
  },
  {
    id: 'sensor.heat_pump_energy_today',
    state: '6.9',
    attributes: energy,
    registry: { device_id: 'd-heat-pump' },
  },
];

/**
 * The energy dashboard of a house that has set it all up: the grid's meters, the sun and the battery with their
 * power sensors, the battery's charge and capacity, water and gas.
 */
export const DEMO_ENERGY_SOURCES: readonly Record<string, unknown>[] = [
  {
    type: 'grid',
    stat_energy_from: 'sensor.grid_energy_today',
    stat_energy_to: null,
    power_config: { stat_rate: 'sensor.grid_meter_power' },
  },
  {
    type: 'solar',
    stat_energy_from: 'sensor.solar_inverter_daily_yield',
    stat_rate: 'sensor.solar_inverter_power',
  },
  {
    type: 'battery',
    stat_energy_from: 'sensor.home_battery_out',
    stat_energy_to: 'sensor.home_battery_in',
    power_config: { stat_rate: 'sensor.home_battery_power' },
    stat_soc: 'sensor.home_battery_level',
    capacity: 10,
  },
  { type: 'water', stat_energy_from: 'sensor.water_meter' },
  { type: 'gas', stat_energy_from: 'sensor.gas_meter' },
];

/** The devices the energy dashboard tracks in the ordinary house (its `device_consumption` statistics). */
export const DEMO_CONSUMPTION: readonly string[] = ['sensor.washing_machine_energy_today'];

/** Rooms and people beyond the ordinary day: a bedroom upstairs, a second person at work (for the room and map cards). */
export const DEMO_ROOMS: readonly DemoEntity[] = [
  {
    id: 'light.bedroom_ceiling',
    state: 'off',
    attributes: { friendly_name: 'Bedroom ceiling', supported_color_modes: ['brightness'] },
    registry: { area_id: 'bedroom' },
  },
  {
    id: 'light.bedroom_bedside',
    state: 'on',
    attributes: {
      friendly_name: 'Bedside lamp',
      supported_color_modes: ['hs', 'color_temp'],
      color_mode: 'hs',
      brightness: 90,
      hs_color: [24, 65],
      rgb_color: [255, 160, 90],
    },
    registry: { area_id: 'bedroom' },
  },
  {
    id: 'sensor.bedroom_temperature',
    state: '19.5',
    attributes: {
      friendly_name: 'Bedroom temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    },
    registry: { area_id: 'bedroom' },
  },
  {
    id: 'zone.work',
    state: '1',
    attributes: {
      friendly_name: 'Work',
      latitude: 41.39,
      longitude: 2.17,
      radius: 100,
      icon: 'mdi:briefcase',
    },
  },
  {
    id: 'person.pau',
    state: 'Work',
    attributes: {
      friendly_name: 'Pau',
      user_id: 'u-pau',
      latitude: 41.39,
      longitude: 2.17,
      gps_accuracy: 20,
    },
  },
];

/** The dashboards the house has: its own home, the automatic one, and one of Home Assistant's. */
export const DEMO_DASHBOARDS: readonly DemoDashboard[] = [
  { url_path: 'fluvy-home', title: 'Home', icon: 'mdi:home' },
  { url_path: 'fluvy-auto', title: 'Fluvy auto', icon: 'fluvy:sun' },
  { url_path: 'dashboard-energy', title: 'Energy', icon: 'mdi:lightning-bolt' },
];

export interface DemoHassOptions {
  /** Entities on top of the ordinary house (a later one with the same id replaces an earlier one). */
  readonly more?: readonly DemoEntity[];
  /** The energy dashboard's device statistics. */
  readonly consumption?: readonly string[];
  /** The energy dashboard's sources, meters and power sensors (`DEMO_ENERGY_SOURCES`), beside its devices. */
  readonly sources?: readonly Record<string, unknown>[];
  readonly language?: string;
}

/** What the strategy reads of `hass`, built from the demo home. */
export interface DemoHass {
  language: string;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
  entities: Record<string, Record<string, unknown>>;
  devices: Record<string, { id: string; area_id: string | null; name?: string }>;
  areas: Record<string, DemoArea>;
  floors: Record<string, DemoFloor>;
  user: { id: string; name: string; is_admin: boolean };
  callWS: (message: { type: string }) => Promise<unknown>;
}

/** A `hass` for the demo home: the registries and the energy preferences a strategy asks for. */
export function demoHass(options: DemoHassOptions = {}): DemoHass {
  const states: DemoHass['states'] = {};
  const entities: DemoHass['entities'] = {};
  for (const entity of [...DEMO_HOME, ...(options.more ?? [])]) {
    states[entity.id] = {
      state: entity.state,
      attributes: { friendly_name: entity.id.split('.')[1], ...entity.attributes },
    };
    entities[entity.id] = { entity_id: entity.id, ...entity.registry };
  }
  const consumption = options.consumption ?? DEMO_CONSUMPTION;
  return {
    language: options.language ?? 'en',
    states,
    entities,
    devices: Object.fromEntries(DEMO_DEVICES.map((device) => [device.id, { ...device }])),
    areas: Object.fromEntries(DEMO_AREAS.map((area) => [area.area_id, { ...area }])),
    floors: Object.fromEntries(DEMO_FLOORS.map((floor) => [floor.floor_id, { ...floor }])),
    user: { id: 'u-marta', name: 'Marta', is_admin: true },
    callWS: async () => ({
      ...(options.sources ? { energy_sources: options.sources } : {}),
      device_consumption: consumption.map((stat) => ({ stat_consumption: stat })),
    }),
  };
}
