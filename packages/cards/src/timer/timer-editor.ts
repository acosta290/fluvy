import { strings, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  nameIconFields,
  showIconField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import type { TimerCardConfig } from './timer-card.js';

/** The timer card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('timer');

export const base = HEAD_BASE;

export const keys = configKeys<TimerCardConfig>()(['show_gauge', 'show_actions']);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({ show_gauge: true, show_actions: true });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['timer']),
      nameIconFields(),
      showIconField(),
      ...colourFields(),
      fieldRow(boolField('show_gauge'), boolField('show_actions')),
      actionFields(),
    ],
    ...editorLabels(s, { show_gauge: 'elapsed' }, {}),
  };
}
