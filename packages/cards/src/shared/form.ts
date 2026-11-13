import {
  addEnglish,
  domainOf,
  idsOf,
  localize,
  resolveEntity,
  type ActionConfig,
  type HaFormSchemaItem,
  type HomeAssistant,
  type KeyOf,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
  type MessageKey,
  SLIDER_STYLES,
  SLIDER_WORDS,
  sliderDefaults,
  type SliderStyle,
  TOGGLE_DOMAINS,
  UNAVAILABLE_LOOKS,
} from '@fluvy/core';
import { TONES } from '@fluvy/ui';
import type { EditorChoices, RowsListSpec, SelectOption } from './rows-editor.js';
import { statesOf } from './lists.js';
import { LADDERS, ladderOf, unitClass } from './units.js';
import words from '@fluvy/core/locales/en/editor.json';

// the editors' English, in this chunk: every editor is built of these fields, so its words are here before it speaks
addEnglish(words);

/** The words every card's editor shares, by field name: a card maps only its own fields (or another word). */
export const SHARED_LABELS: Readonly<Record<string, MessageKey>> = {
  title: 'editor.title',
  subtitle: 'editor.subtitle',
  icon: 'editor.icon',
  tone: 'editor.tone',
  color: 'editor.color',
  card_color: 'editor.card_color',
  entity: 'editor.entity',
  entities: 'editor.entities',
  name: 'editor.name',
  tap_action: 'editor.tap_action',
  hold_action: 'editor.hold_action',
  hours: 'editor.hours',
  variant: 'editor.variant',
  size: 'editor.size',
  columns: 'editor.columns',
  secondary: 'editor.secondary',
  min: 'editor.min',
  max: 'editor.max',
};

/** The language an editor speaks: `getConfigForm()` is static, so it comes from the document. */
export const editorLanguage = (): Pick<HomeAssistant, 'language'> => ({
  language: document.documentElement.lang || 'en',
});

/** A value a select may hold: one the catalogue has a word for (`option.<value>`), in every language. */
export type OptionWord = KeyOf<'option'>;

/** A word of the catalogue in the editor's language (a select built by hand names its choices with it). */
export const editorWord = (key: MessageKey): string => localize(editorLanguage(), key);

/** What names an editor's field (`computeLabel` of a config form): a word, or HA's own when undefined. */
export type FormLabeler = (
  schema: HaFormSchemaItem,
  localize: (key: string) => string,
) => string | undefined;

/** Editor labels in the dashboard's language. `getConfigForm()` is static, so the language comes from the document. */
/** A field's own editor word, when the catalogue has one (`show_rows` → `editor.show_rows`). */
const editorKey = (name: string): MessageKey | undefined =>
  Object.hasOwn(words.editor, name) ? (`editor.${name}` as MessageKey) : undefined;

export function formLabels(map: Readonly<Record<string, MessageKey>> = {}): {
  readonly computeLabel: FormLabeler;
} {
  return {
    computeLabel: (schema: HaFormSchemaItem) => {
      const key = map[schema.name] ?? SHARED_LABELS[schema.name] ?? editorKey(schema.name);
      if (!key) return undefined;
      return localize(editorLanguage(), key);
    },
  };
}

/**
 * Editor labels for a card with words of its own: a field it owns is named from its own namespace (`own`, the
 * card's `strings('<name>')`), the rest from the shared editor words (the defaults, and `shared` for another word).
 */
export function editorLabels<K extends string>(
  strings: (hass: Pick<HomeAssistant, 'language'> | undefined, key: K) => string,
  own: Readonly<Record<string, K>>,
  shared: Readonly<Record<string, MessageKey>> = {},
): { readonly computeLabel: FormLabeler } {
  const fallback = formLabels(shared);
  return {
    computeLabel: (schema, localize) => {
      const key = own[schema.name];
      return key ? strings(editorLanguage(), key) : fallback.computeLabel(schema, localize);
    },
  };
}

/**
 * The visual editor shows a list as an entity picker, which can only hold ids. A list with
 * `{ entity, name, … }` rows makes Home Assistant fall back to its YAML editor instead of mangling them.
 */
export function idsOnly(...keys: readonly string[]): Pick<LovelaceConfigForm, 'assertConfig'> {
  return {
    assertConfig: (config: LovelaceCardConfig) => {
      for (const key of keys) {
        const list = config[key];
        if (Array.isArray(list) && list.some((row) => typeof row !== 'string'))
          throw new Error(`"${key}" has rows with options: edit them as YAML`);
      }
    },
  };
}

export const entityField = (
  domains?: readonly string[],
  name = 'entity',
  required = true,
): HaFormSchemaItem => ({
  name,
  required,
  selector: { entity: domains ? { domain: [...domains] } : {} },
});

export const textField = (name: string): HaFormSchemaItem => ({ name, selector: { text: {} } });
/**
 * A text of the card's own that may be live (`Card.ownText`, Discussion #156): words, an entity's id or a template,
 * typed, as its helper says (a template is no entity, so Home Assistant's entity picker cannot take one).
 */
