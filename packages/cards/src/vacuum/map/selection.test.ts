import { describe, expect, it } from 'vitest';
import type { Preset, Room } from './config.js';
import {
  jobOf,
  namesOf,
  presetJob,
  showable,
  shows,
  withDrawn,
  withPoint,
  withPreset,
  withRoom,
  withZone,
  type Selection,
} from './selection.js';

/*
 * What is picked on a map (#265): rooms, zones or a point, one kind at a time; a preset shown whole and taken off;
 * and what a selection asks of the robot.
 */

const room = (id: number, name: string, area?: string): Room => ({
  key: String(id),
  id,
  name,
  outline: [],
  ...(area ? { area } : {}),
});
const ROOMS: readonly Room[] = [
  room(16, 'Hall', 'hall'),
  room(17, 'Kitchen', 'kitchen'),
  room(18, 'Study'),
  { key: 'area:bath', area: 'bath', name: 'Bathroom', outline: [] },
];

const preset = (extra: Partial<Preset>): Preset => ({
  name: 'Preset',
  zones: [],
  rooms: [],
  areas: [],
  repeats: 1,
  onMap: true,
  ...extra,
});
const PRESETS: readonly Preset[] = [
  preset({ name: 'Cooker', zones: [[1, 2, 3, 4]], repeats: 2 }),
  preset({
    name: 'Table',
    zones: [
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ],
  }),
  preset({ name: 'Downstairs', rooms: [16, 17] }),
  preset({ name: 'Wet rooms', areas: ['kitchen', 'bath'] }),
  preset({ name: 'Bin', point: [100, 200] }),
  preset({ name: 'Full clean' }),
];

describe('rooms', () => {
  it('are picked one by one, and let go the same way', () => {
    const one = withRoom(undefined, '16');
    const two = withRoom(one, '17');
    expect(two).toEqual({ kind: 'rooms', rooms: ['16', '17'] });
    expect(withRoom(two, '16')).toEqual({ kind: 'rooms', rooms: ['17'] });
    expect(withRoom(one, '16')).toBeUndefined();
  });

  it('start over from another kind', () => {
    expect(withRoom({ kind: 'zones', presets: [0] }, '16')).toEqual({
      kind: 'rooms',
      rooms: ['16'],
    });
    expect(withRoom(withPoint([1, 2]), '16')).toEqual({ kind: 'rooms', rooms: ['16'] });
  });
});

describe('zones', () => {
  it('are the saved ones picked and one marked by hand, a new one in the last one’s place', () => {
    const saved = withZone(withZone(undefined, 0), 1);
    expect(saved).toEqual({ kind: 'zones', presets: [0, 1] });
    const both = withDrawn(saved, [10, 20, 30, 40]);
    expect(both).toEqual({ kind: 'zones', presets: [0, 1], drawn: [10, 20, 30, 40] });
    expect(withDrawn(both, [1, 1, 2, 2])).toMatchObject({ presets: [0, 1], drawn: [1, 1, 2, 2] });
    expect(withZone(withZone(both, 0), 1)).toEqual({
      kind: 'zones',
      presets: [],
      drawn: [10, 20, 30, 40],
    });
    expect(withZone(withZone(undefined, 0), 0)).toBeUndefined();
  });

  it('start over from rooms', () => {
    expect(withDrawn({ kind: 'rooms', rooms: ['16'] }, [1, 2, 3, 4])).toEqual({
      kind: 'zones',
      presets: [],
      drawn: [1, 2, 3, 4],
    });
  });
});

