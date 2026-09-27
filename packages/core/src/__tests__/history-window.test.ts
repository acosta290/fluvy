import { describe, expect, it } from 'vitest';
import {
  buildWindow,
  byActivity,
  byRange,
  fractionOf,
  periodFor,
  sampleTrack,
  spanAt,
  stateAt,
  timeAt,
  valueAt,
  type Line,
  type RawHistory,
  type Track,
} from '../history/index.js';
import type { HomeAssistant } from '../ha/types.js';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 8, 19, 9, 0, 0);
const END = START + 3 * HOUR;

/** A house with a thermometer, a second thermometer, a power meter and a washer. */
const hass = {
  states: {
    'sensor.hall': {
      entity_id: 'sensor.hall',
      state: '21.4',
      attributes: { friendly_name: 'Hall', unit_of_measurement: '°C', device_class: 'temperature' },
      last_changed: '',
      last_updated: '',
      context: { id: '' },
    },
    'sensor.attic': {
      entity_id: 'sensor.attic',
      state: '18',
      attributes: {
        friendly_name: 'Attic',
        unit_of_measurement: '°C',
        device_class: 'temperature',
      },
      last_changed: '',
      last_updated: '',
      context: { id: '' },
    },
    'sensor.meter': {
      entity_id: 'sensor.meter',
      state: '500',
      attributes: { friendly_name: 'Meter', unit_of_measurement: 'W', device_class: 'power' },
      last_changed: '',
      last_updated: '',
      context: { id: '' },
    },
    'switch.washer': {
      entity_id: 'switch.washer',
      state: 'on',
      attributes: { friendly_name: 'Washer' },
      last_changed: '',
      last_updated: '',
      context: { id: '' },
    },
  },
  entities: {},
  devices: {},
  areas: {},
} as unknown as HomeAssistant;

const at = (hours: number): number => (START + hours * HOUR) / 1000;

const states: RawHistory = {
  'sensor.hall': [
    { s: '20', lu: at(0) },
    { s: '22', lu: at(1) },
    { s: 'unavailable', lu: at(1.5) },
    { s: '21', lu: at(2) },
  ],
  'sensor.attic': [
    { s: '18', lu: at(0) },
    { s: '18.5', lu: at(2) },
  ],
  'sensor.meter': [{ s: '500', lu: at(0) }],
  'switch.washer': [
    { s: 'off', lu: at(0) },
    { s: 'on', lu: at(1) },
    { s: 'on', lu: at(1.2) },
    { s: 'off', lu: at(2) },
  ],
  'sensor.gone': [],
};

describe('a window of history', () => {
  const window = buildWindow(hass, states, {
    start: START,
    end: END,
    entityIds: [...Object.keys(states)],
  });

  it('groups the numbers by what they measure, and keeps the states apart', () => {
    expect(window.groups.map((group) => `${group.unit}|${group.tracks.length}`)).toEqual([
      '°C|2',
      'W|1',
    ]);
    expect(window.lines.map((line) => line.name)).toEqual(['Washer']);
    expect(window.empty).toEqual(['sensor.gone']);
  });

  it('reads a state that is not a number as a hole, never a zero', () => {
    const hall = window.groups[0]?.tracks[0];
    expect(hall?.points.map((point) => point.v)).toEqual([20, 22, 21]);
    expect(hall?.min).toBe(20);
    expect(hall?.max).toBe(22);
  });

  it('averages by the time spent at each reading, not by the readings', () => {
    // 20° for an hour, 22° for an hour, 21° for the last: 21
    expect(window.groups[0]?.tracks[0]?.average).toBeCloseTo(21, 6);
    expect(window.groups[0]?.tracks[1]?.average).toBeCloseTo((18 * 2 + 18.5) / 3, 6);
  });

  it("joins a state's run into one stretch and counts the changes", () => {
    const washer = window.lines[0];
    expect(washer?.spans.map((span) => span.state)).toEqual(['off', 'on', 'off']);
    expect(washer?.spans[1]?.from).toBe(START + HOUR);
    expect(washer?.spans[1]?.to).toBe(START + 2 * HOUR);
    expect(washer?.spans[2]?.to).toBe(END); // still off when the window ends
    expect(washer?.changes).toBe(2);
  });

  it('takes the statistics when the window is read from them, with the band they moved in', () => {
    const summarised = buildWindow(
      hass,
      {},
      {
        start: START,
        end: END,
        entityIds: ['sensor.hall'],
        statistics: {
          'sensor.hall': [
            { start: START, end: START + HOUR, mean: 20, min: 19, max: 21 },
            { start: START + HOUR, end: START + 2 * HOUR, mean: 22, min: 21, max: 23 },
          ],
        },
      },
    );
    const track = summarised.groups[0]?.tracks[0];
    expect(track?.summarised).toBe(true);
    expect(track?.points.map((point) => point.v)).toEqual([20, 22]);
    expect(track?.band?.map((band) => `${band.low}–${band.high}`)).toEqual(['19–21', '21–23']);
  });
});