export const ownTextField = (name: string): HaFormSchemaItem => ({
  ...textField(name),
  helper: 'editor.own_text_helper',
});
export const iconField = (name = 'icon'): HaFormSchemaItem => ({ name, selector: { icon: {} } });
/** An area of the house, from Home Assistant's own picker. */
export const areaField = (name = 'area'): HaFormSchemaItem => ({
  name,
  required: true,
  selector: { area: {} },
});
export const boolField = (name: string): HaFormSchemaItem => ({ name, selector: { boolean: {} } });
/** A number typed in a box, from `min` to `max`; without a `max` where the card takes any (a list's rows). */
export const numberField = (
  name: string,
  min: number,
  max?: number,
  step = 1,
): HaFormSchemaItem => ({
  name,
  selector: { number: { min, ...(max === undefined ? {} : { max }), step, mode: 'box' } },
});
/** A number of any size and sign typed in a box (a bar's range, a condition's bound). */
export const anyNumberField = (name: string): HaFormSchemaItem => ({
  name,
  selector: { number: { mode: 'box', step: 'any' } },
});
/**
 * A choice among values the catalogue names (a value without a word does not compile), in the editor's language;
 * `custom` lets a value of the person's own be typed as well (an attribute's name, a template); `words` names a value
 * by another word where its own would say something else here (`full` strength is not the full layout).
 */
export const selectField = (
  name: string,
  options: readonly OptionWord[],
  {
    custom = false,
    words = {},
  }: { custom?: boolean; words?: Partial<Record<OptionWord, OptionWord>> } = {},
): HaFormSchemaItem => ({
  name,
  selector: {
    select: {
      mode: 'dropdown',
      ...(custom ? { custom_value: true } : {}),
      options: optionChoices(options, words),
    },
  },
});

/** A select's choices: each value with its words (`option.*`, or another value's where `words` says so). */
export const optionChoices = (
  options: readonly OptionWord[],
  words: Partial<Record<OptionWord, OptionWord>> = {},
): SelectOption[] =>
  options.map((value) => ({
    value,
    label: localize(editorLanguage(), `option.${words[value] ?? value}`),
  }));
/**
 * Where a row's last change is read from (`since`, #67): one of the house's timestamp sensors (`sinceChoices`), or
 * `attribute:<name>` of the row's own entity, typed.
 */
export const sinceField = (): HaFormSchemaItem => ({
  ...selectField('since', [], { custom: true }),
  helper: 'editor.since_help',
});

/** The house's timestamp sensors, by name, as a `since` select's choices: what a real last change is read from. */
export const sinceChoices: EditorChoices = (_config, hass) => ({
  since: Object.values(hass?.states ?? {})
    .filter(
      (state) =>
        state.entity_id.startsWith('sensor.') && state.attributes.device_class === 'timestamp',
    )
    .map((state) => ({
      value: state.entity_id,
      label: state.attributes.friendly_name ?? state.entity_id,
    })),
});

/**
 * A select's row (#96): the options its list offers, in their order (of those the select lists, `selectRowChoices`),
 * and its own words for them.
 */
export const selectRowFields = (): [options: HaFormSchemaItem, labels: HaFormSchemaItem] => [
  { name: 'options', selector: { select: { multiple: true, reorder: true, options: [] } } },
  { name: 'labels', selector: { object: {} } },
];

/** Whether a row's entity is a select: its form offers its options and their words. */
export const isSelectRow = (item: Readonly<Record<string, unknown>>): boolean =>
  /^(input_)?select\./.test(String(item['entity']));

/** A row's `since` offers the house's timestamp sensors, a select's `options` what it lists, in its words. */
export const selectRowChoices: EditorChoices = (item, hass) => {
  const state = hass?.states[String(item['entity'])];
  const listed: unknown = state?.attributes['options'];
  return {
    ...sinceChoices(item, hass),
    options: (Array.isArray(listed) ? listed : []).map((option) => {
      const value = String(option);
      return { value, label: (state && hass?.formatEntityState?.(state, value)) || value };
    }),
  };
};

/**
 * A choice among values, each named by a word of the catalogue — a family's own words among them, where `selectField`
 * takes the core's option words alone.
 */
export const choiceField = (
  name: string,
  options: ReadonlyArray<readonly [value: string, word: MessageKey]>,
): HaFormSchemaItem => ({
  name,
  selector: {
    select: {
      mode: 'dropdown',
      options: options.map(([value, word]) => ({ value, label: editorWord(word) })),
    },
  },
});

/**
 * An ordered subset of named choices (a compact row's `controls`): Home Assistant's select as chips that are
 * dragged into order, with a box to add the rest. The dropdown mode is asked for: with fewer than six choices the
 * selector would draw check boxes, which keep no order. `custom` lets a value of the person's own be typed as well
 * (a light's quick colour as `#rrggbb`).
 */
