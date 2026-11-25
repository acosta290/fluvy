import type { LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE, SLIDER_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  notCompact,
  ownTextField,
  rowsFields,
  rowsList,
  selectField,
  headFields,
  sliderFields,
  stateLabels,
  stateTintFields,
  whenOffField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import { STATE_TINT_KEYS } from '../shared/state-tint.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import type { FanCardConfig } from './fan-card.js';

/** The fan card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

export const base = [...HEAD_BASE, ...SLIDER_BASE];

/** A fan's states, as Home Assistant writes them: what the editor offers a colour for. */
const STATES = ['on', 'off'];

export const keys = configKeys<FanCardConfig>()([
  'subtitle',
  'variant',
  'show_stepper',
  'show_presets',
  'preset_style',
  'show_oscillation',
  'show_direction',
  'when_off',
  ...STATE_TINT_KEYS,
  'rows',
  'show_rows',
]);

/** The rows it lists under its presets (#262), on every card but the compact one. */
export const lists: readonly RowsListSpec[] = [rowsList(notCompact)];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  show_stepper: true,
  preset_style: 'full',
  show_presets: true,
  show_oscillation: true,
  show_direction: true,
  when_off: 'all',
  show_rows: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['fan']),
      nameIconFields(),
      headFields(),
      fieldRow(ownTextField('subtitle'), selectField('variant', ['full', 'compact'])),
      boolField('show_stepper'),
      fieldRow(boolField('show_presets'), selectField('preset_style', ['full', 'chips'])),
      fieldRow(boolField('show_oscillation'), boolField('show_direction')),
      whenOffField(),
      ...rowsFields(notCompact),
      ...sliderFields(),
      ...colourFields(),
      ...stateTintFields(STATES),
      actionFields({ icon: true }),
    ],
    ...stateLabels(formLabels({ show_presets: 'fan.preset' }), STATES, 'fan'),
  };
}
