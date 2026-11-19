import { FluvyOpeningsCard } from '../../../../packages/cards/src/openings/openings-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-openings-card'))
  customElements.define('fluvy-openings-card', FluvyOpeningsCard);

/*
 * Motion that alerts (#223): an Openings card that counts the hall's motion and the landing's presence as alerts
 * (`alert_classes`), as an open window is — the warning tone, the badge's count, the time it has been on — beside a
 * door shut; "2 detected" where every alert is of them, "2 alerts" with a window open among them; a row's own say
 * (`alert`: the shed's tilt sensor always, the nursery's motion never); compact, as tiles, folded, and as before, none
 * counted. Light and dark are the page's (`&mode=dark`).
 */

const OPENINGS = 'custom:fluvy-openings-card';
/** The sheet's moment (the playground's own: Thursday 17 September 2026, 21:47), frozen into the times. */
const _now = new Date(2026, 8, 17, 21, 47, 12).toISOString();
const MINUTE = 60;

/** The hall's motion and the landing's presence, counted as alerts. */
const COUNTED = { alert_classes: ['motion', 'occupancy'] } as const;

const HALL = { entity: 'binary_sensor.ma_hall_motion', name: 'Hall' };
const LANDING = { entity: 'binary_sensor.ma_landing_presence', name: 'Landing' };
const FRONT = { entity: 'binary_sensor.ma_front_door', name: 'Front door' };
const KITCHEN = { entity: 'binary_sensor.ma_kitchen_window', name: 'Kitchen window' };
const NURSERY = { entity: 'binary_sensor.ma_nursery_motion', name: 'Nursery' };
const SHED = { entity: 'binary_sensor.ma_shed_tilt', name: 'Shed window', icon: 'window' };
const BACK = { entity: 'binary_sensor.ma_back_door', name: 'Back door' };

const card = (rows: readonly unknown[], more: Record<string, unknown> = {}) => ({
  type: OPENINGS,
  _now,
  ...COUNTED,
  rows,
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    [
      'binary_sensor.ma_hall_motion',
      'on',
      { friendly_name: 'Hall motion', device_class: 'motion' },
      2 * MINUTE,
    ],
    [
      'binary_sensor.ma_landing_presence',
      'on',
      { friendly_name: 'Landing presence', device_class: 'occupancy' },
      9 * MINUTE,
    ],
    ['binary_sensor.ma_front_door', 'off', { friendly_name: 'Front door', device_class: 'door' }],
    [
      'binary_sensor.ma_kitchen_window',
      'on',
      { friendly_name: 'Kitchen window', device_class: 'window' },
      14 * MINUTE,
    ],
    [
      'binary_sensor.ma_nursery_motion',
      'on',
      { friendly_name: 'Nursery motion', device_class: 'motion' },
      MINUTE,
    ],
    ['binary_sensor.ma_shed_tilt', 'on', { friendly_name: 'Shed window tilt' }, 40 * MINUTE],
    ['binary_sensor.ma_back_door', 'off', { friendly_name: 'Back door', device_class: 'door' }],
  ],
  frames: [
    {
      title: 'Motion that alerts · the hall detected, a door shut, a window open',
      cards: [card([HALL, FRONT, KITCHEN])],
    },
    {
      title: 'Motion that alerts · every alert detected: "2 detected"',
      cards: [card([HALL, LANDING, FRONT, BACK])],
    },
    {
      title: 'Motion that alerts · a row’s own say: the shed’s tilt always, the nursery never',
      cards: [card([{ ...SHED, alert: true }, { ...NURSERY, alert: false }, HALL, FRONT])],
    },
    {
      title: 'Motion that alerts · compact',
      cards: [card([HALL, LANDING, FRONT, KITCHEN], { variant: 'compact' })],
    },
    {
      title: 'Motion that alerts · tiles',
      cards: [card([HALL, LANDING, FRONT, KITCHEN], { variant: 'tiles' })],
    },
    {
      title: 'Motion that alerts · folded, what it hides detected',
      cards: [card([FRONT, BACK, HALL, LANDING], { max_rows: 2 })],
    },
    {
      title: 'Motion that alerts · as before, none counted',
      cards: [{ type: OPENINGS, _now, rows: [HALL, FRONT, KITCHEN] }],
    },
  ],
};