export const orderedField = (
  name: string,
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>,
  { custom = false }: { custom?: boolean } = {},
): HaFormSchemaItem => ({
  name,
  selector: {
    select: {
      multiple: true,
      reorder: true,
      mode: 'dropdown',
      ...(custom ? { custom_value: true } : {}),
      options: [...options],
    },
  },
});

/** An action, in Home Assistant's own picker, saying what the card does while none is chosen where it is said (`fallback`). */
export const actionField = (
  name = 'tap_action',
  fallback?: ActionConfig['action'],
): HaFormSchemaItem => ({
  name,
  selector: { ui_action: fallback ? { default_action: fallback } : {} },
});

/** A double tap (`double_tap_action`, a circle's): nothing until one is set, the word under it saying what it costs a tap. */
export const doubleTapField = (name = 'double_tap_action'): HaFormSchemaItem => ({
  ...actionField(name, 'none'),
  helper: 'editor.double_tap_helper',
});

/**
 * Actions not shown until one is added, as Home Assistant's own editors add them ("Add interaction"): a double tap,
 * a circle's. Each stands as a field of its own once it holds one.
 */
export const optionalActions = (...schema: HaFormSchemaItem[]): HaFormSchemaItem => ({
  type: 'optional_actions',
  name: '',
  flatten: true,
  schema,
});

/** What an action does where none is chosen, as its picker says it; `null`: what the card does of its own, unsaid. */
type Fallback = ActionConfig['action'] | null;

/**
 * What a card, or an item, answers, in its Interactions section (#179): a tap and a still press — the details where
 * none is chosen, nothing on a card of many (`many`: no entity of its own to open), each its own where the card says
 * (`tap`, `hold`) — then, added as Home Assistant's own editors add them, a double tap and, where it has a circle that
 * may answer on its own (`icon`), the circle's tap, hold and double tap: nothing until set (a tile's circle that is its
 * switch flips it: `iconTap`).
 */
export const actionFields = ({
  icon = false,
  many = false,
  tap,
  hold,
  iconTap = 'none',
}: {
  icon?: boolean;
  many?: boolean;
  tap?: Fallback;
  hold?: Fallback;
  iconTap?: Fallback;
} = {}): HaFormSchemaItem => {
  const fallback = many ? 'none' : 'more-info';
  const said = (own: Fallback | undefined): ActionConfig['action'] | undefined =>
    own === null ? undefined : (own ?? fallback);
  return sectionField('editor.interactions', [
    actionField('tap_action', said(tap)),
    actionField('hold_action', said(hold)),
    optionalActions(
      doubleTapField(),
      ...(icon
        ? [
            actionField('icon_tap_action', iconTap ?? undefined),
            actionField('icon_hold_action', 'none'),
            doubleTapField('icon_double_tap_action'),
          ]
        : []),
    ),
  ]);
};

/** The palette's tones as a dropdown, each by its word. */
export const toneSelector = (language: Pick<HomeAssistant, 'language'> = editorLanguage()) => ({
  select: {
    mode: 'dropdown',
    options: TONES.map((value) => ({ value, label: localize(language, `tone.${value}`) })),
  },
});

/** Whether a field's label stands above its box (an entity's or a statistic's picker); every other field's is inside it. */
const labelAbove = (item: HaFormSchemaItem): boolean =>
  Boolean(item.selector && ('entity' in item.selector || 'statistic' in item.selector));

/**
 * Fields side by side: one row of the editor (Home Assistant's form grid), on their boxes' tops whatever hint is under
 * each. A label above its box beside one inside its own would leave the boxes 24 apart: such a row stacks.
 */
export const fieldRow = (...schema: HaFormSchemaItem[]): HaFormSchemaItem => {
  const above = schema.filter(labelAbove).length;
  return {
    type: 'grid',
    name: '',
    flatten: true,
    ...(above && above < schema.length ? { column_min_width: '100%' } : {}),
    schema,
  };
};

/** A group of fields under a title of its own, folded until opened (Home Assistant's expandable section). */
export const sectionField = (
  title: MessageKey,
  schema: readonly HaFormSchemaItem[],
): HaFormSchemaItem => ({
  type: 'expandable',
  name: '',
  title: editorWord(title),
  flatten: true,
  schema,
});

/**
 * A form with only the items `keep` takes, asked of every row and every field: a row it refuses goes whole, and a row
 * that loses one of its fields keeps the other on its own line.
 */
export function pickFields(
  schema: readonly HaFormSchemaItem[],
  keep: (item: HaFormSchemaItem) => boolean,
): HaFormSchemaItem[] {
  return schema.flatMap((item): HaFormSchemaItem[] => {
    if (!keep(item)) return [];
    if (!item.schema) return [item];
    const inner = pickFields(item.schema, keep);
    if (inner.length === item.schema.length) return [item];
    return inner;
  });
}

/** A `pickFields` test of the fields' names alone: every row is opened, for its fields to be asked. */
export const byName =
  (keep: (name: string) => boolean) =>
  (item: HaFormSchemaItem): boolean =>
    item.schema !== undefined || keep(item.name);

