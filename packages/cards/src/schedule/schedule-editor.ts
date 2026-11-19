import { strings, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE, type BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import { WEEKDAYS } from '../shared/dates.js';
import {
  accentField,
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  headFields,
  iconField,
  nameIconFields,
  onlyWhen,
  selectField,
  textField,
  toneField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { SCHEDULE_VARIANTS, type ScheduleCardConfig } from './schedule-card.js';

/** The Heating schedule card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('schedule');

/** A card of one thermostat with a head: its circle, its name's lines and its actions. */
export const base: readonly BaseKey[] = HEAD_BASE;

export const keys = configKeys<ScheduleCardConfig>()([
  'schedule',
  'variant',
  'show_head',
  'show_presets',
  'show_switch',
  'first_weekday',
  'presets',
]);

/** A preset's own name, icon, tone and colour on the card, by its key (the automation keeps the presets themselves). */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'presets',
    title: 'schedule.editor.presets',
    idKey: 'preset',
    keys: ['preset', 'name', 'icon', 'tone', 'color'],
    schema: [
      { ...textField('preset'), required: true, helper: 'schedule.editor.preset_helper' },
      fieldRow(textField('name'), iconField()),
      fieldRow(toneField(), accentField('color', { item: 'own' })),
    ],
    computeLabel: editorLabels(s, { preset: 'editor.preset' }).computeLabel,
  },
];

/** What the card does where the config says nothing. */
export const defaults: EditorDefaults = () => ({
  variant: 'week',
  show_head: true,
  show_presets: true,
  show_switch: true,
  first_weekday: 'language',
});

type Data = Readonly<Record<string, unknown>>;

/** The row: a line of its own, its circle and its switch; no head, no week's lines, no legend. */
const row = (data: Data): boolean => data['variant'] === 'row';

/** The week or today's line: what a head and a legend go with. */
const lined = (data: Data): boolean => !row(data);

/** The head shows: what its own options act on. */
const headed = (data: Data): boolean => lined(data) && data['show_head'] !== false;

/** The switch is drawn: in the head, or at the row's end. */
const switched = (data: Data): boolean => row(data) || headed(data);

export function getConfigForm(): LovelaceConfigForm {
  const schema: HaFormSchemaItem[] = [
    entityField(['climate']),
    { ...entityField(['schedule'], 'schedule', false), helper: 'schedule.editor.schedule_helper' },
    nameIconFields(),
    fieldRow(
      selectField('variant', SCHEDULE_VARIANTS),
      selectField('first_weekday', ['language', ...WEEKDAYS]),
    ),
    onlyWhen(lined, fieldRow(boolField('show_head'), boolField('show_presets'))),
    onlyWhen(switched, fieldRow(boolField('show_switch'))),
    // a row's circle gives way by its own rule, its name on one line
    onlyWhen(headed, headFields()),
    ...colourFields(),
    actionFields({ icon: true, tap: null }),
  ];
  return {
    schema,
    ...editorLabels(s, {
      schedule: 'editor.schedule',
      show_head: 'editor.show_head',
      show_presets: 'editor.show_presets',
      first_weekday: 'editor.first_weekday',
    }),
  };
}
