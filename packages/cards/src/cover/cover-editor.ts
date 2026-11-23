import { strings, type HomeAssistant, type LovelaceConfigForm } from '@fluvy/core';
import { BADGE_BASE, SLIDER_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  nameIconFields,
  numberField,
  onlyWhen,
  orderedField,
  ownTextField,
  sectionField,
  selectField,
  headFields,
  sliderFields,
  stateLabels,
  stateTintFields,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import { STATE_TINT_KEYS } from '../shared/state-tint.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { OPEN_TILT, CLOSE_TILT, SET_POSITION, SET_TILT_POSITION, USUAL } from '../cover-family.js';
import type { CoverCardConfig } from './cover-card.js';

/** The cover card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const coverStrings = strings('cover');

export const base = [...BADGE_BASE, ...SLIDER_BASE];

/** A cover's states, as Home Assistant writes them (a valve's are the same): what the editor offers a colour for. */
const STATES = ['open', 'closed', 'opening', 'closing'];

export const keys = configKeys<CoverCardConfig>()([
  'subtitle',
  'variant',
  'favorites',
  'favorites_style',
  'show_tilt',
  'show_favorites',
  'tilt_angle',
  ...STATE_TINT_KEYS,
  'tilt_style',
  'tilt_presets',
  'position_presets',
  'invert_position',
  'invert_tilt',
  'direction',
  'open_label',
  'closed_label',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'favorites',
    idKey: 'name',
    title: 'editor.favorites',
    keys: ['name', 'position', 'tilt'],
    schema: [
      textField('name'),
      fieldRow(numberField('position', 0, 100), numberField('tilt', 0, 100)),
    ],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  favorites_style: 'full',
  show_tilt: true,
  show_favorites: true,
  tilt_style: 'steps',
  direction: 'up',
  invert_position: false,
  invert_tilt: false,
});

type Data = Readonly<Record<string, unknown>>;

/** What the cover does, as Home Assistant describes it; its usual parts where it is not there to say. */
const features = (data: Data, hass?: HomeAssistant): number => {
  const state = hass?.states[String(data['entity'])];
  const said = Number(state?.attributes['supported_features']);
  return state && Number.isFinite(said) ? said : USUAL | SET_TILT_POSITION;
};

/**
 * The full card draws the position and the tilt, as the horizontal one does (#244); the compact one, the head and the
 * commands.
 */
const full = (data: Data): boolean =>
  data['variant'] === undefined || data['variant'] === 'full' || data['variant'] === 'horizontal';
/** The full card of a cover that takes a position. */
const positioned = (data: Data, hass?: HomeAssistant): boolean =>
  full(data) && (features(data, hass) & SET_POSITION) !== 0;
/** …that tilts its slats, and shows it. */
const tilted = (data: Data, hass?: HomeAssistant): boolean =>
  full(data) &&
  data['show_tilt'] !== false &&
  !String(data['entity']).startsWith('valve.') &&
  (features(data, hass) & (SET_TILT_POSITION | OPEN_TILT | CLOSE_TILT)) !== 0;
/** …to an angle: its slats and its presets need one. */
const angled = (data: Data, hass?: HomeAssistant): boolean =>
  tilted(data, hass) && (features(data, hass) & SET_TILT_POSITION) !== 0;

/** A preset's choices: the quarters, each as the card says it; any other percent typed. */
const PRESETS = [0, 25, 50, 75, 100].map((value) => ({
  value: String(value),
  label: `${value} %`,
}));

/**
 * The position and the tilt (#203), folded: what the position counts and whether the cover reports it turned round,
 * the ruler's ends in words of the person's own, its presets; then the tilt as steps or its slats, turned round, its
 * presets. Each only where the cover can act on it.
 */
const positionTiltFields = () =>
  onlyWhen(
    (data, hass) => positioned(data, hass) || tilted(data, hass),
    sectionField('editor.position_tilt', [
      onlyWhen(
        positioned,
        fieldRow(
          choiceField('direction', [
            ['up', 'editor.direction_up'],
            ['down', 'editor.direction_down'],
          ]),
          { ...boolField('invert_position'), helper: 'editor.invert_helper' },
        ),
      ),
      onlyWhen(positioned, orderedField('position_presets', PRESETS, { custom: true })),
      onlyWhen(positioned, fieldRow(textField('open_label'), textField('closed_label'))),
      onlyWhen(
        angled,
        fieldRow(
          choiceField('tilt_style', [
            ['steps', 'editor.tilt_steps'],
            ['slats', 'editor.tilt_slats'],
          ]),
          boolField('invert_tilt'),
        ),
      ),
      onlyWhen(angled, orderedField('tilt_presets', PRESETS, { custom: true })),
    ]),
  );

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['cover', 'valve']),
      nameIconFields(),
      headFields({ badge: true }),
      fieldRow(ownTextField('subtitle'), numberField('tilt_angle', 0, 360)),
      fieldRow(
        choiceField('variant', [
          ['full', 'option.full'],
          ['compact', 'option.compact'],
          ['horizontal', 'editor.horizontal'],
        ]),
        selectField('favorites_style', ['full', 'chips']),
      ),
      fieldRow(boolField('show_tilt'), boolField('show_favorites')),
      { name: 'favorites', selector: { object: {} } },
      positionTiltFields(),
      // its position ruler's style, where the full card draws one
      ...sliderFields().map((row) => onlyWhen(full, row)),
      ...colourFields(),
      ...stateTintFields(STATES),
      actionFields({ icon: true }),
    ],
    ...stateLabels(editorLabels(coverStrings, { tilt_angle: 'tilt_angle' }, {}), STATES, 'cover'),
  };
}
