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
  type MessageKey,
} from '@fluvy/core';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionField,
  actionFields,
  acts,
  areaField,
  boolField,
  choiceField,
  colourFields,
  editorWord,
  endsReadouts,
  entitiesField,
  entityField,
  fieldRow,
  figureField,
  formLabels,
  iconField,
  joinsReadouts,
  itemToggleField,
  lightColourFields,
  lineReadoutsField,
  listed,
  mostReadouts,
  nameIconFields,
  nameLinesField,
  numberField,
  onlyWhen,
  readoutsLayoutField,
  selectField,
  showActionField,
  showIconField,
  sinceChoices,
  switches,
  switchStyleField,
  textField,
  thresholdsField,
  tintField,
  toneField,
} from '../shared/form.js';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { lists as tilesLists } from '../tiles/tiles-editor.js';
import { roomLights, type RoomCardConfig } from './room-card.js';
import { ROUND_GROUPS, roundEntry } from '../shared/rounds.js';
import { defaultGroups } from './quick-actions.js';
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

/**
 * What a card's quick actions say of their state, and where (#205), on every card that draws them: every one's
 * (`show_quick_states`) while the card draws them (`draws`), and where the states stand (`quick_state_position`) once
 * one of them says its own — every one's, or one's of its own (`show_state`).
 */
export const quickStateFields = (
  draws: (form: Readonly<Record<string, unknown>>) => boolean,
): HaFormSchemaItem[] => [
  onlyWhen(draws, {
    ...boolField('show_quick_states'),
    helper: 'room-editor.quick_states_help',
  }),
  onlyWhen(
    (form) =>
      draws(form) &&
      (form['show_quick_states'] === true ||
        listed(form, 'quick_actions').some(
          (item) => (item as { show_state?: unknown } | null)?.show_state === true,
        )),
    choiceField('quick_state_position', [
      ['under', 'room-editor.under'],
      ['beside', 'room-editor.beside'],
    ]),
  ),
];

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
export const readingField = (kind: ClimateKind, ...domain: string[]): HaFormSchemaItem => ({
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
  'card_blur',
  'exact_colors',
  'unavailable',
  ...ACTIONS_BASE,
  'show_icon',
  // its controls' names, not its head's (#100)
  'name_lines',
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
  'show_quick_states',
  'quick_state_position',
  'show_arrow',
  'show_action',
  'controls',
  'tiles',
  'quick_actions',
  'lights',
  'lamp_switches',
  'path',
  'temperature_entity',
  'humidity_entity',
  'include',
  'exclude',
  'tint',
  'switch_style',
  'line_readouts',
  'readouts_layout',
  'light_colors',
  'light_whites',
]);

/** What a quick action stands for: one of the room's sets, by its word, or an entity. */
const groupField = choiceField('group', [
  ...ROUND_GROUPS.map((group) => [group, `room.${group}`] as const),
  ['entity', 'editor.entity'],
]);
/**
 * A gauge's style as its tile draws it (1.26, #257): the round and the style's marks on it, in a mid grey and its
 * tints — a picture reads no token, and this one reads on a light ground and on a dark one.
 */
