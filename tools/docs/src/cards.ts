/**
 * The cards as the code says them: for every card of the catalogue its name, what it is, every key its editor shows
 * (the editor's word and the sentence under it, what the key holds, what the card does when it is left out, a
 * choice's values), its lists with their item's fields, the older names it still reads, and its example from the
 * gallery with each of its layouts. Everything `docs/` says about a card is made from this (`pages.ts`) and held to
 * it (`build.ts --check`), so the docs cannot drift from the editors' contract (`Card` in the cards' `shared/base.ts`).
 * What a key does is said in a sentence of the docs' own (`meanings.ts`): the pages print that one, and the data
 * keeps the editor's helper beside it.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { HaFormSchemaItem, LovelaceCardConfig, LovelaceConfigForm } from '@fluvy/core';
import about from '@fluvy/core/locales/en/cards-about.json';
import core from '@fluvy/core/locales/en/core.json';
import { drawn, GALLERY, layoutKey, shortName, type Drawn, type Example } from './gallery.js';
import { MEANINGS } from './meanings.js';
import type { OptionsCard } from './options.js';

// the cards and core read the DOM as they load
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
const { cardKey } = await import('@fluvy/core');
const form = await import('../../../packages/cards/src/shared/form.js');

type Schema = readonly HaFormSchemaItem[];

/** One list of a card, as its editor declares it (`RowsListSpec`). */
interface ListSpec {
  readonly key: string;
  readonly alias?: string;
  readonly title: string;
  readonly helper?: string;
  readonly schema: Schema;
  readonly idKey?: string;
  readonly sections?: boolean | 'labels';
  readonly computeLabel?: LovelaceConfigForm['computeLabel'];
  readonly computeHelper?: Helper;
}
type Helper = (
  schema: HaFormSchemaItem,
  localize: (key: string) => string,
  data?: Readonly<Record<string, unknown>>,
) => string | undefined;
type Defaults = (config: LovelaceCardConfig, hass: undefined) => Readonly<Record<string, unknown>>;
/** What a card's editor shows (its class's, or the module a card every page carries keeps it in). */
interface Editor {
  readonly base: readonly string[];
  readonly keys: readonly string[];
  readonly lists?: readonly ListSpec[];
  readonly defaults?: Defaults | undefined;
  getConfigForm(): LovelaceConfigForm & { computeHelper?: Helper };
}
interface Move {
  readonly from: string;
  readonly to: string;
  readonly when?: (value: unknown) => boolean;
}
interface Aliases {
  readonly keys?: readonly Move[];
  readonly items?: Readonly<Record<string, readonly Move[]>>;
  readonly drop?: readonly string[];
}
interface Contract {
  readonly aliases?: Aliases;
  editor(): Promise<Editor>;
}

/** A key of a card, or of an item of one of its lists, as the docs say it. */
export interface Key {
  readonly key: string;
  /** The editor's word for it. */
  readonly label: string;
  /** The sentence the editor says under it. */
  readonly helper?: string;
  /** What it does, in the docs' own sentence, and the name of the entry of `MEANINGS` it is read from. */
  readonly meaning?: string;
  readonly meaningOf?: string;
  /** What it holds, in a word: `entity`, `text`, `number`, `boolean`, `choice`, `action`, `map` (keys of its own). */
  readonly type: string;
  readonly required: boolean;
  /** What the card does when the key is left out, where its editor declares it. */
  readonly default?: unknown;
  /** The same in words, where it is no value to write (a tone left out is the card's own). */
  readonly defaultWords?: string;
  /** A choice's values, each with the editor's word for it. */
  readonly values: readonly { readonly value: string; readonly label: string }[];
  /** A number's range, as the editor holds it ("0 to 100, in steps of 5"). */
  readonly range?: string;
  /** The folded group of the editor it stands in ("Interactions"). */
  readonly group?: string;
}

/** A list of a card: its key, its word, and the fields an item may carry. */
export interface List {
  readonly key: string;
  readonly label: string;
  readonly helper?: string;
  /** What it holds, in the docs' own sentence, and the name of the entry of `MEANINGS` it is read from. */
  readonly meaning?: string;
  readonly meaningOf?: string;
  /** The field that identifies an item: a bare id stands for an item with nothing else. */
  readonly id: string;
  /** What may stand between its items: a section's label and a divider, or labels alone. */
  readonly sections?: 'sections' | 'labels';
  readonly item: readonly Key[];
}

