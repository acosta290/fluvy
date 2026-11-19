import { FluvyThermostatsCard } from '../../../../packages/cards/src/thermostats/thermostats-card.js';
import { CLIMATE, speakingAttributes } from '../attribute-words.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the rounds sheet does
if (!customElements.get('fluvy-thermostats-card'))
  customElements.define('fluvy-thermostats-card', FluvyThermostatsCard);

const THERMOSTATS = 'custom:fluvy-thermostats-card';

/**
 * The house's heating (#230, @xoatrash; #219, @waphbs's house card): a living room's heat pump heating from 20.5° to
 * 21°, the bedroom's valve idle at 19° on Eco, the kids' room heating on Comfort, the office off and the bathroom's
 * valve gone with its battery; underfloor heating in the living room too, which the house's own list counts. Each
 * room in its area, the areas on their floors with their icons, so a row wears its room's glyph and its name.
 */
const LIVING = 'climate.ts_living_heat_pump';
const BEDROOM = 'climate.ts_bedroom';
const KIDS = 'climate.ts_kids_room';
const OFFICE = 'climate.ts_office';
const BATHROOM = 'climate.ts_bathroom';
const FLOOR = 'climate.ts_living_underfloor';
const HOUSE = [LIVING, BEDROOM, KIDS, OFFICE, BATHROOM];

/** A radiator valve: half a degree a step, 5 to 30, Eco and Comfort and a boost; no off of its own but its mode. */
const VALVE = {
  min_temp: 5,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat', 'auto'],
  preset_modes: ['none', 'eco', 'comfort', 'boost'],
  supported_features: 17,
};

/** The heat pump: a whole degree a step, 16 to 30, its own off and on. */
const HEAT_PUMP = {
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 1,
  hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
  preset_modes: ['none', 'eco', 'comfort'],
  supported_features: 401,
};

/** Home Assistant's words for the presets in every language the sheets speak. */
const speaking = speakingAttributes(CLIMATE);

/** The schedule's view on the house's dashboard, and the bedroom's window: a row's own rounds after its own. */
const SCHEDULE = {
  entity: 'schedule.ts_heating',
  name: 'Heating schedule',
  icon: 'calendar',
  tap_action: { action: 'navigate', navigation_path: '/fluvy-home/climate' },
};

const heating = { type: THERMOSTATS, title: 'Heating', show_count: true, thermostats: HOUSE };
/** The issue's own rounds: the one that opens it, then the schedule's view; the bedroom's window too. */
const OWN_ROUNDS = {
  type: THERMOSTATS,
  thermostats: [
    { entity: BEDROOM, rounds: ['binary_sensor.ts_bedroom_window', SCHEDULE] },
    { entity: KIDS, rounds: [SCHEDULE] },
    { entity: OFFICE, rounds: [SCHEDULE] },
  ],
};
const actions = { ...heating, show_average: true, house_actions: ['all_off', 'presets'] };

