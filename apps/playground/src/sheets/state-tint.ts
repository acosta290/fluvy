import type { LovelaceCardConfig } from '@fluvy/core';
import type { StateSeed } from '../hass.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { BLUE } from './glass.js';
import { LINE } from './line.js';

/**
 * A device's state is always said, and may colour the card (1.22, #196). Lock, Cover (a blind, a garage, a valve),
 * Alarm and Vacuum in a narrow column: where the badge cannot stand beside the name, its word leads the line
 * ("Unlocked · 21:32", in the warning's ink), at 152, 172 and 211 — before 1.22 they said their state nowhere
 * there. Then the six device cards shown in their state's tone beyond the circle, as asked (`tint`: never, when
 * active, always; `tint_style`: a wash, the card's edge, the control alone — the lock's knob, the reporter's mock-up),
 * the reporter's own colours by state (`state_colors`: unlocked in the danger's, locked in what is good), see-through
 * on a view's background, and on a surface read by its edges (E-ink). And a room's status said as its icon in its
 * state's tone on the Entities card (#234), its climate under its name: here, not on the lists sheet, whose template
 * rows a suite counts.
 */

const LOCK = 'custom:fluvy-lock-card';
const COVER = 'custom:fluvy-cover-card';
const ALARM = 'custom:fluvy-alarm-card';
const VACUUM = 'custom:fluvy-vacuum-card';
const FAN = 'custom:fluvy-fan-card';
const THERMOSTAT = 'custom:fluvy-thermostat-card';

/** A minute before the playground's clock: "Since …" says when the state began. */
const MINUTES = 60;

const PANEL = { supported_features: 1 | 2, code_format: null, code_arm_required: false };
const ROBOT = { supported_features: 8192 | 16 | 8 | 4 | 64, battery_level: 76 };
const TRV = {
  min_temp: 5,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat', 'cool', 'auto'],
};

/** Two or three cards on a line, each its share of the section. */
const share = (cards: readonly LovelaceCardConfig[]): FrameSpec['cards'] =>
  cards.map((card) => ({ ...card, cols: 12 / cards.length }));

/** The four cards that said their state nowhere in a narrow column, as a dashboard holds them, half a section each. */
const unsaid = (more: Record<string, unknown> = {}): FrameSpec['cards'] =>
  [
    { type: LOCK, entity: 'lock.st_front', name: 'Front door lock', variant: 'compact' },
    { type: ALARM, entity: 'alarm_control_panel.st_loud', variant: 'compact' },
    { type: COVER, entity: 'cover.st_blind', variant: 'compact' },
    { type: VACUUM, entity: 'vacuum.st_robot', variant: 'compact' },
  ].map((card) => ({ ...card, ...more, cols: 6 }));

/** A room's state as an icon (#234): its own icon at the row's end, its climate under its name. */
const STATUS_ICONS = {
  ok: 'mdi:check-circle-outline',
  warning: 'mdi:alert-outline',
  critical: 'mdi:alert-circle-outline',
};
const climateLine = (room: string): string =>
  `{{ states('sensor.st_${room}_temperature') | round(1) }} °C · {{ states('sensor.st_${room}_humidity') }} %`;
const STATUS_ROWS = [
  {
    entity: 'sensor.st_living_status',
    name: 'Living room',
    icon: 'mdi:sofa',
    secondary: climateLine('living'),
  },
  {
    entity: 'sensor.st_kitchen_status',
    name: 'Kitchen',
    icon: 'mdi:stove',
    secondary: climateLine('kitchen'),
  },
  {
    entity: 'sensor.st_bath_status',
    name: 'Bathroom',
    icon: 'mdi:shower',
    secondary: climateLine('bath'),
  },
];
/** A room's status, worded as its template sensor writes it (#234), and its climate. */
const ROOM_STATES = (
  [
    ['living', 'Living room', 'ok', '21.8', '48'],
    ['kitchen', 'Kitchen', 'warning', '23.6', '67'],
    ['bath', 'Bathroom', 'critical', '20.4', '84'],
  ] as const
).flatMap(([room, name, status, temperature, humidity]): StateSeed[] => [
  [`sensor.st_${room}_status`, status, { friendly_name: `${name} status` }],
  [
    `sensor.st_${room}_temperature`,
    temperature,
    {
      friendly_name: `${name} temperature`,
      unit_of_measurement: '°C',
      device_class: 'temperature',
    },
  ],
  [
    `sensor.st_${room}_humidity`,
    humidity,
    { friendly_name: `${name} humidity`, unit_of_measurement: '%', device_class: 'humidity' },
  ],
]);

