import { lightDefaults, type LovelaceConfigForm } from '@fluvy/core';
import { roundsList } from '../room/room-editor.js';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  fieldRow,
  formLabels,
  headFields,
  holdsDevice,
  holdsLight,
  iconField,
  lightColourFields,
  namesField,
  numberField,
  onlyWhen,
  textField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { ROUNDS_ALIGNS, ROUNDS_VARIANTS, type RoundsCardConfig } from './rounds-card.js';

/** The Rounds card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

type Data = Readonly<Record<string, unknown>>;

/** The card draws a head: it has a title. */
const titled = (data: Data): boolean => Boolean(data['title']);
/** …its rounds in lines, where their names, their columns and their place on the line act (not a row each). */
const inLines = (data: Data): boolean => data['variant'] !== 'row';

/** A card of rounds has no entity of its own: its icon, tone and colour are the head's, and a light's where it says none. */
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

export const keys = configKeys<RoundsCardConfig>()([
  'title',
  'show_count',
  'items',
  'variant',
  'show_names',
  'columns',
  'align',
  'light_colors',
  'light_whites',
]);

/** The rounds, each an entity with its own name, icon, colour, state and actions (the room's rounds' form). */
export const lists: readonly RowsListSpec[] = [roundsList('items', 'rounds.rounds', undefined)];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rounds',
  show_count: true,
  show_names: false,
  align: 'fill',
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      fieldRow(textField('title'), iconField()),
      fieldRow(
        choiceField(
          'variant',
          ROUNDS_VARIANTS.map(
            (variant) =>
              [
                variant,
                variant === 'row' ? 'option.rows' : (`rounds.${variant}` as const),
              ] as const,
          ),
        ),
        onlyWhen(titled, boolField('show_count')),
      ),
      onlyWhen(titled, headFields()),
      // their names under them, how many a line, where they stand on it: the lines' alone
      onlyWhen(inLines, fieldRow(boolField('show_names'), numberField('columns', 1, 12))),
      onlyWhen(
        inLines,
        choiceField(
          'align',
          ROUNDS_ALIGNS.map((align) => [align, `rounds.${align}`] as const),
        ),
      ),
      // the list is edited item by item (the rows editor takes the field out of the form)
      { name: 'items', selector: { object: {} } },
      onlyWhen(holdsDevice('items', 'entities'), namesField()),
      ...colourFields(),
      // a light's colours where the rounds hold a light
      onlyWhen(holdsLight('items', 'entities'), lightColourFields()),
      // the head's taps, where there is one: each round answers its own
      onlyWhen(titled, actionFields({ icon: true, many: true })),
    ],
    ...formLabels({
      show_names: 'rounds.show_names',
      align: 'rounds.align',
      items: 'rounds.rounds',
    }),
  };
}