/** An older name a card still reads: where it stood, and what it is read as (none: folded into another key). */
export interface Read {
  readonly from: string;
  readonly to?: string;
  /** Whether only some of its values are read so (`forecast: none` → `show_forecast: false`). */
  readonly partly: boolean;
}

/** The select a card's layouts are chosen by. */
export interface Layout {
  readonly key: string;
  readonly values: readonly string[];
  /** The value the editor shows on a new card. */
  readonly default: string;
}

export interface CardDoc {
  readonly tag: string;
  /** Its short name: what its page and its pictures are named by. */
  readonly short: string;
  readonly name: string;
  readonly description: string;
  /** The section of the index it stands in. */
  readonly section: string;
  readonly keys: readonly Key[];
  readonly lists: readonly List[];
  readonly reads: readonly Read[];
  readonly layout?: Layout;
  /** Its example from the gallery, and that example as it is drawn: the base, then each other layout. */
  readonly example?: Example;
  readonly drawn: readonly Drawn[];
  /**
   * Its example with every option its editor shows for it, as YAML (`options.ts`): the keys left out written at their
   * defaults, those that follow the house or have none said as comments, in the layout the picture shows.
   */
  readonly allOptions?: string;
  /** Every key a configuration of it may carry: the form's and the lists', with the older names of its lists. */
  readonly known: ReadonlySet<string>;
  /** Its configuration as the card reads it: the older names moved to the newer ones. */
  normalise(config: LovelaceCardConfig): LovelaceCardConfig;
}

/** The sections of the index, each the tags it holds in order. */
export const SECTIONS: ReadonlyArray<readonly [title: string, tags: readonly string[]]> = [
  [
    'Everyday',
    [
      'fluvy-tile-card',
      'fluvy-tiles-card',
      'fluvy-template-card',
      'fluvy-light-card',
      'fluvy-slider-card',
      'fluvy-lights-card',
      'fluvy-thermostat-card',
      'fluvy-entities-card',
      'fluvy-items-card',
      'fluvy-media-card',
      'fluvy-now-playing-card',
      'fluvy-remote-card',
      'fluvy-cover-card',
      'fluvy-fan-card',
      'fluvy-vacuum-card',
      'fluvy-lock-card',
      'fluvy-alarm-card',
      'fluvy-camera-card',
      'fluvy-cameras-card',
      'fluvy-printer-card',
      'fluvy-appliance-card',
      'fluvy-appliances-card',
      'fluvy-vehicle-card',
      'fluvy-weather-card',
      'fluvy-sensor-card',
      'fluvy-readouts-card',
      'fluvy-people-card',
      'fluvy-openings-card',
      'fluvy-alerts-card',
    ],
  ],
  ['Rooms and the map', ['fluvy-room-card', 'fluvy-map-card']],
  [
    'Structure and navigation',
    [
      'fluvy-hello-card',
      'fluvy-chips-card',
      'fluvy-heading-card',
      'fluvy-expander-card',
      'fluvy-swipe-card',
      'fluvy-web-card',
    ],
  ],
  [
    'Scenes, actions and helpers',
    [
      'fluvy-scene-card',
      'fluvy-scenes-card',
      'fluvy-actions-card',
      'fluvy-helpers-card',
      'fluvy-todo-card',
      'fluvy-timer-card',
      'fluvy-updates-card',
      'fluvy-automations-card',
    ],
  ],
  [
    'Energy',
    [
      'fluvy-energy-period-card',
      'fluvy-energy-usage-card',
      'fluvy-energy-card',
      'fluvy-energy-flow-card',
      'fluvy-energy-balance-card',
      'fluvy-grid-card',
      'fluvy-batteries-card',
      'fluvy-ev-charger-card',
      'fluvy-energy-sankey-card',
      'fluvy-energy-score-card',
      'fluvy-energy-devices-card',
      'fluvy-meters-card',
      'fluvy-gauge-card',
      'fluvy-stat-tiles-card',
      'fluvy-production-card',
      'fluvy-history-bars-card',
      'fluvy-chart-card',
      'fluvy-bars-card',
      'fluvy-distribution-card',
      'fluvy-humidity-card',
    ],
  ],
  ['Time', ['fluvy-clock-card', 'fluvy-calendar-card']],
];