/** A field as `ha-form` takes it, through its rows: without its `when` (a form is never handed a function). */
function bare(item: HaFormSchemaItem): HaFormSchemaItem {
  const { when, schema, ...field } = item;
  return when || schema ? { ...field, ...(schema ? { schema: schema.map(bare) } : {}) } : item;
}

/**
 * The form as it stands: the fields and rows that can act on what it holds (`when`, asked with the config over the
 * card's defaults, and the house), the rest left out — their values stay in the config.
 */
export const visibleFields = (
  schema: readonly HaFormSchemaItem[],
  data: Readonly<Record<string, unknown>>,
  hass?: HomeAssistant,
): HaFormSchemaItem[] => pickFields(schema, (item) => item.when?.(data, hass) ?? true).map(bare);

/**
 * A card's list as its editor's `when` reads it: under its key, else its alias; none where the config holds no list
 * there (that slip is the card's to say, never the editor's to throw on).
 */
export const listed = (
  data: Readonly<Record<string, unknown>>,
  key: string,
  alias?: string,
): readonly unknown[] => {
  const list = data[key] ?? (alias ? data[alias] : undefined);
  return Array.isArray(list) ? list : [];
};

/** Whether a card's list names a light: what the lights' colours act on (`lightColourFields`). */
export const holdsLight =
  (key: string, alias?: string) =>
  (data: Readonly<Record<string, unknown>>): boolean =>
    idsOf(listed(data, key, alias)).some((id) => id.startsWith('light.'));

/** Whether an entity is one a tile switches: what a large tile's switch acts on (`showSwitchField`). */
export const switches = (entity: unknown): boolean =>
  typeof entity === 'string' && TOGGLE_DOMAINS.has(domainOf(entity));

/** Whether a card's list names an entity a tile switches. */
export const holdsSwitch =
  (key: string, alias?: string) =>
  (data: Readonly<Record<string, unknown>>): boolean =>
    idsOf(listed(data, key, alias)).some(switches);

/** A field (or a row) shown only while `when` says it can act: one that acts only in a style is shown in that style. */
export const onlyWhen = (
  when: NonNullable<HaFormSchemaItem['when']>,
  item: HaFormSchemaItem,
): HaFormSchemaItem => ({ ...item, when });

/** A card's tone, from the palette's tones. */
export const toneField = (): HaFormSchemaItem => ({ name: 'tone', selector: toneSelector() });

/**
 * What an item's colour (or a part's) is while none is chosen: its bulb's where the card shows bulbs' colours, else
 * the card's (`bulb`: an item of a card of lights, tiles or rows); the card's alone (`card`: a scene, a chip, a person,
 * a row of a lock, a camera or an alarm, the history bars' bar below zero or in progress); or the one the card gives it
 * (`own`: an appliance's kind's, a source's, an alert's severity's, a figure's or a reading's neutral).
 */
export type ItemColour = 'bulb' | 'card' | 'own';

const ITEM_HELPER: Record<ItemColour, MessageKey> = {
  bulb: 'editor.item_color_helper',
  card: 'editor.item_color_card_helper',
  own: 'editor.item_color_own_helper',
};

/**
 * A card's or an item's own colour: Home Assistant's colour picker — its named swatches, shown in the palette's
 * colours where the look reaches the editor, or any colour typed — with the palette's accent as its default. A colour
 * that may be none (`card_color`) is none until one is chosen: the picker then says what the card draws, and offers
 * to clear it. One that follows its entity (`state`: a light card's, its bulb's) says so as Home Assistant's own
 * tile does, State by default. An item's (`item`) has no default of its own — the picker would call it "Primary",
 * whatever it wears — and shows none chosen, its helper saying what it wears then (`ItemColour`).
 */
export const accentField = (
  name = 'color',
  {
    none = false,
    state = false,
    item,
  }: { none?: boolean; state?: boolean; item?: ItemColour } = {},
): HaFormSchemaItem => {
  const helper = item && ITEM_HELPER[item];
  return {
    name,
    selector: {
      ui_color: {
        ...(helper ? {} : { default_color: none ? 'none' : state ? 'state' : 'primary' }),
        include_none: none,
        include_state: state,
      },
    },
    ...(helper ? { helper } : {}),
  };
};

/**
 * The card's surface beside its colour: how opaque it is (`card_opacity`, 1.15), a percentage on Home Assistant's
 * slider in 5 % steps, its figure in the box beside it, and under it whether it draws its border (`card_border`, 1.19,
 * #171) — each the house's, shown and never written, until one is chosen (`editorDefaults`), the word under it saying
 * so.
 */
export const cardSurfaceFields = (): HaFormSchemaItem[] => [
  {
    name: 'card_opacity',
    selector: { number: { min: 0, max: 100, step: 5, mode: 'slider', unit_of_measurement: '%' } },
    helper: 'editor.card_opacity_helper',
  },
  { ...boolField('card_border'), helper: 'editor.card_border_helper' },
];

