import {
  chartDefaults,
  plural,
  strings,
  type EntityName,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import type { ChartCaps, ChartPreset, Curve, FillKind } from '../shared/chart-config.js';
import {
  choiceField,
  editorLanguage,
  editorWord,
  editorLabels,
  entityField,
  fieldRow,
  nameField,
  numberFields,
  selectField,
  stateColoursField,
  stateLabel,
  textField,
  toneField,
  unitChoices,
  type FormLabeler,
} from '../shared/form.js';
import type { EditorChoices, FormHelper, RowsListSpec } from '../shared/rows-editor.js';
import { ladderOf, type NumberKeys } from '../shared/units.js';
import { timedAttributes, type Day } from './data/attribute.js';
import {
  HISTORY_STATS,
  PERIOD_MS,
  periodOf,
  PERIODS,
  SOURCES,
  sourceOf,
  STATS,
  type Period,
  type Source,
  type Stat,
} from './data/sources.js';
import { dayStart, DAY, spanOf } from './data/span.js';
import { CHART_PRESETS, resolveStyle, seriesColourField } from './engine/index.js';

/*
 * What a Chart card's config says, read without the card: its series as items, what it can draw, the windows it marks,
 * and its editor's list of series, their rows by where each is read from (its thresholds are every numeric card's:
 * `shared/thresholds.ts`, their rows `thresholdsList`).
 * Pure, so the card, its tests and its editor share it.
 */

const s = strings('chart-card');

/**
 * How a series is drawn: its line as the style draws it, an area under it, columns, its band of lows and highs, or its
 * states as words (#228) — a strip under the plot of the stretches it spent in each, on the plot's time.
 */
export type SeriesKind = 'line' | 'area' | 'columns' | 'band' | 'states';
/** The windows a card marks (`highlight`): the lowest, the highest, both, or none. */
export type Windows = 'none' | 'min' | 'max' | 'both';

/** A series of the chart: its entity and where it is read from, its name, its colour, how it is drawn and written. */
export interface ChartSeriesConfig extends NumberKeys {
  entity: string;
  name?: EntityName;
  /** Where its readings come from; none: a weather's forecast, a list where `attribute` is named, else its history. */
  source?: Source;
  /** The attribute that holds its list (`raw_today` reads `raw_tomorrow` after it); none: the usual ones. */
  attribute?: string;
  /** The list's keys where they are not the usual ones (`start`, `from`, `time` …; `value`, `price` …). */
  time_key?: string;
  value_key?: string;
  /**
   * Statistics: what each bucket reads (a meter's change, a measurement's mean by default), and how long one is; a
   * sensor's history: what each slot and point reads of its readings (their mean by default, `HISTORY_STATS`).
   */
  stat?: Stat;
  period?: Period;
  tone?: Tone;
  color?: string;
  curve?: Curve;
  fill?: FillKind;
  kind?: SeriesKind;
  /**
   * A series of states (`kind: states`): a state's colour, by the state as Home Assistant writes it (`on: ok`) — a
   * tone's name, a colour (a name, a hex), or `none` for the strip's own fill. A state left out keeps the house's.
   */
  state_colors?: Readonly<Record<string, string>>;
}

/** A series drawn as its states (#228): a strip under the plot, out of the scales. */
export const isStates = (item: Pick<ChartSeriesConfig, 'kind'>): boolean => item.kind === 'states';

/** The most series a card draws: the palette's six series colours. */
export const MOST_SERIES = 6;

/** The series of a config as items: an id, or the series with what it says (a bare id is `{ entity }`); six at most. */
export function seriesOf(
  config: Readonly<Record<string, unknown>> | undefined,
): ChartSeriesConfig[] {
  const raw = config?.['series'];
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry: unknown): ChartSeriesConfig[] => {
      if (typeof entry === 'string') return entry ? [{ entity: entry }] : [];
      const item = entry as Partial<ChartSeriesConfig> | null;
      return item && typeof item === 'object' && typeof item.entity === 'string' && item.entity
        ? [item as ChartSeriesConfig]
        : [];
    })
    .slice(0, MOST_SERIES);
}

/** A unit a price is written in: money — a currency or its sign — or anything per watt hour. */
const MONEY =
  /(€|\$|£|¥|₩|₹|\bkr\b|zł|Kč|\bct\b|\b(EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|CZK|HUF|RON|BGN|ISK|AUD|NZD|CAD|JPY)\b)/i;
