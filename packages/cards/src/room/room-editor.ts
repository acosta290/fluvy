import {
  addEnglish,
  areaContents,
  areaEntities,
  deviceNameOf,
  idsOf,
  lightDefaults,
  resolveEntity,
  type ClimateKind,
  type HaFormSchemaItem,
  type HomeAssistant,
  type LovelaceConfigForm,
} from '@fluvy/core';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  acts,
  areaField,
  boolField,
  choiceField,
  colourFields,
  editorWord,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  iconField,
  lightColourFields,
  listed,
  nameIconFields,
  nameLinesField,
  onlyWhen,
  selectField,
  showActionField,
  showIconField,
  sinceChoices,
  switches,
  switchStyleField,
  textField,
  tintField,
  toneField,
} from '../shared/form.js';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { lists as tilesLists } from '../tiles/tiles-editor.js';
import { roomLights, type RoomCardConfig } from './room-card.js';
import { defaultGroups, QUICK_GROUPS, quickEntry } from './quick-actions.js';
import words from '@fluvy/core/locales/en/room-editor.json';

// the editor's own English, in its chunk: its words are said once it is drawn, never by a dashboard
addEnglish(words);

/** The room card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** Whether the room draws what its editor offers under its head or hero (its form's data): a row draws none of it. */
const drawsControls = ({ variant }: Readonly<Record<string, unknown>>): boolean =>
  variant !== 'row';

/** …its tiles (`controls: tiles`), and their colour at rest with them. */
const drawsTiles = (form: Readonly<Record<string, unknown>>): boolean =>
  drawsControls(form) && form['controls'] === 'tiles';

/** …its lights, in a row of their own or among its tiles. */
const drawsLights = (form: Readonly<Record<string, unknown>>): boolean =>
  drawsControls(form) && form['controls'] !== 'none';

/** …its category rows. */
const drawsRows = ({ variant, controls }: Readonly<Record<string, unknown>>): boolean =>
  variant !== 'row' && (controls ?? 'rows') === 'rows';

/**
 * …a thermostat that may say what it is doing: its climate row's, or a tile's of its own (a climate or a humidifier).
 */
const holdsThermostat = (form: Readonly<Record<string, unknown>>, hass?: HomeAssistant): boolean =>
  drawsRows(form)
    ? Boolean(hass?.states) &&
      areaEntities(hass as HomeAssistant, String(form['area'] ?? ''), { domains: ['climate'] })
        .length > 0
    : drawsTiles(form) && idsOf(listed(form, 'tiles')).some(acts);

/** …its quick actions. */
const drawsQuick = ({ show_quick_actions: shown }: Readonly<Record<string, unknown>>): boolean =>
  shown !== false;

/** The arrows stand on a tile's head and on the category rows: a card of neither has none to hide. */
const drawsArrows = (form: Readonly<Record<string, unknown>>): boolean =>
  form['variant'] === 'tile' || drawsRows(form);

/** The photo alone carries the name's pill, a picture and the readouts. */
const isPhoto = ({ variant }: Readonly<Record<string, unknown>>): boolean => variant === 'photo';

/** …its readouts, while it shows the climate or the count: how they are laid out and labelled. */
const drawsReadouts = (form: Readonly<Record<string, unknown>>): boolean =>
  isPhoto(form) && (form['show_climate'] !== false || form['show_count'] !== false);

/** …with words over their figures, which a wrapped row keeps (icons or none keep to one row). */
const keepsWords = ({ readout_labels: labels }: Readonly<Record<string, unknown>>): boolean =>
  labels !== 'icons' && labels !== 'none';

/** A reading's field: a sensor of its class, or the thermostat (the humidifier) that carries it (`climateAttribute`). */
const readingField = (kind: ClimateKind, ...domain: string[]): HaFormSchemaItem => ({
  name: `${kind}_entity`,
  selector: { entity: { filter: [{ domain: 'sensor', device_class: kind }, { domain }] } },
});