/**
 * How the card looks out of reach (`unavailable`, 1.16, #126): dashed, or as when off, its words saying so — the
 * house's, shown and never written, until one is chosen (`editorDefaults`), the word under it saying so. An item's
 * (`item`: a tile of a group) is empty until chosen, its group's then.
 */
export const unavailableField = ({ item = false } = {}): HaFormSchemaItem => ({
  ...selectField('unavailable', UNAVAILABLE_LOOKS),
  helper: item ? 'editor.item_unavailable_helper' : 'editor.unavailable_helper',
});

/** A style's word among the options: the fill's is a tile's ("Fill"), where `fill` alone is a view's. */
const STYLE_WORDS: Readonly<Record<SliderStyle, OptionWord>> = {
  ruler: 'ruler',
  bar: 'bar',
  liquid: 'liquid',
  fill: 'tile_fill',
};

/** The style a card's config asks of its sliders: its own, else the house's it keeps to (`house`, or nothing). */
export const askedSliderStyle = (data: Readonly<Record<string, unknown>>): unknown => {
  const own = data['slider_style'];
  return own === undefined || own === 'house' ? sliderDefaults().style : own;
};

/** Whether the style asked says words under it: a bar's or a liquid's. */
const saysWords = (data: Readonly<Record<string, unknown>>): boolean => {
  const style = askedSliderStyle(data);
  return style === 'bar' || style === 'liquid';
};

/**
 * The style a card's sliders are drawn in (`slider_style`, 1.18, #144) and the words under them (`slider_words`),
 * on one row: the house's, named with the style it draws ("House (Ruler)"), the ruler, a bar, a liquid and, where the
 * card draws a tile (`tile`: always, or asked of the config), the tile's fill — the whole tile being the slider;
 * elsewhere a card asked for the fill draws the ruler, so the editor never offers it; the words — the ends and the
 * middle, or none — while the style asked is a bar or a liquid. The house's, shown and never written, until one is
 * chosen (`editorDefaults`), the word under the style saying so.
 */
export const sliderFields = (
  tile: boolean | NonNullable<HaFormSchemaItem['when']> = false,
): HaFormSchemaItem[] => {
  const row = (fill: boolean): HaFormSchemaItem =>
    fieldRow(
      {
        name: 'slider_style',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              {
                value: 'house',
                label: localize(editorLanguage(), 'option.house_style', {
                  style: editorWord(`option.${STYLE_WORDS[sliderDefaults().style]}`),
                }),
              },
              ...optionChoices(
                SLIDER_STYLES.filter((style) => fill || style !== 'fill'),
                STYLE_WORDS,
              ),
            ],
          },
        },
        helper: 'editor.slider_style_helper',
      },
      onlyWhen(saysWords, selectField('slider_words', SLIDER_WORDS)),
    );
  return typeof tile === 'function'
    ? [onlyWhen(tile, row(true)), onlyWhen((data, hass) => !tile(data, hass), row(false))]
    : [row(tile)];
};

/**
 * A tone and a colour on one row, then the card's own surface: its colour (`card_color`, none by default), its opacity,
 * its border and how it looks out of reach (`unavailable: false`: a card that shows no entity has nothing out of
 * reach).
 */
export const colourFields = ({ state = false, unavailable = true } = {}): HaFormSchemaItem[] => [
  fieldRow(toneField(), accentField('color', { state })),
  accentField('card_color', { none: true }),
  ...cardSurfaceFields(),
  ...(unavailable ? [unavailableField()] : []),
];

/**
 * When an item's colour shows on its surface: while it is on (the default), or always (a quiet wash at rest); a light
 * card's may be off as well — "Never" beside "Show its colour", not "Off" (a light's own off is another thing).
 */
export const tintField = (options: readonly OptionWord[] = ['on', 'always']): HaFormSchemaItem =>
  selectField('tint', options, { words: { off: 'never' } });

/**
 * A lit light in its bulb's colour (`light_colors`), and beside it how a white shows then (`light_whites`: by its
 * temperature, or as the palette's light) — a choice only while the bulbs show their colours.
 */
export const lightColourFields = (): HaFormSchemaItem =>
  fieldRow(
    boolField('light_colors'),
    onlyWhen(
      ({ light_colors }) => light_colors === true,
      selectField('light_whites', ['palette', 'temperature']),
    ),
  );

/** What a device card shows while the device is off: everything (the default), or the essentials alone. */
export const whenOffField = (): HaFormSchemaItem => selectField('when_off', ['all', 'essentials']);

/** A small tile's name in one line (the default) or two where one would cut it (`name_lines`, #100). */
export const nameLinesField = (): HaFormSchemaItem => selectField('name_lines', ['1', '2']);

/**
 * What ends a large tile's head where its entity switches (`show_switch`, #160), as its config writes it: its switch
 * (the default), nothing, or its level's figure — its circle the switch then, as the word under it says. An item's
 * (`item`: a tile of a group) is empty until chosen, its group's then.
 */
