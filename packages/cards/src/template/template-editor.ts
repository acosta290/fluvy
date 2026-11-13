import { strings, type LovelaceConfigForm } from '@fluvy/core';
import { tintsAtRest } from '../tile/tile-card.js';
import { ENTITY_BASE, ICON_ACTIONS_BASE } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  colourFields,
  editorLabels,
  editorLanguage,
  editorWord,
  entitiesField,
  entityField,
  fieldRow,
  iconField,
  nameLinesField,
  onlyWhen,
  selectField,
  showSwitchField,
  sinceChoices,
  sinceField,
  switches,
  textField,
  tintField,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults } from '../shared/rows-editor.js';
import { KEYWORDS, VARIANTS, type TemplateCardConfig } from './template-card.js';

/** The template card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('template');

/** What the editor says under a field that takes a template. */
const HELPERS: Readonly<Record<string, () => string>> = {
  name: () => editorWord('editor.template_helper'),
  secondary: () => editorWord('editor.secondary_helper'),
  icon: () => s(editorLanguage(), 'editor.icon_helper'),
  active: () => s(editorLanguage(), 'editor.active_helper'),
  color: () => s(editorLanguage(), 'editor.color_helper'),
};

export const base = [...ENTITY_BASE, ...ICON_ACTIONS_BASE];

export const keys = configKeys<TemplateCardConfig>()([
  'secondary',
  'since',
  'active',
  'tint',
  'variant',
  'name_lines',
  'show_switch',
  'readouts',
]);

export const defaults: EditorDefaults = (config) => ({
  variant: 'compact',
  name_lines: '1',
  show_switch: true,
  secondary: config['entity'] ? 'state' : 'none',
  since: '',
  active: 'auto',
  tint: 'on',
});

/** `since` offers the house's timestamp sensors, as the tile's does. */
export const choices: EditorChoices = sinceChoices;

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(undefined, 'entity', false),
      fieldRow(textField('name'), iconField()),
      selectField('secondary', KEYWORDS, { custom: true }),
      // where the last change is read from: an entity's
      onlyWhen((data) => Boolean(data['entity']), sinceField()),
      fieldRow(
        selectField('variant', VARIANTS),
        selectField('active', ['auto', 'always', 'never'], { custom: true }),
      ),
      // a compact or mini tile's name may take two lines; a large one's switch may give way to its circle, where
      // its entity is one that switches
      onlyWhen((data) => data['variant'] !== 'large', nameLinesField()),
      onlyWhen(
        (data) => data['variant'] === 'large' && switches(data['entity']),
        showSwitchField(),
      ),
      ...colourFields(),
      // a colour at rest needs a rest and something to show then (a colour, or a tone that washes); readouts need
      // a large tile's foot
      onlyWhen((data, hass) => data['active'] !== 'always' && tintsAtRest(data, hass), tintField()),
      onlyWhen((data) => data['variant'] === 'large', entitiesField('readouts', ['sensor'])),
      // a small tile's tap toggles what toggles, a large one's opens; its circle may be its switch
      actionFields({ icon: true, tap: null, iconTap: null }),
    ],
    ...editorLabels(s, { active: 'editor.active' }, { readouts: 'editor.readouts' }),
    computeHelper: (schema) => HELPERS[schema.name]?.(),
  };
}