describe('reading a window at an instant', () => {
  const points = [
    { t: START, v: 20 },
    { t: START + HOUR, v: 22 },
    { t: START + 2 * HOUR, v: 21 },
  ];

  it('holds a reading until the next one, and says nothing before the first', () => {
    expect(valueAt(points, START - 1)).toBeNull();
    expect(valueAt(points, START)).toBe(20);
    expect(valueAt(points, START + HOUR / 2)).toBe(20);
    expect(valueAt(points, START + HOUR)).toBe(22);
    expect(valueAt(points, END)).toBe(21);
  });

  it('samples the window at even steps, each the reading in force', () => {
    expect(sampleTrack({ points }, START, END, 4)).toEqual([20, 22, 21, 21]);
    expect(sampleTrack({ points: [] }, START, END, 4)).toEqual([]);
  });

  it('finds the stretch an instant falls in', () => {
    const spans = [
      { from: START, to: START + HOUR, state: 'off' },
      { from: START + HOUR, to: END, state: 'on' },
    ];
    expect(stateAt(spans, START + HOUR / 2)).toBe('off');
    expect(stateAt(spans, START + 2 * HOUR)).toBe('on');
    expect(spanAt(spans, START + 2 * HOUR)?.from).toBe(START + HOUR);
    expect(stateAt(spans, START - 1)).toBe('');
  });

  it('maps an instant to its place in the window and back', () => {
    expect(fractionOf(START + 1.5 * HOUR, START, END)).toBeCloseTo(0.5, 6);
    expect(timeAt(0.5, START, END)).toBe(START + 1.5 * HOUR);
    expect(fractionOf(START - HOUR, START, END)).toBe(0);
  });
});

describe('what a summarised track says it reached', () => {
  it('takes its ends from the band it drew, not from the mean line', () => {
    const hour = 3_600_000;
    const statistics = {
      'sensor.power': Array.from({ length: 4 }, (_, i) => ({
        start: START + i * hour,
        end: START + (i + 1) * hour,
        mean: 500 + i,
        min: 40,
        max: 1870,
      })),
    };
    const window = buildWindow(
      undefined,
      {},
      {
        start: START,
        end: START + 4 * hour,
        entityIds: ['sensor.power'],
        statistics: statistics as never,
      },
    );
    const track = window.groups[0]?.tracks[0];
    expect(track?.summarised).toBe(true);
    // the means run 500 … 503; what the house did is in the band
    expect(track?.min).toBe(40);
    expect(track?.max).toBe(1870);
  });
});

describe('what a curve drawn from a track reaches', () => {
  it("touches the window's own lowest and highest reading, however few points it draws", () => {
    const minute = 60_000;
    // a quiet measure with one spike and one dip, far apart, and far more readings than a chart draws
    const points = Array.from({ length: 600 }, (_, i) => ({ t: START + i * minute, v: 500 }));
    points[137] = { t: START + 137 * minute, v: 1870 };
    points[402] = { t: START + 402 * minute, v: 40 };
    const drawn = sampleTrack({ points }, START, START + 600 * minute, 64);
    expect(drawn).toHaveLength(64);
    expect(Math.max(...drawn)).toBe(1870);
    expect(Math.min(...drawn)).toBe(40);
  });
});

describe('how a window is read', () => {
  it('takes its own states up to two days, then the statistics', () => {
    expect(periodFor(START, START + 24 * HOUR)).toBe('raw');
    expect(periodFor(START, START + 7 * 24 * HOUR)).toBe('hour');
    expect(periodFor(START, START + 30 * 24 * HOUR)).toBe('day');
    expect(periodFor(START, START + 90 * 24 * HOUR)).toBe('day');
  });

  it('puts the busiest lines and the widest tracks first', () => {
    const line = (name: string, changes: number) => ({ name, changes }) as unknown as Line;
    expect([line('A', 1), line('B', 9)].sort(byActivity)[0]?.name).toBe('B');
    const track = (name: string, min: number, max: number) =>
      ({ name, min, max }) as unknown as Track;
    expect([track('A', 20, 21), track('B', 0, 900)].sort(byRange)[0]?.name).toBe('B');
  });
});
