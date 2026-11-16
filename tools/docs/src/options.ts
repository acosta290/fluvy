/**
 * A card's configuration both ways a page prints it, from the editors' contract (`Card` in the cards'
 * `shared/base.ts`): what a person has to write, and every option the card's editor shows for it. The docs and the
 * demo read it from here, so the two never say different things.
 *
 * - `minimal`: the configuration without what its editor would never have written — a key at the default the editor
 *   shows for it, a number's Automatic, a hook of the tests' (`_now`) — in the names the card reads today.
 * - `full`: after `type`, every key the editor shows for that configuration, in the editor's order (the fields that
 *   can act on it, `visibleFields`; a list where its field stands; a group that holds its own as one key), then what
 *   the configuration writes that its editor does not show now. A key the configuration writes keeps its value; one
 *   it leaves out takes the default the editor shows on a new card, written out. What is no such default is said and
 *   not written (`unset`), since written it would change what the card does, here or in the house it is copied to:
 *   a default that follows the house's settings (`HOUSE_KEYS`), its entities (a thermostat's modes are its device's)
 *   or the rest of the configuration (a grid's columns its layout's), a number's Automatic, what an action's picker
 *   does while none is chosen, and a key with no default at all (a name, a colour, a list). So `full` without its
 *   `unset` keys is `minimal` and defaults of the card's own: the card draws the two alike.
 *
 * A default may depend on the house's entities (a room whose area has a picture is a photo): read without a house,
 * as the docs do, it is the one the editor shows on a new card. Nothing here reads the page: it loads with what the
 * cards' `shared/form.ts` loads with.
 */
import type {
  HaFormSchemaItem,
  HomeAssistant,
  LovelaceCardConfig,
  LovelaceConfigForm,
} from '@fluvy/core';
import {
  COMMON_ALIASES,
  normaliseConfig,
  type AliasSpec,
} from '../../../packages/cards/src/shared/config.js';
import { holdsOwn, visibleFields } from '../../../packages/cards/src/shared/form.js';
import {
  automatic,
  editorDefaults,
  HOUSE_KEYS,
  type EditorDefaults,
  type RowsListSpec,
} from '../../../packages/cards/src/shared/rows-editor.js';
import { toYaml } from './yaml.js';

type Config = Readonly<Record<string, unknown>>;

/** What a card's editor shows, as far as its options go (the cards' `CardEditor`). */
export interface OptionsEditor {
  readonly lists?: readonly RowsListSpec[] | undefined;
  readonly defaults?: EditorDefaults | undefined;
  getConfigForm(): LovelaceConfigForm;
}

/** A card's class, as far as its options go: its editor, and the older names it still reads. */
export interface OptionsCard {
  readonly aliases?: AliasSpec | undefined;
  editor(): Promise<OptionsEditor>;
}

export interface Options {
  /** What a person has to write. */
  readonly minimal: Config;
  /** Every option the editor shows, each with its value, then what the configuration writes beside them. */
  readonly full: Config;
  /** The keys of `full` that are said and not written: the house's, and those with nothing to write. */
  readonly unset: ReadonlySet<string>;
}

/** Whether a value says nothing: none, or an empty text, list or map. */
const empty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (typeof value === 'object' && Object.keys(value).length === 0);

/**
 * Whether a configuration's value is the default its editor shows: the same, or the figure or the switch a select
 * words (`2` its "2", `true` its "true").
 */
const same = (held: unknown, shown: unknown): boolean =>
  JSON.stringify(held) === JSON.stringify(shown) ||
  (!empty(held) &&
    typeof held !== 'object' &&
    typeof shown !== 'object' &&
    String(held) === String(shown));

/** A form's fields through its rows, a group that holds its own as one field; a line of words holds nothing. */
const fieldsOf = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
  schema.flatMap((item) =>
    item.schema && !holdsOwn(item)
      ? fieldsOf(item.schema)
      : item.type === 'constant' || !item.name
        ? []
        : [item],
  );

/** What an action does while none is chosen, where its picker says it (`actionField`), as a configuration writes it. */
const actionOf = (field: HaFormSchemaItem | undefined): unknown => {
  const picker = field?.selector?.['ui_action'] as { default_action?: string } | undefined;
  return picker?.default_action ? { action: picker.default_action } : undefined;
};

/** A default as a configuration writes it: the figure a select words ("2") is the figure. */
const written = (value: unknown): unknown =>
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;

/** The lists' second names (`entities` beside `rows`), each with the key the editor writes its list under. */
const secondNames = (lists: readonly RowsListSpec[]): ReadonlyMap<string, string> =>
  new Map(lists.flatMap((list) => (list.alias ? [[list.alias, list.key] as const] : [])));

/**
 * A configuration as its editor holds it: no hook of the tests', and each list under its own key — one written under
 * its second name stands where the editor writes it back.
 */
