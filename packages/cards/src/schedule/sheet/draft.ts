import type { Weekday } from '../../shared/dates.js';
import { presetName, type Preset } from '../automation.js';
import {
  checkDay,
  copyDay,
  DAYS,
  newBlock,
  renamePreset,
  startWeek,
  usesPreset,
  withDay,
  type Block,
  type DayProblem,
  type Week,
} from '../plan.js';
import { isStandard, STANDARD, type Standard } from '../presets.js';

/**
 * The plan as the heating sheet holds it while it is edited (#229): the day shown, the week, the presets and the base,
 * whether the thermostat's own presets are used, the days the shown one is to be copied to. Pure: what each gesture of
 * the sheet does to it, what is wrong with it, and what Save hands the card (`HeatingDraft`).
 */

/** What the sheet knows of the thermostat: its bounds and step, its unit, a unit that keeps only a range, its presets. */
export interface Unit {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: '°C' | '°F';
  readonly range: boolean;
  readonly modes: readonly string[];
}

/** A preset as the sheet edits it: its target stays while the thermostat's own preset is used, for a way back. */
export interface DraftPreset {
  readonly key: string;
  readonly name: string;
  readonly temperature: number;
}

export interface Draft {
  readonly day: Weekday;
  readonly week: Week;
  readonly presets: readonly DraftPreset[];
  readonly base: string;
  /** The thermostat's own presets are set where it has them (`preset_mode`). */
  readonly own: boolean;
  /** The days the shown one is to be copied to. */
  readonly copyTo: readonly Weekday[];
}

/** What Save hands the card: the week, the presets as the automation keeps them, the base. */
export interface HeatingDraft {
  readonly week: Week;
  readonly presets: readonly Preset[];
  readonly base: string;
}

/** A preset's target where it has none of its own, by the house's unit: what Home Assistant's presets mean. */
const TEMPERATURE: Readonly<
  Record<Standard | 'own', readonly [celsius: number, fahrenheit: number]>
> = {
  comfort: [21, 70],
  eco: [18, 64],
  away: [16, 61],
  home: [20, 68],
  sleep: [17, 63],
  boost: [24, 75],
  activity: [20, 68],
  own: [19, 66],
};

/** A preset's target where it has none, within the thermostat's bounds. */
export function usualTemperature(key: string, unit: Unit): number {
  const [celsius, fahrenheit] = TEMPERATURE[isStandard(key) ? key : 'own'];
  return Math.min(unit.max, Math.max(unit.min, unit.unit === '°F' ? fahrenheit : celsius));
}

/** The presets a new plan starts with: Comfort, Eco and Away, named in the sheet's language; Eco the base. */
export const START_PRESETS: readonly Standard[] = ['comfort', 'eco', 'away'];
export const START_BASE: Standard = 'eco';

/**
 * The draft a sheet opens on: the plan as read; a new one (`week` none) on the start week with the start presets;
 * a helper with no plan of Fluvy's yet (its blocks name presets the automation never had, or none) with those
 * presets, and Comfort for a block that names none, Eco for the gaps — unless it is only read (`adopt` false), when
 * it is the plan as it stands, nothing added.
 */
export function draftOf(
  o: {
    readonly week?: Week;
    readonly presets?: readonly Preset[];
    readonly base?: string;
    readonly day: Weekday;
  },
  unit: Unit,
  word: (key: Standard) => string,
  adopt = true,
): Draft {
  const standard = (key: Standard): DraftPreset => ({
    key,
    name: word(key),
    temperature: usualTemperature(key, unit),
  });
  if (!o.week) {
    return {
      day: o.day,
      week: startWeek(START_PRESETS[0] as Standard),
      presets: START_PRESETS.map(standard),
      base: START_BASE,
      own: false,
      copyTo: [],
    };
  }
  const read = (o.presets ?? []).map((preset) => ({
    key: preset.key,
    name: isStandard(preset.key) ? word(preset.key) : preset.name,
    temperature: preset.temperature ?? usualTemperature(preset.key, unit),
  }));
  if (!adopt || (o.base !== undefined && read.some((preset) => preset.key === o.base)))
    return {
      day: o.day,
      week: o.week,
      presets: read,
      base: o.base ?? '',
      own: (o.presets ?? []).some((preset) => preset.mode !== undefined),
      copyTo: [],
    };
  // a helper of its own: what its blocks name, Comfort for those that name none, Eco for the gaps
  const named = new Set(read.map((preset) => preset.key));
  const comfort = START_PRESETS[0] as Standard;
  const week = Object.fromEntries(
    DAYS.map((day) => [
      day,
      o.week?.[day].map((block) =>
        block.preset === undefined ? { ...block, preset: comfort } : block,
      ) ?? [],
    ]),
  ) as unknown as Week;
  const presets = [...read, ...START_PRESETS.filter((key) => !named.has(key)).map(standard)];
  return { day: o.day, week, presets, base: START_BASE, own: false, copyTo: [] };
}

/* ---------- gestures ---------- */

/** The draft with the shown day's blocks replaced. */
const withBlocks = (draft: Draft, blocks: readonly Block[]): Draft => ({
  ...draft,
  week: withDay(draft.week, draft.day, blocks),
});