export const sheet: SheetSpec = {
  states: [
    [
      'lock.st_front',
      'unlocked',
      { friendly_name: 'Front door', changed_by: 'Marta' },
      15 * MINUTES,
    ],
    ['lock.st_back', 'locked', { friendly_name: 'Back door' }, 3 * 3600],
    ['lock.st_gate', 'jammed', { friendly_name: 'Side gate' }, 4 * MINUTES],
    [
      'cover.st_blind',
      'open',
      {
        friendly_name: 'Living room blind',
        device_class: 'blind',
        current_position: 60,
        supported_features: 15,
      },
      40 * MINUTES,
    ],
    [
      'cover.st_garage',
      'open',
      { friendly_name: 'Garage door', device_class: 'garage', supported_features: 3 },
      6 * MINUTES,
    ],
    [
      'cover.st_shutter',
      'closed',
      {
        friendly_name: 'Bedroom shutter',
        device_class: 'shutter',
        current_position: 0,
        supported_features: 15,
      },
      2 * 3600,
    ],
    [
      'valve.st_garden',
      'open',
      { friendly_name: 'Garden irrigation', supported_features: 3 },
      12 * MINUTES,
    ],
    [
      'alarm_control_panel.st_house',
      'armed_away',
      { friendly_name: 'House alarm', ...PANEL },
      2 * 3600,
    ],
    [
      'alarm_control_panel.st_loud',
      'triggered',
      { friendly_name: 'House alarm', previous_state: 'armed_away', ...PANEL },
      2 * MINUTES,
    ],
    [
      'alarm_control_panel.st_home',
      'disarmed',
      { friendly_name: 'House alarm', ...PANEL },
      5 * 3600,
    ],
    ['vacuum.st_robot', 'cleaning', { friendly_name: 'Robot vacuum', ...ROBOT }, 25 * MINUTES],
    [
      'vacuum.st_stuck',
      'error',
      { friendly_name: 'Robot vacuum', ...ROBOT, battery_level: 41 },
      9 * MINUTES,
    ],
    [
      'fan.st_bedroom',
      'on',
      { friendly_name: 'Bedroom fan', percentage: 66, percentage_step: 33, supported_features: 1 },
      30 * MINUTES,
    ],
    [
      'climate.st_living',
      'heat',
      {
        friendly_name: 'Living room',
        ...TRV,
        temperature: 21.5,
        current_temperature: 20.4,
        current_humidity: 46,
        hvac_action: 'heating',
      },
    ],
    [
      'climate.st_study',
      'cool',
      {
        friendly_name: 'Study',
        ...TRV,
        temperature: 23,
        current_temperature: 25.1,
        current_humidity: 52,
        hvac_action: 'cooling',
      },
    ],
    ...ROOM_STATES,
  ],
  frames: [
    // the fix, for everyone: the state leads the line where its badge has no room beside the name
    {
      title: 'Narrow · the state leads the line at 152',
      width: 320,
      cards: unsaid(),
    },
    {
      title: 'Narrow · the state leads the line at 172',
      cards: unsaid(),
    },
    {
      title: 'Narrow · the state leads the line at 211',
      width: 211,
      cards: unsaid().map((card) => ({ ...card, cols: 12 })),
    },
    {
      title: 'Narrow · tinted at 172',
      cards: unsaid({ tint: 'on' }),
    },
    // the lock: never, when active, always; then as a wash, its edge, its knob
    {
      title: 'Lock · never, when active, always',
      cards: share([
        { type: LOCK, entity: 'lock.st_front', variant: 'compact' },
        { type: LOCK, entity: 'lock.st_front', variant: 'compact', tint: 'on' },
        { type: LOCK, entity: 'lock.st_back', variant: 'compact', tint: 'always' },
      ]),
    },
    {
      title: 'Lock · a wash, its edge, its knob',
      cards: share(
        (['wash', 'edge', 'control'] as const).map((tint_style) => ({
          type: LOCK,
          entity: 'lock.st_front',
          variant: 'compact',
          tint: 'on',
          tint_style,
        })),
      ),
    },
    // the reporter's mock-up: unlocked in the danger's colour, locked in what is good, at rest too
    {
      title: 'Lock · the reporter’s colours',
      cards: (['wash', 'control'] as const).flatMap((tint_style) =>
        ['lock.st_front', 'lock.st_back'].map((entity) => ({
          type: LOCK,
          entity,
          variant: 'compact',
          tint: 'always',
          tint_style,
          state_colors: { unlocked: 'danger', locked: 'ok' },
          cols: 6,
        })),
      ),
    },
    {
      title: 'Lock · full, unlocked and jammed',
      cards: [
        { type: LOCK, entity: 'lock.st_front', tint: 'on', cols: 6 },
        { type: LOCK, entity: 'lock.st_gate', tint: 'on', cols: 6 },
      ],
    },
    // a cover, a garage and a valve: open is active; closed is the neutral, which has no colour to show
    {
      title: 'Cover · never, when active, always',
      cards: share([
        { type: COVER, entity: 'cover.st_blind', variant: 'compact' },
        { type: COVER, entity: 'cover.st_blind', variant: 'compact', tint: 'on' },
        { type: COVER, entity: 'cover.st_shutter', variant: 'compact', tint: 'always' },
      ]),
    },
    {
      title: 'Cover · a garage, a valve, as a wash, its edge, its control',
      cards: share(
        (['wash', 'edge', 'control'] as const).map((tint_style, index) => ({
          type: COVER,
          entity: index === 1 ? 'valve.st_garden' : 'cover.st_garage',
          variant: 'compact',
          tint: 'on',
          tint_style,
        })),
      ),
    },
    {
      title: 'Cover · full, open',
      cards: [{ type: COVER, entity: 'cover.st_blind', tint: 'on' }],
    },
    // the alarm: armed is active, so is a panel that alerts
    {
      title: 'Alarm · never, when active, always',
      cards: share([
        { type: ALARM, entity: 'alarm_control_panel.st_house', variant: 'compact' },
        { type: ALARM, entity: 'alarm_control_panel.st_house', variant: 'compact', tint: 'on' },
        { type: ALARM, entity: 'alarm_control_panel.st_home', variant: 'compact', tint: 'always' },
      ]),
    },
    {
      title: 'Alarm · triggered, as a wash, its edge, its control',
      cards: share(
        (['wash', 'edge', 'control'] as const).map((tint_style) => ({
          type: ALARM,
          entity: 'alarm_control_panel.st_loud',
          variant: 'compact',
          tint: 'on',
          tint_style,
        })),
      ),
    },
    {
      title: 'Alarm · full, armed',
      cards: [{ type: ALARM, entity: 'alarm_control_panel.st_house', tint: 'on' }],
    },
    {
      title: 'Vacuum · never, when active, failing',
      cards: share([
        { type: VACUUM, entity: 'vacuum.st_robot', variant: 'compact' },
        { type: VACUUM, entity: 'vacuum.st_robot', variant: 'compact', tint: 'on' },
        { type: VACUUM, entity: 'vacuum.st_stuck', variant: 'compact', tint: 'on' },
      ]),
    },
    {
      title: 'Vacuum · full, cleaning, its edge',
      cards: [{ type: VACUUM, entity: 'vacuum.st_robot', tint: 'on', tint_style: 'edge' }],
    },
    {
      title: 'Fan · never, as a wash, its edge',
      cards: share([
        { type: FAN, entity: 'fan.st_bedroom', variant: 'compact' },
        { type: FAN, entity: 'fan.st_bedroom', variant: 'compact', tint: 'on' },
        { type: FAN, entity: 'fan.st_bedroom', variant: 'compact', tint: 'on', tint_style: 'edge' },
      ]),
    },
    {
      title: 'Thermostat · never, heating, cooling at its edge',
      cards: share([
        { type: THERMOSTAT, entity: 'climate.st_living', variant: 'compact' },
        { type: THERMOSTAT, entity: 'climate.st_living', variant: 'compact', tint: 'on' },
        {
          type: THERMOSTAT,
          entity: 'climate.st_study',
          variant: 'compact',
          tint: 'on',
          tint_style: 'edge',
        },
      ]),
    },
    {
      title: 'Thermostat · full, heating',
      cards: [{ type: THERMOSTAT, entity: 'climate.st_living', tint: 'on' }],
    },
    // see-through on a view's background: the wash at the card's opacity, the edge an ink
    {
      title: 'See-through · a wash and an edge at 60 %',
      backdrop: BLUE,
      cards: [
        {
          type: LOCK,
          entity: 'lock.st_front',
          variant: 'compact',
          tint: 'on',
          card_opacity: 60,
          cols: 6,
        },
        {
          type: ALARM,
          entity: 'alarm_control_panel.st_loud',
          variant: 'compact',
          tint: 'on',
          tint_style: 'edge',
          card_opacity: 60,
          cols: 6,
        },
        {
          type: COVER,
          entity: 'cover.st_garage',
          variant: 'compact',
          tint: 'on',
          card_opacity: 60,
          cols: 6,
        },
        {
          type: FAN,
          entity: 'fan.st_bedroom',
          variant: 'compact',
          tint: 'on',
          tint_style: 'edge',
          card_opacity: 60,
          cols: 6,
        },
      ],
    },
    // a surface read by its edges: the card's edge is already an ink, so the tone's is two wide
    {
      title: 'E-ink · a wash and an edge',
      palette: LINE,
      cards: [
        { type: LOCK, entity: 'lock.st_front', variant: 'compact', tint: 'on', cols: 6 },
        {
          type: LOCK,
          entity: 'lock.st_front',
          variant: 'compact',
          tint: 'on',
          tint_style: 'edge',
          cols: 6,
        },
        {
          type: ALARM,
          entity: 'alarm_control_panel.st_loud',
          variant: 'compact',
          tint: 'on',
          cols: 6,
        },
        {
          type: ALARM,
          entity: 'alarm_control_panel.st_loud',
          variant: 'compact',
          tint: 'on',
          tint_style: 'edge',
          cols: 6,
        },
      ],
    },
    // #234: each room's status as its icon in its tone, its climate under its name; in half a section, and compact
    {
      title: 'Entities · room status as icons',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Rooms',
          icon: 'mdi:home-outline',
          state_display: 'icon',
          state_icons: STATUS_ICONS,
          rows: STATUS_ROWS,
        },
      ],
    },
    {
      title: 'Entities · room status as icons, half a section',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Rooms',
          cols: 6,
          state_display: 'icon',
          state_icons: STATUS_ICONS,
          rows: STATUS_ROWS,
        },
        {
          type: 'custom:fluvy-entities-card',
          title: 'Rooms',
          cols: 6,
          variant: 'compact',
          state_display: 'icon',
          state_icons: STATUS_ICONS,
          rows: STATUS_ROWS,
        },
      ],
    },
  ],
};
