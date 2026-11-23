import type { HaFormSchemaItem, LovelaceConfigForm } from '@fluvy/core';
import { roundsField } from '../room/room-editor.js';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  areaField,
  boolField,
  choiceField,
  colourFields,
  editorWord,
  entityField,
  fieldRow,
  formLabels,
  headFields,
  iconField,
  listed,
  nameIconFields,
  onlyWhen,
  orderedField,
  textField,
  toneField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { hasHead } from '../thermostats-family.js';
import {
  HOUSE_ACTIONS,
  THERMOSTATS_CONTROLS,
  THERMOSTATS_VARIANTS,
  type ThermostatsCardConfig,
} from './thermostats-card.js';

/** The Thermostats card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

type Data = Readonly<Record<string, unknown>>;

/** The card draws a head: a title, the count or the average. */
const headed = (data: Data): boolean => hasHead({ type: '', ...data });
/** …its thermostats as rows, where a row's control and its round act (a tile has neither). */
const inRows = (data: Data): boolean => data['variant'] !== 'tiles';
/** …its own list of none: the area's or the house's, where its area acts. */
const unlisted = (data: Data): boolean => !listed(data, 'thermostats', 'entities').length;

/**
 * A card of thermostats has no entity of its own: its icon, tone and colour are the head's, and a row's where it says
 * none.
 */
export const base: readonly BaseKey[] = [
  'names',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'card_blur',
  'exact_colors',
  'unavailable',
  'show_icon',
  'name_lines',
  ...ACTIONS_BASE,
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<ThermostatsCardConfig>()([
  'title',
  'show_count',
  'show_average',
  'thermostats',
  'area',
  'variant',
  'control',
  'show_round',
  'house_actions',
]);

/**
 * The thermostats, each a climate, a water heater or a humidifier with its own name, icon, colour, rounds and
 * actions.
 */
/** A thermostat's own fields; its rounds only where it is a row (tiles draw none), one array per answer. */
const THERMOSTAT_FIELDS = [
  entityField(['climate', 'water_heater', 'humidifier']),
  nameIconFields(),
  fieldRow(toneField(), accentField('color', { item: 'card' })),
  roundsField(),
  actionFields(),
];
const THERMOSTAT_TILE_FIELDS = THERMOSTAT_FIELDS.filter((field) => field.name !== 'rounds');

export const lists: readonly RowsListSpec[] = [
  {
    key: 'thermostats',
    title: 'thermostats.title',
    domains: ['climate', 'water_heater', 'humidifier'],
    // how the thermostats that say no name are named stands over them
    fields: ['names'],
    keys: [
      'entity',
      'name',
      'icon',
      'tone',
      'color',
      'rounds',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    schema: THERMOSTAT_FIELDS,
    schemaOf: (_item, card) =>
      card?.['variant'] === 'tiles' ? THERMOSTAT_TILE_FIELDS : THERMOSTAT_FIELDS,
    computeLabel: (schema) =>
      schema.name === 'rounds' ? editorWord('thermostats.rounds') : undefined,
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  names: 'area',
  variant: 'rows',
  control: 'none',
  show_round: true,
  show_count: false,
  show_average: false,
});

export function getConfigForm(): LovelaceConfigForm {
  const area: HaFormSchemaItem = { ...areaField(), required: false };
  return {
    schema: [
      // where its thermostats are found while it lists none: an area, else the house
      onlyWhen(unlisted, area),
      fieldRow(textField('title'), iconField()),
      fieldRow(boolField('show_count'), boolField('show_average')),
      onlyWhen(headed, headFields()),
      fieldRow(
        choiceField(
          'variant',
          THERMOSTATS_VARIANTS.map((variant) => [variant, `option.${variant}`] as const),
        ),
        // what a row ends in: the room's temperature, or the target between − and +
        onlyWhen(
          inRows,
          choiceField(
            'control',
            THERMOSTATS_CONTROLS.map(
              (control) =>
                [control, control === 'none' ? 'thermostats.room' : 'thermostats.stepper'] as const,
            ),
          ),
        ),
      ),
      onlyWhen(inRows, boolField('show_round')),
      // All off and the presets for every thermostat, in the order chosen
      orderedField(
        'house_actions',
        HOUSE_ACTIONS.map((action) => ({
          value: action,
          label: editorWord(action === 'all_off' ? 'thermostats.all_off' : 'thermostats.presets'),
        })),
      ),
      // the list is edited row by row (the rows editor takes the field out of the form)
      { name: 'thermostats', selector: { object: {} } },
      // by its room first: a list of thermostats is a list of rooms
      {
        ...choiceField('names', [
          ['area', 'thermostats.names_area'],
          ['full', 'editor.names_full'],
          ['entity', 'editor.names_entity'],
          ['device', 'editor.names_device'],
        ]),
        helper: 'editor.names_helper',
      },
      ...colourFields(),
      // the head's taps, where there is one: each row answers its own
      onlyWhen(headed, actionFields({ icon: true, many: true })),
    ],
    ...formLabels({
      show_count: 'thermostats.show_count',
      show_average: 'thermostats.show_average',
      control: 'thermostats.control',
      show_round: 'thermostats.show_round',
      house_actions: 'thermostats.house_actions',
      thermostats: 'thermostats.title',
    }),
  };
}
