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
  editorWord,
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
  type FormHelper,
  type RowsEditorSpec,
} from '../shared/rows-editor.js';
import {
  POSITIONS,
  SIZES,
  STYLES,
  type ChevronPosition,
  type ChevronSize,
  type ExpanderCardConfig,
  type ExpanderStyle,
} from './expander-card.js';
import { REMEMBER, type Remember } from './memory.js';

/**
 * The Expander card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. Its
 * form is Fluvy's, as every card's; the cards it holds, and those that stand as its head, are edited in Home
 * Assistant's own stack editor, each list in one set under the form (`FluvyExpanderEditor`), and in a code field
 * where that editor is not to be had.
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
  'double_tap_action',
];

export const keys = configKeys<ExpanderCardConfig>()([
  'title',
  'subtitle',
  'cards',
  'head_cards',
  'expanded',
  'remember',
  'style',
  'columns',
  'gap',
  'show_summary',
  'show_chevron',
  'chevron_position',
  'chevron_size',
  'id',
  'open_when',
  'close_after',
  'icon_color',
]);

/** The lists of cards the config holds, in the order the editor shows them: its head's, then what it folds. */
const LISTS = ['head_cards', 'cards'] as const;
type ListKey = (typeof LISTS)[number];

/** Each choice's word: the editor's own, or the options' where they have it. */
const STYLE_WORDS: Readonly<Record<ExpanderStyle, MessageKey>> = {
  card: 'expander.editor.o_card',
  plain: 'option.plain',
};
const POSITION_WORDS: Readonly<Record<ChevronPosition, MessageKey>> = {
  end: 'option.end',
  start: 'expander.editor.o_start',
  bottom: 'expander.editor.o_bottom',
};
const SIZE_WORDS: Readonly<Record<ChevronSize, MessageKey>> = {
  regular: 'expander.editor.o_regular',
  large: 'expander.editor.o_large',
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
/** Its head is words — its circle, its title's line, its button — while no cards stand as it. */
const worded = (data: Data): boolean => listed(data, 'head_cards').length === 0;
const chevroned = (data: Data): boolean => data['show_chevron'] !== false;

/**
 * The action another card opens it with, as that card's YAML takes it on one line: what the `id` field says under
 * itself, with the name as it is typed (quoted where YAML would read it as anything but a word), an example's until
 * one is.
 */
function askYaml(id: unknown): string {
  const name =
    (typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '') || 'clock';
  const word = /^[\w-]+$/.test(name) ? name : JSON.stringify(name);
  return `tap_action: {action: fire-dom-event, fluvy_expander: {id: ${word}, action: toggle}}`;
}

const helper: FormHelper = (schema, _localize, data) =>
  schema.name === 'entities'
    ? s(editorLanguage(), 'editor.entities_helper')
    : schema.name === 'open_when'
      ? s(editorLanguage(), 'editor.open_when_helper')
      : schema.name === 'id'
        ? s(editorLanguage(), 'editor.id_helper', { action: askYaml(data?.['id']) })
        : undefined;

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
  chevron_size: 'regular',
  close_after: 0,
});

