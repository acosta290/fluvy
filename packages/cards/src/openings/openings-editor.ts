import { strings, type HomeAssistant, type LovelaceConfigForm } from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  accentField,
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  holdsDevice,
  iconField,
  nameIconFields,
  namesField,
  numberField,
  onlyWhen,
  selectField,
  headFields,
  listed,
  sinceChoices,
  sinceField,
  textField,
  titleFields,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { ALERT, OPENINGS_VARIANTS, type OpeningsCardConfig } from './openings-card.js';

/** The openings card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('openings');

/** The openings have no entity of their own: the head's icon, tone and colour are the base fields it honours. */
export const base: readonly BaseKey[] = [
  'entities',
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
  ...ACTIONS_BASE,
  'show_icon',
  'name_lines',
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<OpeningsCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'variant',
  'max_rows',
  'show_count',
  'show_time',
  'since_pattern',
  'alert_classes',
  ...EMPTY_KEYS,
]);

/**
 * The classes a row may be read as (#102): Home Assistant's binary sensor classes this card speaks of, any other
 * typed.
 */
const CLASSES = [
  'door',
  'window',
  'garage_door',
  'opening',
  'lock',
  'motion',
  'occupancy',
  'presence',
  'vibration',
  'moisture',
  'smoke',
  'gas',
  'carbon_monoxide',
  'problem',
  'safety',
  'tamper',
] as const;

/**
 * The binary sensor classes the card may count as alerts too (`alert_classes`, #223): Home Assistant's that are none
 * by themselves, what is detected first.
 */
const OTHER_CLASSES = [
  'motion',
  'occupancy',
  'presence',
  'moving',
  'vibration',
  'sound',
  'battery',
  'cold',
  'heat',
  'light',
  'power',
  'plug',
  'running',
  'connectivity',
  'battery_charging',
  'update',
] as const;

/** A binary sensor class in Home Assistant's own words, else its name. */
const classWord = (hass: HomeAssistant | undefined, value: string): string =>
  hass?.localize(`component.binary_sensor.entity_component.${value}.name`) ||
  value.replace(/_/g, ' ');

/**
 * Whether a row is read as a class that is no alert by itself (a motion sensor's): what the card's `alert_classes`
 * acts on. Its own class (`device_class`) first, else its sensor's; a house not read yet keeps the field.
 */
const holdsOther = (data: Readonly<Record<string, unknown>>, hass?: HomeAssistant): boolean =>
  !hass?.states ||
  listed(data, 'rows', 'entities').some((entry) => {
    const row = typeof entry === 'string' ? { entity: entry } : (entry as Record<string, unknown>);
    const id = String(row['entity'] ?? '');
    const own = row['device_class'];
    const dc =
      typeof own === 'string' && own
        ? own
        : id.startsWith('binary_sensor.')
          ? hass.states[id]?.attributes['device_class']
          : undefined;
    return typeof dc === 'string' && dc !== '' && !ALERT.has(dc);
  });

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    domains: ['binary_sensor', 'cover', 'lock'],
    // how the rows that say no name are named stands over them
    fields: ['names'],
    keys: [
      'entity',
      'name',
      'icon',
      'color',
      'device_class',
      'states',
      'alert',
      'since',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    schema: [
      entityField(['binary_sensor', 'cover', 'lock']),
      nameIconFields(),
      fieldRow(
        accentField('color', { item: 'own' }),
        selectField('device_class', [], { custom: true }),
      ),
      { name: 'states', selector: { object: {} } },
      // whether its on is an alert whatever its class says (#223): empty until chosen, its class's then
      {
        ...choiceField('alert', [
          ['true', 'option.always'],
          ['false', 'option.never'],
        ]),
        helper: 'editor.alert_helper',
      },
      sinceField(),
      actionFields(),
    ],
    // a row's `since` offers the house's timestamp sensors, its class Home Assistant's classes in its own words
    choices: (item, hass) => ({
      ...sinceChoices(item, hass),
      device_class: CLASSES.map((value) => ({ value, label: classWord(hass, value) })),
    }),
  },
];

/** A row's `since` offers the house's timestamp sensors; `alert_classes` the classes, in Home Assistant's words. */
export const choices: EditorChoices = (config, hass) => ({
  ...sinceChoices(config, hass),
  alert_classes: OTHER_CLASSES.map((value) => ({ value, label: classWord(hass, value) })),
});

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rows',
  max_rows: 4,
  show_count: true,
  show_time: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', ['binary_sensor', 'cover', 'lock'], true),
      onlyWhen(holdsDevice('rows', 'entities'), namesField()),
      titleFields(),
      iconField(),
      headFields(),
      ...colourFields(),
      // as many rows as asked for, past twenty too (an automatic dashboard in full asks for every one)
      fieldRow(selectField('variant', OPENINGS_VARIANTS), numberField('max_rows', 1)),
      fieldRow(boolField('show_count'), boolField('show_time')),
      // the classes whose on is an alert too (#223): while a row is read as one that is none by itself
      onlyWhen(holdsOther, {
        name: 'alert_classes',
        selector: { select: { multiple: true, mode: 'dropdown', options: [] } },
        helper: 'editor.alert_classes_helper',
      }),
      // where the rows read their last change from, for the rows that say nothing: while the times show
      onlyWhen(({ show_time, variant }) => show_time !== false && variant !== 'compact', {
        ...textField('since_pattern'),
        helper: 'editor.since_pattern_help',
      }),
      emptyFields(),
      actionFields({ icon: true, many: true }),
    ],
    ...editorLabels(s, { max_rows: 'editor.max_rows' }, {}),
  };
}