export const sheet: SheetSpec = {
  states: [
    [
      LIVING,
      'heat',
      {
        friendly_name: 'Living room heat pump',
        ...HEAT_PUMP,
        temperature: 21,
        current_temperature: 20.5,
        hvac_action: 'heating',
        preset_mode: 'none',
      },
    ],
    [
      BEDROOM,
      'heat',
      {
        friendly_name: 'Bedroom radiator',
        ...VALVE,
        temperature: 19,
        current_temperature: 19.4,
        hvac_action: 'idle',
        preset_mode: 'eco',
      },
    ],
    [
      KIDS,
      'heat',
      {
        friendly_name: 'Kids room radiator',
        ...VALVE,
        temperature: 21.5,
        current_temperature: 20.8,
        hvac_action: 'heating',
        preset_mode: 'comfort',
      },
    ],
    [
      OFFICE,
      'off',
      {
        friendly_name: 'Office radiator',
        ...VALVE,
        temperature: 20,
        current_temperature: 18.2,
        hvac_action: 'off',
        preset_mode: 'none',
      },
    ],
    [BATHROOM, 'unavailable', { friendly_name: 'Bathroom radiator', ...VALVE, restored: true }],
    [
      FLOOR,
      'heat',
      {
        friendly_name: 'Underfloor heating',
        min_temp: 18,
        max_temp: 28,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat'],
        supported_features: 385,
        temperature: 22,
        current_temperature: 21.6,
        hvac_action: 'idle',
      },
    ],
    [
      'schedule.ts_heating',
      'on',
      { friendly_name: 'Heating schedule', icon: 'mdi:calendar-clock' },
    ],
    [
      'binary_sensor.ts_bedroom_window',
      'off',
      { friendly_name: 'Bedroom window', device_class: 'window' },
    ],
  ],
  registry: {
    floors: {
      ts_ground: { floor_id: 'ts_ground', name: 'Ground floor', level: 0, icon: null },
      ts_first: { floor_id: 'ts_first', name: 'First floor', level: 1, icon: null },
    },
    areas: {
      ts_living_room: {
        area_id: 'ts_living_room',
        name: 'Living room',
        icon: 'mdi:sofa',
        floor_id: 'ts_ground',
        picture: null,
      },
      ts_office: {
        area_id: 'ts_office',
        name: 'Office',
        icon: 'mdi:desk',
        floor_id: 'ts_ground',
        picture: null,
      },
      ts_bedroom: {
        area_id: 'ts_bedroom',
        name: 'Bedroom',
        icon: 'mdi:bed',
        floor_id: 'ts_first',
        picture: null,
      },
      ts_kids_room: {
        area_id: 'ts_kids_room',
        name: 'Kids room',
        icon: 'mdi:teddy-bear',
        floor_id: 'ts_first',
        picture: null,
      },
      ts_bathroom: {
        area_id: 'ts_bathroom',
        name: 'Bathroom',
        icon: 'mdi:shower',
        floor_id: 'ts_first',
        picture: null,
      },
      ts_hallway: {
        area_id: 'ts_hallway',
        name: 'Hallway',
        icon: 'mdi:coat-rack',
        floor_id: 'ts_ground',
        picture: null,
      },
    },
    entities: Object.fromEntries(
      (
        [
          [LIVING, 'ts_living_room'],
          [FLOOR, 'ts_living_room'],
          [BEDROOM, 'ts_bedroom'],
          [KIDS, 'ts_kids_room'],
          [OFFICE, 'ts_office'],
          [BATHROOM, 'ts_bathroom'],
          ['binary_sensor.ts_bedroom_window', 'ts_bedroom'],
        ] as const
      ).map(([entity_id, area_id]) => [entity_id, { entity_id, area_id }]),
    ),
  },
  frames: [
    // the issue's card: a row each, its room's glyph and name, what it is doing, its preset and its target, the
    // room's temperature, the round that opens it
    { title: 'The house’s heating', hass: speaking, cards: [heating] },
    {
      title: 'The house’s heating · compact',
      hass: speaking,
      cards: [{ ...heating, variant: 'compact' }],
    },
    {
      title: 'The house’s heating · tiles',
      hass: speaking,
      cards: [{ ...heating, variant: 'tiles' }],
    },
    // the house's actions: All off, asked first, and the presets they offer, each saying how many offer it
    { title: 'The house’s heating · house actions', hass: speaking, cards: [actions] },
    {
      title: 'The house’s heating · tiles and house actions',
      hass: speaking,
      cards: [{ ...actions, variant: 'tiles' }],
    },
    // the target between − and +, each its own step and range; the room's reading leads the line
    {
      title: 'The house’s heating · − and +',
      hass: speaking,
      cards: [{ ...heating, control: 'stepper', show_round: false }],
    },
    {
      title: 'The house’s heating · − and + with house actions',
      hass: speaking,
      cards: [{ ...actions, control: 'stepper', variant: 'compact' }],
    },
    // a row's own rounds after the one that opens it: the schedule's view, the bedroom's window; on a phone the
    // rounds give way from the end, the name and the room's temperature kept
    { title: 'Their own rounds', hass: speaking, cards: [OWN_ROUNDS] },
    // a desktop's section: the rows with the house's actions, the tiles, the stepper and the rounds side by side
    {
      title: 'On a desktop · 1400',
      width: 1400,
      hass: speaking,
      cards: [
        { ...actions, cols: 4 },
        { ...actions, variant: 'tiles', cols: 4 },
        {
          type: THERMOSTATS,
          title: 'Upstairs',
          control: 'stepper',
          thermostats: [BEDROOM, KIDS, BATHROOM].map((entity) => ({ entity, rounds: [SCHEDULE] })),
          cols: 4,
        },
      ],
    },
    // no list: every thermostat of the house, in its order (the ground floor first), two in the living room by
    // their own names
    {
      title: 'Every thermostat of the house',
      hass: speaking,
      cards: [{ type: THERMOSTATS, title: 'Thermostats', show_count: true, show_average: true }],
    },
    // half a section: the rows keep their height, what does not hold gives way
    {
      title: 'Halves',
      hass: speaking,
      heights: [152, 172],
      cards: [
        { ...heating, cols: 6 },
        { ...heating, variant: 'compact', control: 'stepper', cols: 6 },
      ],
    },
    // a room with none: the panel and its hint
    {
      title: 'A room with none',
      cards: [{ type: THERMOSTATS, title: 'Hallway', area: 'ts_hallway' }],
    },
  ],
};
