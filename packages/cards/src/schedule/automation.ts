import { isEntityId } from '@fluvy/core';
import { sanitiseAlias, SCHEDULE_ID } from '../automations/schedule.js';
import { isPresetKey, PRESET_KEY } from './plan.js';

/**
 * What applies a heating week (#229): one native automation per schedule helper, in a strict shape Fluvy writes and
 * reads back, beside the automations card's (`automations/schedule.ts`): an id of its own (`fluvy_` and twelve hex
 * digits), the person's presets as one branch each, the base preset for the gaps as the default. It runs in Home
 * Assistant with every browser closed; Fluvy only writes it. Nothing here touches the socket: `buildHeating` says what
 * to write, `parseHeating` what was read.
 *
 * The shape, template-free so Home Assistant's editor shows every part of it as it is: `id`, `alias`, an optional
 * `description`, `mode: restart`; two triggers, the helper's state (any change of it, its attributes' too: a block
 * ending in another of a different preset changes only them) and Home Assistant's start; one condition, the helper on
 * or off (never while it is reloading); one `choose`, an option a preset — its name as the option's alias, the
 * helper's `preset` attribute as its condition, one step — and as its default the base preset's step under its name. A
 * step sets the thermostat: its target (`climate.set_temperature`, `temperature`; a unit that keeps only a range gets
 * the preset as its low end and its own top as its high end, so it heats to the preset and never cools), or its own
 * preset (`climate.set_preset_mode`) where the person chose the thermostat's own presets and it has that one. Nothing
 * else: the mode stays the person's, a unit switched off stays off.
 */

/** A preset as the automation keeps it: its key (what a block names), its name, and what it sets. */
export interface Preset {
  readonly key: string;
  /** The person's name for it, the option's alias in Home Assistant's editor. */
  readonly name: string;
  /** The target it sets (a range's low end); none where it sets the thermostat's own preset. */
  readonly temperature?: number;
  /** A range's high end: the unit's top, for a unit that keeps only a range. */
  readonly high?: number;
  /** The thermostat's own preset it sets instead of a target (`preset_mode`). */
  readonly mode?: string;
}

/** A heating schedule as Fluvy writes it: the helper it follows, the thermostat it sets, its presets and its base. */
export interface Heating {
  readonly id: string;
  readonly alias: string;
  readonly description?: string;
  /** The schedule helper (`schedule.*`). */
  readonly schedule: string;
  /** The thermostat (`climate.*`). */
  readonly climate: string;
  readonly presets: readonly Preset[];
  /** The preset of the gaps between blocks (and of a block that names none of them). */
  readonly base: string;
}

/* ---------- the automation as Home Assistant keeps it ---------- */

export interface StepData {
  temperature?: number;
  target_temp_low?: number;
  target_temp_high?: number;
  preset_mode?: string;
}

export interface Step {
  alias?: string;
  action: 'climate.set_temperature' | 'climate.set_preset_mode';
  target: { entity_id: string };
  data: StepData;
}

export interface Option {
  alias: string;
  conditions: readonly [
    { condition: 'state'; entity_id: string; attribute: typeof PRESET_KEY; state: string },
  ];
  sequence: readonly [Step];
}

export interface HeatingConfig {
  id: string;
  alias: string;
  description?: string;
  triggers: readonly [
    { trigger: 'state'; entity_id: string },
    { trigger: 'homeassistant'; event: 'start' },
  ];
  conditions: readonly [{ condition: 'state'; entity_id: string; state: readonly ['on', 'off'] }];
  actions: readonly [{ choose: readonly Option[]; default: readonly [Step] }];
  mode: 'restart';
}

export type HeatingProblem =
  | 'bad_id'
  | 'bad_entities'
  | 'no_presets'
  | 'bad_preset'
  | 'same_preset'
  | 'no_base'
  | 'bad_temperature';

/** What `buildHeating` throws: the problem `checkHeating` found, as its code. */
export class HeatingError extends Error {
  constructor(readonly problem: HeatingProblem) {
    super(problem);
    this.name = 'HeatingError';
  }
}

const domainOf = (id: string): string => id.slice(0, id.indexOf('.'));
const isTemperature = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 200;
/** A thermostat's preset as Home Assistant names one: a word of letters, figures and underscores. */
const isMode = (value: unknown): value is string =>
  typeof value === 'string' && /^[\p{L}\p{N}_ -]{1,40}$/u.test(value) && value.trim() === value;