export function getConfigForm(): LovelaceConfigForm {
  const [colours, ...surface] = colourFields({ unavailable: false });
  return {
    schema: [
      // cards for a head take the place of its circle, its line and its button: what is theirs leaves the form
      fieldRow(textField('title'), onlyWhen(worded, iconField())),
      onlyWhen(worded, ownTextField('subtitle')),
      onlyWhen(worded, entitiesField('entities')),
      // the count needs something to count
      onlyWhen(
        (data) => worded(data) && listed(data, 'entities').length > 0,
        boolField('show_summary'),
      ),
      fieldRow(choices('style', STYLES, STYLE_WORDS), selectField('columns', ['1', '2', '3', '4'])),
      fieldRow(numberField('gap', 0, 64, 4), onlyWhen(worded, showIconField())),
      fieldRow(
        boolField('show_chevron'),
        onlyWhen(chevroned, choices('chevron_position', POSITIONS, POSITION_WORDS)),
      ),
      onlyWhen(chevroned, choices('chevron_size', SIZES, SIZE_WORDS)),
      fieldRow(boolField('expanded'), choices('remember', REMEMBER, REMEMBER_WORDS)),
      cardWhenField('open_when'),
      numberField('close_after', 0, 1440),
      textField('id'),
      // the card's colour is its circle's and, inside it, that of Fluvy's cards that name none; a tone and the
      // circle's own colour are the circle's alone
      ...(colours
        ? [
            {
              ...colours,
              schema: (colours.schema ?? []).map((field) =>
                field.name === 'tone' ? onlyWhen(worded, field) : field,
              ),
            },
          ]
        : []),
      onlyWhen(worded, accentField('icon_color', { item: 'card' })),
      // a wash, an opacity and a border are a surface's: without one there is nothing to wear them
      ...surface.map((field) => onlyWhen(onSurface, field)),
      onlyWhen(worded, actionFields()),
      // the code view of its cards: what edits them where Home Assistant's stack editor is not to be had
      ...LISTS.map((name) => ({ name, selector: { object: {} } })),
    ],
    ...editorLabels(s, {
      cards: 'editor.cards',
      head_cards: 'editor.head_cards',
      style: 'editor.style',
      gap: 'editor.gap',
      show_summary: 'editor.show_summary',
      show_chevron: 'editor.show_chevron',
      chevron_position: 'editor.chevron_position',
      chevron_size: 'editor.chevron_size',
      expanded: 'editor.expanded',
      remember: 'editor.remember',
      open_when: 'editor.open_when',
      close_after: 'editor.close_after',
      id: 'editor.id',
      icon_color: 'editor.icon_color',
    }),
    computeHelper: helper,
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
 * One of the config's lists of cards in a stack editor of its own: made once Home Assistant's is defined, handed each
 * config to take or to refuse, and what it changes written back under the list's key. Its config is a stack's: the
 * cards, and the title its own form would edit.
 */
class CardList {
  /** The stack editor, made once it is defined, and the config it was last asked to take. */
  private made: StackEditor | undefined;
  private asked: LovelaceCardConfig | undefined;
  /** It holds the cards: it took the config it was last asked to. Else the form's code field edits them. */
  holds = false;

  constructor(
    readonly key: ListKey,
    private readonly write: (next: LovelaceCardConfig) => void,
    private readonly config: () => LovelaceCardConfig | undefined,
  ) {}

  /** The stack editor while it holds the cards. */
  get element(): StackEditor | undefined {
    return this.holds ? this.made : undefined;
  }

  /** The stack editor made, once: its changes are the list's. */
  seat(): void {
    if (this.made) return;
    this.made = document.createElement(STACK_EDITOR) as StackEditor;
    this.made.addEventListener('config-changed', this.onCards);
  }

  private readonly onCards = (event: Event): void => {
    event.stopPropagation();
    const config = this.config();
    const stack = (event as CustomEvent<{ config?: LovelaceCardConfig }>).detail?.config;
    const cards: unknown = stack?.['cards'];
    if (!config || !Array.isArray(cards)) return;
    const next: LovelaceCardConfig = { ...config, [this.key]: cards };
    // no cards for a head is no head of cards: the key leaves the config, as a default would
    if (this.key === 'head_cards' && !cards.length) delete next[this.key];
    if (typeof stack?.['title'] === 'string' && stack['title']) next['title'] = stack['title'];
    else delete next['title'];
    this.write(next);
  };

  /** Each config is its to take or to refuse: cards it cannot hold are the code field's, until they are mended. */
  take(config: LovelaceCardConfig, hass: HomeAssistant | undefined, lovelace: unknown): void {
    const stack = this.made;
    if (!stack) return;
    stack.hass = hass;
    stack.lovelace = lovelace;
    if (config === this.asked) return;
    this.asked = config;
    const title = config['title'];
    try {
      stack.setConfig({
        type: 'vertical-stack',
        ...(typeof title === 'string' && title ? { title } : {}),
        cards: (config[this.key] as unknown[] | undefined) ?? [],
      });
      this.holds = true;
    } catch {
      this.holds = false;
    }
  }

  /** Its own Title field left out, once its shadow root is there. */
  untitle(): void {
    const root = this.element?.shadowRoot;
    UNTITLED ??= untitled();
    if (root && UNTITLED && !root.adoptedStyleSheets.includes(UNTITLED))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, UNTITLED];
  }
}

/**
 * The expander's editor: the base's (its form, its defaults), and under it the cards — those that stand as its head,
 * then those it holds — each list in Home Assistant's own stack editor, which then takes the place of the form's
 * code field for it, and gives it back where it refuses the cards (a list that is no list of cards). The head's is
 * folded behind a button until it has a card or one is asked for: a head of cards is a thing to turn on, and an
 * empty stack editor is a whole card picker. It carries `lovelace`, so Home Assistant hands it the dashboard, which
 * the stack editor's card picker reads.
 */
export class FluvyExpanderEditor extends FluvyRowsEditor {
  static override properties = {
    ...FluvyRowsEditor.properties,
    lovelace: { attribute: false },
    held_: { state: true },
    heading_: { state: true },
  };

  declare lovelace?: unknown;
  /** The lists Home Assistant's stack editor holds now, by their keys: what the form's code fields are left out for. */
  declare held_: string;
  /** The head's card picker was asked for: it shows though the head has no card yet. */
  declare heading_: boolean;
  /** The card's whole form, its code fields in it: what the editor shows without the stack editor. */
  whole: RowsEditorSpec | undefined;
  /** The form without the code fields of the lists held, by those: one object each, so the base keeps what it worked out. */
  private readonly forms = new Map<string, RowsEditorSpec>();
  private readonly lists = LISTS.map(
    (key) =>
      new CardList(
        key,
        (next) => this.commit(next),
        () => this.config,
      ),
  );

  constructor() {
    super();
    this.held_ = '';
    this.heading_ = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void stackEditor().then(
      () => {
        for (const list of this.lists) list.seat();
        this.requestUpdate();
      },
      () => undefined,
    );
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const config = this.config;
    if (config) for (const list of this.lists) list.take(config, this.hass, this.lovelace);
    // a stack editor in place, the form's code field for its list leaves; without it, the whole form
    const held = this.lists.filter((list) => list.holds).map((list) => list.key);
    this.held_ = held.join();
    const whole = this.whole;
    if (!whole) return;
    let form = this.forms.get(this.held_);
    if (!form) {
      form = held.length
        ? {
            ...whole,
            schema: pickFields(
              whole.schema,
              byName((name) => !(held as readonly string[]).includes(name)),
            ),
          }
        : whole;
      this.forms.set(this.held_, form);
    }
    this.spec = form;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    for (const list of this.lists) list.untitle();
  }

  private readonly openHead = (): void => {
    this.heading_ = true;
  };

  protected override render(): TemplateResult | typeof nothing {
    const form = super.render();
    const config = this.config;
    if (!this.held_ || !this.ready || !config) return form;
    return html`${form}
    ${this.lists.map((list) => {
      const stack = list.element;
      if (!stack) return nothing;
      const head = list.key === 'head_cards';
      const folded = head && !this.heading_ && !listed(config, list.key).length;
      return html`<div class="list">
        <p class="list__title">${s(this.hass, `editor.${list.key}`)}</p>
        ${head ? html`<p class="list__helper">${s(this.hass, 'editor.head_cards_helper')}</p>` : nothing}
        ${
          folded
            ? html`<div class="more">
                <button type="button" @click=${this.openHead}>${editorWord('editor.add')}</button>
              </div>`
            : stack
        }
      </div>`;
    })}`;
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