export const showSwitchField = ({ item = false } = {}): HaFormSchemaItem => ({
  ...choiceField('show_switch', [
    ['true', 'editor.switch_shown'],
    ['false', 'editor.switch_hidden'],
    ['value', 'editor.switch_value'],
  ]),
  helper: item ? 'editor.item_show_switch_helper' : 'editor.show_switch_helper',
});

/** A card's head: its title and its subtitle, on one row. */
export const titleFields = (): HaFormSchemaItem =>
  fieldRow(textField('title'), textField('subtitle'));

/** A card's icon and its tone, on one row. */
export const iconToneFields = (): HaFormSchemaItem => fieldRow(iconField(), toneField());

/**
 * A name, a card's or an item's in a list, as Home Assistant's own editors write one (#125): words of the person's own,
 * or the parts read with the entity beside it (its own name, its device's, its area's, its floor's: `entityName`).
 */
export const nameField = (): HaFormSchemaItem => ({
  name: 'name',
  selector: { entity_name: {} },
  context: { entity: 'entity' },
});

/** A name and an icon, on one row (a card's, or an item's in a list): the entity's parts where one is beside them. */
export const nameIconFields = (): HaFormSchemaItem => fieldRow(nameField(), iconField());

/** Whether a card's head shows its circle: automatic (it gives way to a long name), always or never. */
export const showIconField = (): HaFormSchemaItem =>
  selectField('show_icon', ['auto', 'always', 'never']);

/** What a card of a list says while the list has nothing to show, and whether it hides then (`EmptyList`). */
export const emptyFields = (): HaFormSchemaItem =>
  fieldRow(textField('empty_text'), boolField('hide_empty'));

/** A list of entities in one picker (the visual editor's form; `listsEditor` gives each its own). */
export const entitiesField = (
  name: string,
  domains?: readonly string[],
  required = false,
): HaFormSchemaItem => ({
  name,
  ...(required ? { required } : {}),
  selector: { entity: { multiple: true, ...(domains ? { domain: [...domains] } : {}) } },
});

/** The fields a row of any list may carry (`RowConfig`, `lock/rows.ts`), as its editor shows them. */
const ROW_KEYS = [
  'entity',
  'name',
  'icon',
  'secondary',
  'since',
  'options',
  'labels',
  'tap_action',
  'hold_action',
  'double_tap_action',
  'tone',
  'color',
] as const;

/**
 * A row's form: the entity, its name and icon, what it says, a select's (`select`: what its dropdown offers, its
 * words), its colours, what it answers, and when it shows on a card whose rows show on a condition (`shows`). Its colour has
 * none chosen by default: a light wears its bulb's on a card that shows them (`bulb`), the row the card's otherwise.
 */
const rowSchema = (
  bulb: boolean,
  shows: boolean,
  select: readonly HaFormSchemaItem[] = [],
): HaFormSchemaItem[] => [
  entityField(),
  nameIconFields(),
  selectField('secondary', ['area', 'last-changed', 'state', 'none'], { custom: true }),
  sinceField(),
  ...select,
  fieldRow(toneField(), accentField('color', { item: bulb ? 'bulb' : 'card' })),
  actionFields(),
  ...(shows ? [rowWhenField()] : []),
];

/**
 * A list of rows as its editor shows each: the keys a row may carry and its form, a select's with the options its
 * dropdown offers (of those it lists, in Home Assistant's words) and its words for them (#96) — its words alone where
 * the row names a tap of its own, which opens no dropdown.
 */
export function rowItems(
  bulb = false,
  shows = false,
): Pick<RowsListSpec, 'keys' | 'schema' | 'schemaOf' | 'choices'> {
  const [options, labels] = selectRowFields();
  const plain = rowSchema(bulb, shows);
  const select = rowSchema(bulb, shows, [options, labels]);
  const worded = rowSchema(bulb, shows, [labels]);
  return {
    keys: shows ? [...ROW_KEYS, 'show_when'] : ROW_KEYS,
    schema: select,
    schemaOf: (item) => (!isSelectRow(item) ? plain : item['tap_action'] ? worded : select),
    choices: selectRowChoices,
  };
}

/* ---------- a list in parts, and rows on a condition (#157) ---------- */

/**
 * A section among a list's rows as its editor shows it: its label, and whether a hairline stands over it, each in
 * the editor's own word for it (a row's `label` is another thing).
 */
export const SECTION_FORM: readonly HaFormSchemaItem[] = [
  fieldRow(textField('label'), boolField('line')),
];
export const sectionLabels = formLabels({ label: 'editor.section', line: 'editor.line' });

/** How a condition is asked: not at all, a number above one, below one or between two, a state that is a word or is not. */
const WHEN_MODES = ['always', 'above', 'below', 'between', 'state', 'state_not'] as const;
type WhenMode = (typeof WHEN_MODES)[number];

const MODE_WORDS: Readonly<Record<WhenMode, MessageKey>> = {
  always: 'editor.when_always',
  above: 'editor.when_above',
  below: 'editor.when_below',
  between: 'editor.when_between',
  state: 'editor.when_state_is',
  state_not: 'editor.when_state_not',
};