/** A preset's name fit to write: trimmed, one space between words, no control characters, forty characters at most. */
export const presetName = (text: string): string =>
  Array.from(sanitiseAlias(text)).slice(0, 40).join('');

/** The first thing wrong with a heating schedule, or nothing: what `buildHeating` refuses. */
export function checkHeating(h: Heating): HeatingProblem | undefined {
  if (!SCHEDULE_ID.test(h.id)) return 'bad_id';
  if (
    !isEntityId(h.schedule) ||
    domainOf(h.schedule) !== 'schedule' ||
    !isEntityId(h.climate) ||
    domainOf(h.climate) !== 'climate'
  )
    return 'bad_entities';
  if (!h.presets.length) return 'no_presets';
  const keys = new Set<string>();
  const names = new Set<string>();
  for (const preset of h.presets) {
    if (!isPresetKey(preset.key) || !preset.name || presetName(preset.name) !== preset.name)
      return 'bad_preset';
    const name = preset.name.toLocaleLowerCase();
    if (keys.has(preset.key) || names.has(name)) return 'same_preset';
    keys.add(preset.key);
    names.add(name);
    const sets = (preset.mode === undefined ? 0 : 1) + (preset.temperature === undefined ? 0 : 1);
    if (sets !== 1) return 'bad_preset';
    if (preset.mode !== undefined && (!isMode(preset.mode) || preset.high !== undefined))
      return 'bad_preset';
    if (preset.temperature !== undefined && !isTemperature(preset.temperature))
      return 'bad_temperature';
    if (
      preset.high !== undefined &&
      (!isTemperature(preset.high) || preset.high < (preset.temperature ?? 0))
    )
      return 'bad_temperature';
  }
  if (!keys.has(h.base)) return 'no_base';
  return undefined;
}

const roundTemperature = (t: number): number => Math.round(t * 10) / 10;

/** The step a preset writes for that thermostat. */
function stepOf(climate: string, preset: Preset): Step {
  const target = { entity_id: climate };
  if (preset.mode !== undefined)
    return { action: 'climate.set_preset_mode', target, data: { preset_mode: preset.mode } };
  const temperature = roundTemperature(preset.temperature ?? 0);
  return {
    action: 'climate.set_temperature',
    target,
    data:
      preset.high === undefined
        ? { temperature }
        : { target_temp_low: temperature, target_temp_high: roundTemperature(preset.high) },
  };
}

/** The automation a heating schedule writes. Throws a `HeatingError` with what `checkHeating` found. */
export function buildHeating(h: Heating): HeatingConfig {
  const problem = checkHeating(h);
  if (problem) throw new HeatingError(problem);
  const base = h.presets.find((preset) => preset.key === h.base) as Preset;
  const description = h.description?.trim();
  return {
    id: h.id,
    alias: sanitiseAlias(h.alias),
    ...(description ? { description } : {}),
    triggers: [
      { trigger: 'state', entity_id: h.schedule },
      { trigger: 'homeassistant', event: 'start' },
    ],
    conditions: [{ condition: 'state', entity_id: h.schedule, state: ['on', 'off'] }],
    actions: [
      {
        choose: h.presets.map((preset) => ({
          alias: preset.name,
          conditions: [
            { condition: 'state', entity_id: h.schedule, attribute: PRESET_KEY, state: preset.key },
          ],
          sequence: [stepOf(h.climate, preset)],
        })),
        default: [{ alias: base.name, ...stepOf(h.climate, base) }],
      },
    ],
    mode: 'restart',
  };
}

