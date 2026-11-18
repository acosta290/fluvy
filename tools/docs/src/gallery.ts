/**
 * The gallery: one example of every card on the demo house (Marta's flat, the house every design sheet shows), and of
 * each of its layouts. It is the one spec the docs and the demo are made from, so they cannot say different things:
 * the playground's `gallery` sheet draws it (and the measurer audits it there), `pnpm docs:images` takes each
 * example's picture from that sheet, `pnpm docs:cards` prints each example beside its picture as the YAML that draws it
 * (`yaml.ts`), and the live demo shows every example on its card's page with that same YAML.
 *
 * An example is a configuration a person could paste: the card's newest names, no key left at its default, nothing of
 * the sheets' own (`_now`). Its entities are the demo house's, so the names and the figures in a picture are made up.
 * A card with a layout select (`variant`, a tile's `size`, an Expander's `style`, a humidity card's `gauge`) is drawn
 * once more for each other value: the base with that key and whatever the layout needs beside it to be itself.
 * `pnpm check` holds the spec to the code (`checks.ts`): an example for every card, a line for every value of its
 * layout select, no key its editor does not show, no older name, no default written out.
 */
import type { LovelaceCardConfig } from '@fluvy/core';

/**
 * The moment the gallery shows: the pictures' (`pnpm docs:images` holds the playground's clock there), and the clock of
 * every card on the `gallery` sheet that keeps one of its own (`_now`), so the measurer, which draws the sheet at
 * today's time, sees what the pictures show. It is 21:50 on the clock of the machine drawing it, as the sheets' own
 * moment is 21:47 there (`apps/playground/src/now.ts`): a fixed instant would put a card's clock before the states it
 * reads in another time zone (in UTC, where CI draws, a window opened at 21:27 was not yet open five minutes at 19:50,
 * and the alerts' rows lost a row). Where the pictures are taken (CEST) it is 19:50Z.
 */
export const MOMENT = new Date(2026, 8, 17, 21, 50, 0).toISOString();

/** One of a card's other layouts: what it needs beside its key, and the columns it is given where they are not the base's. */
export interface Variant {
  readonly config?: Readonly<Record<string, unknown>>;
  /** Of a section's 12; 12 a full card where the base is half a section. */
  readonly cols?: number;
}

export interface Example {
  /** What the card's picture draws and its page prints: its configuration in the layout it has when none is named. */
  readonly config: LovelaceCardConfig;
  /** The columns it is given, of a section's 12, where it is not a full card (a tile is half a section). */
  readonly cols?: number;
  /** The key its layouts are chosen by, where it is not `variant`. */
  readonly layout?: string;
  /**
   * The layout the base is drawn in, where the house decides it and it is not the one the editor shows on a new card
   * (a room whose area has a picture is a photo).
   */
  readonly own?: string;
  /** Each layout but the base's, by its value. */
  readonly variants?: Readonly<Record<string, Variant>>;
}

/** An example as it is drawn: the card's base, or one of its other layouts. */
export interface Drawn {
  /** What its frame is named: the card's short name, then the layout's value after ` · `. */
  readonly name: string;
  /** The layout's value; none on the base. */
  readonly layout?: string;
  readonly config: LovelaceCardConfig;
  readonly cols?: number;
}

/** A card's short name: its tag without `fluvy-` and `-card`, what its page, its pictures and its frames are named by. */
export const shortName = (tag: string): string => tag.replace(/^fluvy-/, '').replace(/-card$/, '');

/** The key a card's layouts are chosen by, as its example says it. */
export const layoutKey = (example: Example): string => example.layout ?? 'variant';

/** A card's examples as they are drawn: its base, then each other layout as the base plus its key. */
export function drawn(tag: string, example: Example): Drawn[] {
  const name = shortName(tag);
  const { cols } = example;
  return [
    { name, config: example.config, ...(cols ? { cols } : {}) },
    ...Object.entries(example.variants ?? {}).map(([layout, variant]) => {
      const given = variant.cols ?? cols;
      return {
        name: `${name} · ${layout}`,
        layout,
        config: { ...example.config, [layoutKey(example)]: layout, ...variant.config },
        ...(given && given < 12 ? { cols: given } : {}),
      };
    }),
  ];
}

