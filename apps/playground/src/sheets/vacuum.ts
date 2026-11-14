import type { HomeAssistant } from '@fluvy/core';
import type { SheetSpec } from '../scenes.js';
import { FluvyVacuumCard } from '../../../../packages/cards/src/vacuum/vacuum-card.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the remote's sheet does
if (!customElements.get('fluvy-vacuum-card'))
  customElements.define('fluvy-vacuum-card', FluvyVacuumCard);

const VACUUM = 'custom:fluvy-vacuum-card';

/* vacuum: PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · SEND_COMMAND 256 · LOCATE 512 ·
   START 8192 */
const ROBOT = 4 + 8 + 16 + 32 + 64 + 256 + 512 + 8192;
const SUCTION = ['quiet', 'standard', 'turbo', 'max'];

const robot = (name: string, extra: Record<string, unknown> = {}) => ({
  friendly_name: name,
  supported_features: ROBOT,
  battery_level: 86,
  fan_speed: 'standard',
  fan_speed_list: SUCTION,
  ...extra,
});

const entry = (entity: string, platform: string, device?: string) =>
  [
    entity,
    { entity_id: entity, area_id: 'dr_living', platform, ...(device ? { device_id: device } : {}) },
  ] as const;

/** The actions the house's integrations offer: what a robot's profile is read by, beside its entity's platform. */
const SERVICES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  vacuum: { start: {}, pause: {}, stop: {}, return_to_base: {}, locate: {}, send_command: {} },
  xiaomi_miio: {
    vacuum_remote_control_start: {},
    vacuum_remote_control_move: {},
    vacuum_remote_control_move_step: {},
    vacuum_remote_control_stop: {},
  },
  xiaomi_miot: { set_miot_property: {}, call_action: {}, send_command: {} },
  script: { robot_drive: {}, robot_park: {} },
};

/** The house with its actions listed, as Home Assistant hands them over (`hass.services`). */
const withServices = (hass: HomeAssistant): HomeAssistant => ({ ...hass, services: SERVICES });

/**
 * The Vacuum card's drive pad (#178): a robot that can be driven by hand with its Drive command, then driven — the
 * battery and the suction giving the ring their room, the card as tall as it was — with its readouts and five speeds,
 * in a 266 column, and a Xiaomi robot through Xiaomi Miot Auto; the compact card, whose pad opens in its sheet, and
 * the sheet; a card with no room for the ring, driven; a robot of the person's own calls; one whose integration has
 * no remote control, which gains no command; and one out of reach, its command still.
 */
export const sheet: SheetSpec = {
  states: [
    ['vacuum.dr_robot', 'docked', robot('Robot vacuum')],
    ['vacuum.dr_roborock', 'idle', robot('Roborock', { fan_speed: 'balanced', battery_level: 72 })],
    [
      'vacuum.dr_s8',
      'idle',
      robot('Upstairs', {
        battery_level: 64,
        fan_speed: 'balanced',
        fan_speed_list: ['quiet', 'balanced', 'turbo', 'max', 'max_plus'],
      }),
    ],
    ['sensor.dr_area', '38', { friendly_name: 'Cleaned area', unit_of_measurement: 'm²' }],
    ['sensor.dr_time', '46', { friendly_name: 'Cleaning time', unit_of_measurement: 'min' }],
    // a Xiaomi robot as Xiaomi Miot Auto writes it: its MIoT properties as attributes, service by service
    [
      'vacuum.dr_x20',
      'idle',
      robot('Robot cleaner', {
        battery_level: 58,
        fan_speed: 'Basic',
        fan_speed_list: ['Silent', 'Basic', 'Strong', 'Full Speed'],
        'vacuum.status': 2,
        'vacuum_extend.work_mode': 0,
        'vacuum_extend.cleaning_time': 46,
        'vacuum_extend.cleaning_area': 38,
      }),
    ],
    ['vacuum.dr_own', 'docked', robot('Hallway robot', { battery_level: 100 })],
    ['vacuum.dr_deebot', 'docked', robot('Deebot', { battery_level: 93 })],
    [
      'vacuum.dr_gone',
      'unavailable',
      { friendly_name: 'Robot vacuum', supported_features: ROBOT, fan_speed_list: SUCTION },
    ],
  ],
  registry: {
    areas: { dr_living: { area_id: 'dr_living', name: 'Living room' } },
    devices: {
      dr_x20: {
        id: 'dr_x20',
        name: 'Robot cleaner',
        name_by_user: null,
        area_id: 'dr_living',
        manufacturer: 'xiaomi',
        model: 'xiaomi.vacuum.c102gl',
      },
    },
    entities: Object.fromEntries([
      entry('vacuum.dr_robot', 'xiaomi_miio'),
      entry('vacuum.dr_roborock', 'xiaomi_miio'),
      entry('vacuum.dr_s8', 'roborock'),
      entry('vacuum.dr_x20', 'xiaomi_miot', 'dr_x20'),
      entry('vacuum.dr_own', 'mqtt'),
      entry('vacuum.dr_deebot', 'ecovacs'),
      entry('vacuum.dr_gone', 'xiaomi_miio'),
    ]),
  },
  frames: [
    {
      title: 'Drive',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_robot', show_drive: true }],
    },
    {
      title: 'Drive · driving',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_roborock', show_drive: true, _drive: true }],
    },
    {
      title: 'Drive · driving · readouts and five speeds',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.dr_s8',
          area_entity: 'sensor.dr_area',
          duration_entity: 'sensor.dr_time',
          show_drive: true,
          _drive: true,
        },
      ],
    },
    {
      title: 'Drive · driving · a 266 column',
      width: 266,
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_roborock', show_drive: true, _drive: true }],
    },
    {
      title: 'Drive · driving · Xiaomi Miot',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_x20', show_drive: true, _drive: true }],
    },
    // the compact robot: the head and the commands, its pad in the sheet
    {
      title: 'Drive · compact',
      width: 392,
      hass: withServices,
      cards: [
        { type: VACUUM, entity: 'vacuum.dr_robot', variant: 'compact', show_drive: true, cols: 6 },
        {
          type: VACUUM,
          entity: 'vacuum.dr_roborock',
          variant: 'compact',
          show_drive: true,
          _drive: true,
          cols: 6,
        },
      ],
    },
    {
      title: 'Drive · sheet',
      width: 392,
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_roborock', show_drive: true, _sheet: true }],
    },
    // no battery drawn: the suction alone leaves the ring no room, so the card is driven from its sheet
    {
      title: 'Drive · driving · no room in the card',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.dr_roborock',
          show_battery: false,
          show_drive: true,
          _drive: true,
        },
      ],
    },
    // a robot no profile knows, wired by hand: its move is a script's, with the speed and the turn the pad asks for
    {
      title: 'Drive · a robot’s own calls',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.dr_own',
          show_drive: true,
          drive: {
            move: {
              action: 'script.robot_drive',
              data: { velocity: '{{ velocity }}', rotation: '{{ rotation }}' },
            },
            stop: { action: 'script.robot_park' },
            velocity: 0.2,
            rotation: 45,
          },
        },
      ],
    },
    {
      title: 'Drive · no remote control',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_deebot', show_drive: true }],
    },
    {
      title: 'Drive · unavailable',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_gone', show_drive: true }],
    },
    // asked for its sheet: Drive opens the pad over the page whatever the column, as on a phone at any size (#190)
    {
      title: 'Drive · in its sheet',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.dr_robot', show_drive: true, drive_style: 'sheet' }],
    },
  ],
};
