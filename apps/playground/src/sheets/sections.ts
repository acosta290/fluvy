import type { LovelaceCardConfig } from '@fluvy/core';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

/*
 * A list in parts, and rows on a condition (#157): a section's label among the rows of the bars and the entities
 * cards, a hairline over it or alone, and rows that show only while a condition holds — their section with them, the
 * head's count reading what shows, the empty panel when nothing does. Its own entities (`sc_`), so no other sheet's
 * card moves.
 */

/** Six batteries on two floors: two of them low. */
const BATTERIES = [
  ['front_door', 'Front door', 84],
  ['hall_motion', 'Hall motion', 62],
  ['kitchen_window', 'Kitchen window', 18],
  ['valve', 'Radiator valve', 47],
  ['leak', 'Leak sensor', 9],
  ['smoke', 'Smoke alarm', 73],
] as const;
const battery = (id: string): string => `sensor.sc_${id}`;
const [DOWN, UP] = [BATTERIES.slice(0, 3), BATTERIES.slice(3)].map((floor) =>
  floor.map(([id]) => battery(id)),
) as [string[], string[]];

/** The batteries in two sections; `line` draws a hairline over each label. */
const floors = (line = false): unknown[] => [
  { type: 'section', label: 'Downstairs', ...(line ? { line } : {}) },
  ...DOWN,
  { type: 'section', label: 'Upstairs', ...(line ? { line } : {}) },
  ...UP,
];

const bars = (more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-bars-card',
  title: 'Batteries',
  icon: 'battery',
  rows: floors(),
  ...more,
});

/** A kitchen's switches, sensors and door. */
const SWITCHES = ['switch.sc_light', 'switch.sc_washer', 'switch.sc_pump'];
const SENSORS = ['binary_sensor.sc_window', 'binary_sensor.sc_motion', 'sensor.sc_temperature'];
const kitchen = (line = false): unknown[] => [
  { type: 'section', label: 'Switches', ...(line ? { line } : {}) },
  ...SWITCHES,
  { type: 'section', label: 'Sensors', ...(line ? { line } : {}) },
  ...SENSORS,
  { type: 'section', label: 'Doors', ...(line ? { line } : {}) },
  'lock.sc_door',
];

const entities = (more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-entities-card',
  title: 'Kitchen',
  icon: 'grid',
  show_count: true,
  rows: kitchen(),
  ...more,
});

/** The kitchen with what is not worth a row left out: the washer while off, the pump while gone, motion while clear. */
const QUIET_KITCHEN = [
  { type: 'section', label: 'Switches' },
  'switch.sc_light',
  { entity: 'switch.sc_washer', show_when: { state: 'on' } },
  { entity: 'switch.sc_pump', show_when: { state_not: 'unavailable' } },
  { type: 'section', label: 'Sensors' },
  'binary_sensor.sc_window',
  { entity: 'binary_sensor.sc_motion', show_when: { state: 'on' } },
  'sensor.sc_temperature',
  { type: 'section', label: 'Doors' },
  'lock.sc_door',
];

