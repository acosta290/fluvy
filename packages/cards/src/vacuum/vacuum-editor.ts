// the drive pad's words first: its fields say them
import './english.js';
import {
  strings,
  type HaFormSchemaItem,
  type HomeAssistant,
  type KeyOf,
  type LovelaceConfigForm,
} from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  entityField,
  fieldRow,
  nameIconFields,
  onlyWhen,
  ownTextField,
  sectionField,
  selectField,
  showIconField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { DRIVE_SPEEDS, DRIVE_STYLES, driveProfile } from './drive.js';
import type { VacuumCardConfig } from './vacuum-card.js';

/** The vacuum card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const vacuumStrings = strings('vacuum');
const driveStrings = strings('drive');

type Data = Readonly<Record<string, unknown>>;

/** The robot can be driven by hand: its integration, or the config's own calls, says how (`driveProfile`). */
const drivable = (data: Data, hass?: HomeAssistant): boolean =>
  driveProfile(hass, data) !== undefined;
/** The Drive command is drawn: what the pad's own options act on. */
const driven = (data: Data, hass?: HomeAssistant): boolean =>
  data['show_drive'] === true && drivable(data, hass);

export const base = HEAD_BASE;

export const keys = configKeys<VacuumCardConfig>()([
  'subtitle',
  'variant',
  'show_battery',
  'area_entity',
  'duration_entity',
  'remaining_entity',
  'battery_entity',
  'suction_style',
  'show_drive',
  'drive_speed',
  'drive_style',
  'drive_entity',
  'drive',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  suction_style: 'full',
  show_battery: true,
  show_drive: false,
  drive_speed: 'normal',
  drive_style: 'card',
});

/** What says a field's use under it: the drive pad's two that need it. */
const HELPERS: Readonly<Partial<Record<string, KeyOf<'drive'>>>> = {
  drive_entity: 'editor.drive_entity_helper',
  drive: 'editor.drive_helper',
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

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['vacuum', 'lawn_mower']),
      nameIconFields(),
      showIconField(),
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
      driveFields(),
      ...colourFields(),
      actionFields({ icon: true }),
    ],
    ...editorLabels(
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
      },
    ),
    computeHelper: (schema) => {
      const key = HELPERS[schema.name];
      return key ? driveStrings(editorLanguage(), key) : undefined;
    },
  };
}