function asHeld(config: Config, lists: readonly RowsListSpec[]): Config {
  const second = secondNames(lists);
  return Object.fromEntries(
    Object.entries(config).flatMap(([key, value]): [string, unknown][] => {
      if (key.startsWith('_')) return [];
      const own = second.get(key);
      if (!own) return [[key, value]];
      const named = config[own];
      return Array.isArray(named) && named.length ? [] : [[own, value]];
    }),
  );
}

/**
 * The keys an editor shows for what it holds (`asked`: the configuration over the defaults), in its order: its form's
 * fields that can act, a list where its field stands (under either of its names; after the form where it has none)
 * while its section can act, and the card's fields that section draws only with it.
 */
function shownKeys(
  form: LovelaceConfigForm,
  lists: readonly RowsListSpec[],
  asked: Config,
  hass: HomeAssistant | undefined,
): string[] {
  const visible = new Set(
    fieldsOf(visibleFields(form.schema, asked, hass)).map((field) => field.name),
  );
  const acts = new Map<string, boolean>();
  for (const list of lists) {
    const can = list.when?.(asked, hass) ?? true;
    acts.set(list.key, can);
    for (const name of list.fields ?? []) acts.set(name, can && visible.has(name));
  }
  const second = secondNames(lists);
  const names = fieldsOf(form.schema).map((field) => second.get(field.name) ?? field.name);
  return [...new Set([...names, ...acts.keys()])].filter(
    (name) => acts.get(name) ?? visible.has(name),
  );
}

/**
 * A configuration's options as its card's editor has them (`editor`), in the house `hass` (the fields that act and a
 * default may depend on its entities; none, as the docs read them). The configuration is in the card's newest names
 * (`cardOptions` reads the older ones).
 */
export function optionsOf(
  editor: OptionsEditor,
  config: LovelaceCardConfig,
  hass?: HomeAssistant,
): Options {
  const form = editor.getConfigForm();
  const lists = editor.lists ?? [];
  const own = asHeld(config, lists);
  const ask = editorDefaults(form, editor.defaults);
  /** What the editor shows where a configuration says nothing, in a house (or in none). */
  const defaultsIn = (house: HomeAssistant | undefined, asked: Config = own): Config =>
    ask?.(asked as LovelaceCardConfig, house) ?? {};
  const defaults = defaultsIn(hass);
  const unhoused = hass ? defaultsIn(undefined) : defaults;
  const fresh = defaultsIn(undefined, { type: own['type'] });
  /**
   * Whether a key's default is the house's: its settings' (`HOUSE_KEYS`), or its entities' — another one without the
   * house (a room whose area has a picture is a photo). A key that writes it holds the card to it, and is kept.
   */
  const housed = (key: string): boolean =>
    HOUSE_KEYS.has(key) || !same(defaults[key], unhoused[key]);
  /**
   * Whether a key's default follows something: the house, or the rest of the configuration — it is not the one the
   * editor shows on a new card in no house (a thermostat's modes are its device's, a grid's columns its layout's).
   * Written, it would stop following, here or in the house it is copied to.
   */
  const follows = (key: string): boolean => housed(key) || !same(defaults[key], fresh[key]);
  /**
   * Whether the card does the same without a key: its value is the default the editor shows with the key left out (a
   * default may follow the configuration: an appliance's layout is the one it names), and no default of the house's.
   */
  const spare = (key: string, value: unknown): boolean => {
    if (housed(key) || !(key in defaults)) return false;
    const rest = Object.fromEntries(Object.entries(own).filter(([name]) => name !== key));
    return same(value, defaultsIn(hass, rest)[key]);
  };

  const minimal = Object.fromEntries(
    Object.entries(own).filter(([key, value]) => !automatic(key, value) && !spare(key, value)),
  );

  const fields = new Map(fieldsOf(form.schema).map((field) => [field.name, field]));
  const unset = new Set<string>();
  const full: Record<string, unknown> = { type: own['type'] };
  for (const key of shownKeys(form, lists, { ...defaults, ...own }, hass)) {
    if (key in own) full[key] = own[key];
    else if (empty(defaults[key])) {
      unset.add(key);
      full[key] = actionOf(fields.get(key));
    } else {
      if (follows(key) || automatic(key, defaults[key])) unset.add(key);
      full[key] = written(defaults[key]);
    }
  }
  for (const [key, value] of Object.entries(own)) if (!(key in full)) full[key] = value;
  return { minimal, full, unset };
}

/** A configuration's options for its card (`card`: its class), whatever names the configuration is written in. */
export async function cardOptions(
  card: OptionsCard,
  config: LovelaceCardConfig,
  hass?: HomeAssistant,
): Promise<Options> {
  const specs = [...(card.aliases ? [card.aliases] : []), COMMON_ALIASES];
  return optionsOf(await card.editor(), normaliseConfig(config, ...specs), hass);
}

/** A card's options as YAML: every one of them (`all`), the unset ones as comments, or what a person has to write. */
export const optionsYaml = (options: Options, all: boolean): string =>
  all ? toYaml(options.full, options.unset) : toYaml(options.minimal);