export const sheet: SheetSpec = {
  states: [
    ...BATTERIES.map(([id, name, level]): StateSeed => [
      battery(id),
      String(level),
      { friendly_name: name, unit_of_measurement: '%', device_class: 'battery' },
    ]),
    ['sensor.sc_gone', 'unavailable', { friendly_name: 'Attic sensor', device_class: 'battery' }],
    ['switch.sc_light', 'on', { friendly_name: 'Kitchen light' }],
    ['switch.sc_washer', 'off', { friendly_name: 'Washing machine', device_class: 'outlet' }],
    ['switch.sc_pump', 'unavailable', { friendly_name: 'Garden pump' }],
    ['binary_sensor.sc_window', 'on', { friendly_name: 'Kitchen window', device_class: 'window' }],
    ['binary_sensor.sc_motion', 'off', { friendly_name: 'Hall motion', device_class: 'motion' }],
    [
      'sensor.sc_temperature',
      '21.6',
      { friendly_name: 'Hall temperature', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    ['lock.sc_door', 'locked', { friendly_name: 'Front door' }],
    // what a condition may read in a row's place: nobody is staying
    ['input_boolean.sc_guests', 'off', { friendly_name: 'Guests' }],
  ],
  frames: [
    // a section's label, 8 under what precedes it and where a row's hairline would be; the list's first on its own 16
    { title: 'Bars · sections', cards: [bars()] },
    // a hairline from side to side over the label, never over the list's first
    { title: 'Bars · sections with a line', cards: [bars({ rows: floors(true) })] },
    // the hairline alone, in a band of 16; one that starts or ends the list is not drawn
    {
      title: 'Bars · a divider',
      cards: [
        bars({
          rows: [{ type: 'divider' }, ...DOWN, { type: 'divider' }, ...UP, { type: 'divider' }],
        }),
      ],
    },
    { title: 'Bars · sections, compact', cards: [bars({ variant: 'compact' })] },
    // half a section: the circles give way to the names, the label starts where they do; a long label of the
    // person's own ends in its ellipsis
    {
      title: 'Bars · sections, half a section',
      heights: [152, 172, 211, 266],
      cards: [
        bars({ cols: 6 }),
        bars({
          cols: 6,
          variant: 'compact',
          rows: [
            { section: 'Ground floor and the garden shed' },
            ...DOWN,
            { section: 'Loft' },
            ...UP,
          ],
        }),
      ],
    },
    // a row out of reach keeps its place under its label; the short form of a section, a line of YAML
    {
      title: 'Bars · sections, a row out of reach',
      cards: [
        bars({
          rows: [
            { section: 'Downstairs' },
            DOWN[0],
            'sensor.sc_gone',
            { section: 'Upstairs', line: true },
            UP[0],
          ],
        }),
      ],
    },
    // every row shown only below 30 %: two of six hold, each under its label; the badge counts what shows
    {
      title: 'Bars · rows on a condition',
      cards: [bars({ show_rows_when: { below: 30 }, empty_text: 'Nothing under 30 %' })],
    },
    // a row's own condition wins over the card's: the front door shows whatever it holds (`always`), the valve below 50
    {
      title: 'Bars · a row’s own condition',
      cards: [
        bars({
          show_rows_when: { below: 30 },
          rows: [
            { section: 'Downstairs' },
            { entity: DOWN[0], show_when: 'always' },
            ...DOWN.slice(1),
            { section: 'Upstairs' },
            { entity: UP[0], show_when: { below: 50 } },
            ...UP.slice(1),
          ],
        }),
      ],
    },
    // none holds: the empty panel in the card's words, no badge; asked to, the card steps aside (the second is hidden)
    {
      title: 'Bars · no row shows',
      cards: [
        bars({ show_rows_when: { below: 5 }, empty_text: 'Nothing under 5 %' }),
        bars({ show_rows_when: { below: 5 }, hide_empty: true }),
      ],
    },
    // a condition on another entity: the rows of a list shown only while guests are staying
    {
      title: 'Bars · a condition on another entity',
      cards: [
        bars({
          title: 'Guest room',
          rows: [
            DOWN[0],
            { entity: DOWN[1], show_when: { entity: 'input_boolean.sc_guests', state: 'on' } },
            { entity: DOWN[2], show_when: { entity: 'input_boolean.sc_guests', state_not: 'on' } },
          ],
        }),
      ],
    },
    { title: 'Entities · sections', cards: [entities()] },
    // the hairline from side to side, where a row's starts at its text
    { title: 'Entities · sections with a line', cards: [entities({ rows: kitchen(true) })] },
    {
      title: 'Entities · a divider',
      cards: [
        entities({
          rows: [...SWITCHES, { type: 'divider' }, ...SENSORS, { type: 'divider' }, 'lock.sc_door'],
        }),
      ],
    },
    { title: 'Entities · sections, compact', cards: [entities({ variant: 'compact' })] },
    // no head: the first label stands where the first row's circle would, on the card's 20
    {
      title: 'Entities · sections, no head',
      cards: [{ type: 'custom:fluvy-entities-card', rows: kitchen() }],
    },
    // half a section: the labels start where the names do, and every kind of row holds what ends it. A switch and a
    // chevron keep their place and the name gives way beside them; a state takes its two lines, then goes under its
    // words, where the row grows (so the frame holds no height here); the ages take one form down the list, an age
    // or a state's word no row has room for is left out, never cut
    {
      title: 'Entities · sections, half a section',
      cards: [
        entities({ cols: 6 }),
        entities({ cols: 6, variant: 'compact', rows: kitchen(true) }),
      ],
    },
    // the washer only while on, the pump only while it answers, motion only while detected: the count reads what shows
    { title: 'Entities · rows on a condition', cards: [entities({ rows: QUIET_KITCHEN })] },
    // a section whose rows are all away goes with them
    {
      title: 'Entities · a section with no row showing',
      cards: [
        entities({
          rows: [
            { section: 'Switches' },
            { entity: 'switch.sc_washer', show_when: { state: 'on' } },
            { entity: 'switch.sc_pump', show_when: { state_not: 'unavailable' } },
            { section: 'Sensors' },
            ...SENSORS,
          ],
        }),
      ],
    },
    {
      title: 'Entities · no row shows',
      cards: [
        entities({
          show_rows_when: { state: 'home' },
          empty_text: 'Nothing open, nothing on',
        }),
      ],
    },
  ],
};