/** What a condition's choice asks for, each a field beside it: named so that one condition stands in a form. */
const WHEN_PARTS = ['when_above', 'when_below', 'when_state', 'when_entity'] as const;

/**
 * A condition among a form's fields, by its key (`show_when`: a `ShowWhen`). One field, which Fluvy's editor draws as
 * how it is asked and what that asks for (`withConditions`), writing the condition they say (`foldConditions`): the
 * fields that cannot act are never shown. A row's keeps to the card's while it names none (`follows`: the card's
 * key), and its first choice then says so.
 */
export const whenField = (name: string, follows?: string): HaFormSchemaItem => ({
  name,
  selector: { object: {} },
  condition: follows ? { follows } : {},
});

/** When a row shows (`show_when`), on a card with a condition for every row (`show_rows_when`). */
export const rowWhenField = (): HaFormSchemaItem => whenField('show_when', 'show_rows_when');

/** A schema's condition fields, through its rows. */
export const conditionsOf = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
  schema.flatMap((item) =>
    item.schema ? conditionsOf(item.schema) : item.condition ? [item] : [],
  );

type Bag = Readonly<Record<string, unknown>>;

const bagOf = (value: unknown): Bag =>
  typeof value === 'object' && value !== null ? (value as Bag) : {};

/** How a condition is asked, by the parts it holds: one it holds without a value yet is asked all the same. */
const modeOf = (when: unknown): WhenMode => {
  const has = (key: string): boolean => key in bagOf(when);
  return has('above')
    ? has('below')
      ? 'between'
      : 'above'
    : has('below')
      ? 'below'
      : has('state')
        ? 'state'
        : has('state_not')
          ? 'state_not'
          : 'always';
};

/** How a form's condition stands: how it is asked, the states its entity offers, whether it keeps to the card's. */
export interface ConditionStand {
  readonly mode: WhenMode;
  readonly states: readonly SelectOption[];
  readonly follows: boolean;
}

/**
 * How the conditions of a form stand in what it holds (`data`), by their names: a state's choices are what the entity
 * read lists and says now, and out of reach, in Home Assistant's words, with those already chosen; `card` is the
 * card's form, which a row's condition may follow.
 */
export function standsOf(
  schema: readonly HaFormSchemaItem[],
  data: Bag,
  hass: HomeAssistant | undefined,
  card?: Bag,
): Readonly<Record<string, ConditionStand>> {
  return Object.fromEntries(
    conditionsOf(schema).map((field) => {
      const when = bagOf(data[field.name]);
      const mode = modeOf(when);
      const state = hass?.states[String(when['entity'] ?? data['entity'])];
      const listed: unknown = state?.attributes['options'];
      const values =
        mode === 'state' || mode === 'state_not'
          ? [
              ...(Array.isArray(listed) ? listed.map(String) : []),
              ...(state ? [state.state, 'unavailable'] : []),
              ...statesOf(when[mode]),
            ]
          : [];
      const stand: ConditionStand = {
        mode,
        states: [...new Set(values)].map((value) => ({
          value,
          label: (state && hass?.formatEntityState?.(state, value)) || value,
        })),
        follows: mode === 'always' && modeOf(card?.[field.condition?.follows ?? '']) !== 'always',
      };
      return [field.name, stand];
    }),
  );
}

/** A condition's fields as it stands: how it is asked, what that asks for beside it, and the entity it reads. */
function conditionFields(
  name: string,
  { mode, states, follows }: ConditionStand,
): HaFormSchemaItem[] {
  const asked = choiceField(
    name,
    WHEN_MODES.map(
      (value) =>
        [value, value === 'always' && follows ? 'editor.when_follows' : MODE_WORDS[value]] as const,
    ),
  );
  if (mode === 'always') return [asked];
  const asks: HaFormSchemaItem[] =
    mode === 'state' || mode === 'state_not'
      ? [
          {
            name: 'when_state',
            selector: {
              select: {
                multiple: true,
                custom_value: true,
                mode: 'dropdown',
                options: [...states],
              },
            },
          },
        ]
      : [
          ...(mode === 'below' ? [] : [anyNumberField('when_above')]),
          ...(mode === 'above' ? [] : [anyNumberField('when_below')]),
        ];
  return [
    fieldRow(asked, ...asks),
    { ...entityField(undefined, 'when_entity', false), helper: 'editor.when_entity_helper' },
  ];
}

/** A schema with each condition field as it stands (`stands`, by its name), through its rows: itself where it has none. */
export const withConditions = (
  schema: readonly HaFormSchemaItem[],
  stands: Readonly<Record<string, ConditionStand>>,
): readonly HaFormSchemaItem[] =>
  Object.keys(stands).length
    ? schema.flatMap((item) => {
        const stand = item.condition && stands[item.name];
        return item.schema
          ? [{ ...item, schema: withConditions(item.schema, stands) }]
          : stand
            ? conditionFields(item.name, stand)
            : [item];
      })
    : schema;

/**
 * A form's data with its conditions (`fields`) as their fields hold them: how each is asked under its own name, its
 * parts beside it.
 */
