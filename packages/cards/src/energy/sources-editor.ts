import type { HaFormSchemaItem, KeyOf } from '@fluvy/core';
import { SOURCE_KINDS } from '../energy-model/sources.js';
import { boolField, editorWord, entityField, fieldRow } from '../shared/form.js';

/**
 * The editor's pieces for a source, in the flow's words, for the cards that read sources the flow's way: its kind
 * (the add picker of a `sources` list, and the list's first field) and how its power is read — one signed sensor,
 * one per phase, or two (in and out) — and which way the sensor counts.
 */

/** A source's kind, chosen from the kinds by their words. */
export const kindField = (): HaFormSchemaItem => ({
  name: 'type',
  selector: {
    select: {
      mode: 'dropdown',
      options: SOURCE_KINDS.map((value) => ({
        value,
        label: editorWord(`energy-flow.kind_${value}`),
      })),
    },
  },
});

/** How a source's power is read. */
export const measureFields = (): HaFormSchemaItem[] => [
  entityField(['sensor'], 'power', false),
  { name: 'phases', selector: { entity: { domain: ['sensor'], multiple: true } } },
  fieldRow(entityField(['sensor'], 'import', false), entityField(['sensor'], 'export', false)),
  boolField('invert'),
];

/** The measure's fields' words (the flow's), for `editorLabels(strings('energy-flow'), …)`. */
export const MEASURE_WORDS = {
  type: 'editor_type',
  power: 'editor_power',
  phases: 'editor_phases',
  import: 'editor_import',
  export: 'editor_export',
  invert: 'editor_invert',
  threshold: 'editor_threshold',
} as const satisfies Readonly<Record<string, KeyOf<'energy-flow'>>>;

/** A `power: [a, b, c]` list is a grid read per phase (the flow reads it so). */
export const PHASES_ALIAS = { from: 'power', to: 'phases', when: Array.isArray } as const;
