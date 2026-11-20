import { describe, expect, it } from 'vitest';
import {
  blockAt,
  checkDay,
  checkWeek,
  copyDay,
  DAY_END,
  EMPTY_WEEK,
  helperDays,
  helperOf,
  minutesOf,
  newBlock,
  nextChange,
  renamePreset,
  sameWeek,
  startWeek,
  usesPreset,
  weekOfResponse,
  withDay,
  type Block,
} from './plan.js';

const at = (text: string): number => minutesOf(text, true) as number;
const block = (from: string, to: string, preset = 'comfort'): Block => ({
  from: at(from),
  to: at(to),
  preset,
});

describe('a time as Home Assistant writes one', () => {
  it('reads hours and minutes, with or without seconds, the day’s end as an end only', () => {
    expect(minutesOf('06:30')).toBe(390);
    expect(minutesOf('06:30:00')).toBe(390);
    expect(minutesOf('6:05:59')).toBe(365);
    expect(minutesOf('24:00:00')).toBeUndefined();
    expect(minutesOf('24:00:00', true)).toBe(DAY_END);
    expect(minutesOf('24:00', true)).toBe(DAY_END);
    // `get_schedule` serialises Python's time.max
    expect(minutesOf('23:59:59.999999', true)).toBe(DAY_END);
    expect(minutesOf('25:00')).toBeUndefined();
    expect(minutesOf('noon')).toBeUndefined();
    expect(minutesOf(390)).toBeUndefined();
  });
});

describe('the week, from both of Home Assistant’s sources', () => {
  const ITEM = {
    id: 'bedroom_heating',
    name: 'Bedroom heating',
    icon: 'mdi:calendar-clock',
    tuesday: [
      { from: '17:00:00', to: '22:00:00', data: { preset: 'comfort' } },
      { from: '06:00:00', to: '08:00:00', data: { preset: 'comfort', note: 'early' } },
    ],
    saturday: [{ from: '08:00:00', to: '24:00:00' }],
  };

  it('reads a helper of the collection: its id, name and icon, its days in order, presets and other data kept', () => {
    const item = helperOf(ITEM);
    expect(item?.id).toBe('bedroom_heating');
    expect(item?.name).toBe('Bedroom heating');
    expect(item?.icon).toBe('mdi:calendar-clock');
    expect(item?.week.monday).toEqual([]);
    expect(item?.week.tuesday).toEqual([
      { from: 360, to: 480, preset: 'comfort', data: { note: 'early' } },
      { from: 1020, to: 1320, preset: 'comfort' },
    ]);
    // a block written in Home Assistant's own dialog names no preset
    expect(item?.week.saturday).toEqual([{ from: 480, to: DAY_END }]);
  });

  it('reads `schedule.get_schedule`’s answer for one entity, the response alone too', () => {
    const answer = {
      context: { id: 'c' },
      response: {
        'schedule.study': {
          monday: [{ from: '08:00:00', to: '23:59:59.999999', data: { preset: 'eco' } }],
        },
      },
    };
    expect(weekOfResponse(answer, 'schedule.study')?.monday).toEqual([
      { from: 480, to: DAY_END, preset: 'eco' },
    ]);
    expect(weekOfResponse(answer.response, 'schedule.study')?.monday).toHaveLength(1);
    expect(weekOfResponse(answer, 'schedule.other')).toBeUndefined();
  });

  it('refuses what is no helper: a day that is no list, a block that ends before it starts, data of another kind', () => {
    expect(helperOf({ ...ITEM, monday: 'all day' })).toBeUndefined();
    expect(helperOf({ ...ITEM, monday: [{ from: '09:00', to: '08:00' }] })).toBeUndefined();
    expect(
      helperOf({ ...ITEM, monday: [{ from: '08:00', to: '09:00', data: { a: [1] } }] }),
    ).toBeUndefined();
    expect(helperOf({ name: 'no id' })).toBeUndefined();
  });

  it('writes every day back as Home Assistant takes it, and reads what it wrote as the same week', () => {
    const week = withDay(startWeek('comfort'), 'sunday', [block('08:00', '24:00', 'eco')]);
    const days = helperDays(week);
    expect(days.monday).toEqual([
      { from: '06:30:00', to: '08:30:00', data: { preset: 'comfort' } },
      { from: '17:00:00', to: '22:30:00', data: { preset: 'comfort' } },
    ]);
    expect(days.sunday).toEqual([{ from: '08:00:00', to: '24:00:00', data: { preset: 'eco' } }]);
    const read = helperOf({ id: 'x', name: 'x', ...days });
    expect(read && sameWeek(read.week, week)).toBe(true);
  });

  it('writes a block made by hand back with its seconds while it keeps its minute, on the minute once it is moved', () => {
    const item = helperOf({
      ...ITEM,
      monday: [
        { from: '06:30:15', to: '08:00:00', data: { preset: 'comfort' } },
        { from: '22:00:00', to: '23:59:59', data: { preset: 'comfort' } },
      ],
    });
    const monday = item?.week.monday ?? [];
    expect(monday.map((each) => [each.from, each.to])).toEqual([
      [390, 480],
      [1320, DAY_END],
    ]);
    // untouched, the helper is written as Home Assistant holds it: nothing to write
    expect(helperDays(item!.week).monday).toEqual([
      { from: '06:30:15', to: '08:00:00', data: { preset: 'comfort' } },
      { from: '22:00:00', to: '23:59:59', data: { preset: 'comfort' } },
    ]);
    expect(sameWeek(helperOf({ ...ITEM, ...helperDays(item!.week) })!.week, item!.week)).toBe(true);
    // its start moved in the sheet: the start on the minute, its end as it was
    const moved = withDay(item!.week, 'monday', [{ ...monday[0]!, from: 7 * 60 }, monday[1]!]);
    expect(helperDays(moved).monday[0]).toEqual({
      from: '07:00:00',
      to: '08:00:00',
      data: { preset: 'comfort' },
    });
    expect(helperDays(moved).monday[1]?.to).toBe('23:59:59');
  });
});

