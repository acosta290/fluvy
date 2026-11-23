import {
  isEntityId,
  strings,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionField,
  actionFields,
  boolField,
  choiceField,
  colourFields,
  doubleTapField,
  editorLabels,
  editorWord,
  entityField,
  fieldRow,
  headFields,
  iconField,
  listed,
  nameIconFields,
  numberField,
  onlyWhen,
  optionalActions,
  ownTextField,
  selectField,
  textField,
  unitChoices,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { roundsList } from '../room/room-editor.js';
import { VEHICLE_VARIANTS } from '../vehicle-family.js';
import { VEHICLE_PLATFORMS, VEHICLE_ROLES, type VehicleRole } from './roles.js';
import {
  controlWord,
  STALE_AFTER,
  VEHICLE_CONTROLS,
  VEHICLE_ROWS,
  type VehicleCardConfig,
} from './vehicle-card.js';

/** The Vehicle card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('vehicle');

/** The picker's word for a control of the person's own: the item is then its entity's. */
const OWN = 'entity';

/** A unit a figure reads in: automatic (the sensor's own), or one of `units`. */
const unitField = (name: string, units: readonly string[]): HaFormSchemaItem => ({
  name,
  selector: { select: { mode: 'dropdown', options: unitChoices(units) } },
});

/** The editor's choices of a list's key, each by its word. */
const keyPicker = <K extends string>(
  name: string,
  keys: readonly K[],
  word: (key: K) => MessageKey,
): HaFormSchemaItem => ({
  name,
  selector: {
    select: {
      mode: 'dropdown',
      options: keys.map((value) => ({ value, label: editorWord(word(value)) })),
    },
  },
});
/** A control the list adds: one of the car's, by its word, or an entity of the person's own (#248). */
const controlPicker = (): HaFormSchemaItem =>
  keyPicker('control', [...VEHICLE_CONTROLS, OWN] as const, (key) =>
    key === OWN ? 'editor.entity' : controlWord(key),
  );
const rowPicker = (): HaFormSchemaItem =>
  keyPicker('row', VEHICLE_ROWS, (key): MessageKey => `vehicle.${key}`);
/** A role's word in the editor: its control's or its row's where it has one, else its own. */
const ROLE_WORDS: Readonly<Record<VehicleRole, MessageKey>> = {
  battery: 'vehicle.battery',
  range: 'vehicle.range',
  charging: 'vehicle.role.charging',
  plugged: 'vehicle.role.plugged',
  charge_power: 'vehicle.charge_power',
  charge_rate: 'vehicle.charge_rate',
  time_to_full: 'vehicle.time_to_full',
  charge_limit: 'vehicle.charge_limit',
  charge_switch: 'vehicle.role.charge_switch',
  charge_start: 'vehicle.role.charge_start',
  charge_stop: 'vehicle.role.charge_stop',
  charge_port: 'vehicle.charge_port',
  climate: 'vehicle.climate',
  climate_switch: 'vehicle.role.climate_switch',
  climate_start: 'vehicle.role.climate_start',
  climate_stop: 'vehicle.role.climate_stop',
  climate_running: 'vehicle.role.climate_running',
  inside: 'vehicle.inside',
  outside: 'vehicle.outside',
  lock: 'lock.lock',
  trunk: 'vehicle.trunk',
  frunk: 'vehicle.frunk',
  windows: 'vehicle.windows',
  engine: 'vehicle.engine',
  sentry: 'vehicle.sentry',
  odometer: 'vehicle.odometer',
  location: 'vehicle.location',
  address: 'vehicle.role.address',
  software: 'vehicle.software',
  state: 'vehicle.role.state',
  shift: 'vehicle.role.shift',
  speed: 'vehicle.speed',
  moving: 'vehicle.role.moving',
  updated: 'vehicle.role.updated',
  fuel: 'vehicle.fuel',
  fuel_range: 'vehicle.fuel_range',
  fuel_volume: 'vehicle.fuel_volume',
  fuel_low: 'vehicle.role.fuel_low',
  adblue: 'vehicle.adblue',
  oil: 'vehicle.oil',
  service: 'vehicle.service',
  service_time: 'vehicle.role.service_time',
  tyre_fl: 'vehicle.tyre_fl',
  tyre_fr: 'vehicle.tyre_fr',
  tyre_rl: 'vehicle.tyre_rl',
  tyre_rr: 'vehicle.tyre_rr',
};
const rolePicker = (): HaFormSchemaItem =>
  keyPicker('role', VEHICLE_ROLES, (role) => ROLE_WORDS[role]);

/** A control's colour, whether its tap asks first, and its actions: the car's do what they do where they name no tap. */
const CONTROL_OWN: readonly HaFormSchemaItem[] = [
  fieldRow(accentField('color', { item: 'card' }), boolField('confirm')),
  actionFields({ tap: null }),
];
/** One of the car's controls: which, and its own name and icon. */
const CAR_CONTROL: readonly HaFormSchemaItem[] = [
  controlPicker(),
  fieldRow(textField('name'), iconField()),
  ...CONTROL_OWN,
];
/** An entity of the person's own among them: the entity, then its own name and icon (Home Assistant's by default). */
const OWN_CONTROL: readonly HaFormSchemaItem[] = [
  controlPicker(),
  entityField(undefined, 'entity', false),
  nameIconFields(),
  ...CONTROL_OWN,
];

/** A car has no entity of its own to show: its device does; `entity` names one of its entities instead. */
export const base: readonly BaseKey[] = [
  'entity',
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
  'name_lines',
  'show_badge',
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<VehicleCardConfig>()([
  'device',
  'variant',
  'scan',
  'roles',
  'energy',
  'tank_size',
  'hero',
  'badge',
  'image',
  'image_position',
  'image_size',
  'show_head',
  'show_hero',
  'show_range',
  'show_limit',
  'show_status',
  'show_controls',
  'controls',
  'show_rows',
  'rows',
  'show_tyres',
  'tyre_decimals',
  'tyre_low',
  'quick_actions',
  'show_quick_states',
  'quick_state_position',
  'low_range',
  'stale_after',
  'range_unit',
  'range_decimals',
  'power_unit',
  'power_decimals',
  'hero_tap_action',
  'hero_hold_action',
  'hero_double_tap_action',
]);

/** What the card draws but for its strip: its line, its controls and its quick actions (the form's data). */
const notMini = (data: Readonly<Record<string, unknown>>): boolean => data['variant'] !== 'mini';
/** …its quick actions' states (#251): every one's, or one's of its own. */
const saysStates = (data: Readonly<Record<string, unknown>>): boolean =>
  notMini(data) &&
  listed(data, 'quick_actions').length > 0 &&
  (data['show_quick_states'] === true ||
    listed(data, 'quick_actions').some(
      (item) => (item as { show_state?: unknown } | null)?.show_state === true,
    ));

export const lists: readonly RowsListSpec[] = [
  {
    key: 'controls',
    idKey: 'control',
    also: ['entity'],
    title: 'editor.controls',
    keys: [
      'control',
      'entity',
      'name',
      'icon',
      'color',
      'confirm',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    computeLabel: (schema) =>
      schema.name === 'control'
        ? editorWord('vehicle.editor.control')
        : schema.name === 'confirm'
          ? editorWord('vehicle.editor.confirm')
          : undefined,
    picker: controlPicker(),
    // an entity of the person's own is the picker's own word in the editor, and goes back as its entity (its id alone
    // in the config, a bare word or id read as one)
    read: (raw) => {
      const entry =
        typeof raw === 'string' ? (isEntityId(raw) ? { entity: raw } : { control: raw }) : raw;
      if (typeof entry !== 'object' || entry === null) return null;
      const item = entry as Readonly<Record<string, unknown>>;
      return item['control'] === undefined ? { control: OWN, ...item } : item;
    },
    write: ({ control, ...own }) => {
      const kept = Object.fromEntries(
        Object.entries(own).filter(([, value]) => value !== undefined && value !== ''),
      );
      if (control !== OWN) return { control, ...kept };
      return typeof kept['entity'] === 'string' ? kept : { control };
    },
    when: (data) => data['show_controls'] !== false && data['variant'] !== 'mini',
    schema: OWN_CONTROL,
    schemaOf: (item) => (item['control'] === OWN ? OWN_CONTROL : CAR_CONTROL),
  },
  {
    key: 'rows',
    idKey: 'row',
    also: ['entity'],
    title: 'editor.rows',
    keys: [
      'row',
      'entity',
      'name',
      'icon',
      'color',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    computeLabel: (schema) => (schema.name === 'row' ? editorWord('editor.row') : undefined),
    picker: rowPicker(),
    when: (data) => data['show_rows'] !== false && (data['variant'] ?? 'full') === 'full',
    schema: [
      rowPicker(),
      entityField(undefined, 'entity', false),
      nameIconFields(),
      accentField('color', { item: 'card' }),
      actionFields({ hold: 'none' }),
    ],
  },
  roundsList('quick_actions', 'room-editor.quick_actions', notMini),
  {
    key: 'roles',
    idKey: 'role',
    title: 'vehicle.editor.roles',
    keys: ['role', 'entity'],
    computeLabel: (schema) =>
      schema.name === 'role' ? editorWord('vehicle.editor.role') : undefined,
    picker: rolePicker(),
    schema: [rolePicker(), entityField(undefined, 'entity')],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  scan: true,
  energy: 'auto',
  hero: 'ruler',
  image_position: 'hero',
  show_head: true,
  show_hero: true,
  show_range: true,
  show_limit: true,
  show_status: true,
  show_controls: true,
  show_rows: true,
  show_tyres: false,
  tyre_decimals: 'auto',
  show_quick_states: false,
  quick_state_position: 'under',
  stale_after: STALE_AFTER,
  range_unit: 'auto',
  range_decimals: 'auto',
  power_unit: 'auto',
  power_decimals: 'auto',
});

export function getConfigForm(): LovelaceConfigForm {
  const full = (data: Readonly<Record<string, unknown>>): boolean =>
    (data['variant'] ?? 'full') === 'full';
  const hasImage = (data: Readonly<Record<string, unknown>>): boolean =>
    typeof data['image'] === 'string' && data['image'].trim() !== '';
  // a tank's size where one may be drawn; a charge limit where a battery may be; a ring where one gauge is
  const tanked = (data: Readonly<Record<string, unknown>>): boolean =>
    data['energy'] !== 'electric';
  const charged = (data: Readonly<Record<string, unknown>>): boolean => data['energy'] !== 'fuel';
  const tyred = (data: Readonly<Record<string, unknown>>): boolean =>
    full(data) && data['show_tyres'] === true;
  // the picture over the battery; the battery (or the tank) shown
  const pictured = (data: Readonly<Record<string, unknown>>): boolean =>
    full(data) && hasImage(data) && data['image_position'] !== 'head';
  const heroed = (data: Readonly<Record<string, unknown>>): boolean =>
    notMini(data) && data['show_hero'] !== false;
  const decimals = ['auto', '0', '1', '2'] as const;
  return {
    schema: [
      {
        name: 'device',
        selector: {
          device: { filter: VEHICLE_PLATFORMS.map((integration) => ({ integration })) },
        },
      },
      entityField(undefined, 'entity', false),
      boolField('scan'),
      nameIconFields(),
      headFields({ badge: true }),
      ownTextField('badge'),
      selectField('variant', VEHICLE_VARIANTS),
      fieldRow(
        choiceField('energy', [
          ['auto', 'option.auto'],
          ['electric', 'vehicle.editor.electric'],
          ['fuel', 'vehicle.fuel'],
          ['hybrid', 'vehicle.editor.hybrid'],
        ]),
        onlyWhen(tanked, numberField('tank_size', 0, 500)),
      ),
      onlyWhen(
        (data) => full(data) && data['energy'] !== 'hybrid' && data['show_hero'] !== false,
        selectField('hero', ['ruler', 'ring']),
      ),
      onlyWhen(notMini, textField('image')),
      onlyWhen(
        (data) => full(data) && hasImage(data),
        choiceField('image_position', [
          ['hero', 'vehicle.editor.image_hero'],
          ['head', 'vehicle.editor.image_head'],
        ]),
      ),
      // the picture over the battery at a size of its own (#254)
      onlyWhen(pictured, textField('image_size')),
      onlyWhen(notMini, fieldRow(boolField('show_head'), boolField('show_hero'))),
      // the range where the battery or the compact card's head says it; the limit where a battery marks it
      fieldRow(
        onlyWhen(
          (data) => heroed(data) || (data['variant'] === 'compact' && data['show_head'] !== false),
          boolField('show_range'),
        ),
        onlyWhen((data) => heroed(data) && charged(data), boolField('show_limit')),
      ),
      onlyWhen(notMini, fieldRow(boolField('show_status'), boolField('show_controls'))),
      onlyWhen(full, fieldRow(boolField('show_rows'), boolField('show_tyres'))),
      // the tyres' decimals where they are drawn; a low tyre where the tyres or the line can say it
      fieldRow(
        onlyWhen(tyred, selectField('tyre_decimals', decimals)),
        onlyWhen(
          (data) => tyred(data) || (notMini(data) && data['show_status'] !== false),
          textField('tyre_low'),
        ),
      ),
      // what the quick actions say of their state, and where (#251, as a room's)
      onlyWhen((data) => notMini(data) && listed(data, 'quick_actions').length > 0, {
        ...boolField('show_quick_states'),
        helper: 'room-editor.quick_states_help',
      }),
      onlyWhen(
        saysStates,
        choiceField('quick_state_position', [
          ['under', 'room-editor.under'],
          ['beside', 'room-editor.beside'],
        ]),
      ),
      fieldRow(numberField('low_range', 0, 1000), numberField('stale_after', 0, 1440)),
      fieldRow(unitField('range_unit', ['km', 'mi']), selectField('range_decimals', decimals)),
      fieldRow(unitField('power_unit', ['W', 'kW']), selectField('power_decimals', decimals)),
      ...colourFields(),
      // the card's own: its head's, the strip's, or its picture's where the head is hidden
      onlyWhen(
        (data) => !notMini(data) || data['show_head'] !== false || pictured(data),
        actionFields({ icon: true }),
      ),
      onlyWhen(heroed, fieldRow(actionField('hero_tap_action'), actionField('hero_hold_action'))),
      onlyWhen(heroed, optionalActions(doubleTapField('hero_double_tap_action'))),
    ],
    ...editorLabels(
      s,
      {
        device: 'editor.device',
        scan: 'editor.scan',
        energy: 'editor.energy',
        tank_size: 'editor.tank_size',
        hero: 'editor.hero',
        image_position: 'editor.image_position',
        image_size: 'editor.image_size',
        show_head: 'editor.show_head',
        show_hero: 'editor.show_hero',
        show_range: 'editor.show_range',
        show_limit: 'editor.show_limit',
        show_status: 'editor.show_status',
        show_tyres: 'editor.show_tyres',
        tyre_decimals: 'editor.tyre_decimals',
        tyre_low: 'editor.tyre_low',
        low_range: 'editor.low_range',
        stale_after: 'editor.stale_after',
        range_unit: 'editor.range_unit',
        range_decimals: 'editor.range_decimals',
        power_unit: 'editor.power_unit',
        power_decimals: 'editor.power_decimals',
        hero_tap_action: 'editor.hero_tap_action',
        hero_hold_action: 'editor.hero_hold_action',
        hero_double_tap_action: 'editor.hero_double_tap_action',
      },
      {
        badge: 'gauge.badge',
        image: 'editor.picture',
        show_controls: 'editor.show_actions',
        show_rows: 'editor.show_rows',
        show_quick_states: 'room-editor.show_quick_states',
        quick_state_position: 'room-editor.quick_state_position',
      },
    ),
    computeHelper: (schema) =>
      schema.name === 'scan'
        ? s(undefined, 'editor.scan_helper')
        : schema.name === 'image'
          ? s(undefined, 'editor.image_helper')
          : schema.name === 'tank_size'
            ? s(undefined, 'editor.tank_size_helper')
            : schema.name === 'tyre_low'
              ? s(undefined, 'editor.tyre_low_helper')
              : schema.name === 'image_size'
                ? s(undefined, 'editor.image_size_helper')
                : undefined,
  };
}