/** A card's name and what it is, as English says them (the catalogue's `cards` and `cards-about`). */
function words(tag: string): { name: string; description: string } {
  const key = cardKey(tag) as keyof typeof core.cards;
  return { name: core.cards[key], description: about['cards-about'][key] };
}

/** The docs' sentence for a key, the more particular entry first: the card's own, then every card's. */
function meaningOf(names: readonly string[]): { meaning?: string; meaningOf?: string } {
  const found = names.find((name) => MEANINGS[name] !== undefined);
  return found ? { meaning: MEANINGS[found] as string, meaningOf: found } : {};
}

/**
 * The keys a card's layouts may be chosen by, the first its editor shows as a select: `variant` on most, a tile's
 * `size`, an Expander's `style`, and the dial a humidity card has in place of a layout.
 */
const LAYOUT_KEYS = ['variant', 'size', 'style', 'gauge'] as const;

/**
 * The choices that declare no default, each with what leaving it out means: a tone is the card's own, and of several
 * chosen of a list none chosen is everything its device offers, or nothing added. Every other select and switch of
 * a card's form declares what the card does without it (`undeclared` names the ones that do not).
 */
export const UNDECLARED: Readonly<Record<string, string>> = {
  tone: 'the card’s own',
  modes: 'what the device offers',
  drinks: 'what the device offers',
  include: 'nothing more',
  exclude: 'nothing',
  confirm: 'each appliance’s own',
  position_presets: 'none',
  tilt_presets: 'none',
};

/**
 * Every field of a form through its rows, each with the folded group it stands in; a group that holds its fields under
 * a key of its own (a card's colours by state) is that key's, one field.
 */
const flatten = (
  schema: Schema,
  group?: string,
): { readonly field: HaFormSchemaItem; readonly group?: string }[] =>
  schema.flatMap((item) =>
    item.schema && !form.holdsOwn(item)
      ? flatten(item.schema, item.type === 'expandable' ? item.title : group)
      : item.type === 'constant'
        ? []
        : [{ field: item, ...(group ? { group } : {}) }],
  );

type Selector = Readonly<Record<string, unknown>>;
const selectorOf = (field: HaFormSchemaItem): readonly [kind: string, options: Selector] => {
  const [kind = '', options] = Object.entries(field.selector ?? {})[0] ?? [];
  return [kind, (options ?? {}) as Selector];
};

/** A select's choices, each value with the editor's word for it; a group's keys, where it holds its own. */
const choicesOf = (field: HaFormSchemaItem): { value: string; label: string }[] => {
  if (field.schema) return field.schema.map(({ name }) => ({ value: name, label: name }));
  const [kind, options] = selectorOf(field);
  if (kind !== 'select') return [];
  return (
    (options['options'] ?? []) as readonly (string | { value: string; label?: string })[]
  ).map((option) =>
    typeof option === 'string'
      ? { value: option, label: option }
      : { value: option.value, label: option.label ?? option.value },
  );
};

/** What a field holds, in a word. */
function typeOf(field: HaFormSchemaItem): string {
  const [kind, options] = selectorOf(field);
  const many = options['multiple'] === true;
  if (field.condition) return 'condition';
  if (field.schema) return 'map';
  switch (kind) {
    case 'entity': {
      const domains = [options['domain'] ?? []].flat().map(String);
      return `${many ? 'entities' : 'entity'}${domains.length ? ` (${domains.join(', ')})` : ''}`;
    }
    case 'entity_name':
      return 'name';
    case 'select':
      return `${many ? 'choices' : 'choice'}${options['custom_value'] === true ? ' or text' : ''}`;
    case 'ui_color':
    case 'color_rgb':
      return 'colour';
    case 'ui_action':
      return 'action';
    default:
      return kind || 'text';
  }
}

/** From where a bound of a number's field bounds nothing: the form's guard against a slip, far past any reading. */
const NO_BOUND = 100_000;