/** A block added to the shown day (`newBlock`: two hours in its first room from the morning), in the first preset that is not the base. */
export function addBlock(draft: Draft): Draft | undefined {
  const preset = draft.presets.find((each) => each.key !== draft.base) ?? draft.presets[0];
  const block = preset ? newBlock(draft.week[draft.day], preset.key) : undefined;
  return block ? withBlocks(draft, [...draft.week[draft.day], block]) : undefined;
}

/** The shown day's block at `index` changed (its times, its preset); the rest kept. */
export function setBlock(draft: Draft, index: number, part: Partial<Block>): Draft {
  const blocks = draft.week[draft.day];
  return {
    ...draft,
    week: {
      ...draft.week,
      [draft.day]: blocks.map((block, i) => (i === index ? { ...block, ...part } : block)),
    },
  };
}

export const removeBlock = (draft: Draft, index: number): Draft =>
  withBlocks(
    draft,
    draft.week[draft.day].filter((_, i) => i !== index),
  );

/** The shown day copied to the days chosen, which are then forgotten. */
export const copyTo = (draft: Draft): Draft => ({
  ...draft,
  week: copyDay(draft.week, draft.day, draft.copyTo),
  copyTo: [],
});

/** A preset's target moved by a step, within the thermostat's bounds. */
export function stepPreset(draft: Draft, key: string, direction: 1 | -1, unit: Unit): Draft {
  return {
    ...draft,
    presets: draft.presets.map((preset) =>
      preset.key === key
        ? {
            ...preset,
            temperature:
              Math.round(
                Math.min(unit.max, Math.max(unit.min, preset.temperature + direction * unit.step)) *
                  10,
              ) / 10,
          }
        : preset,
    ),
  };
}

/** The name a new preset of the person's own takes: "Preset 4", the first count no preset has. */
export function ownName(draft: Draft, word: (count: number) => string): string {
  const taken = new Set(draft.presets.map((preset) => preset.name.toLocaleLowerCase()));
  for (let count = draft.presets.length + 1; ; count++) {
    const name = word(count);
    if (!taken.has(name.toLocaleLowerCase())) return name;
  }
}

/** A preset added: one of Home Assistant's the plan has not, or one of the person's own by its name. */
export function addPreset(draft: Draft, key: string, name: string, unit: Unit): Draft {
  return {
    ...draft,
    presets: [...draft.presets, { key, name, temperature: usualTemperature(key, unit) }],
  };
}

/** Home Assistant's presets the plan has not yet: what "Add a preset" offers beside one of the person's own. */
export const missingStandard = (draft: Draft): Standard[] =>
  STANDARD.filter((key) => !draft.presets.some((preset) => preset.key === key));

/**
 * A preset of the person's own renamed: its name is its key, so the blocks that named it name it again by the new one.
 * A name that is no name (empty, another preset's) leaves it as it was.
 */
export function renameOwn(draft: Draft, key: string, typed: string): Draft {
  const name = presetName(typed);
  const clash = draft.presets.some(
    (preset) =>
      preset.key !== key &&
      (preset.name.toLocaleLowerCase() === name.toLocaleLowerCase() || preset.key === name),
  );
  if (!name || clash || isStandard(name) || name === key) return draft;
  return {
    ...draft,
    week: renamePreset(draft.week, key, name),
    presets: draft.presets.map((preset) =>
      preset.key === key ? { key: name, name, temperature: preset.temperature } : preset,
    ),
    base: draft.base === key ? name : draft.base,
  };
}

/** Whether a preset may go: not the base, and no block of the week names it. */
export const removable = (draft: Draft, key: string): boolean =>
  key !== draft.base && !usesPreset(draft.week, key);

export const removePreset = (draft: Draft, key: string): Draft =>
  removable(draft, key)
    ? { ...draft, presets: draft.presets.filter((preset) => preset.key !== key) }
    : draft;

/* ---------- checking and saving ---------- */

/** The first day with something wrong (the shown one first), and what. */
export function problemOf(
  draft: Draft,
): { readonly day: Weekday; readonly problem: DayProblem } | undefined {
  for (const day of [draft.day, ...DAYS.filter((each) => each !== draft.day)]) {
    const problem = checkDay(draft.week[day]);
    if (problem) return { day, problem };
  }
  return undefined;
}

/** Whether the thermostat's own preset of that key may be set: it has one, and the person chose them. */
export const ownMode = (draft: Draft, key: string, unit: Unit): boolean =>
  draft.own && unit.modes.includes(key);

/** Whether the switch for the thermostat's own presets can act: it has at least one the plan names. */
export const offersOwn = (draft: Draft, unit: Unit): boolean =>
  draft.presets.some((preset) => unit.modes.includes(preset.key));

/**
 * What Save hands the card, or nothing while something is wrong: each preset as the automation sets it — the
 * thermostat's own where it has it and the person chose them, else its target (with the unit's top as the high end of
 * a unit that keeps only a range).
 */
export function heatingDraft(draft: Draft, unit: Unit): HeatingDraft | undefined {
  if (problemOf(draft) || !draft.presets.some((preset) => preset.key === draft.base))
    return undefined;
  return {
    week: draft.week,
    presets: draft.presets.map((preset) =>
      ownMode(draft, preset.key, unit)
        ? { key: preset.key, name: preset.name, mode: preset.key }
        : {
            key: preset.key,
            name: preset.name,
            temperature: preset.temperature,
            ...(unit.range ? { high: unit.max } : {}),
          },
    ),
    base: draft.base,
  };
}
