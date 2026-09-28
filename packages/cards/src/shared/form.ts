import {
  localize,
  type HaFormSchemaItem,
  type HomeAssistant,
  type KeyOf,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { TONES } from '@fluvy/ui';

/** The words every card's editor shares, by field name: a card maps only its own fields (or another word). */
export const SHARED_LABELS: Readonly<Record<string, MessageKey>> = {
  title: 'editor.title',
  subtitle: 'editor.subtitle',
  icon: 'editor.icon',
  tone: 'editor.tone',
  color: 'editor.color',
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
const editorLanguage = (): Pick<HomeAssistant, 'language'> => ({
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
export function formLabels(map: Readonly<Record<string, MessageKey>> = {}): {
  readonly computeLabel: FormLabeler;
} {
  return {
    computeLabel: (schema: HaFormSchemaItem) => {
      const key = map[schema.name] ?? SHARED_LABELS[schema.name];
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
export const iconField = (name = 'icon'): HaFormSchemaItem => ({ name, selector: { icon: {} } });
export const boolField = (name: string): HaFormSchemaItem => ({ name, selector: { boolean: {} } });
export const numberField = (
  name: string,
  min: number,
  max: number,
  step = 1,
): HaFormSchemaItem => ({ name, selector: { number: { min, max, step, mode: 'box' } } });
/** A choice among values the catalogue names (a value without a word does not compile), in the editor's language. */
export const selectField = (name: string, options: readonly OptionWord[]): HaFormSchemaItem => ({
  name,
  selector: {
    select: {
      mode: 'dropdown',
      options: options.map((value) => ({
        value,
        label: localize(editorLanguage(), `option.${value}`),
      })),
    },
  },
});
export const actionField = (name = 'tap_action'): HaFormSchemaItem => ({
  name,
  selector: { ui_action: {} },
});

/** What a card answers a tap and a still press with, on one row. */
export const actionFields = (): HaFormSchemaItem =>
  fieldRow(actionField('tap_action'), actionField('hold_action'));

/** The palette's tones as a dropdown, each by its word. */
export const toneSelector = (language: Pick<HomeAssistant, 'language'> = editorLanguage()) => ({
  select: {
    mode: 'dropdown',
    options: TONES.map((value) => ({ value, label: localize(language, `tone.${value}`) })),
  },
});

/** Two fields side by side: one row of the editor (Home Assistant's form grid). */
export const fieldRow = (...schema: HaFormSchemaItem[]): HaFormSchemaItem => ({
  type: 'grid',
  name: '',
  flatten: true,
  schema,
});

/** A card's tone, from the palette's tones. */
export const toneField = (): HaFormSchemaItem => ({ name: 'tone', selector: toneSelector() });

/**
 * A card's or an item's own colour: Home Assistant's colour picker — its named swatches, shown in the palette's
 * colours where the look reaches the editor, or any hex typed — with the palette's accent as its default.
 */
export const accentField = (name = 'color'): HaFormSchemaItem => ({
  name,
  selector: { ui_color: { default_color: 'primary', include_none: false, include_state: false } },
});

/** A tone and a colour, on one row. */
export const colourFields = (): HaFormSchemaItem => fieldRow(toneField(), accentField());

/** A card's head: its title and its subtitle, on one row. */
export const titleFields = (): HaFormSchemaItem =>
  fieldRow(textField('title'), textField('subtitle'));

/** A card's icon and its tone, on one row. */
export const iconToneFields = (): HaFormSchemaItem => fieldRow(iconField(), toneField());

/** A name and an icon, on one row (a card's, or an item's in a list). */
export const nameIconFields = (): HaFormSchemaItem => fieldRow(textField('name'), iconField());

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