describe('a day’s blocks', () => {
  it('refuses two that overlap and one that ends before it starts; touching ones are fine', () => {
    expect(checkDay([block('06:00', '08:00'), block('08:00', '10:00', 'eco')])).toBeUndefined();
    expect(checkDay([block('06:00', '08:30'), block('08:00', '10:00')])).toEqual({
      kind: 'overlap',
      first: block('06:00', '08:30'),
      second: block('08:00', '10:00'),
    });
    expect(checkDay([{ from: 600, to: 540 }])?.kind).toBe('time');
    expect(checkDay([{ from: 600, to: 1500 }])?.kind).toBe('time');
    expect(
      checkWeek(withDay(EMPTY_WEEK, 'friday', [block('06:00', '08:30'), block('08:00', '09:00')])),
    ).toMatchObject({ day: 'friday', problem: { kind: 'overlap' } });
  });

  it('adds two hours in the first room from the morning, else the longest gap, else none', () => {
    expect(newBlock([], 'comfort')).toEqual(block('06:00', '08:00'));
    expect(newBlock([block('06:00', '08:00')], 'comfort')).toEqual(block('08:00', '10:00'));
    // no two hours left from the morning on: the longest gap
    const tight = [block('00:00', '05:00'), block('06:00', '23:00')];
    expect(newBlock(tight, 'eco')).toEqual(block('05:00', '06:00', 'eco'));
    expect(newBlock([block('00:00', '24:00')], 'eco')).toBeUndefined();
  });

  it('copies a day onto others, their own blocks replaced, the day itself untouched', () => {
    const week = withDay(EMPTY_WEEK, 'monday', [block('06:30', '08:30')]);
    const copied = copyDay(week, 'monday', [
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'monday',
    ]);
    expect(copied.friday).toEqual([block('06:30', '08:30')]);
    expect(copied.monday).toEqual([block('06:30', '08:30')]);
    expect(copied.saturday).toEqual([]);
  });

  it('says what is on at a minute: a block’s start in it, its end not', () => {
    const week = startWeek('comfort');
    expect(blockAt(week, 'thursday', at('17:00'))?.preset).toBe('comfort');
    expect(blockAt(week, 'thursday', at('22:30'))).toBeUndefined();
    expect(blockAt(week, 'saturday', at('22:59'))?.from).toBe(at('08:00'));
  });

  it('says when the preset in force next changes: today, a later day, never across a midnight it carries on over', () => {
    const week = startWeek('comfort');
    // Thursday 21:47 in Comfort: the gaps' at 22:30; in the gap, Comfort the next morning
    expect(nextChange(week, 'thursday', at('21:47'))).toEqual({
      preset: undefined,
      days: 0,
      minute: at('22:30'),
    });
    expect(nextChange(week, 'thursday', at('23:00'))).toEqual({
      preset: 'comfort',
      days: 1,
      minute: at('06:30'),
    });
    // Friday night to Saturday's late start
    expect(nextChange(week, 'friday', at('22:45'))).toEqual({
      preset: 'comfort',
      days: 1,
      minute: at('08:00'),
    });
    // a night in Sleep to midnight, the next day's carrying it on: the change is its end the next morning
    const nights = withDay(
      withDay(EMPTY_WEEK, 'monday', [block('22:00', '24:00', 'sleep')]),
      'tuesday',
      [block('00:00', '06:00', 'sleep'), block('06:00', '08:00')],
    );
    expect(nextChange(nights, 'monday', at('23:00'))).toEqual({
      preset: 'comfort',
      days: 1,
      minute: at('06:00'),
    });
    // the plan's reading: a preset it has not is the base's, so a block of it next to a gap is no change
    const odd = withDay(EMPTY_WEEK, 'monday', [
      block('06:00', '07:00', 'old'),
      block('07:00', '08:00'),
    ]);
    const plan = (preset: string | undefined): string => (preset === 'comfort' ? 'comfort' : 'eco');
    expect(nextChange(odd, 'monday', at('05:00'), plan)).toEqual({
      preset: 'comfort',
      days: 0,
      minute: at('07:00'),
    });
    // one block a week: a week on, the same day's earlier start; a week of one preset never changes
    const once = withDay(EMPTY_WEEK, 'monday', [block('06:00', '08:00')]);
    expect(nextChange(once, 'monday', at('09:00'))).toEqual({
      preset: 'comfort',
      days: 7,
      minute: at('06:00'),
    });
    expect(nextChange(EMPTY_WEEK, 'monday', at('09:00'))).toBeUndefined();
  });

  it('renames a preset in every block that names it, and says whether one is used', () => {
    const week = renamePreset(startWeek('Cosy'), 'Cosy', 'Warm');
    expect(usesPreset(week, 'Warm')).toBe(true);
    expect(usesPreset(week, 'Cosy')).toBe(false);
  });
});
