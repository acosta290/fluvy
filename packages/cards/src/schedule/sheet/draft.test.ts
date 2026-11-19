import { describe, expect, it } from 'vitest';
import { EMPTY_WEEK, startWeek, withDay } from '../plan.js';
import {
  addBlock,
  addPreset,
  copyTo,
  draftOf,
  heatingDraft,
  missingStandard,
  offersOwn,
  ownName,
  problemOf,
  removable,
  removeBlock,
  removePreset,
  renameOwn,
  setBlock,
  stepPreset,
  type Unit,
} from './draft.js';

const UNIT: Unit = { min: 7, max: 30, step: 0.5, unit: '°C', range: false, modes: [] };
const word = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1);
const fresh = () => draftOf({ day: 'monday' }, UNIT, word);

describe('the heating sheet’s draft', () => {
  it('starts a new plan on weekday mornings and evenings and the weekend in Comfort, Eco between, Away beside', () => {
    const draft = fresh();
    expect(draft.week).toEqual(startWeek('comfort'));
    expect(draft.presets).toEqual([
      { key: 'comfort', name: 'Comfort', temperature: 21 },
      { key: 'eco', name: 'Eco', temperature: 18 },
      { key: 'away', name: 'Away', temperature: 16 },
    ]);
    expect(draft.base).toBe('eco');
    // in Fahrenheit, Home Assistant's presets mean their own figures
    expect(
      draftOf({ day: 'monday' }, { ...UNIT, unit: '°F', min: 45, max: 95, step: 1 }, word)
        .presets[0]?.temperature,
    ).toBe(70);
  });

  it('takes up a helper with no plan of Fluvy’s: its presets kept, Comfort for a block that names none, Eco between', () => {
    const week = withDay(EMPTY_WEEK, 'monday', [
      { from: 480, to: 600 },
      { from: 1020, to: 1200, preset: 'Reading' },
    ]);
    const draft = draftOf(
      { day: 'monday', week, presets: [{ key: 'Reading', name: 'Reading' }] },
      UNIT,
      word,
    );
    expect(draft.week.monday.map((block) => block.preset)).toEqual(['comfort', 'Reading']);
    expect(draft.presets.map((preset) => preset.key)).toEqual([
      'Reading',
      'comfort',
      'eco',
      'away',
    ]);
    expect(draft.base).toBe('eco');
  });

  it('adds a time in the first preset that is not the base, and removes one', () => {
    const draft = { ...fresh(), week: EMPTY_WEEK };
    const added = addBlock(draft);
    expect(added?.week.monday).toEqual([{ from: 360, to: 480, preset: 'comfort' }]);
    expect(added && removeBlock(added, 0).week.monday).toEqual([]);
  });

  it('refuses two times that overlap, in words of the day they are on', () => {
    const draft = setBlock(fresh(), 0, { to: 18 * 60 });
    expect(problemOf(draft)).toMatchObject({ day: 'monday', problem: { kind: 'overlap' } });
    expect(heatingDraft(draft, UNIT)).toBeUndefined();
    expect(problemOf(setBlock(fresh(), 1, { from: 23 * 60 }))).toMatchObject({
      problem: { kind: 'time' },
    });
  });

  it('copies the day shown to the days chosen, and forgets them', () => {
    const draft = {
      ...setBlock(fresh(), 0, { from: 7 * 60 }),
      copyTo: ['tuesday', 'friday'] as const,
    };
    const copied = copyTo({ ...draft, copyTo: [...draft.copyTo] });
    expect(copied.week.tuesday).toEqual(copied.week.monday);
    expect(copied.week.friday[0]?.from).toBe(7 * 60);
    expect(copied.week.wednesday[0]?.from).toBe(6 * 60 + 30);
    expect(copied.copyTo).toEqual([]);
  });

  it('steps a preset’s target within the thermostat’s bounds', () => {
    let draft = fresh();
    draft = stepPreset(draft, 'comfort', 1, UNIT);
    expect(draft.presets[0]?.temperature).toBe(21.5);
    for (let i = 0; i < 40; i++) draft = stepPreset(draft, 'comfort', 1, UNIT);
    expect(draft.presets[0]?.temperature).toBe(30);
  });

  it('adds Home Assistant’s presets the plan has not, or one of the person’s own, which renames the blocks with it', () => {
    let draft = fresh();
    expect(missingStandard(draft)).toEqual(['home', 'sleep', 'boost', 'activity']);
    const name = ownName(draft, (count) => `Preset ${count}`);
    expect(name).toBe('Preset 4');
    draft = addPreset(draft, name, name, UNIT);
    expect(draft.presets.at(-1)).toEqual({ key: 'Preset 4', name: 'Preset 4', temperature: 19 });
    draft = setBlock(draft, 0, { preset: 'Preset 4' });
    const renamed = renameOwn(draft, 'Preset 4', '  Reading  ');
    expect(renamed.presets.at(-1)?.key).toBe('Reading');
    expect(renamed.week.monday[0]?.preset).toBe('Reading');
    // another's name, or one of Home Assistant's, leaves it as it was
    expect(renameOwn(renamed, 'Reading', 'comfort')).toBe(renamed);
    expect(renameOwn(renamed, 'Reading', 'Eco')).toBe(renamed);
    expect(renameOwn(renamed, 'Reading', '   ')).toBe(renamed);
  });

  it('lets a preset go only where no time names it and it is not the base', () => {
    const draft = fresh();
    expect(removable(draft, 'away')).toBe(true);
    expect(removable(draft, 'eco')).toBe(false);
    expect(removable(draft, 'comfort')).toBe(false);
    expect(removePreset(draft, 'comfort')).toBe(draft);
    expect(removePreset(draft, 'away').presets.map((preset) => preset.key)).toEqual([
      'comfort',
      'eco',
    ]);
  });

  it('hands the card the thermostat’s own presets where it has them and they were chosen, a range’s top for a range-only unit', () => {
    const unit: Unit = { ...UNIT, modes: ['none', 'eco', 'comfort'] };
    const draft = { ...fresh(), own: true };
    expect(offersOwn(draft, unit)).toBe(true);
    expect(offersOwn(draft, UNIT)).toBe(false);
    expect(heatingDraft(draft, unit)?.presets).toEqual([
      { key: 'comfort', name: 'Comfort', mode: 'comfort' },
      { key: 'eco', name: 'Eco', mode: 'eco' },
      { key: 'away', name: 'Away', temperature: 16 },
    ]);
    expect(heatingDraft(fresh(), { ...UNIT, range: true })?.presets[0]).toEqual({
      key: 'comfort',
      name: 'Comfort',
      temperature: 21,
      high: 30,
    });
  });
});
