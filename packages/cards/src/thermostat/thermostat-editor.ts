import {
  resolveEntity,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorWord,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  onlyWhen,
  orderedField,
  ownTextField,
  sectionField,
  selectField,
  showIconField,
  textField,
  whenOffField,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { batteryLevel, valveOf, windowBy } from './readings.js';
import {
  defaultModes,
  MODE_ORDER,
  modeLabel,
  modeOrder,
  type ThermostatCardConfig,
} from './thermostat-card.js';

/** The thermostat card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

export const base = HEAD_BASE;

/** A sensor a picker may show: what was found, where it is an entity of its own and no climate's attribute. */
const picked = (entity: string | undefined): string | undefined =>
  entity && !entity.startsWith('climate.') ? entity : undefined;

/**
 * What the editor shows where the config says nothing; the modes as the card draws them, in its order, and in the
 * pickers of what it is asked to read (the valve, the window, the battery) the sensor it found for each.
 */
export const defaults: EditorDefaults = (config, hass) => {
  const entity = config['entity'];
  const view = resolveEntity(hass, typeof entity === 'string' ? entity : undefined);
  const modes = defaultModes(view.domain === 'climate', modeOrder(view));
  const ask: ThermostatCardConfig = config;
  const found = {
    valve_entity: picked(valveOf(hass, view, ask)?.entity),
    window_entity: picked(windowBy(hass, view, ask)?.entity),
    battery_entity: picked(batteryLevel(hass, view, ask)?.entity),
  };
  return {
    variant: 'dial',
    show_stepper: true,
    show_current: true,
    show_modes: true,
    modes_style: 'tiles',
    preset_style: 'full',
    fan_style: 'full',
    show_presets: true,
    show_fan: true,
    when_off: 'all',
    show_state: true,
    show_valve: false,
    show_window: false,
    show_battery: false,
    ...(modes.length ? { modes } : {}),
    ...Object.fromEntries(Object.entries(found).filter(([, id]) => id)),
  };
};

/** The modes the editor offers are the entity's own, worded as the card words them. */
export const choices: EditorChoices = (config, hass) => {
  const entity = config['entity'];
  const view = resolveEntity(hass, typeof entity === 'string' ? entity : undefined);
  const modes = modeOrder(view);
  return modes.length
    ? { modes: modes.map((value) => ({ value, label: modeLabel(hass, view, value) })) }
    : {};
};

export const keys = configKeys<ThermostatCardConfig>()([
  'subtitle',
  'image',
  'show_presets',
  'show_fan',
  'variant',
  'show_stepper',
  'show_current',
  'show_modes',
  'modes',
  'modes_style',
  'preset_style',
  'fan_style',
  'when_off',
  'show_state',
  'state_entity',
  'show_valve',
  'valve_entity',
  'valve_attribute',
  'show_window',
  'window_entity',
  'show_battery',
  'battery_entity',
  'humidity_entity',
]);

type Data = Readonly<Record<string, unknown>>;

/** The card says what the thermostat is doing: what the word's own options act on. */
const said = (data: Data): boolean => data['show_state'] !== false;
/** …and it is a climate: a valve and a window are a radiator's, the room's humidity a room's. */
const climate = (data: Data): boolean => String(data['entity']).startsWith('climate.');

/** A sensor's picker that shows what was found where none is named, the word under it saying so. */
const foundField = (name: string, ...domains: string[]): HaFormSchemaItem => ({
  ...entityField(domains, name, false),
  helper: 'editor.found_helper',
});

/**
 * What the thermostat is doing (#185), folded: the word's switch; then what may be said with it, each off until
 * asked — the action from another entity, the valve's opening and an open window (a climate's), a low battery and the
 * room's humidity from another sensor. A sensor left empty is found, and its picker shows which.
 */
const doingFields = (): HaFormSchemaItem =>
  sectionField('editor.doing', [
    boolField('show_state'),
    onlyWhen(said, {
      ...entityField(['sensor', 'binary_sensor', 'switch', 'input_boolean'], 'state_entity', false),
      helper: 'editor.state_entity_helper',
    }),
    onlyWhen(
      (data) => said(data) && climate(data),
      fieldRow(boolField('show_valve'), foundField('valve_entity', 'sensor', 'number')),
    ),
    // an attribute of the climate's own, where no sensor is named
    onlyWhen(
      (data) => said(data) && climate(data) && !data['valve_entity'],
      textField('valve_attribute'),
    ),
    onlyWhen(
      (data) => said(data) && climate(data),
      fieldRow(boolField('show_window'), foundField('window_entity', 'binary_sensor')),
    ),
    fieldRow(boolField('show_battery'), foundField('battery_entity', 'sensor')),
    onlyWhen(climate, {
      name: 'humidity_entity',
      selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } },
    }),
  ]);

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['climate', 'water_heater', 'humidifier']),
      nameIconFields(),
      // the person's own picture in the circle's place: an address, or an entity whose picture it is
      textField('image'),
      fieldRow(ownTextField('subtitle'), showIconField()),
      fieldRow(selectField('variant', ['dial', 'compact', 'ruler']), boolField('show_stepper')),
      fieldRow(boolField('show_modes'), selectField('modes_style', ['tiles', 'chips', 'full'])),
      // a climate's seven until the entity is known: then its own (`choices`), dragged into the order they show in
      orderedField(
        'modes',
        MODE_ORDER.map((value) => ({
          value,
          label: editorWord(`climate.mode.${value}` as MessageKey),
        })),
      ),
      boolField('show_current'),
      fieldRow(boolField('show_presets'), selectField('preset_style', ['full', 'chips'])),
      fieldRow(boolField('show_fan'), selectField('fan_style', ['full', 'chips'])),
      whenOffField(),
      doingFields(),
      ...colourFields(),
      actionFields({ icon: true }),
    ],
    ...formLabels({
      modes: 'editor.modes',
      modes_style: 'editor.modes_style',
      show_presets: 'climate.preset',
      preset_style: 'editor.preset_style',
      show_fan: 'climate.fan',
      fan_style: 'editor.fan_style',
      show_battery: 'editor.show_low_battery',
      battery_entity: 'vacuum.battery',
    }),
  };
}