const drawing = (marks: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="none" stroke="#888" stroke-width="3"><circle cx="22" cy="22" r="22" fill="#888" fill-opacity=".16" stroke="none"/>${marks}</svg>`,
  )}`;
const WASH = 'fill="#888" fill-opacity=".3" stroke="none"';
/** A gauge's styles: each its word and what its tile draws on the round. */
const GAUGE_STYLES = [
  [
    'arc',
    'room-editor.gauge_arc',
    '<circle cx="22" cy="22" r="20.5" stroke-opacity=".3"/><path d="M22 1.5A20.5 20.5 0 1 1 2.5 28.3"/>',
  ],
  [
    'zero',
    'room-editor.gauge_zero_arc',
    '<path d="M7.5 36.5A20.5 20.5 0 1 1 36.5 36.5" stroke-opacity=".3"/><path d="M22 1.5A20.5 20.5 0 0 1 36.5 7.5M22 0v7"/>',
  ],
  [
    'sector',
    'room-editor.gauge_sector',
    `<path d="M22 22V0A22 22 0 0 1 42.9 28.8z" ${WASH}/><path d="M22 1.5A20.5 20.5 0 0 1 41.5 28.3"/>`,
  ],
  [
    'fill',
    'room-editor.gauge_fill',
    `<path d="M.4 26.4h43.2A22 22 0 0 1 .4 26.4z" ${WASH}/><path d="M42 26.4A20.5 20.5 0 0 1 2 26.4"/>`,
  ],
] as const;
/** A round's gauge: none, or one of its styles, each a tile with its drawing (Home Assistant's boxes, Fluvy's tiles). */
const gaugeField: HaFormSchemaItem = {
  name: 'gauge',
  selector: {
    select: {
      mode: 'box',
      options: ([['', 'option.none', ''], ...GAUGE_STYLES] as const).map(
        ([value, word, marks]) => ({
          value,
          label: editorWord(word),
          image: drawing(marks),
        }),
      ),
    },
  },
};
/** Whether a round names a gauge: what its range, its attribute, its decimals and its thresholds act on. */
const gauged = ({ gauge }: Readonly<Record<string, unknown>>): boolean =>
  typeof gauge === 'string' && gauge !== '';
/**
 * A gauge's own: its range (each end a figure, an entity or a template), an attribute read in its state's place and
 * its reading's decimals, and its thresholds.
 */
const GAUGE_OWN: readonly HaFormSchemaItem[] = [
  fieldRow(figureField('min'), figureField('max')),
  fieldRow(textField('attribute'), numberField('decimals', 0, 3)),
  thresholdsField(),
];
/** The words of a gauge's fields that are the rounds' own. */
export const GAUGE_LABELS = { attribute: 'room-editor.attribute' } as const;
/**
 * A gauge's fields where a round is edited in a list inside its item's form (a room's rounds, a thermostat's): its
 * style from a dropdown, its range, its attribute and its decimals; its thresholds are YAML's there.
 */
export const gaugeFlatFields = (): HaFormSchemaItem[] => [
  choiceField(
    'gauge',
    GAUGE_STYLES.map(([value, word]) => [value, word] as const),
  ),
  figureField('min'),
  figureField('max'),
  textField('attribute'),
  numberField('decimals', 0, 3),
];
/** A round's own colour and its state (empty: its card's say). */
const ROUND_LOOK: readonly HaFormSchemaItem[] = [
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  itemToggleField('show_state'),
];
/** Its actions: a round turns on and off what switches, else opens. */
const ROUND_ACTIONS = actionFields({ tap: null });
/** An entity's round: the entity first, then its own name and icon, its look, its gauge and its actions. */
const ROUND_HEAD: readonly HaFormSchemaItem[] = [
  entityField(undefined, 'entity', false),
  nameIconFields(),
  ...ROUND_LOOK,
  gaugeField,
];
/** …with what a gauge takes once one is chosen, and without. */
const ROUND_ITEM: readonly HaFormSchemaItem[] = [...ROUND_HEAD, ...GAUGE_OWN, ROUND_ACTIONS];
const ROUND_PLAIN: readonly HaFormSchemaItem[] = [...ROUND_HEAD, ROUND_ACTIONS];
/** A room's round, of a set or of an entity: what it stands for first, a set's own name and icon; a set has no gauge. */
const GROUP_ITEM: readonly HaFormSchemaItem[] = [
  groupField,
  fieldRow(textField('name'), iconField()),
  ...ROUND_LOOK,
  ROUND_ACTIONS,
];
const ENTITY_ITEM: readonly HaFormSchemaItem[] = [groupField, ...ROUND_ITEM];
const ENTITY_PLAIN: readonly HaFormSchemaItem[] = [groupField, ...ROUND_PLAIN];
/** What a round may carry, as `RoundSpec` declares it (a set's word beside them where it stands for a room's). */
const ROUND_KEYS: readonly string[] = [
  'entity',
  'name',
  'icon',
  'tone',
  'color',
  'show_state',
  'gauge',
  'min',
  'max',
  'attribute',
  'decimals',
  'thresholds',
  'tap_action',
  'hold_action',
  'double_tap_action',
];
const roundLabel = (schema: HaFormSchemaItem): string | undefined =>
  schema.name === 'group'
    ? editorWord('room-editor.group')
    : schema.name === 'show_state'
      ? editorWord('room-editor.show_state')
      : schema.name === 'attribute'
        ? editorWord(GAUGE_LABELS.attribute)
        : undefined;
/** Under a gauge once one is chosen: the range it needs. */
const roundHelper: NonNullable<RowsListSpec['computeHelper']> = (schema, _localize, item) =>
  schema.name === 'gauge' && item && gauged(item)
    ? editorWord('room-editor.gauge_help')
    : undefined;

/**
 * A list of rounds, one item form on every card that draws them (#224): an entity's round, its id and its own name,
 * icon, colour, state and actions; or, where the rounds stand for a room's sets (`sets`), one of them by its word as
 * well — a set alone written as its word, an entity alone as its id, an entity's kind never beside it.
 */
export const roundsList = (
  key: string,
  title: MessageKey,
  when: RowsListSpec['when'],
  sets = false,
): RowsListSpec =>
  sets
    ? {
        key,
        idKey: 'group',
        also: ['entity'],
        title,
        keys: ['group', ...ROUND_KEYS],
        picker: groupField,
        computeLabel: roundLabel,
        computeHelper: roundHelper,
        read: (raw) => roundEntry(raw) as Record<string, unknown> | null,
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
        schemaOf: (item) =>
          item['group'] !== 'entity' ? GROUP_ITEM : gauged(item) ? ENTITY_ITEM : ENTITY_PLAIN,
        when,
      }
    : {
        key,
        title,
        keys: ROUND_KEYS,
        schema: ROUND_ITEM,
        schemaOf: (item) => (gauged(item) ? ROUND_ITEM : ROUND_PLAIN),
        computeLabel: roundLabel,
        computeHelper: roundHelper,
        when,
      };

/**
 * A list of rounds inside an item's form (1.23, #230: a thermostat's own, after the one that opens it): Home
 * Assistant's list of objects, each an entity's round with its own name, icon, colour and actions, added and edited in
 * its dialog and dragged into order. The rows editor hands it items and writes them back as the card reads them, an
 * entity alone as its id.
 */
export const roundsField = (name = 'rounds'): HaFormSchemaItem => {
  const { computeLabel } = formLabels(GAUGE_LABELS);
  const fields = [
    entityField(undefined, 'entity'),
    textField('name'),
    iconField(),
    toneField(),
    accentField('color'),
    ...gaugeFlatFields(),
    actionField('tap_action'),
    actionField('hold_action'),
  ];
  return {
    name,
    selector: {
      object: {
        multiple: true,
        label_field: 'entity',
        description_field: 'name',
        fields: Object.fromEntries(
          fields.map((field) => [
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
  roundsList('quick_actions', 'room-editor.quick_actions', drawsQuick, true),
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
    line_readouts: 'first',
    readouts_layout: 'line',
    show_count: true,
    show_climate: true,
    readout_style: 'row',
    readout_labels: 'auto',
    show_quick_actions: true,
    show_quick_states: false,
    quick_state_position: 'under',
    show_arrow: true,
    show_action: false,
    quick_actions: defaultGroups({ hass, devices, lights }),
    lights,
    lamp_switches: false,
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
      // what the quick actions say of their state, and where (#205)
      ...quickStateFields(drawsQuick),
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
      // …or, where it lists none, the room's lamps on plugs among them by their names (#219)
      onlyWhen((form) => (drawsRows(form) || drawsQuick(form)) && !listed(form, 'lights').length, {
        ...boolField('lamp_switches'),
        helper: 'editor.lamp_switches_help',
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
      // its tiles' readouts: at a tile's end, and on its line the first, or every one, where a tile has two or more
      fieldRow(
        onlyWhen(
          (form) => drawsTiles(form) && endsReadouts('compact', mostReadouts(form, 'tiles')),
          readoutsLayoutField(),
        ),
        onlyWhen(
          (form) =>
            drawsTiles(form) &&
            joinsReadouts('compact', mostReadouts(form, 'tiles'), form['readouts_layout']),
          lineReadoutsField(),
        ),
      ),
      onlyWhen(drawsLights, lightColourFields()),
      // where the room opens, where none is chosen
      actionFields({ icon: true, tap: null }),
    ],
    ...formLabels({
      temperature_entity: 'editor.temperature_entity',
      humidity_entity: 'editor.humidity_entity',
      show_quick_actions: 'room-editor.show_quick_actions',
      show_quick_states: 'room-editor.show_quick_states',
      quick_state_position: 'room-editor.quick_state_position',
      show_arrow: 'room-editor.show_arrow',
      name_position: 'room-editor.name_position',
      readout_style: 'room-editor.readout_style',
      readout_labels: 'room-editor.readout_labels',
      quick_actions: 'room-editor.quick_actions',
      lights: 'room.lights',
      lamp_switches: 'editor.lamp_switches',
      include: 'room-editor.include',
      exclude: 'room-editor.exclude',
    }),
  };
}
