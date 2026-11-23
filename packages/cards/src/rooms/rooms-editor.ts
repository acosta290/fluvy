import { lightDefaults, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import { readingField } from '../room/room-editor.js';
import { houseRooms } from '../rooms-family.js';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionField,
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
  lightColourFields,
  listed,
  numberField,
  onlyWhen,
  orderedField,
  selectField,
  textField,
  toneField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { ROUND_GROUPS } from '../shared/rounds.js';
import { ROOMS_ACTIONS, ROOMS_VARIANTS, type RoomsCardConfig } from './rooms-card.js';

/** The Rooms card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

type Data = Readonly<Record<string, unknown>>;
type Item = Record<string, unknown>;

/** The card draws its head. */
const headed = (data: Data): boolean => data['show_head'] !== false;
/** …its rooms as rows with their lines (a compact row says its temperature alone). */
const lined = (data: Data): boolean => data['variant'] !== 'compact';

/** A round that stands for a room's lights: their set, by its word, or a light of its own. */
const lightRound = (entry: unknown): boolean =>
  entry === 'lights' ||
  (typeof entry === 'string' && entry.startsWith('light.')) ||
  (typeof entry === 'object' &&
    entry !== null &&
    ((entry as { group?: unknown }).group === 'lights' ||
      String((entry as { entity?: unknown }).entity).startsWith('light.')));

/** Whether a room's rounds may hold a light, the card's own or a room's: what the lights' colours act on. */
const holdsLights = (data: Data): boolean =>
  listed(data, 'default_actions').includes('lights') ||
  listed(data, 'rooms').some(
    (room) =>
      typeof room === 'object' &&
      room !== null &&
      listed(room as Data, 'quick_actions').some(lightRound),
  );

/** What a room's rounds may stand for besides an entity: one of its sets, or its thermostat, each by its word. */
const ACTION_WORDS = {
  lights: 'room.lights',
  covers: 'room.covers',
  fans: 'room.fans',
  media: 'room.media',
  climate: 'room.climate',
} as const;

/**
 * A room's rounds inside its form (#225): Home Assistant's list of objects, each a round of an entity, or of one of
 * the room's sets or its thermostat where it names none (`group`), with its own name, icon, tone and colour, whether it
 * says its state, and its own tap, hold and double tap (#239), as the Room card's quick actions have them; each left
 * empty is what the round does by itself. A set alone goes back as its word, an entity alone as its id (the list's
 * `write`).
 */
const roundsField = (): HaFormSchemaItem => {
  const { computeLabel } = formLabels({
    group: 'room-editor.group',
    show_state: 'room-editor.show_state',
  });
  return {
    name: 'quick_actions',
    selector: {
      object: {
        multiple: true,
        fields: Object.fromEntries(
          [
            entityField(undefined, 'entity', false),
            choiceField('group', [
              ...ROUND_GROUPS.map((group) => [group, ACTION_WORDS[group]] as const),
              ['climate', ACTION_WORDS.climate],
            ]),
            textField('name'),
            iconField(),
            toneField(),
            accentField('color', { item: 'bulb' }),
            // a switch, not a choice: Home Assistant's list writes a choice's words as they are ("false")
            boolField('show_state'),
            actionField('tap_action'),
            actionField('hold_action'),
            actionField('double_tap_action', 'none'),
          ].map((field) => [
            field.name,
            {
              selector: field.selector,
              required: field.required ?? false,
              label: computeLabel(field, (key) => key),
            },
          ]),
        ),
      },
    },
  };
};

/** A room's form: its area, then its own name, icon and colour, its readings, its rounds, where it opens, its actions. */
const ROOM_ITEM: readonly HaFormSchemaItem[] = [
  areaField(),
  fieldRow(textField('name'), iconField()),
  fieldRow(toneField(), accentField('color', { item: 'card' })),
  fieldRow(
    readingField('temperature', 'climate'),
    readingField('humidity', 'climate', 'humidifier'),
  ),
  roundsField(),
  textField('path'),
  // where it opens, where it names no tap
  actionFields({ tap: null, hold: null }),
];

/** A round of a room's as its form's entry: a set or its thermostat by its word, an entity by its id. */
const roundItem = (raw: unknown): unknown =>
  typeof raw === 'string' ? (raw.includes('.') ? { entity: raw } : { group: raw }) : raw;

/** …and back: a set alone as its word, an entity alone as its id, else its fields that say something. */
const roundEntry = (item: unknown): unknown => {
  if (typeof item !== 'object' || item === null) return item;
  const kept = Object.entries(item).filter(([, value]) => value !== undefined && value !== '');
  const [only] = kept;
  return kept.length === 1 && only && (only[0] === 'group' || only[0] === 'entity')
    ? only[1]
    : Object.fromEntries(kept);
};

/** A room as its form's item, its rounds each as theirs. */
const readRoom = (raw: unknown): Item | null => {
  if (typeof raw === 'string') return raw ? { area: raw } : null;
  if (typeof raw !== 'object' || raw === null || typeof (raw as Item)['area'] !== 'string')
    return null;
  const room = raw as Item;
  const rounds = room['quick_actions'];
  return rounds === undefined ? room : { ...room, quick_actions: [rounds].flat().map(roundItem) };
};

/** A room back as its entry: its area alone as its id, else the fields that say something, its rounds as theirs. */
const writeRoom = (item: Item): string | Item => {
  const kept = Object.entries(item).filter(
    ([, value]) => value !== undefined && value !== '' && value !== null,
  );
  if (kept.length === 1 && kept[0]?.[0] === 'area') return String(kept[0][1]);
  return Object.fromEntries(
    kept.map(([key, value]) => [
      key,
      key === 'quick_actions' && Array.isArray(value) ? value.map(roundEntry) : value,
    ]),
  );
};

/** A card of rooms has no entity of its own: its icon, tone and colour are the head's, its rooms' circles' when lit. */
export const base: readonly BaseKey[] = [
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

export const keys = configKeys<RoomsCardConfig>()([
  'variant',
  'show_head',
  'title',
  'show_average',
  'show_climate',
  'show_count',
  'show_arrow',
  'max_rooms',
  'default_actions',
  'rooms',
  'light_colors',
  'light_whites',
]);

/** The rooms, each an area with its own name, icon, colour, readings, rounds, page and actions. */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'rooms',
    title: 'rooms-card.rooms',
    idKey: 'area',
    picker: areaField(),
    keys: [
      'area',
      'name',
      'icon',
      'tone',
      'color',
      'temperature_entity',
      'humidity_entity',
      'quick_actions',
      'path',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    schema: ROOM_ITEM,
    read: readRoom,
    write: writeRoom,
    ...formLabels({
      temperature_entity: 'editor.temperature_entity',
      humidity_entity: 'editor.humidity_entity',
      quick_actions: 'room-editor.quick_actions',
    }),
  },
];

/**
 * What the editor shows where the config says nothing: what the card does then — the house's rooms, in its order, as
 * rows until the list is touched.
 */
export const defaults: EditorDefaults = (_config, hass) => ({
  variant: 'rows',
  show_head: true,
  show_average: true,
  show_climate: true,
  show_count: false,
  show_arrow: true,
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
  default_actions: [],
  rooms: hass?.areas ? houseRooms(hass).map((area) => area.area_id) : [],
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      fieldRow(selectField('variant', ROOMS_VARIANTS), boolField('show_head')),
      onlyWhen(headed, fieldRow(textField('title'), iconField())),
      onlyWhen(headed, fieldRow(boolField('show_average'), headFields())),
      fieldRow(boolField('show_climate'), onlyWhen(lined, boolField('show_count'))),
      fieldRow(boolField('show_arrow'), numberField('max_rooms', 1, 99)),
      {
        ...orderedField(
          'default_actions',
          ROOMS_ACTIONS.map((action) => ({
            value: action,
            label: editorWord(ACTION_WORDS[action]),
          })),
        ),
        helper: 'rooms-card.default_actions_help',
      },
      // the list is edited item by item (the rows editor takes the field out of the form)
      { name: 'rooms', selector: { object: {} } },
      ...colourFields(),
      // a light's colours where a room's rounds may hold one
      onlyWhen(holdsLights, lightColourFields()),
      // the head's taps, where there is one (it opens every room where the house's rooms open on a dashboard): each
      // room answers its own
      onlyWhen(headed, actionFields({ icon: true, many: true, tap: null })),
    ],
    ...formLabels({
      show_head: 'rooms-card.show_head',
      show_average: 'rooms-card.show_average',
      show_arrow: 'room-editor.show_arrow',
      max_rooms: 'rooms-card.max_rooms',
      default_actions: 'rooms-card.default_actions',
      rooms: 'rooms-card.rooms',
    }),
  };
}