/** A number's range as its field holds it; none where it takes any. */
function rangeOf(field: HaFormSchemaItem): string | undefined {
  const [kind, options] = selectorOf(field);
  if (kind !== 'number') return undefined;
  const { step, unit_of_measurement: unit } = options;
  const [min, max] = [options['min'], options['max']].map((bound) =>
    typeof bound === 'number' && Math.abs(bound) >= NO_BOUND ? undefined : bound,
  );
  const of = (value: unknown): string => `${String(value)}${unit ? ` ${String(unit)}` : ''}`;
  const span =
    min !== undefined && max !== undefined
      ? `${of(min)} to ${of(max)}`
      : min !== undefined
        ? `${of(min)} or more`
        : max !== undefined
          ? `up to ${of(max)}`
          : '';
  const steps = typeof step === 'number' && step !== 1 ? `in steps of ${step}` : '';
  // a step alone is the form's, not a range
  return span ? [span, steps].filter(Boolean).join(', ') : undefined;
}

/**
 * A key as the docs say it, from the fields that show it (a key the form shows in turns, one select for a sensor
 * alone and another beside others, is said once, with every value any of them offers).
 */
function keyOf(
  fields: readonly { readonly field: HaFormSchemaItem; readonly group?: string }[],
  said: { readonly label: string; readonly helper?: string | undefined },
  defaults: Readonly<Record<string, unknown>>,
  meanings: readonly string[],
): Key {
  const [{ field, group } = { field: { name: '' } as HaFormSchemaItem }] = fields;
  const [kind, options] = selectorOf(field);
  const values = fields.flatMap(({ field: shown }) => choicesOf(shown));
  const unique = values.filter(
    (choice, index) => values.findIndex((other) => other.value === choice.value) === index,
  );
  const declared = field.name in defaults;
  // an action's default is its selector's own: what a tap does while none is chosen
  const action = kind === 'ui_action' ? options['default_action'] : undefined;
  const range = rangeOf(field);
  const required = fields.every(({ field: shown }) => shown.required === true);
  const undeclared =
    !declared && !required
      ? kind === 'ui_action' && action === undefined
        ? 'the card’s own'
        : kind === 'select' || kind === 'boolean'
          ? UNDECLARED[field.name]
          : undefined
      : undefined;
  return {
    key: field.name,
    label: said.label,
    ...(said.helper ? { helper: said.helper } : {}),
    ...meaningOf(meanings.map((name) => name.replace('*', field.name))),
    type: typeOf(field),
    required,
    ...(declared
      ? { default: defaults[field.name] }
      : action !== undefined
        ? { default: action }
        : {}),
    ...(undeclared ? { defaultWords: undeclared } : {}),
    values: unique,
    ...(range ? { range } : {}),
    ...(group ? { group } : {}),
  };
}

/** The fields of a schema by their key, in the order each is first shown. */
const byKey = (
  schema: Schema,
): Map<string, { readonly field: HaFormSchemaItem; readonly group?: string }[]> => {
  const shown = new Map<string, { readonly field: HaFormSchemaItem; readonly group?: string }[]>();
  for (const entry of flatten(schema))
    shown.set(entry.field.name, [...(shown.get(entry.field.name) ?? []), entry]);
  return shown;
};