export const base: readonly BaseKey[] = [
  'name',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
  ...ACTIONS_BASE,
  'show_icon',
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<RoomCardConfig>()([
  'area',
  'variant',
  'picture',
  'name_position',
  'show_climate',
  'show_count',
  'readout_style',
  'readout_labels',
  'show_quick_actions',
  'show_arrow',
  'show_action',
  'controls',
  'tiles',
  'quick_actions',
  'lights',
  'path',
  'temperature_entity',
  'humidity_entity',
  'include',
  'exclude',
  'tint',
  'name_lines',
  'switch_style',
  'light_colors',
  'light_whites',
]);

/** What a quick action stands for: one of the room's sets, by its word, or an entity. */
const groupField = choiceField('group', [
  ...QUICK_GROUPS.map((group) => [group, `room.${group}`] as const),
  ['entity', 'editor.entity'],
]);
/** A set's round: its own name, icon, colour and actions; an entity's, the entity first. */
const GROUP_ITEM: readonly HaFormSchemaItem[] = [
  groupField,
  fieldRow(textField('name'), iconField()),
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  // a round turns on and off what switches, else opens
  actionFields({ tap: null }),
];
const ENTITY_ITEM: readonly HaFormSchemaItem[] = [
  groupField,
  entityField(undefined, 'entity', false),
  nameIconFields(),
  ...GROUP_ITEM.slice(2),
];

/**
 * A room's tiles are a group's but for their look out of reach, which is the room's (they sit inside it), and a large
 * tile's switch: they are compact, the tile itself the button — or, asked for a wall rocker, its switch at its end.
 */
const ownField = (key: string): boolean => key !== 'unavailable' && key !== 'show_switch';
const TILE_FIELDS = (tilesLists[0]?.schema ?? []).filter((field) => ownField(field.name));
/** A tile's fields by what its entity is: one that switches has its switch's style, a thermostat what it is doing. */
const TILE_FORMS = [false, true].map((styled) =>
  [false, true].map((acting) =>
    TILE_FIELDS.filter(
      (field) =>
        (styled || field.name !== 'switch_style') && (acting || field.name !== 'show_action'),
    ),
  ),
);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'tiles',
    title: 'editor.tiles',
    keys: (tilesLists[0]?.keys ?? []).filter(ownField),
    schema: TILE_FIELDS,
    // a tile's own switch style, of an entity that switches; what it is doing, of a climate or a humidifier
    schemaOf: (item) =>
      TILE_FORMS[Number(switches(item['entity']))]?.[Number(acts(item['entity']))] ?? TILE_FIELDS,
    when: drawsTiles,
  },
  {
    key: 'quick_actions',
    idKey: 'group',
    also: ['entity'],
    title: 'room-editor.quick_actions',
    keys: [
      'group',
      'entity',
      'name',
      'icon',
      'tone',
      'color',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    picker: groupField,
    computeLabel: (schema) =>
      schema.name === 'group' ? editorWord('room-editor.group') : undefined,
    read: (raw) => quickEntry(raw) as Record<string, unknown> | null,
    // a set alone is its word, an entity alone its id; an entity's kind is never written beside it
    write: ({ group, entity, ...own }) => {
      const kept = Object.fromEntries(
        Object.entries(own).filter(([, value]) => value !== undefined && value !== ''),
      );
      const bare = !Object.keys(kept).length;
      if (group !== 'entity') return bare ? String(group) : { group, ...kept };
      if (typeof entity !== 'string' || !entity) return { group };
      return bare ? entity : { entity, ...kept };
    },
    schema: ENTITY_ITEM,
    schemaOf: (item) => (item['group'] === 'entity' ? ENTITY_ITEM : GROUP_ITEM),
    when: drawsQuick,
  },
];

/**
 * What a room's `include` and `exclude` offer (#95), each with its words: its entities, its devices and its domains,
 * any other entry typed (an entity elsewhere, a pattern of ids).
 */
function roomEntries(config: Readonly<Record<string, unknown>>, hass?: HomeAssistant) {
  const area = String(config['area'] ?? '');
  if (!hass?.states || !area) return [];
  const ids = areaEntities(hass, area);
  const devices = [...new Set(ids.map((id) => hass.entities?.[id]?.device_id ?? ''))].filter(
    (device) => hass.devices?.[device],
  );
  return [
    ...ids.map((id) => ({ value: id, label: `${resolveEntity(hass, id).name} (${id})` })),
    ...devices.map((device) => ({
      value: device,
      label: deviceNameOf(hass.devices?.[device]) ?? device,
    })),
    ...[...new Set(ids.map((id) => id.slice(0, id.indexOf('.'))))].map((domain) => ({
      value: domain,
      label: domain,
    })),
  ];
}

/** A tile's `since` offers the house's timestamp sensors, as the tiles card's do; `include`, `exclude` the room's own. */
export const choices: EditorChoices = (config, hass) => {
  const entries = roomEntries(config, hass);
  return { ...sinceChoices(config, hass), include: entries, exclude: entries };
};

/** A room's `include` or `exclude`: its entities, devices and domains to choose, or a pattern typed (#95). */
const entriesField = (name: 'include' | 'exclude'): HaFormSchemaItem => ({
  name,
  selector: { select: { multiple: true, custom_value: true, mode: 'dropdown', options: [] } },
  helper: 'room-editor.entries_help',
});

