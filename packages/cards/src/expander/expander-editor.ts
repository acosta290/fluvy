import {
  strings,
  type HaFormSchemaItem,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  boolField,
  byName,
  cardWhenField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  entitiesField,
  fieldRow,
  iconField,
  listed,
  numberField,
  onlyWhen,
  ownTextField,
  pickFields,
  selectField,
  showIconField,
  textField,
} from '../shared/form.js';
import {
  FluvyRowsEditor,
  type EditorDefaults,
  type RowsEditorSpec,
} from '../shared/rows-editor.js';
import {
  POSITIONS,
  STYLES,
  type ChevronPosition,
  type ExpanderCardConfig,
  type ExpanderStyle,
} from './expander-card.js';
import { REMEMBER, type Remember } from './memory.js';

/**
 * The Expander card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. Its
 * form is Fluvy's, as every card's; the cards it holds are edited in Home Assistant's own stack editor, set under the
 * form (`FluvyExpanderEditor`), and in a code field where that editor is not to be had.
 */

const s = strings('expander');

/** An expander has no entity: its icon and its circle, the entities it counts, its colours and what its head answers. */
export const base: readonly BaseKey[] = [
  'icon',
  'show_icon',
  'entities',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'tap_action',
  'hold_action',
];

export const keys = configKeys<ExpanderCardConfig>()([
  'title',
  'subtitle',
  'cards',
  'expanded',
  'remember',
  'style',
  'columns',
  'gap',
  'show_summary',
  'show_chevron',
  'chevron_position',
  'open_when',
  'close_after',
  'icon_color',
]);

/** Each choice's word: the editor's own, or the options' where they have it. */
const STYLE_WORDS: Readonly<Record<ExpanderStyle, MessageKey>> = {
  card: 'expander.editor.o_card',
  plain: 'option.plain',
};
const POSITION_WORDS: Readonly<Record<ChevronPosition, MessageKey>> = {
  end: 'option.end',
  start: 'expander.editor.o_start',
};
const REMEMBER_WORDS: Readonly<Record<Remember, MessageKey>> = {
  device: 'expander.editor.o_device',
  user: 'expander.editor.o_person',
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

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  expanded: false,
  remember: 'device',
  style: 'card',
  columns: '1',
  gap: config['style'] === 'plain' ? 16 : 40,
  show_summary: true,
  show_chevron: true,
  chevron_position: 'end',
  close_after: 0,
});

export function getConfigForm(): LovelaceConfigForm {
  const [colours, ...surface] = colourFields({ unavailable: false });
  return {
    schema: [
      fieldRow(textField('title'), iconField()),
      ownTextField('subtitle'),
      entitiesField('entities'),
      // the count needs something to count
      onlyWhen((data) => listed(data, 'entities').length > 0, boolField('show_summary')),
      fieldRow(choices('style', STYLES, STYLE_WORDS), selectField('columns', ['1', '2', '3', '4'])),
      fieldRow(numberField('gap', 0, 64, 4), showIconField()),
      fieldRow(
        boolField('show_chevron'),
        onlyWhen(
          (data) => data['show_chevron'] !== false,
          choices('chevron_position', POSITIONS, POSITION_WORDS),
        ),
      ),
      fieldRow(boolField('expanded'), choices('remember', REMEMBER, REMEMBER_WORDS)),
      cardWhenField('open_when'),
      numberField('close_after', 0, 1440),
      // the card's colour is its circle's and, inside it, that of Fluvy's cards that name none; the circle's own
      // leaves them theirs
      ...(colours ? [colours] : []),
      accentField('icon_color', { item: 'card' }),
      // a wash, an opacity and a border are a surface's: without one there is nothing to wear them
      ...surface.map((field) => onlyWhen(onSurface, field)),
      actionFields(),
      // the code view of its cards: what edits them where Home Assistant's stack editor is not to be had
      { name: 'cards', selector: { object: {} } },
    ],
    ...editorLabels(s, {
      cards: 'editor.cards',
      style: 'editor.style',
      gap: 'editor.gap',
      show_summary: 'editor.show_summary',
      show_chevron: 'editor.show_chevron',
      chevron_position: 'editor.chevron_position',
      expanded: 'editor.expanded',
      remember: 'editor.remember',
      open_when: 'editor.open_when',
      close_after: 'editor.close_after',
      icon_color: 'editor.icon_color',
    }),
    computeHelper: (schema) =>
      schema.name === 'entities'
        ? s(editorLanguage(), 'editor.entities_helper')
        : schema.name === 'open_when'
          ? s(editorLanguage(), 'editor.open_when_helper')
          : undefined,
  };
}

/* ---------- its cards, in Home Assistant's stack editor ---------- */

const STACK_CARD = 'hui-vertical-stack-card';
const STACK_EDITOR = 'hui-stack-card-editor';
/** How long the editor waits for the stack editor before it opens on the code field (which gives way as it lands). */
const GRACE = 800;

/** Home Assistant's stack editor, as far as the expander's speaks to it. */
interface StackEditor extends HTMLElement {
  hass?: HomeAssistant | undefined;
  lovelace?: unknown;
  setConfig(config: LovelaceCardConfig): void;
}

/** The stack editor's own Title field, which the expander's form holds: left out of its place. */
const untitled = (): CSSStyleSheet | undefined => {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('ha-form{display:none}');
    return sheet;
  } catch {
    return undefined; // no constructed sheets: its Title shows, and writes the head's title
  }
};
let UNTITLED: CSSStyleSheet | undefined;