/* ---------- parsing ---------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value Home Assistant may keep as one or as a list: as a list. */
const listOf = (value: unknown): readonly unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const keysWithin = (record: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(record).every((key) => allowed.includes(key));

/** `metadata: {}` is what Home Assistant's editor leaves on a step or a trigger: nothing. */
const emptyMetadata = (record: Record<string, unknown>): boolean =>
  record['metadata'] === undefined ||
  (isRecord(record['metadata']) && Object.keys(record['metadata']).length === 0);

/** One entity named where Home Assistant takes one or a list of them: the one, or nothing. */
function oneEntity(value: unknown): string | undefined {
  const ids = listOf(value);
  const [id] = ids;
  return ids.length === 1 && isEntityId(id) ? id : undefined;
}

/** A value read under its key or its older one (`trigger` / `platform`, `action` / `service`), never two that differ. */
function either(record: Record<string, unknown>, key: string, older: string): unknown {
  const value = record[key];
  const old = record[older];
  if (value !== undefined && old !== undefined && value !== old) return undefined;
  return value ?? old;
}

/** The helper's state trigger, or Home Assistant's start: which one, and the helper it follows. */
function parseTrigger(
  raw: unknown,
): { readonly start: true } | { readonly schedule: string } | undefined {
  if (!isRecord(raw) || !emptyMetadata(raw)) return undefined;
  const kind = either(raw, 'trigger', 'platform');
  if (kind === 'homeassistant') {
    if (!keysWithin(raw, ['trigger', 'platform', 'event', 'metadata'])) return undefined;
    return raw['event'] === 'start' ? { start: true } : undefined;
  }
  if (kind !== 'state' || !keysWithin(raw, ['trigger', 'platform', 'entity_id', 'metadata']))
    return undefined;
  const schedule = oneEntity(raw['entity_id']);
  return schedule ? { schedule } : undefined;
}

/** A step as read: the thermostat it sets, and what. */
function parseStep(
  raw: unknown,
  alias: boolean,
): { climate: string; preset: Omit<Preset, 'key' | 'name'>; alias?: string } | undefined {
  if (!isRecord(raw) || !emptyMetadata(raw)) return undefined;
  if (!keysWithin(raw, ['alias', 'action', 'service', 'target', 'data', 'metadata']))
    return undefined;
  const own = raw['alias'];
  if (own !== undefined && (!alias || typeof own !== 'string')) return undefined;
  const action = either(raw, 'action', 'service');
  const target = raw['target'];
  const data = raw['data'];
  if (!isRecord(target) || !keysWithin(target, ['entity_id']) || !isRecord(data)) return undefined;
  const climate = oneEntity(target['entity_id']);
  if (!climate) return undefined;
  const named = typeof own === 'string' ? { alias: own } : {};
  if (action === 'climate.set_preset_mode') {
    const mode = data['preset_mode'];
    if (!keysWithin(data, ['preset_mode']) || !isMode(mode)) return undefined;
    return { climate, preset: { mode }, ...named };
  }
  if (action !== 'climate.set_temperature') return undefined;
  if (keysWithin(data, ['temperature']) && isTemperature(data['temperature']))
    return { climate, preset: { temperature: data['temperature'] }, ...named };
  const [low, high] = [data['target_temp_low'], data['target_temp_high']];
  if (
    keysWithin(data, ['target_temp_low', 'target_temp_high']) &&
    isTemperature(low) &&
    isTemperature(high)
  )
    return { climate, preset: { temperature: low, high }, ...named };
  return undefined;
}

/** One option of the `choose`: the preset it is, its name, the helper whose attribute it reads, what it sets. */
function parseOption(
  raw: unknown,
): { schedule: string; climate: string; preset: Preset } | undefined {
  if (!isRecord(raw) || !keysWithin(raw, ['alias', 'conditions', 'condition', 'sequence']))
    return undefined;
  if (raw['conditions'] !== undefined && raw['condition'] !== undefined) return undefined;
  const name = raw['alias'];
  if (typeof name !== 'string') return undefined;
  const conditions = listOf(raw['conditions'] ?? raw['condition']);
  const [condition] = conditions;
  if (
    conditions.length !== 1 ||
    !isRecord(condition) ||
    !keysWithin(condition, ['condition', 'entity_id', 'attribute', 'state']) ||
    condition['condition'] !== 'state' ||
    condition['attribute'] !== PRESET_KEY
  )
    return undefined;
  const schedule = oneEntity(condition['entity_id']);
  const states = listOf(condition['state']);
  const [key] = states;
  if (!schedule || states.length !== 1 || !isPresetKey(key)) return undefined;
  const sequence = listOf(raw['sequence']);
  const step = sequence.length === 1 ? parseStep(sequence[0], false) : undefined;
  if (!step) return undefined;
  return { schedule, climate: step.climate, preset: { key, name, ...step.preset } };
}

const TOP_KEYS = [
  'id',
  'alias',
  'description',
  'triggers',
  'trigger',
  'conditions',
  'condition',
  'actions',
  'action',
  'mode',
];

const samePreset = (a: Omit<Preset, 'key' | 'name'>, b: Omit<Preset, 'key' | 'name'>): boolean =>
  a.temperature === b.temperature && a.high === b.high && a.mode === b.mode;

/**
 * The heating schedule an automation is, read strictly: a `fluvy_` id, no template anywhere, the two triggers, the one
 * condition, one `choose` of presets on one helper and one thermostat with the base as its default. Tolerant of what
 * Home Assistant accepts as the same thing: `platform:` and `service:`, the singular keys, an `entity_id` as a list
 * of one, an empty `metadata`, the triggers and the condition's states in any order. Anything else is not one: the
 * card shows it as it stands and never writes it (edited by hand, it is Home Assistant's now).
 */
export function parseHeating(config: unknown): Heating | undefined {
  if (!isRecord(config)) return undefined;
  const id = config['id'];
  if (typeof id !== 'string' || !SCHEDULE_ID.test(id) || !keysWithin(config, TOP_KEYS))
    return undefined;
  const text = JSON.stringify(config);
  if (text.includes('{{') || text.includes('{%')) return undefined;
  const alias = config['alias'];
  const description = config['description'];
  if (typeof alias !== 'string') return undefined;
  if (description !== undefined && typeof description !== 'string') return undefined;
  if (config['mode'] !== 'restart') return undefined;
  for (const [plural, singular] of [
    ['triggers', 'trigger'],
    ['conditions', 'condition'],
    ['actions', 'action'],
  ] as const)
    if (config[plural] !== undefined && config[singular] !== undefined) return undefined;

  const triggers = listOf(config['triggers'] ?? config['trigger']).map(parseTrigger);
  const followed = triggers.flatMap((trigger) =>
    trigger && 'schedule' in trigger ? [trigger.schedule] : [],
  );
  const starts = triggers.filter((trigger) => trigger && 'start' in trigger).length;
  const [schedule] = followed;
  if (triggers.length !== 2 || followed.length !== 1 || starts !== 1 || !schedule) return undefined;

  const conditions = listOf(config['conditions'] ?? config['condition']);
  const [condition] = conditions;
  if (
    conditions.length !== 1 ||
    !isRecord(condition) ||
    !keysWithin(condition, ['condition', 'entity_id', 'state']) ||
    condition['condition'] !== 'state' ||
    oneEntity(condition['entity_id']) !== schedule
  )
    return undefined;
  const states = listOf(condition['state']);
  if (states.length !== 2 || !states.includes('on') || !states.includes('off')) return undefined;

  const actions = listOf(config['actions'] ?? config['action']);
  const [choose] = actions;
  if (actions.length !== 1 || !isRecord(choose) || !keysWithin(choose, ['choose', 'default']))
    return undefined;
  const options = listOf(choose['choose']).map(parseOption);
  if (!options.length || options.some((option) => !option)) return undefined;
  const read = options as { schedule: string; climate: string; preset: Preset }[];
  const climate = read[0]?.climate;
  if (!climate || read.some((option) => option.schedule !== schedule || option.climate !== climate))
    return undefined;
  const fallback = listOf(choose['default']);
  const step = fallback.length === 1 ? parseStep(fallback[0], true) : undefined;
  if (!step || step.climate !== climate) return undefined;
  // the base: the option the default repeats, by its name and what it sets
  const base = read.find(
    (option) => option.preset.name === step.alias && samePreset(option.preset, step.preset),
  );
  if (!base) return undefined;
  const heating: Heating = {
    id,
    alias,
    ...(description?.trim() ? { description: description.trim() } : {}),
    schedule,
    climate,
    presets: read.map((option) => option.preset),
    base: base.preset.key,
  };
  return checkHeating(heating) ? undefined : heating;
}

/**
 * The helper a Fluvy automation follows where it is not the shape any more (edited by hand in Home Assistant): the one
 * `schedule.*` entity its triggers name. What the card shows such a week by, never writing it.
 */
export function followedSchedule(config: unknown): string | undefined {
  if (!isRecord(config)) return undefined;
  const followed = listOf(config['triggers'] ?? config['trigger']).flatMap((trigger) =>
    isRecord(trigger)
      ? listOf(trigger['entity_id']).filter(
          (id): id is string => typeof id === 'string' && id.startsWith('schedule.'),
        )
      : [],
  );
  return followed.length === 1 ? followed[0] : undefined;
}