/**
 * What the editor shows where the config says nothing: what the card does then — its variant, the readings it found
 * and its quick actions (its lights, then its blinds, where it has them), in the room as its `include` and `exclude`
 * say.
 */
export const defaults: EditorDefaults = (config, hass) => {
  const area = hass?.areas?.[String(config['area'] ?? '')];
  const found =
    hass && area ? areaContents(hass, area.area_id, config as RoomCardConfig) : undefined;
  const devices = found?.devices ?? [];
  const lights = roomLights(config as RoomCardConfig, devices);
  return {
    variant: config['picture'] || area?.picture ? 'photo' : 'tile',
    controls: 'rows',
    name_position: 'bottom',
    name_lines: '1',
    switch_style: 'toggle',
    show_count: true,
    show_climate: true,
    readout_style: 'row',
    readout_labels: 'auto',
    show_quick_actions: true,
    show_arrow: true,
    show_action: false,
    quick_actions: defaultGroups({ hass, devices, lights }),
    lights,
    tint: 'on',
    light_colors: lightDefaults().colors,
    light_whites: 'temperature',
    temperature_entity: found?.climate.temperature,
    humidity_entity: found?.climate.humidity,
  };
};

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      areaField(),
      fieldRow(textField('name'), iconField()),
      showIconField(),
      fieldRow(
        selectField('variant', ['photo', 'tile', 'row']),
        onlyWhen(drawsControls, selectField('controls', ['rows', 'tiles', 'none'])),
      ),
      // where the photo carries the name (#159): at its foot beside the quick actions, or at its top
      onlyWhen(
        isPhoto,
        choiceField('name_position', [
          ['bottom', 'room-editor.bottom'],
          ['top', 'room-editor.top'],
        ]),
      ),
      fieldRow(boolField('show_climate'), boolField('show_count')),
      // the photo's readouts: on one row or wrapped (words alone wrap), and what stands over their figures
      fieldRow(
        onlyWhen(
          (form) => drawsReadouts(form) && keepsWords(form),
          choiceField('readout_style', [
            ['row', 'room-editor.one_row'],
            ['wrap', 'room-editor.several_rows'],
          ]),
        ),
        onlyWhen(
          drawsReadouts,
          choiceField('readout_labels', [
            ['auto', 'option.auto'],
            ['words', 'room-editor.words'],
            ['icons', 'room-editor.icons'],
            ['none', 'option.none'],
          ]),
        ),
      ),
      fieldRow(boolField('show_quick_actions'), onlyWhen(drawsArrows, boolField('show_arrow'))),
      // its climate row and its thermostats' tiles say what they are doing, where they said their mode
      onlyWhen(holdsThermostat, showActionField()),
      // the list is edited item by item (the rows editor takes the field out of the form)
      { name: 'quick_actions', selector: { object: {} } },
      // a picture is the photo's alone (the default where the room has one)
      fieldRow(onlyWhen(isPhoto, textField('picture')), textField('path')),
      // the lights its row and its lights' round count and switch: a lamp on a plug among them
      onlyWhen((form) => drawsRows(form) || drawsQuick(form), {
        ...entitiesField('lights', ['light', 'switch']),
        helper: 'room-editor.lights_help',
      }),
      fieldRow(
        readingField('temperature', 'climate'),
        readingField('humidity', 'climate', 'humidifier'),
      ),
      entriesField('include'),
      entriesField('exclude'),
      ...colourFields(),
      // its tiles' colour at rest; their names' lines, and the row's (a compact tile)
      fieldRow(
        onlyWhen(drawsTiles, tintField()),
        onlyWhen((form) => drawsTiles(form) || form['variant'] === 'row', nameLinesField()),
      ),
      // its tiles' switches as wall rockers, each at its tile's end
      onlyWhen(drawsTiles, switchStyleField()),
      onlyWhen(drawsLights, lightColourFields()),
      // where the room opens, where none is chosen
      actionFields({ icon: true, tap: null }),
    ],
    ...formLabels({
      temperature_entity: 'editor.temperature_entity',
      humidity_entity: 'editor.humidity_entity',
      show_quick_actions: 'room-editor.show_quick_actions',
      show_arrow: 'room-editor.show_arrow',
      name_position: 'room-editor.name_position',
      readout_style: 'room-editor.readout_style',
      readout_labels: 'room-editor.readout_labels',
      quick_actions: 'room-editor.quick_actions',
      lights: 'room.lights',
      include: 'room-editor.include',
      exclude: 'room-editor.exclude',
    }),
  };
}
