import {
  strings,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { FluvyExpanderEditor, withCards, type ListKey } from '../expander/expander-editor.js';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  boolField,
  cardSurfaceFields,
  choiceField,
  editorLabels,
  fieldRow,
  listed,
  numberField,
  onlyWhen,
  selectField,
} from '../shared/form.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { REMEMBER, type Remember } from './memory.js';
import { STYLES, type SwipeCardConfig, type SwipeStyle } from './swipe-card.js';

/**
 * The Swipe card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard, with the
 * Expander's, whose stack editor it shares. Its form is Fluvy's, as every card's; its cards are edited in Home
 * Assistant's own stack editor under the form, one tab a page, and in a code field where that editor is not to be had.
 */

const s = strings('swipe');

/** A swipe card has no entity and no head: its colour (the lit mark's) and its surface. */
export const base: readonly BaseKey[] = [
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'card_blur',
  'exact_colors',
];

export const keys = configKeys<SwipeCardConfig>()([
  'cards',
  'style',
  'columns',
  'gap',
  'show_indicators',
  'loop',
  'start',
  'remember',
  'autoplay',
]);

/** Each choice's word: the editor's own, or the options' where they have it. */
const STYLE_WORDS: Readonly<Record<SwipeStyle, MessageKey>> = {
  card: 'swipe.editor.o_card',
  plain: 'option.plain',
};
const REMEMBER_WORDS: Readonly<Record<Remember, MessageKey>> = {
  session: 'swipe.editor.o_session',
  off: 'option.off',
};
/** A select of the card's own values, each with its word. */
const choices = <T extends string>(
  name: string,
  values: readonly T[],
  words: Readonly<Record<T, MessageKey>>,
): HaFormSchemaItem =>
  choiceField(
    name,
    values.map((value) => [value, words[value]] as const),
  );

type Data = Readonly<Record<string, unknown>>;
const onSurface = (data: Data): boolean => data['style'] !== 'plain';
/** What turns it acts only with a page to turn to: two cards at least. */
const pages = (data: Data): boolean => listed(data, 'cards').length > 1;

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  style: 'card',
  columns: '1',
  gap: config['style'] === 'plain' ? 16 : 40,
  show_indicators: true,
  loop: false,
  start: 1,
  remember: 'session',
  autoplay: 0,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      fieldRow(
        choices('style', STYLES, STYLE_WORDS),
        onlyWhen(pages, selectField('columns', ['1', '2', '3', '4'])),
      ),
      onlyWhen(pages, fieldRow(numberField('gap', 0, 40, 4), numberField('start', 1))),
      onlyWhen(pages, fieldRow(boolField('show_indicators'), boolField('loop'))),
      onlyWhen(
        pages,
        fieldRow(choices('remember', REMEMBER, REMEMBER_WORDS), {
          ...numberField('autoplay', 0, 3600),
          helper: 'swipe.editor.autoplay_helper',
        }),
      ),
      // its colour is the lit mark's and that of Fluvy's cards it holds that name none
      fieldRow(
        accentField('color'),
        onlyWhen(onSurface, accentField('card_color', { none: true })),
      ),
      // an opacity, a border and a blur are a surface's: without one there is nothing to wear them
      ...cardSurfaceFields().map((field) => onlyWhen(onSurface, field)),
      // the code view of its cards: what edits them where Home Assistant's stack editor is not to be had
      { name: 'cards', selector: { object: {} } },
    ],
    ...editorLabels(s, {
      cards: 'editor.cards',
      style: 'editor.style',
      columns: 'editor.columns',
      gap: 'editor.gap',
      start: 'editor.start',
      show_indicators: 'editor.show_indicators',
      loop: 'editor.loop',
      remember: 'editor.remember',
      autoplay: 'editor.autoplay',
    }),
  };
}

/** The Expander's editor, its one list the pages: called "Cards", the line under it saying they are one a page. */
class FluvySwipeEditor extends FluvyExpanderEditor {
  static override cardLists: readonly ListKey[] = ['cards'];

  protected override listWords(): readonly [title: string, helper?: string] {
    return [s(this.hass, 'editor.cards'), s(this.hass, 'editor.cards_helper')];
  }
}

if (!customElements.get('fluvy-swipe-editor'))
  customElements.define('fluvy-swipe-editor', FluvySwipeEditor);

/** The base's editor of the swipe card as its own, which holds its cards in Home Assistant's stack editor too. */
export const withPages = (element: HTMLElement): Promise<HTMLElement> =>
  withCards(element, 'fluvy-swipe-editor');