export function unfoldConditions(data: Bag, fields: readonly HaFormSchemaItem[]): Bag {
  if (!fields.length) return data;
  const next: Record<string, unknown> = { ...data };
  for (const { name } of fields) {
    const when = bagOf(data[name]);
    const mode = modeOf(when);
    next[name] = mode;
    next['when_above'] = when['above'] ?? undefined;
    next['when_below'] = when['below'] ?? undefined;
    next['when_state'] = statesOf(when[mode === 'state_not' ? mode : 'state']);
    next['when_entity'] = when['entity'];
  }
  return next;
}

/**
 * A form's value with its conditions (`fields`) back as the config holds them (`ShowWhen`): the parts the choice asks
 * for (a bound not typed yet keeps its place), none at all for "always"; one whose fields stand as they were handed
 * (`held`) stays as the config wrote it.
 */
export function foldConditions(
  value: Bag,
  held: Bag,
  fields: readonly HaFormSchemaItem[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...value };
  for (const field of fields) {
    const { name } = field;
    const before = unfoldConditions(held, [field]);
    const touched = [name, ...WHEN_PARTS].some(
      (key) => JSON.stringify(next[key]) !== JSON.stringify(before[key]),
    );
    const mode = next[name];
    const [above, below, states, entity] = WHEN_PARTS.map((key) => next[key]);
    for (const key of WHEN_PARTS) delete next[key];
    if (!touched) {
      if (held[name] === undefined) delete next[name];
      else next[name] = held[name];
    } else if (mode === 'always' || !WHEN_MODES.includes(mode as WhenMode)) delete next[name];
    else {
      const words = statesOf(states);
      next[name] = {
        ...(typeof entity === 'string' && entity ? { entity } : {}),
        // a bound follows its figure from above to below and back
        ...(mode === 'above' || mode === 'between'
          ? { above: above ?? (mode === 'above' ? below : undefined) ?? null }
          : {}),
        ...(mode === 'below' || mode === 'between'
          ? { below: below ?? (mode === 'below' ? above : undefined) ?? null }
          : {}),
        ...(mode === 'state' || mode === 'state_not'
          ? { [mode]: words.length === 1 ? words[0] : words }
          : {}),
      };
    }
  }
  return next;
}

/** The choices of a unit select: the automatic one, then each unit by its symbol. */
export const unitChoices = (units: readonly string[]): SelectOption[] => [
  { value: 'auto', label: editorWord('option.auto') },
  ...units.map((value) => ({ value, label: value })),
];

/** Every unit a card's figures may be asked in: the ladders of power, energy, volume and distance. */
const EVERY_LADDER: readonly string[] = Object.values(LADDERS).flat();
const DECIMALS: readonly OptionWord[] = ['auto', '0', '1', '2', '3'];

/**
 * The unit a card's figures read in and their decimals, on one row — the last before the actions. `unit` offers the
 * ladders given (every one by default, narrowed to the entity's class at render where the card says so, through
 * `unitChoicesOf`), or a unit typed; `decimals` is fixed, or automatic (the sensor's own precision, else the figure's
 * size). Neither default is written (`NUMBER_DEFAULTS`). `when` says while the unit can act: an entity whose unit
 * has no ladder gives it nothing to do (`hasLadder`).
 */
export const numberFields = ({
  units = EVERY_LADDER,
  when,
  decimals = DECIMALS,
}: {
  units?: readonly string[];
  when?: HaFormSchemaItem['when'];
  decimals?: readonly OptionWord[];
} = {}): HaFormSchemaItem => {
  const unit: HaFormSchemaItem = {
    name: 'unit',
    selector: {
      select: { mode: 'dropdown', custom_value: true, options: unitChoices(units) },
    },
  };
  return fieldRow(when ? onlyWhen(when, unit) : unit, selectField('decimals', decimals));
};

/** What the row shows where the config says nothing: automatic, both. */
export const NUMBER_DEFAULTS = { unit: 'auto', decimals: 'auto' } as const;

/** The unit of the card's entity as the editor's `when` and `choices` read it: none where the house does not hold it. */
const unitOf = (
  data: Readonly<Record<string, unknown>>,
  hass?: HomeAssistant,
): string | undefined => {
  const id = data['entity'];
  return typeof id === 'string' && hass?.states[id] ? resolveEntity(hass, id).unit : undefined;
};

/** Whether the card's entity's figures can be asked in another unit: its unit converts (one not there: shown). */
export const hasLadder = (
  data: Readonly<Record<string, unknown>>,
  hass?: HomeAssistant,
): boolean => {
  const unit = unitOf(data, hass);
  return unit === undefined || unitClass(unit) !== undefined;
};

/** The units the editor offers a card's entity: its class's ladder (a class without one: typed), as its `choices`. */
export const unitChoicesOf: EditorChoices = (config, hass) => {
  const unit = unitOf(config, hass);
  return unit !== undefined && unitClass(unit) ? { unit: unitChoices(ladderOf(unit)) } : {};
};