/**
 * An example as the playground mounts it: its configuration and the columns it is given. What a picture is of: the
 * pictures' manifest keeps a digest of it, so a picture of another example is known without drawing it again.
 */
export const mounted = ({ config, cols }: Drawn): LovelaceCardConfig & { cols?: number } => ({
  ...config,
  ...(cols ? { cols } : {}),
});

/** Every card's example, by its tag, in the order the docs list the cards. */
export const GALLERY: Readonly<Record<string, Example>> = {
  'fluvy-tile-card': {
    config: { type: 'custom:fluvy-tile-card', entity: 'light.ceiling' },
    cols: 6,
    layout: 'size',
    variants: { compact: {}, mini: {} },
  },
  'fluvy-tiles-card': {
    config: {
      type: 'custom:fluvy-tiles-card',
      tiles: [
        { entity: 'switch.desk_plug', readouts: ['sensor.desk_plug_power'] },
        { entity: 'switch.patio' },
      ],
    },
    layout: 'size',
    variants: { mini: {}, large: {} },
  },
  'fluvy-template-card': {
    config: {
      type: 'custom:fluvy-template-card',
      entity: 'light.tp_desk',
      icon: "{{ 'mdi:lamp' if is_state(entity, 'on') else 'mdi:lamp-outline' }}",
      secondary: "{{ states('sensor.tp_temperature') }} °C here",
    },
    cols: 6,
    variants: { mini: {}, large: {} },
  },
  'fluvy-light-card': {
    config: { type: 'custom:fluvy-light-card', entity: 'light.ceiling' },
    variants: { full: {}, compact: {} },
  },
  'fluvy-slider-card': {
    config: { type: 'custom:fluvy-slider-card', entity: 'media_player.sl_soundbar' },
    variants: { compact: {}, tile: {} },
  },
  'fluvy-lights-card': {
    config: {
      type: 'custom:fluvy-lights-card',
      name: 'Living room',
      lights: ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading'],
    },
    variants: { chips: {}, tiles: {} },
  },
  'fluvy-thermostat-card': {
    config: { type: 'custom:fluvy-thermostat-card', entity: 'climate.living' },
    variants: { compact: {}, ruler: {} },
  },
  'fluvy-entities-card': {
    config: {
      type: 'custom:fluvy-entities-card',
      title: 'Kitchen',
      subtitle: '7 devices',
      icon: 'grid',
      show_count: true,
      rows: [
        'switch.kitchen_light',
        'switch.washer',
        'binary_sensor.kitchen_window',
        'binary_sensor.motion_hall',
        'sensor.hall_temperature',
        'lock.front_door',
        'switch.ghost',
      ],
    },
    variants: { compact: {} },
  },
  'fluvy-items-card': {
    config: { type: 'custom:fluvy-items-card', entity: 'sensor.it_flights' },
    variants: { compact: {}, tiles: {} },
  },
  'fluvy-media-card': {
    config: { type: 'custom:fluvy-media-card', entity: 'media_player.kitchen' },
    variants: { mini: {}, hero: {} },
  },
  'fluvy-now-playing-card': {
    config: { type: 'custom:fluvy-now-playing-card', entity: 'media_player.den' },
  },
  'fluvy-remote-card': {
    config: {
      type: 'custom:fluvy-remote-card',
      entity: 'media_player.rm_tv',
      remote: 'remote.rm_tv',
      volume_entity: 'media_player.rm_receiver',
    },
    variants: { compact: {}, pad: {}, row: {} },
  },
  'fluvy-cover-card': {
    config: {
      type: 'custom:fluvy-cover-card',
      entity: 'cover.blinds',
      subtitle: 'Living room · window',
      tilt_angle: 90,
      tilt_style: 'slats',
      favorites: [
        { name: 'Morning', position: 60 },
        { name: 'Night', position: 0, tilt: 0 },
      ],
    },
    variants: { compact: {} },
  },
  'fluvy-fan-card': {
    config: { type: 'custom:fluvy-fan-card', entity: 'fan.ceiling', subtitle: 'Bedroom' },
    variants: { compact: {} },
  },
  'fluvy-vacuum-card': {
    config: {
      type: 'custom:fluvy-vacuum-card',
      entity: 'vacuum.robot',
      subtitle: 'Kitchen · started 21:29',
      battery_entity: 'sensor.robot_battery',
      area_entity: 'sensor.robot_area',
      duration_entity: 'sensor.robot_elapsed',
      remaining_entity: 'sensor.robot_remaining',
    },
    variants: { compact: {} },
  },
  'fluvy-lock-card': {
    config: {
      type: 'custom:fluvy-lock-card',
      entity: 'lock.front_door',
      rows: [
        { entity: 'switch.auto_lock', icon: 'clock' },
        'binary_sensor.front_door',
        { entity: 'input_text.guest_code', icon: 'key' },
      ],
    },
    variants: { compact: {} },
  },
  'fluvy-alarm-card': {
    config: {
      type: 'custom:fluvy-alarm-card',
      entity: 'alarm_control_panel.house',
      rows: ['binary_sensor.living_motion', 'binary_sensor.back_door'],
    },
    variants: { compact: {} },
  },
  'fluvy-camera-card': {
    config: {
      type: 'custom:fluvy-camera-card',
      entity: 'camera.driveway',
      subtitle: 'Front of house · 1080p',
      rows: [
        { entity: 'binary_sensor.person', icon: 'person' },
        { entity: 'binary_sensor.vehicle', icon: 'car' },
      ],
    },
  },
  'fluvy-cameras-card': {
    config: {
      type: 'custom:fluvy-cameras-card',
      cameras: ['camera.cm_driveway', 'camera.cm_garden', 'camera.cm_terrace', 'camera.cm_garage'],
      title: 'Outside',
    },
    variants: { list: {}, compact: {} },
  },
  'fluvy-printer-card': {
    config: { type: 'custom:fluvy-printer-card', device: 'd-p1s' },
    variants: { compact: {}, row: {} },
  },
  'fluvy-appliance-card': {
    config: { type: 'custom:fluvy-appliance-card', device: 'miele-washer', name: 'Washer' },
    variants: { compact: {}, ring: {}, row: {} },
  },
  'fluvy-appliances-card': {
    config: {
      type: 'custom:fluvy-appliances-card',
      appliances: [
        { device: 'lg-washer', name: 'Washer' },
        { device: 'lg-dryer', name: 'Dryer' },
        { device: 'hc-dish', name: 'Dishwasher' },
        { device: 'hc-oven', name: 'Oven' },
      ],
    },
    variants: { compact: {}, tiles: {}, cards: {} },
  },
  'fluvy-vehicle-card': {
    // a plug-in hybrid: its battery and its tank (#207)
    config: { type: 'custom:fluvy-vehicle-card', device: 'd-niro', energy: 'hybrid' },
    variants: { compact: {}, mini: {} },
  },
  'fluvy-weather-card': {
    config: {
      type: 'custom:fluvy-weather-card',
      entity: 'weather.am_home',
      forecast: 'both',
      days: 3,
    },
    variants: { compact: {} },
  },
  'fluvy-sensor-card': {
    config: {
      type: 'custom:fluvy-sensor-card',
      entity: 'sensor.am_living_temperature',
      name: 'Living room',
      subtitle: 'Temperature',
    },
    variants: { tile: {} },
  },
  'fluvy-readouts-card': {
    config: {
      type: 'custom:fluvy-readouts-card',
      rows: ['sensor.living_temperature', 'sensor.living_humidity', 'sensor.home_power'],
    },
    variants: { row: {} },
  },
  'fluvy-people-card': {
    config: {
      type: 'custom:fluvy-people-card',
      people: ['person.am_marta', 'person.am_pau', 'person.am_ona'],
    },
    variants: { rows: {} },
  },
  'fluvy-openings-card': {
    config: {
      type: 'custom:fluvy-openings-card',
      rows: [
        { entity: 'binary_sensor.am_front_door', name: 'Front door' },
        { entity: 'binary_sensor.am_kitchen_window', name: 'Kitchen', icon: 'blinds' },
        { entity: 'binary_sensor.am_garage_door', name: 'Garage', color: 'purple' },
        'binary_sensor.am_hallway_motion',
      ],
    },
    variants: { compact: {}, tiles: {} },
  },
  'fluvy-alerts-card': {
    config: {
      type: 'custom:fluvy-alerts-card',
      alerts: [
        { preset: 'hazards', id: 'hazards' },
        { preset: 'unavailable', domain: 'light', name: 'Lights unavailable', id: 'lights' },
        {
          preset: 'unavailable',
          device_class: ['occupancy', 'presence', 'motion'],
          name: 'Presence sensors offline',
          id: 'presence',
        },
        { preset: 'low_battery', id: 'batteries' },
        { preset: 'open', for: { minutes: 5 }, id: 'open' },
        { preset: 'updates', id: 'updates' },
      ],
    },
    variants: { mini: {}, chips: {}, rows: {}, banner: {} },
  },
  'fluvy-room-card': {
    config: {
      type: 'custom:fluvy-room-card',
      area: 'rm_living',
      path: '/fluvy-auto/room-rm_living',
    },
    own: 'photo',
    variants: { tile: {}, row: {} },
  },
  'fluvy-map-card': {
    config: {
      type: 'custom:fluvy-map-card',
      entities: [
        'person.am_marta',
        'person.am_pau',
        'person.am_ona',
        'person.am_jan',
        'person.am_noa',
      ],
    },
    variants: { map: {}, rows: {} },
  },
  'fluvy-hello-card': {
    config: {
      type: 'custom:fluvy-hello-card',
      name: 'Marta',
      person: 'person.marta',
      weather: 'weather.flat',
    },
  },
  'fluvy-chips-card': {
    config: {
      type: 'custom:fluvy-chips-card',
      chips: [
        { name: 'All', path: '/' },
        { name: 'Living', path: '/fluvy-home/living' },
        { name: 'Kitchen', path: '/fluvy-home/kitchen' },
        { name: 'Bedroom', path: '/fluvy-home/bedroom' },
      ],
    },
  },
  'fluvy-heading-card': {
    config: {
      type: 'custom:fluvy-heading-card',
      title: 'Living room',
      icon: 'fluvy:home',
      subtitle: '4 devices',
      path: '/fluvy-home/living',
    },
    variants: { plain: {} },
  },
  'fluvy-expander-card': {
    config: {
      type: 'custom:fluvy-expander-card',
      title: 'Garden',
      icon: 'leaf',
      entities: [
        'light.ex_terrace',
        'light.ex_path',
        'light.ex_pergola',
        'switch.ex_lawn',
        'switch.ex_beds',
      ],
      remember: 'off',
      cards: [
        { type: 'custom:fluvy-light-card', entity: 'light.ex_terrace' },
        {
          type: 'custom:fluvy-tiles-card',
          size: 'compact',
          columns: 2,
          tiles: [
            { entity: 'light.ex_path' },
            { entity: 'light.ex_pergola' },
            { entity: 'switch.ex_lawn', icon: 'drop' },
            { entity: 'switch.ex_beds', icon: 'leaf' },
          ],
        },
        {
          type: 'custom:fluvy-readouts-card',
          entities: ['sensor.ex_soil', 'sensor.ex_garden_temperature', 'sensor.ex_rain'],
        },
      ],
      expanded: true,
    },
    layout: 'style',
    variants: { plain: {} },
  },
  'fluvy-swipe-card': {
    config: {
      type: 'custom:fluvy-swipe-card',
      cards: [
        { type: 'custom:fluvy-room-card', area: 'rm_living', path: '/fluvy-auto/room-rm_living' },
        { type: 'custom:fluvy-room-card', area: 'rm_kitchen' },
        { type: 'custom:fluvy-room-card', area: 'rm_bedroom' },
      ],
    },
    layout: 'style',
    variants: { plain: {} },
  },
  'fluvy-web-card': {
    config: {
      type: 'custom:fluvy-web-card',
      url: '/web/radar.html',
      title: 'Lightning',
      subtitle: 'Live strikes',
    },
    variants: { frame: {}, bare: {} },
  },
  'fluvy-scene-card': {
    config: { type: 'custom:fluvy-scene-card', entity: 'scene.evening', icon: 'moon' },
    cols: 6,
  },
  'fluvy-scenes-card': {
    config: {
      type: 'custom:fluvy-scenes-card',
      scenes: [
        { entity: 'scene.am_morning', icon: 'sun' },
        { entity: 'scene.am_cinema', icon: 'film' },
        { entity: 'scene.am_night', icon: 'moon', subtitle: 'All off' },
        { entity: 'scene.am_away', icon: 'away', subtitle: 'Lock & arm' },
      ],
    },
    variants: { chips: {} },
  },
  'fluvy-actions-card': {
    config: {
      type: 'custom:fluvy-actions-card',
      tap_action: { action: 'navigate', navigation_path: '/config/scene/dashboard' },
      rows: [
        { entity: 'scene.morning', secondary: 'Lights & blinds' },
        { entity: 'scene.night', secondary: 'Lights & lock' },
        { entity: 'button.restart_ha', secondary: 'Core & add-ons' },
        { entity: 'script.backup', secondary: 'Full backup' },
      ],
    },
  },
  'fluvy-helpers-card': {
    config: {
      type: 'custom:fluvy-helpers-card',
      title: 'Helpers',
      subtitle: 'Living room · 4 inputs',
      tap_action: { action: 'navigate', navigation_path: '/config/helpers' },
      rows: [
        { entity: 'input_number.brightness', secondary: 'Living room lights' },
        { entity: 'input_select.house_mode', secondary: '' },
        { entity: 'input_text.welcome', secondary: 'Shown on arrival' },
        { entity: 'input_boolean.guest', icon: 'moon', secondary: 'Since Monday' },
      ],
    },
  },
  'fluvy-todo-card': {
    config: { type: 'custom:fluvy-todo-card', entity: 'todo.groceries' },
  },
  'fluvy-timer-card': {
    config: { type: 'custom:fluvy-timer-card', entity: 'timer.kitchen' },
  },
  'fluvy-updates-card': {
    config: {
      type: 'custom:fluvy-updates-card',
      entities: ['update.core', 'update.plug', 'update.vacuum', 'update.router'],
      toggle: 'input_boolean.auto_update',
      toggle_secondary: '03:00 · backup first',
    },
  },
  'fluvy-automations-card': {
    config: {
      type: 'custom:fluvy-automations-card',
      entities: [
        'automation.blinds',
        'automation.good_morning',
        'automation.leak_alert',
        'automation.odd',
        'automation.broken',
        'automation.vacation_lights',
        'automation.weekend_heating',
      ],
    },
    variants: { compact: {}, tiles: {} },
  },
  'fluvy-energy-period-card': {
    config: {
      type: 'custom:fluvy-energy-period-card',
      collection_key: 'energy_pg',
      show_compare: true,
    },
    variants: { compact: {}, stacked: {}, bar: {} },
  },
  'fluvy-energy-usage-card': {
    config: { type: 'custom:fluvy-energy-usage-card' },
    variants: { compact: {}, mini: {} },
  },
  'fluvy-energy-card': {
    config: {
      type: 'custom:fluvy-energy-card',
      entity: 'sensor.ef_house_power',
      name: 'Energy',
      cost_entity: 'sensor.ef_cost_now',
      legend: [
        { entity: 'sensor.ef_grid_today', name: 'Grid' },
        { entity: 'sensor.ef_solar_today', name: 'Solar' },
        { entity: 'sensor.ef_peak_today', name: 'Peak' },
      ],
    },
    variants: { compact: {}, sources: {}, overview: {} },
  },
  'fluvy-energy-flow-card': {
    config: {
      type: 'custom:fluvy-energy-flow-card',
      subtitle: 'Live · 5 s ago',
      home: 'sensor.ef_house_power',
      sources: [
        { type: 'solar', power: 'sensor.ef_solar_power' },
        { type: 'grid', power: 'sensor.ef_grid_power' },
        { type: 'battery', power: 'sensor.ef_battery_power', level: 'sensor.ef_battery_level' },
      ],
      readouts: [
        { entity: 'sensor.ef_self_use', name: 'Self-use' },
        { entity: 'sensor.ef_exported_today', name: 'Exported' },
        { entity: 'sensor.ef_imported_today', name: 'Imported' },
      ],
    },
    variants: { cross: {}, list: {} },
  },
  'fluvy-energy-balance-card': {
    config: {
      type: 'custom:fluvy-energy-balance-card',
      sources: [
        { type: 'solar', power: 'sensor.bl_solar' },
        { type: 'grid', phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'] },
        { type: 'battery', power: 'sensor.bl_battery' },
      ],
    },
  },
  'fluvy-grid-card': {
    config: {
      type: 'custom:fluvy-grid-card',
      phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'],
      voltages: ['sensor.bl_v1', 'sensor.bl_v2', 'sensor.bl_v3'],
      price: 'sensor.bl_price',
    },
  },
  'fluvy-batteries-card': {
    config: {
      type: 'custom:fluvy-batteries-card',
      batteries: [
        {
          power: 'sensor.st_garage',
          level: 'sensor.st_garage_level',
          capacity: 10,
          name: 'Garage',
        },
        {
          power: 'sensor.st_basement',
          level: 'sensor.st_basement_level',
          capacity: 10,
          name: 'Basement',
        },
      ],
      reserve: 20,
    },
  },
  'fluvy-ev-charger-card': {
    config: {
      type: 'custom:fluvy-ev-charger-card',
      entity: 'sensor.st_wallbox',
      level: 'sensor.st_car_level',
      target: 80,
      ready_by: '07:00',
      session_energy: 'sensor.st_session',
      status: 'sensor.st_wallbox_status',
      vehicle: 'Model 3',
      solar_share: 'sensor.st_solar_share',
      mode: 'select.st_wallbox_mode',
    },
  },
  'fluvy-energy-sankey-card': {
    config: { type: 'custom:fluvy-energy-sankey-card' },
  },
  'fluvy-energy-score-card': {
    config: { type: 'custom:fluvy-energy-score-card' },
  },
  'fluvy-energy-devices-card': {
    config: {
      type: 'custom:fluvy-energy-devices-card',
      rows: [
        { entity: 'sensor.ef_fridge_power', icon: 'plug' },
        { entity: 'sensor.ef_dishwasher_power', icon: 'plug' },
        { entity: 'sensor.ef_media_power', icon: 'speaker', tone: 'media' },
        { entity: 'sensor.ef_heat_pump_power', icon: 'thermo', tone: 'heat' },
      ],
    },
  },
  'fluvy-meters-card': {
    config: {
      type: 'custom:fluvy-meters-card',
      meters: [
        { entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' },
        { entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 },
      ],
      rows: ['binary_sensor.mt_leak', { entity: 'valve.mt_main', icon: 'sliders' }],
    },
    variants: { rows: {} },
  },
  'fluvy-gauge-card': {
    config: {
      type: 'custom:fluvy-gauge-card',
      entity: 'sensor.so_solar_power',
      icon: 'sun',
      subtitle: 'South roof · 5.4 kWp',
      max_entity: 'sensor.so_solar_capacity',
    },
    variants: { bar: {}, signed: {} },
  },
  'fluvy-stat-tiles-card': {
    config: {
      type: 'custom:fluvy-stat-tiles-card',
      title: 'Total capacity',
      subtitle: '18 panels · 5.4 kWp',
      icon: 'bolt',
      tone: 'solar',
      badge_entity: 'sensor.so_health',
      badge_label: 'Health',
      tiles: [
        {
          entity: 'sensor.so_solar_power',
          name: 'Solar output',
          icon: 'sun',
          tone: 'solar',
          highlight: true,
        },
        { entity: 'sensor.so_grid_export', name: 'Grid export', icon: 'bolt', tone: 'grid' },
        { entity: 'sensor.so_self_use', name: 'Self-use', icon: 'home', tone: 'accent' },
        { entity: 'sensor.so_battery_charge', name: 'To battery', icon: 'battery', tone: 'water' },
      ],
      rows: [{ entity: 'sensor.so_co2', icon: 'leaf', secondary: 'This month' }],
    },
    variants: { compact: {} },
  },
  'fluvy-production-card': {
    config: {
      type: 'custom:fluvy-production-card',
      entity: 'sensor.so_energy_today',
      forecast_entity: 'sensor.so_forecast_today',
      peak_entity: 'sensor.so_peak_today',
    },
    variants: { compact: {} },
  },
  'fluvy-history-bars-card': {
    config: {
      type: 'custom:fluvy-history-bars-card',
      entity: 'sensor.hb_solar',
      icon: 'sun',
      color: '#C9A063',
    },
    variants: { compact: {}, mini: {} },
  },
  'fluvy-chart-card': {
    config: {
      type: 'custom:fluvy-chart-card',
      title: 'Electricity price',
      icon: 'bolt',
      series: [{ entity: 'sensor.ch_nordpool', tone: 'ok' }],
      span: 'today+tomorrow',
      chart: 'step',
      thresholds: [
        { tone: 'warning', value: 0.18 },
        { tone: 'danger', value: 0.26 },
      ],
      highlight: 'both',
      highlight_hours: 2,
    },
    variants: { compact: {}, tile: {} },
  },

  'fluvy-bars-card': {
    config: {
      type: 'custom:fluvy-bars-card',
      title: 'Strings & inverter',
      subtitle: 'SolarEdge · 3 strings',
      icon: 'sliders',
      tone: 'solar',
      badge_warn: '{count} shaded',
      rows: [
        {
          entity: 'sensor.so_string_east',
          icon: 'sun',
          tone: 'solar',
          secondary: '6 panels',
          sub_entity: 'sensor.so_string_east_temperature',
          max: 1800,
          low: 500,
        },
        {
          entity: 'sensor.so_string_south',
          icon: 'sun',
          tone: 'solar',
          secondary: '8 panels',
          sub_entity: 'sensor.so_string_south_temperature',
          max: 2.42,
          low: 0.5,
        },
        {
          entity: 'sensor.so_string_west',
          icon: 'sun',
          tone: 'solar',
          secondary: '4 panels',
          sub_entity: 'sensor.so_string_west_note',
          max: 1360,
          low: 500,
        },
        {
          entity: 'sensor.so_inverter_power',
          icon: 'bolt',
          tone: 'solar',
          plain: true,
          sub_entity: 'sensor.so_inverter_note',
        },
      ],
    },
    variants: { compact: {} },
  },
  'fluvy-distribution-card': {
    config: {
      type: 'custom:fluvy-distribution-card',
      entities: [
        'sensor.so_heat_pump_power',
        'sensor.so_dishwasher_power',
        'sensor.so_media_power',
        'sensor.so_fridge_power',
      ],
    },
    variants: { rows: {} },
  },
  'fluvy-humidity-card': {
    config: {
      type: 'custom:fluvy-humidity-card',
      entity: 'sensor.so_living_humidity',
      subtitle: 'Living room',
      temperature_entity: 'sensor.so_living_temperature',
      humidifier_entity: 'humidifier.so_living',
    },
    layout: 'gauge',
    variants: { ruler: {}, liquid: {} },
  },
  'fluvy-clock-card': {
    config: { type: 'custom:fluvy-clock-card' },
    variants: { side: {}, tile: {} },
  },
  'fluvy-calendar-card': {
    config: {
      type: 'custom:fluvy-calendar-card',
      calendars: [
        'calendar.chores',
        'calendar.family',
        'calendar.ona',
        'calendar.personal',
        'calendar.services',
      ],
      first_weekday: 'monday',
    },
    variants: { month: {}, week: {}, 'month-day': {}, timeline: {}, upcoming: {}, tile: {} },
  },
};