export const isPrice = (unit: string, deviceClass?: string): boolean =>
  deviceClass === 'monetary' || MONEY.test(unit) || /\/\s*[kMG]?Wh\s*$/.test(unit);

/**
 * The window of `length` slots with the lowest (or highest) mean, from slot `from` on: its first slot and its mean;
 * none where no window of whole readings fits. The earliest wins a tie.
 */
export function windowAt(
  values: ReadonlyArray<number | null>,
  length: number,
  pick: 'min' | 'max',
  from = 0,
): { readonly start: number; readonly mean: number } | null {
  const k = Math.max(1, Math.round(length));
  let best: { start: number; mean: number } | null = null;
  for (let start = Math.max(0, from); start + k <= values.length; start++) {
    let sum = 0;
    let whole = true;
    for (let i = start; i < start + k && whole; i++) {
      const v = values[i];
      if (v === null || v === undefined) whole = false;
      else sum += v;
    }
    if (!whole) continue;
    const mean = sum / k;
    if (!best || (pick === 'min' ? mean < best.mean : mean > best.mean)) best = { start, mean };
  }
  return best;
}

/* ---------- what the card can draw ---------- */

/** All a Chart card may draw: a window that runs past now, columns, a band, several series, a scale, a line through time. */
export const CHART_CAPS: ChartCaps = { now: true, bars: true, band: true, axis: true, time: true };

/** What a card draws with its series: now where its window runs past it, a style's highlight only alone. */
export const capsFor = (count: number, ahead: boolean): ChartCaps => ({
  ...CHART_CAPS,
  now: ahead,
  several: count > 1,
});

/**
 * What a config lets the card draw, as its editor reads it (with the house it shows: a sensor that holds a list reads
 * it): a calendar window, a list or a forecast run past now; a line through time where a series reads the recorder,
 * its points never finer than its finest series comes (an hour's statistics).
 */
export function capsIn(data: Readonly<Record<string, unknown>>, hass?: HomeAssistant): ChartCaps {
  const items = seriesOf(data);
  const span = spanOf(data['span']);
  const sources = items.map((item) => sourceOf(item, hass?.states[item.entity]?.attributes));
  const ahead =
    span.kind !== 'rolling' ||
    sources.some((source) => source === 'attribute' || source === 'forecast');
  // a series of states is a strip: it draws no line
  const grains = items.flatMap((item, index) => {
    const source = sources[index];
    if (isStates(item)) return [];
    return source === 'history'
      ? [0]
      : source === 'statistics'
        ? [PERIOD_MS[item.period ?? periodOf(span.hours)]]
        : [];
  });
  return {
    ...capsFor(items.length, ahead),
    time: grains.length > 0,
    ...(grains.length ? { finest: Math.min(...grains) } : {}),
  };
}

/** The windows a card marks where it says none: those its style marks (step's lowest and highest), else none. */
export const defaultWindows = (chart: unknown): Windows =>
  CHART_PRESETS[resolveStyle(chart as ChartPreset | undefined, {}, CHART_CAPS).preset].highlight ===
  'both'
    ? 'both'
    : 'none';

/* ---------- the editor ---------- */