describe('a preset shown on the map', () => {
  it('can be, where it asks to and has a zone, a point or rooms the map draws', () => {
    expect(PRESETS.map((one) => showable(one, ROOMS))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(showable(preset({ zones: [[1, 2, 3, 4]], onMap: false }), ROOMS)).toBe(false);
    expect(showable(preset({ rooms: [99] }), ROOMS)).toBe(false);
  });

  it('adds its zones, and takes them off again', () => {
    const on = withPreset(undefined, PRESETS[0] as Preset, 0, ROOMS);
    expect(on).toEqual({ kind: 'zones', presets: [0] });
    expect(shows(on, PRESETS[0] as Preset, 0, ROOMS)).toBe(true);
    expect(shows(on, PRESETS[1] as Preset, 1, ROOMS)).toBe(false);
    expect(withPreset(on, PRESETS[0] as Preset, 0, ROOMS)).toBeUndefined();
  });

  it('adds every room it names, by its ids or its areas, and takes them all off', () => {
    const held: Selection = { kind: 'rooms', rooms: ['18', '16'] };
    const on = withPreset(held, PRESETS[2] as Preset, 2, ROOMS);
    expect(on).toEqual({ kind: 'rooms', rooms: ['18', '16', '17'] });
    expect(shows(held, PRESETS[2] as Preset, 2, ROOMS)).toBe(false);
    expect(shows(on, PRESETS[2] as Preset, 2, ROOMS)).toBe(true);
    expect(withPreset(on, PRESETS[2] as Preset, 2, ROOMS)).toEqual({
      kind: 'rooms',
      rooms: ['18'],
    });
    expect(withPreset(undefined, PRESETS[3] as Preset, 3, ROOMS)).toEqual({
      kind: 'rooms',
      rooms: ['17', 'area:bath'],
    });
  });

  it('is its point, and no point when taken off', () => {
    const on = withPreset(undefined, PRESETS[4] as Preset, 4, ROOMS);
    expect(on).toEqual({ kind: 'point', point: [100, 200], preset: 4 });
    expect(shows(on, PRESETS[4] as Preset, 4, ROOMS)).toBe(true);
    expect(withPreset(on, PRESETS[4] as Preset, 4, ROOMS)).toBeUndefined();
  });
});

describe('what is picked, in words', () => {
  it('is its rooms’ names, its presets’, and none for what a hand marked', () => {
    expect(namesOf({ kind: 'rooms', rooms: ['17', '16', 'gone'] }, ROOMS, PRESETS)).toEqual([
      'Kitchen',
      'Hall',
    ]);
    expect(
      namesOf({ kind: 'zones', presets: [1, 0], drawn: [1, 2, 3, 4] }, ROOMS, PRESETS),
    ).toEqual(['Table', 'Cooker']);
    expect(namesOf(withPoint([1, 2], 4), ROOMS, PRESETS)).toEqual(['Bin']);
    expect(namesOf(withPoint([1, 2]), ROOMS, PRESETS)).toEqual([]);
  });
});

describe('what a selection asks of the robot', () => {
  it('rooms by their ids where each has one, and by their areas where each names one', () => {
    expect(jobOf({ kind: 'rooms', rooms: ['16', '17'] }, ROOMS, PRESETS, 1)).toEqual({
      rooms: [16, 17],
      areas: ['hall', 'kitchen'],
      repeats: 1,
    });
    expect(jobOf({ kind: 'rooms', rooms: ['16', '18'] }, ROOMS, PRESETS, 2)).toEqual({
      rooms: [16, 18],
      repeats: 2,
    });
    expect(jobOf({ kind: 'rooms', rooms: ['17', 'area:bath'] }, ROOMS, PRESETS, 1)).toEqual({
      areas: ['kitchen', 'bath'],
      repeats: 1,
    });
    // one with an id alone beside one with an area alone: neither way holds them both
    expect(jobOf({ kind: 'rooms', rooms: ['18', 'area:bath'] }, ROOMS, PRESETS, 1)).toEqual({
      repeats: 1,
    });
  });

  it('zones: the saved ones’ and the one marked, as many times as the most of them asks', () => {
    expect(
      jobOf({ kind: 'zones', presets: [1, 0], drawn: [20, 20, 30, 30] }, ROOMS, PRESETS, 1),
    ).toEqual({
      zones: [
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [1, 2, 3, 4],
        [20, 20, 30, 30],
      ],
      repeats: 2,
    });
    expect(jobOf({ kind: 'zones', presets: [1] }, ROOMS, PRESETS, 3).repeats).toBe(3);
  });

  it('a point', () => {
    expect(jobOf(withPoint([7, 9]), ROOMS, PRESETS, 2)).toEqual({ point: [7, 9], repeats: 2 });
  });
});

describe('what a preset asks of the robot', () => {
  it('is what it names, its own times over; nothing but the times for a full clean', () => {
    expect(presetJob(PRESETS[0] as Preset)).toEqual({ zones: [[1, 2, 3, 4]], repeats: 2 });
    expect(presetJob(PRESETS[2] as Preset)).toEqual({ rooms: [16, 17], repeats: 1 });
    expect(presetJob(PRESETS[3] as Preset)).toEqual({ areas: ['kitchen', 'bath'], repeats: 1 });
    expect(presetJob(PRESETS[4] as Preset)).toEqual({ point: [100, 200], repeats: 1 });
    expect(presetJob(PRESETS[5] as Preset)).toEqual({ repeats: 1 });
  });
});
