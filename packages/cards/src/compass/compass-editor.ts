import { strings as words, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import { BADGE_BASE } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  BAND_TINT,
  bandTintFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  hasLadder,
  headFields,
  iconField,
  nameField,
  NUMBER_DEFAULTS,
  numberFields,
  onlyWhen,
  ownTextField,
  selectField,
  textField,
  thresholdsList,
  unitChoicesOf,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import {
  COMPASS_ARROW_POINTS,
  COMPASS_FACES,
  COMPASS_POINTERS,
  COMPASS_VARIANTS,
  type CompassCardConfig,
} from './compass-card.js';

/** The Compass card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = words('compass');

/** The figures the ring's centre and its readouts read: a number's. */
const READINGS: readonly string[] = ['sensor', 'number', 'input_number'];

export const base = BADGE_BASE;

export const keys = configKeys<CompassCardConfig>()([
  'variant',
  'subtitle',
  'direction_entity',
  'direction_attribute',
  'secondary_direction_entity',
  'secondary_direction_attribute',
  'face',
  'indicator',
  'secondary_indicator',
  'arrow_points',
  'north_offset',
  'label',
  'badge',
  'show_ticks',
  'show_cardinals',
  'show_stats',
  'stats',
  'unit',
  'decimals',
  'thresholds',
  'tint',
  'tint_style',
]);

/** Its readouts, each a sensor with its name, unit and decimals; its thresholds, item by item (1.22, #204). */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'stats',
    title: 'editor.readouts',
    domains: READINGS,
    keys: ['entity', 'name', 'unit', 'decimals'],
    schema: [entityField(READINGS), nameField(), numberFields()],
  },
  thresholdsList({ tint: true }),
];

type Data = Readonly<Record<string, unknown>>;

/**
 * Whether the centre reads a figure a unit, decimals and thresholds act on: a sensor's beside a bearing of its own (a
 * sensor alone is the bearing), or a weather entity's wind.
 */
const reads = (data: Data): boolean => {
  const bearing = data['direction_entity'] || data['entity'];
  return (
    Boolean(data['entity'] && data['direction_entity']) ||
    (typeof bearing === 'string' && bearing.startsWith('weather.'))
  );
};

/** Whether the card has a head, a ring of its own and its readouts: every layout but the row. */
const ringed = (data: Data): boolean => data['variant'] !== 'row';

/** Whether a field names an entity: what its attribute and its pointer act on. */
const names =
  (key: string) =>
  (data: Data): boolean =>
    Boolean(data[key]);

/** Whether a pointer points (an arrow or a chevron), where it is asked for. */
const points = (pointer: unknown): boolean => pointer === 'arrow' || pointer === 'chevron';

/**
 * Whether the card draws a pointer that points: the bearing's (an arrow, its default pointer, or a chevron), or a
 * second bearing's asked for one.
 */
const drawsArrow = (data: Data): boolean =>
  points(data['indicator'] ?? 'arrow') ||
  (names('secondary_direction_entity')(data) && points(data['secondary_indicator']));

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  face: 'classic',
  indicator: 'arrow',
  secondary_indicator: 'dot',
  arrow_points: 'outward',
  north_offset: 0,
  show_ticks: true,
  show_cardinals: true,
  show_stats: true,
  ...NUMBER_DEFAULTS,
  ...BAND_TINT,
});

/** The units it offers are its sensor's class's. */
export const choices: EditorChoices = (config, hass) => unitChoicesOf(config, hass);

/** A pointer's style, in the card's words. */
const pointerField = (name: string): HaFormSchemaItem =>
  choiceField(
    name,
    COMPASS_POINTERS.map((pointer) => [pointer, `compass.pointer_${pointer}`] as const),
  );

/** An attribute of the entity `key` names, picked from those it has (Home Assistant's attribute picker). */
const attributeField = (name: string, key: string): HaFormSchemaItem =>
  onlyWhen(names(key), { name, selector: { attribute: {} }, context: { filter_entity: key } });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(READINGS, 'entity', false),
      fieldRow(nameField(), onlyWhen(ringed, ownTextField('subtitle'))),
      fieldRow(iconField(), selectField('variant', COMPASS_VARIANTS)),
      // a row has no head: its circle ringed by the bearing, its name over its line
      onlyWhen(ringed, headFields({ badge: true })),
      ...colourFields(),
      // the bearing and how it is marked; a second one to compare against, in the secondary ink
      { ...entityField(undefined, 'direction_entity', false), helper: 'compass.direction_helper' },
      attributeField('direction_attribute', 'direction_entity'),
      pointerField('indicator'),
      entityField(undefined, 'secondary_direction_entity', false),
      attributeField('secondary_direction_attribute', 'secondary_direction_entity'),
      onlyWhen(names('secondary_direction_entity'), pointerField('secondary_indicator')),
      // which way an arrow or a chevron points, the bearing's and the second's: shown where one is drawn
      onlyWhen(
        drawsArrow,
        choiceField(
          'arrow_points',
          COMPASS_ARROW_POINTS.map((way) => [way, `compass.arrow_${way}`] as const),
        ),
      ),
      {
        name: 'north_offset',
        selector: {
          number: { min: -180, max: 180, step: 1, mode: 'box', unit_of_measurement: '°' },
        },
      },
      // the ring's face, its ticks and its letters: a row draws none of them
      onlyWhen(ringed, selectField('face', COMPASS_FACES)),
      onlyWhen(ringed, fieldRow(boolField('show_ticks'), boolField('show_cardinals'))),
      onlyWhen(
        ringed,
        fieldRow(
          textField('label'),
          onlyWhen((data) => data['show_badge'] !== false, ownTextField('badge')),
        ),
      ),
      // the readouts under the ring (the rows editor draws the list), shown while it lists one
      onlyWhen(ringed, entitiesField('stats', READINGS)),
      onlyWhen(
        (data) => ringed(data) && Array.isArray(data['stats']) && data['stats'].length > 0,
        boolField('show_stats'),
      ),
      // the colours its figure takes past a threshold, and the card's own in them (the rows editor draws the list)
      onlyWhen(reads, { name: 'thresholds', selector: { object: {} } }),
      bandTintFields(),
      // a weather entity's wind is in its own unit; a sensor's in another of its class, where it has one
      onlyWhen(
        reads,
        numberFields({
          when: (data, hass) =>
            Boolean(data['entity'] && data['direction_entity']) && hasLadder(data, hass),
        }),
      ),
      actionFields({ icon: true }),
    ],
    ...editorLabels(
      s,
      {
        direction_entity: 'direction',
        direction_attribute: 'attribute',
        secondary_direction_entity: 'secondary_direction',
        secondary_direction_attribute: 'attribute',
        face: 'face',
        indicator: 'indicator',
        secondary_indicator: 'secondary_indicator',
        arrow_points: 'arrow_points',
        north_offset: 'north_offset',
        show_cardinals: 'show_cardinals',
      },
      {
        label: 'gauge.label',
        badge: 'gauge.badge',
        show_ticks: 'option.ticks',
        show_stats: 'sensor.editor.show_stats',
        stats: 'editor.readouts',
      },
    ),
  };
}