const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The house's window as a span (`12h`, a week as `7d`): what the card reads, and its editor shows, while it names none. */
export function houseSpanValue(): string {
  const hours = chartDefaults().settings.window;
  return hours > 48 && hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`;
}

/** The span's choices: the house's windows and the calendar's by their words; any other typed (`6h`, `3d`). */
export function spanField(): HaFormSchemaItem {
  const windows = (count: number, key: 'sensor.window_hours' | 'sensor.window_days'): string =>
    capitalise(plural(editorLanguage(), key, count, { count }));
  return {
    name: 'span',
    selector: {
      select: {
        mode: 'dropdown',
        custom_value: true,
        options: [
          { value: '4h', label: windows(4, 'sensor.window_hours') },
          { value: '12h', label: windows(12, 'sensor.window_hours') },
          { value: '24h', label: windows(24, 'sensor.window_hours') },
          { value: 'today', label: editorWord('common.today') },
          { value: 'today+tomorrow', label: s(editorLanguage(), 'today_tomorrow') },
          { value: '48h', label: windows(48, 'sensor.window_hours') },
          { value: '7d', label: windows(7, 'sensor.window_days') },
          { value: '30d', label: windows(30, 'sensor.window_days') },
        ],
      },
    },
  };
}

const sourceField = (): HaFormSchemaItem =>
  choiceField('source', [
    ['auto', 'option.auto'],
    ...SOURCES.map((source) => [source, `chart-card.editor.source_${source}`] as const),
  ]);
const kindField = (): HaFormSchemaItem =>
  choiceField('kind', [
    ['line', 'chart-card.editor.kind_line'],
    // the chart's filled series, never the house's area (Fläche, not Bereich)
    ['area', 'chart-card.editor.kind_area'],
    ['columns', 'option.columns'],
    ['band', 'option.band'],
    ['states', 'chart-card.editor.kind_states'],
  ]);
/**
 * What a series reads of its readings (`stat`): a statistic's buckets their mean, lowest, highest, sum or change; a
 * history's slots and points (#228) their mean, lowest, highest or the last reading.
 */
const statField = (stats: readonly Stat[]): HaFormSchemaItem =>
  choiceField(
    'stat',
    stats.map(
      (stat) =>
        [
          stat,
          stat === 'sum'
            ? 'chart-card.editor.stat_sum'
            : stat === 'last'
              ? 'chart-card.editor.stat_last'
              : `option.${stat}`,
        ] as const,
    ),
  );
const periodField = (): HaFormSchemaItem =>
  choiceField(
    'period',
    PERIODS.map((period) => [period, `chart-card.editor.period_${period}`] as const),
  );

/** The entities a series of numbers reads; a series of states reads any (#228), the picker offering the usual. */
const NUMBERS_FROM = ['sensor', 'weather', 'number', 'input_number', 'counter'];
const STATES_FROM = ['binary_sensor', 'input_boolean', 'switch'];
const ENTITY = entityField(NUMBERS_FROM);
const NAME = fieldRow(nameField(), sourceField());
const ATTRIBUTE = selectField('attribute', ['auto'], { custom: true });
const KEYS = fieldRow(textField('time_key'), textField('value_key'));
const VALUE_KEY = textField('value_key');
const STATISTICS = fieldRow(statField(STATS), periodField());
const HISTORY_STAT = statField(HISTORY_STATS);
const DRAWN = fieldRow(kindField(), selectField('curve', ['smooth', 'straight', 'step']));
const FILL = selectField('fill', ['gradient', 'flat', 'none']);
// a colour of its own: one of the palette's (it follows the palette), or a colour name or a hex
const COLOUR = fieldRow(toneField(), seriesColourField('chart-card.editor.color_helper'));
const NUMBERS = numberFields();

/** The fields of a series by where it is read from: the same array for the same answer, so its form is kept. */
const SCHEMAS: Readonly<Record<Source, readonly HaFormSchemaItem[]>> = {
  history: [ENTITY, NAME, HISTORY_STAT, DRAWN, FILL, COLOUR, NUMBERS],
  statistics: [ENTITY, NAME, STATISTICS, DRAWN, FILL, COLOUR, NUMBERS],
  attribute: [ENTITY, NAME, ATTRIBUTE, KEYS, DRAWN, FILL, COLOUR, NUMBERS],
  forecast: [ENTITY, NAME, VALUE_KEY, DRAWN, FILL, COLOUR, NUMBERS],
};

/** The most states a series of states is coloured for in its editor: a select of a hundred options asks no hundred. */
const MOST_STATES = 24;

/**
 * The states a series of states is coloured for in its editor: the list its entity says it may be in (a select's or
 * an enum sensor's options, a climate's modes, a water heater's), else on and off.
 */
function statesFor(entity: unknown, hass: HomeAssistant | undefined): readonly string[] {
  const attributes = (typeof entity === 'string' && hass?.states[entity]?.attributes) || {};
  const listed = ['options', 'hvac_modes', 'operation_list']
    .map((key) => attributes[key])
    .find(Array.isArray);
  const states = (listed ?? []).filter((state): state is string => typeof state === 'string');
  return states.length ? states.slice(0, MOST_STATES) : ['on', 'off'];
}

/** The forms of a series of states, by the states they colour: the same array for the same answer. */
const STATES_SCHEMAS = new Map<string, readonly HaFormSchemaItem[]>();

/**
 * A series of states (#228): any entity, its name and how it is drawn, its colour and its states' (`state_colors`) —
 * no source (its history's), no curve, fill, statistic, unit or decimals: it is a strip of words.
 */
function statesSchema(states: readonly string[]): readonly HaFormSchemaItem[] {
  const key = states.join('\n');
  let schema = STATES_SCHEMAS.get(key);
  if (!schema) {
    schema = [entityField(), fieldRow(nameField(), kindField()), COLOUR, stateColoursField(states)];
    STATES_SCHEMAS.set(key, schema);
  }
  return schema;
}

/** A series' selects as its entity has them: its attributes that read as a list, the units its class converts to. */
const seriesChoices: EditorChoices = (item, hass) => {
  const id = typeof item['entity'] === 'string' ? item['entity'] : '';
  const state = hass?.states[id];
  const day: Day = { start: dayStart(hass, new Date()), length: DAY };
  const lists = state ? timedAttributes(state.attributes, day) : [];
  const unit = String(state?.attributes['unit_of_measurement'] ?? '');
  return {
    ...(lists.length
      ? {
          attribute: [
            { value: 'auto', label: editorWord('option.auto') },
            ...lists.map((value) => ({ value, label: value })),
          ],
        }
      : {}),
    ...(state ? { unit: unitChoices(ladderOf(unit)) } : {}),
  };
};

/** The keys a series may carry: its fields' names, and its states' colours. */
const SERIES_KEYS = [
  'entity',
  'name',
  'source',
  'attribute',
  'time_key',
  'value_key',
  'stat',
  'period',
  'kind',
  'curve',
  'fill',
  'tone',
  'color',
  'unit',
  'decimals',
  'state_colors',
];

const seriesLabels = editorLabels(s, {
  source: 'editor.source',
  attribute: 'editor.attribute',
  time_key: 'editor.time_key',
  value_key: 'editor.value_key',
  stat: 'editor.stat',
  period: 'editor.period',
  kind: 'editor.kind',
}).computeLabel;

/**
 * A series' fields by their words; any other is a state its colour is asked for, named in Home Assistant's words (a
 * switch's on and off, a climate's modes), else tidied.
 */
const seriesLabel: FormLabeler = (schema, localize) =>
  SERIES_KEYS.includes(schema.name)
    ? seriesLabels(schema, localize)
    : stateLabel(schema.name, localize, ['switch', 'climate', 'water_heater']);

const seriesHelper: FormHelper = (schema) => {
  const lang = editorLanguage();
  if (schema.name === 'source') return s(lang, 'editor.source_helper');
  if (schema.name === 'attribute') return s(lang, 'editor.attribute_helper');
  if (schema.name === 'time_key' || schema.name === 'value_key')
    return s(lang, 'editor.keys_helper');
  return undefined;
};

/** The series, item by item: each shows the fields its source reads, as the entity it names has them. */
export const SERIES_LIST: RowsListSpec = {
  key: 'series',
  title: 'chart-card.editor.series',
  domains: [...NUMBERS_FROM, ...STATES_FROM],
  // a switch, a binary sensor or a helper's toggle picked is a strip of its states
  picked: (entity) =>
    STATES_FROM.includes(entity.slice(0, entity.indexOf('.')))
      ? { entity, kind: 'states' }
      : { entity },
  keys: SERIES_KEYS,
  // every field a series may show, a statistic's stat and a history's together, and a series of states' colours
  schema: [
    entityField([...NUMBERS_FROM, ...STATES_FROM]),
    NAME,
    ATTRIBUTE,
    KEYS,
    fieldRow(statField([...STATS, 'last']), periodField()),
    DRAWN,
    FILL,
    COLOUR,
    NUMBERS,
    stateColoursField(['on', 'off']),
  ],
  schemaOf: (item, _card, hass) =>
    isStates(item)
      ? statesSchema(statesFor(item['entity'], hass))
      : SCHEMAS[
          sourceOf({
            ...(item as Partial<ChartSeriesConfig>),
            entity: String(item['entity'] ?? ''),
          })
        ],
  choices: seriesChoices,
  computeLabel: seriesLabel,
  computeHelper: seriesHelper,
};