let defining: Promise<unknown> | undefined;

/**
 * Home Assistant's stack editor (a tab a card, its picker, copy, cut, move and delete, the code view), defined by its
 * stack card's own `getConfigElement` once the card helpers have asked for a stack. None of it is public API: where a
 * step is missing the promise never settles, or fails, and the code field stays.
 */
function stackEditor(): Promise<unknown> {
  defining ??= (async () => {
    if (!customElements.get(STACK_EDITOR)) {
      const helpers = (await window.loadCardHelpers?.()) as
        { createCardElement?: (config: LovelaceCardConfig) => unknown } | undefined;
      helpers?.createCardElement?.({ type: 'vertical-stack', cards: [] });
      await customElements.whenDefined(STACK_CARD);
      const stack = customElements.get(STACK_CARD) as
        { getConfigElement?: () => Promise<unknown> } | undefined;
      await stack?.getConfigElement?.();
    }
    return customElements.whenDefined(STACK_EDITOR);
  })();
  return defining;
}

/**
 * The expander's editor: the base's (its form, its defaults), and under it the cards it holds in Home Assistant's own
 * stack editor — which then takes the place of the form's code field, and gives it back where it refuses the cards
 * (a list that is no list of cards). It carries `lovelace`, so Home Assistant hands it the dashboard, which the
 * stack editor's card picker reads.
 */
export class FluvyExpanderEditor extends FluvyRowsEditor {
  static override properties = {
    ...FluvyRowsEditor.properties,
    lovelace: { attribute: false },
    stack_: { state: true },
  };

  declare lovelace?: unknown;
  /** Home Assistant's stack editor while it holds the cards; none while the code field edits them. */
  declare stack_: StackEditor | undefined;
  /** The card's whole form, its code field in it: what the editor shows without the stack editor. */
  whole: RowsEditorSpec | undefined;
  /** The form without its code field: one object while the form is the same, so the base keeps what it worked out. */
  private formOnly: RowsEditorSpec | undefined;
  /** The stack editor, made once it is defined, and the config it was last asked to take. */
  private made: StackEditor | undefined;
  private asked: LovelaceCardConfig | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    void stackEditor().then(
      () => this.seat(),
      () => undefined,
    );
  }

  /** The stack editor made, once: its changes are the cards'. */
  private seat(): void {
    if (this.made) return;
    this.made = document.createElement(STACK_EDITOR) as StackEditor;
    this.made.addEventListener('config-changed', this.onCards);
    this.requestUpdate();
  }

  /** The stack editor's config is a stack's: the cards, and the title its own form would edit. */
  private readonly onCards = (event: Event): void => {
    event.stopPropagation();
    const config = this.config;
    const stack = (event as CustomEvent<{ config?: LovelaceCardConfig }>).detail?.config;
    if (!config || !Array.isArray(stack?.['cards'])) return;
    const next: LovelaceCardConfig = { ...config, cards: stack['cards'] };
    if (typeof stack['title'] === 'string' && stack['title']) next['title'] = stack['title'];
    else delete next['title'];
    this.commit(next);
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const stack = this.made;
    const config = this.config;
    if (stack && config) {
      stack.hass = this.hass;
      stack.lovelace = this.lovelace;
      // each config is its to take or to refuse: cards it cannot hold are the code field's, until they are mended
      if (config !== this.asked) {
        this.asked = config;
        const title = config['title'];
        try {
          stack.setConfig({
            type: 'vertical-stack',
            ...(typeof title === 'string' && title ? { title } : {}),
            cards: (config['cards'] as unknown[] | undefined) ?? [],
          });
          this.stack_ = stack;
        } catch {
          this.stack_ = undefined;
        }
      }
    }
    // the stack editor in place, the form's code field leaves; without it, the whole form
    const whole = this.whole;
    if (whole)
      this.spec = this.stack_
        ? (this.formOnly ??= {
            ...whole,
            schema: pickFields(
              whole.schema,
              byName((name) => name !== 'cards'),
            ),
          })
        : whole;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const root = this.stack_?.shadowRoot;
    UNTITLED ??= untitled();
    if (root && UNTITLED && !root.adoptedStyleSheets.includes(UNTITLED))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, UNTITLED];
  }

  protected override render(): TemplateResult | typeof nothing {
    const form = super.render();
    if (!this.stack_ || !this.ready || !this.config) return form;
    return html`${form}
      <div class="list">
        <p class="list__title">${s(this.hass, 'editor.cards')}</p>
        ${this.stack_}
      </div>`;
  }
}

if (!customElements.get('fluvy-expander-editor'))
  customElements.define('fluvy-expander-editor', FluvyExpanderEditor);

/**
 * The base's editor of the expander (`base`: its form, lists and defaults) as the expander's own, which holds the
 * cards too. Where Home Assistant can define its stack editor, it waits a moment for it, so the editor opens on it
 * and not on the code field it would replace.
 */
export async function withCards(base: HTMLElement): Promise<HTMLElement> {
  if (typeof window.loadCardHelpers === 'function')
    await Promise.race([
      stackEditor().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, GRACE)),
    ]);
  const editor = document.createElement('fluvy-expander-editor') as FluvyExpanderEditor;
  editor.whole = (base as FluvyRowsEditor).spec;
  editor.spec = editor.whole;
  return editor;
}