/** Every card of the catalogue as the docs say it, in the index's order. */
export async function readCards(): Promise<readonly CardDoc[]> {
  const [{ catalogue }, rows, shared, options] = await Promise.all([
    import('@fluvy/cards'),
    import('../../../packages/cards/src/shared/rows-editor.js'),
    import('../../../packages/cards/src/shared/config.js'),
    import('./options.js'),
  ]);
  const word = (key: string | undefined): string | undefined =>
    key ? form.editorWord(key as Parameters<typeof form.editorWord>[0]) : undefined;
  const asIs = (key: string): string => key;

  const entries = new Map((await catalogue()).map((entry) => [entry[0], entry] as const));
  const placed = SECTIONS.flatMap(([, tags]) => tags);
  const missing = [...entries.keys()].filter((tag) => !placed.includes(tag));
  if (missing.length) throw new Error(`cards without a section: ${missing.join(', ')}`);

  const cards: CardDoc[] = [];
  for (const [section, tags] of SECTIONS)
    for (const tag of tags) {
      const entry = entries.get(tag);
      if (!entry) throw new Error(`${tag} is in a section but not in the catalogue`);
      const card = entry[1] as unknown as Contract;
      const short = shortName(tag);
      const editor = await card.editor();
      const config = editor.getConfigForm();
      const lists = editor.lists ?? [];
      const listed = new Set(
        lists.flatMap((list) => [list.key, ...(list.alias ? [list.alias] : [])]),
      );
      const defaults =
        (rows.editorDefaults(config, editor.defaults as never) as Defaults | undefined)?.(
          { type: `custom:${tag}` },
          undefined,
        ) ?? {};

      // a list's own key is said once, as the list
      const keys = [...byKey(config.schema)]
        .filter(([name]) => !listed.has(name))
        .map(([, fields]) => {
          const [{ field } = { field: { name: '' } as HaFormSchemaItem }] = fields;
          return keyOf(
            fields,
            {
              label: config.computeLabel?.(field, asIs) ?? field.name,
              helper: config.computeHelper?.(field, asIs, defaults) ?? word(field.helper),
            },
            defaults,
            [`${short}.*`, '*'],
          );
        });

      const select = LAYOUT_KEYS.map((name) => keys.find((key) => key.key === name)).find(
        (key) => key?.type === 'choice',
      );
      const example = GALLERY[tag];
      const aliases = card.aliases;
      const specs = [...(aliases ? [aliases] : []), shared.COMMON_ALIASES];
      const names = new Set(keys.map((key) => key.key));
      cards.push({
        tag,
        short,
        ...words(tag),
        section,
        keys,
        lists: lists.map((list) => ({
          key: list.key,
          label: word(list.title) ?? list.key,
          ...(list.helper ? { helper: word(list.helper) ?? '' } : {}),
          ...meaningOf([`${short}.${list.key}[]`, `${list.key}[]`]),
          id: list.idKey ?? 'entity',
          ...(list.sections
            ? { sections: list.sections === 'labels' ? 'labels' : 'sections' }
            : {}),
          item: [...byKey(list.schema)].map(([, fields]) => {
            const [{ field } = { field: { name: '' } as HaFormSchemaItem }] = fields;
            const label =
              list.computeLabel?.(field, asIs) ??
              config.computeLabel?.(field, asIs) ??
              rows.itemLabels(field, asIs);
            // the editor's rule: the list's words, the card's where the list's are not its own alone, the shared ones
            const helper = rows.itemHelper(list as never, config.computeHelper as never)(
              field,
              asIs,
            );
            // a field that carries no floating label on purpose (a colour well) is named by the word under it
            return keyOf(
              fields,
              label ? { label, helper } : { label: helper ?? field.name },
              // an item's fields declare no default of their own: a key left out follows the card
              {},
              [`${short}.${list.key}[].*`, `${list.key}[].*`, '[].*'],
            );
          }),
        })),
        reads: [
          ...(aliases?.keys ?? []).map((move) => ({
            from: move.from,
            to: move.to,
            partly: move.when !== undefined,
          })),
          ...lists
            .filter((list) => list.alias)
            .map((list) => ({ from: list.alias as string, to: list.key, partly: false })),
          ...Object.entries(aliases?.items ?? {}).flatMap(([list, moves]) =>
            moves.map((move) => ({
              from: `${list}[].${move.from}`,
              to: `${list}[].${move.to}`,
              partly: move.when !== undefined,
            })),
          ),
          ...(aliases?.drop ?? []).map((from) => ({ from, partly: false })),
          // the names every card once read, where this one has the key they are read as
          ...(shared.COMMON_ALIASES.keys ?? [])
            .filter((move) => names.has(move.to) && !names.has(move.from))
            .filter((move) => !(aliases?.keys ?? []).some((own) => own.from === move.from))
            .map((move) => ({ from: move.from, to: move.to, partly: false })),
        ],
        ...(select
          ? {
              layout: {
                key: select.key,
                values: select.values.map((choice) => choice.value),
                default: String(select.default ?? ''),
              },
            }
          : {}),
        ...(example ? { example } : {}),
        drawn: example ? drawn(tag, example) : [],
        ...(example
          ? {
              // the layout the picture shows where the example's card takes one by itself (a room with a picture)
              allOptions: options.optionsYaml(
                await options.cardOptions(card as unknown as OptionsCard, {
                  ...example.config,
                  ...(example.own ? { [layoutKey(example)]: example.own } : {}),
                }),
                true,
              ),
            }
          : {}),
        known: new Set(['type', ...names, ...listed]),
        normalise: (given) => shared.normaliseConfig(given, ...specs),
      });
    }
  return cards;
}
