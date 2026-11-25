// the drive pad's words first: its fields say them
import './english.js';
import {
  addEnglish,
  strings,
  type HaFormSchemaItem,
  type HomeAssistant,
  type KeyOf,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import words from '@fluvy/core/locales/en/vacuum-editor.json';
import { BADGE_BASE } from '../shared/base.js';
import {
  accentField,
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  editorWord,
  entityField,
  fieldRow,
  iconField,
  nameIconFields,
  numberField,
  onlyWhen,
  orderedField,
  ownTextField,
  sectionField,
  selectField,
  headFields,
  stateLabels,
  stateTintFields,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import { STATE_TINT_KEYS } from '../shared/state-tint.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { DRIVE_SPEEDS, DRIVE_STYLES, driveProfile } from './drive.js';
import type { VacuumCardConfig } from './vacuum-card.js';

// the map's and the presets' fields say words of their own, here before the editor speaks
addEnglish(words);

/** The vacuum card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const vacuumStrings = strings('vacuum');
const driveStrings = strings('drive');

type Data = Readonly<Record<string, unknown>>;
type Word = KeyOf<'vacuum-editor'>;

/** A word of the map's and the presets' fields, as a key of the catalogue. */
const word = (key: Word): MessageKey => `vacuum-editor.${key}`;

/** The robot can be driven by hand: its integration, or the config's own calls, says how (`driveProfile`). */
const drivable = (data: Data, hass?: HomeAssistant): boolean =>
  driveProfile(hass, data) !== undefined;
/** The Drive command is drawn: what the pad's own options act on. */
const driven = (data: Data, hass?: HomeAssistant): boolean =>
  data['show_drive'] === true && drivable(data, hass);

/** The full card draws the map, the presets and the suction; the compact one none of them. */
const full = (data: Data): boolean => data['variant'] !== 'compact';
const isBag = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** The card's map, as far as the form holds one. */
const mapOf = (data: Data): Data => (isBag(data['map']) ? data['map'] : {});
/** The card draws a map: what `show_map` acts on. */
const mapped = (data: Data): boolean => full(data) && typeof mapOf(data)['image'] === 'string';
/** The config lists presets, or asks for the house's areas. */
const preset = (data: Data): boolean =>
  full(data) &&
  (data['presets'] === 'areas' || (Array.isArray(data['presets']) && data['presets'].length > 0));
/** The calibration is written as points: YAML's to hold, where a choice holds the rest. */
const pointed = (data: Data): boolean => Array.isArray(mapOf(data)['calibration']);

export const base = BADGE_BASE;

/** A robot's states, as Home Assistant writes them (a mower's among them): what the editor offers a colour for. */
const STATES = ['cleaning', 'mowing', 'returning', 'paused', 'idle', 'docked', 'error'];

export const keys = configKeys<VacuumCardConfig>()([
  'subtitle',
  'variant',
  'show_battery',
  'area_entity',
  'duration_entity',
  'remaining_entity',
  'battery_entity',
  'suction_style',
  'show_suction',
  'map',
  'show_map',
  'presets',
  'show_presets',
  'presets_style',
  'show_drive',
  'drive_speed',
  'drive_style',
  'drive_entity',
  'drive',
  ...STATE_TINT_KEYS,
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  suction_style: 'full',
  show_suction: true,
  show_battery: true,
  show_map: true,
  show_presets: true,
  presets_style: 'full',
  show_drive: false,
  drive_speed: 'normal',
  drive_style: 'card',
});

/** What says a field's use under it: the drive pad's, the map's and a preset's that need it. */
const HELPERS: Readonly<Partial<Record<string, MessageKey>>> = {
  drive_entity: 'drive.editor.drive_entity_helper',
  drive: 'drive.editor.drive_helper',
  image: word('image_helper'),
  calibration: word('calibration_helper'),
  aspect_ratio: word('aspect_ratio_helper'),
  controls: word('controls_helper'),
  repeats: word('repeats_helper'),
  topic: word('topic_helper'),
  rooms: word('rooms_helper'),
  room_action: word('action_helper'),
  zone_action: word('action_helper'),
  point_action: word('action_helper'),
};

/**
 * The drive pad's fields (#178), folded: the Drive command's switch where the robot can be driven — else a line
 * saying why, in its place — the pad's speed and where it opens once it is on (a compact card's is always its
 * sheet), the robot to drive where it is another, and a robot's own calls, edited as YAML.
 */
const driveFields = (): HaFormSchemaItem =>
  sectionField('drive.editor.section', [
    onlyWhen(drivable, boolField('show_drive')),
    onlyWhen((data, hass) => !drivable(data, hass), {
      name: 'show_drive',
      type: 'constant',
      value: driveStrings(editorLanguage(), 'none'),
    }),
    onlyWhen(
      driven,
      fieldRow(
        choiceField(
          'drive_speed',
          DRIVE_SPEEDS.map((speed) => [speed, `drive.option.${speed}`] as const),
        ),
        onlyWhen(
          (data) => data['variant'] !== 'compact',
          choiceField(
            'drive_style',
            DRIVE_STYLES.map((style) => [style, `drive.option.${style}`] as const),
          ),
        ),
      ),
    ),
    entityField(['vacuum', 'lawn_mower'], 'drive_entity', false),
    { name: 'drive', selector: { object: {} } },
  ]);

/** A field YAML holds: a list of numbers, of rooms, an action's data. */
const yamlField = (name: string): HaFormSchemaItem => ({ name, selector: { object: {} } });

/**
 * The map's fields (#265), folded, held under the card's `map` as Home Assistant's form holds a named group: its
 * picture, its calibration (typed, or points as YAML where the config writes points) and its shape, what stands on
 * it (the names, a round for each thing a hand may do), how many times a pick is cleaned, a Valetudo robot's topic,
 * and as YAML its rooms and the person's own actions. A group held under its own key shows no default of its own, so
 * none of its fields is a choice with one: each is empty until written, and what the card does then is said under it.
 */
const mapFields = (): HaFormSchemaItem => ({
  type: 'expandable',
  name: 'map',
  schema: [
    textField('image'),
    onlyWhen((data) => !pointed(data), textField('calibration')),
    onlyWhen(pointed, yamlField('calibration')),
    textField('aspect_ratio'),
    orderedField(
      'controls',
      (['names', 'zone', 'point'] as const).map((value) => ({
        value,
        label: editorWord(word(`controls.${value}`)),
      })),
    ),
    fieldRow(numberField('repeats', 1, 3), textField('topic')),
    yamlField('rooms'),
    yamlField('room_action'),
    yamlField('zone_action'),
    yamlField('point_action'),
  ],
});

/** A preset's fields: its name first, what it wears, what it cleans, how, and what it answers of its own. */
const presetSchema = (zones: boolean, one: boolean): HaFormSchemaItem[] => [
  textField('name'),
  fieldRow(iconField(), accentField('color', { item: 'card' })),
  ...(one ? [yamlField('zone')] : []),
  ...(zones ? [yamlField('zones')] : []),
  yamlField('rooms'),
  { name: 'areas', selector: { area: { multiple: true } } },
  yamlField('point'),
  fieldRow(numberField('repeats', 1, 3), boolField('confirmation')),
  choiceField('on_map', [
    ['true', 'common.on'],
    ['false', 'common.off'],
  ]),
  actionFields({ tap: null, hold: null }),
];
const PRESET = presetSchema(true, true);
const PRESET_ZONE = presetSchema(false, true);
const PRESET_ZONES = presetSchema(true, false);

const PRESET_WORDS: Readonly<Partial<Record<string, Word>>> = {
  zone: 'zone',
  zones: 'zones',
  rooms: 'preset_rooms',
  areas: 'areas',
  point: 'point',
  repeats: 'repeats',
  confirmation: 'confirmation',
  on_map: 'on_map',
};
const PRESET_HELPERS: Readonly<Partial<Record<string, Word>>> = {
  zone: 'zone_helper',
  zones: 'zones_helper',
  rooms: 'preset_rooms_helper',
  point: 'point_helper',
  on_map: 'on_map_helper',
  tap_action: 'preset_tap_helper',
  hold_action: 'preset_hold_helper',
};

/**
 * The card's lists, edited item by item: its presets (a list of them; `presets: areas` is YAML's word) by their
 * names, each one's zone as one rectangle or as several, as its config writes it.
 */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'presets',
    title: word('presets'),
    idKey: 'name',
    schema: PRESET,
    schemaOf: (item) => (Array.isArray(item['zones']) ? PRESET_ZONES : PRESET_ZONE),
    keys: [
      'name',
      'icon',
      'color',
      'zone',
      'zones',
      'rooms',
      'areas',
      'point',
      'repeats',
      'confirmation',
      'on_map',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    computeLabel: (schema) => {
      const key = PRESET_WORDS[schema.name];
      return key ? editorWord(word(key)) : undefined;
    },
    computeHelper: (schema) => {
      const key = PRESET_HELPERS[schema.name];
      return key ? editorWord(word(key)) : undefined;
    },
    when: (data) => full(data) && data['presets'] !== 'areas',
  },
];

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['vacuum', 'lawn_mower']),
      nameIconFields(),
      headFields({ badge: true }),
      fieldRow(ownTextField('subtitle'), selectField('variant', ['full', 'compact'])),
      fieldRow(boolField('show_battery'), entityField(['sensor'], 'battery_entity', false)),
      fieldRow(
        entityField(['sensor'], 'area_entity', false),
        entityField(['sensor'], 'duration_entity', false),
      ),
      fieldRow(
        entityField(['sensor'], 'remaining_entity', false),
        selectField('suction_style', ['full', 'chips']),
      ),
      onlyWhen(full, boolField('show_suction')),
      onlyWhen(full, mapFields()),
      onlyWhen(mapped, boolField('show_map')),
      onlyWhen(
        preset,
        fieldRow(boolField('show_presets'), selectField('presets_style', ['full', 'chips'])),
      ),
      driveFields(),
      ...colourFields(),
      ...stateTintFields(STATES),
      actionFields({ icon: true }),
    ],
    ...stateLabels(
      editorLabels(
        vacuumStrings,
        { area_entity: 'area', duration_entity: 'elapsed' },
        {
          battery_entity: 'vacuum.battery',
          remaining_entity: 'timer.remaining',
          suction_style: 'editor.suction_style',
          show_drive: 'drive.editor.show_drive',
          drive_speed: 'drive.editor.drive_speed',
          drive_style: 'drive.editor.drive_style',
          drive_entity: 'drive.editor.drive_entity',
          drive: 'drive.editor.drive',
          show_suction: word('show_suction'),
          map: word('map'),
          show_map: word('show_map'),
          show_presets: word('show_presets'),
          presets_style: word('presets_style'),
          image: word('image'),
          calibration: word('calibration'),
          controls: word('controls'),
          repeats: word('repeats'),
          topic: word('topic'),
          rooms: word('rooms'),
          room_action: word('room_action'),
          zone_action: word('zone_action'),
          point_action: word('point_action'),
        },
      ),
      STATES,
      'vacuum',
      'lawn_mower',
    ),
    computeHelper: (schema) => {
      const key = HELPERS[schema.name];
      return key ? editorWord(key) : undefined;
    },
  };
}
