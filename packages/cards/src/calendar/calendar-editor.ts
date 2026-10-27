import { strings, type LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  numberField,
  selectField,
  showIconField,
  textField,
  toneField,
} from '../shared/form.js';
import { VIEWS, type CalendarCardConfig } from './config.js';
import { WEEKDAYS } from '../shared/dates.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';

/** The calendar card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('calendar');

const EDITOR_LABELS = {
  tile: 'editor_tile',
  first_weekday: 'editor_first_weekday',
  start_hour: 'editor_start_hour',
  end_hour: 'editor_end_hour',
} as const;

/* ---------- Lovelace ---------- */

/** A calendar card has no entity of its own: its calendars are its list, its colour the accent (today, the selection). */
export const base: readonly BaseKey[] = ['entities', 'color', 'card_color', 'show_icon'];

export const keys = configKeys<CalendarCardConfig>()([
  'calendars',
  'variant',
  'tile',
  'title',
  'first_weekday',
  'days',
  'start_hour',
  'end_hour',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'calendars',
    alias: 'entities',
    title: 'editor.rows',
    domains: ['calendar'],
    keys: ['entity', 'name', 'tone', 'color'],
    schema: [entityField(['calendar']), textField('name'), fieldRow(toneField(), accentField())],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'agenda',
  tile: 'date',
  first_weekday: 'language',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', ['calendar'], true),
      fieldRow(selectField('variant', VIEWS), textField('title')),
      showIconField(),
      fieldRow(
        selectField('tile', ['date', 'next']),
        selectField('first_weekday', ['language', ...WEEKDAYS]),
      ),
      fieldRow(numberField('days', 1, 31), numberField('start_hour', 0, 23)),
      fieldRow(
        numberField('end_hour', 1, 24),
        accentField(),
        accentField('card_color', { none: true }),
      ),
    ],
    ...editorLabels(s, EDITOR_LABELS, { days: 'editor.days' }),
  };
}
