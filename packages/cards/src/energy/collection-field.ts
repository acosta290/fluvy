import { strings, type HaFormSchemaItem, type HomeAssistant } from '@fluvy/core';
import { COLLECTION_PREFIX } from '../energy-model/collection.js';
import { editorLanguage, selectField } from '../shared/form.js';
import type { FormHelper, SelectOption } from '../shared/rows-editor.js';

const p = strings('energy-period');

/**
 * The editor's hold on a date picker, one field for every energy card: `collection_key`, chosen among the
 * collections on the connection (every `_energy_*` there, as Home Assistant's date card and Fluvy's Energy period
 * card make them) and this dashboard's own key (`energy_<panelUrl>`, the one HA's cards take without a key), or
 * typed — a key is a word the person chose for a picker on the view. Empty, the card keeps its own period.
 */
export const collectionField = (): HaFormSchemaItem =>
  selectField('collection_key', [], { custom: true });

/** The field's word, for a card's `editorLabels` shared map. */
export const COLLECTION_LABEL = { collection_key: 'energy-period.editor_collection_key' } as const;

/** What the editor's config says: a key is set (the card's chips and its own window are then hidden). */
export const following = (data: Readonly<Record<string, unknown>>): boolean =>
  typeof data['collection_key'] === 'string' && data['collection_key'] !== '';

/** The editor's config shows a period, not the live diagram: what a date picker can act on. */
export const periodic = (data: Readonly<Record<string, unknown>>): boolean =>
  typeof data['period'] === 'string' && data['period'] !== 'live';

/** Under the field, what a key is; under the period, that the picker's range stands in for it while one is set. */
export const collectionHelper: FormHelper = (schema, _localize, data) =>
  schema.name === 'collection_key'
    ? p(editorLanguage(), 'editor_collection_key_help')
    : schema.name === 'period' && data && following(data)
      ? p(editorLanguage(), 'follows')
      : undefined;

/** The keys this dashboard has: the one HA's cards take without a key, then every collection on the connection. */
export function collectionChoices(hass: HomeAssistant | undefined): SelectOption[] {
  const found = Object.keys(hass?.connection ?? {})
    .filter((name) => name.startsWith(`_${COLLECTION_PREFIX}`))
    .map((name) => name.slice(1));
  const own = hass?.panelUrl ? [`${COLLECTION_PREFIX}${hass.panelUrl}`] : [];
  return [...new Set([...own, ...found])].map((value) => ({ value, label: value }));
}
