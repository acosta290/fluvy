import { strings } from '@fluvy/core';
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Group, HistoryWindow, Line, Track } from '@fluvy/core/history';

import { describePeriod } from '../shared/period.js';
import { axisLabels, cardWidth, CARD_PADDING, scaleOf } from './chart.js';
import { chartsOf, coloursOf, linesOf, shownOf, GRAPH_COLOURS, SERIES_LIMIT } from './model.js';
import { FluvyHistory } from './view.js';

const s = strings('history', 'page');

const DAY = 86_400_000;
const HOUR = 3_600_000;
const t = (key: Parameters<typeof s>[1]): string => s({ language: 'en' }, key);

const track = (id: string, name: string, min: number, max: number): Track =>
  ({
    entityId: id,
    name,
    unit: '°C',
    deviceClass: 'temperature',
    points: [],
    min,
    max,
    average: (min + max) / 2,
    last: max,
    summarised: false,
  }) as unknown as Track;

const line = (id: string, name: string, changes: number): Line =>
  ({ entityId: id, name, domain: 'light', spans: [], changes }) as unknown as Line;

const windowOf = (tracks: readonly Track[], lines: readonly Line[] = []): HistoryWindow =>
  ({
    start: 0,
    end: DAY,
    groups: tracks.length
      ? ([{ unit: '°C', deviceClass: 'temperature', tracks, min: 0, max: 30 }] as Group[])
      : [],
    lines,
    empty: !tracks.length && !lines.length,
  }) as unknown as HistoryWindow;

/** Just enough of the page for what the axis and the widths ask of it. */
const page = (range: { start: number; end: number }, label = 30): FluvyHistory =>
  ({
    range,
    period: range.end - range.start > 8 * DAY ? 'day' : 'raw',
    labelWidth: () => label,
    time: (ms: number) => new Date(ms).toISOString().slice(11, 16),
    weekday: (ms: number) => `w${new Date(ms).getUTCDay()}`,
    day: (ms: number) => `d${new Date(ms).getUTCDate()}`,
    date: (ms: number) => `D${new Date(ms).getUTCDate()}`,
    dateYear: (ms: number) => `Y${new Date(ms).toISOString().slice(0, 10)}`,
  }) as unknown as FluvyHistory;

/** The room a label asks for, as `axisLabels` budgets it. */
const roomFor = (label = 30): number => label + 24;

describe('what the page draws', () => {
  it('draws a chart per unit, the widest first, and counts what did not fit', () => {
    const tracks = Array.from({ length: 9 }, (_, i) =>
      track(`sensor.t${i}`, `Room ${i}`, 20 - i, 20 + i),
    );
    const [chart] = chartsOf(undefined, t, windowOf(tracks));
    expect(chart?.tracks).toHaveLength(SERIES_LIMIT);
    expect(chart?.hidden).toBe(9 - SERIES_LIMIT);
    expect(chart?.tracks[0]?.name).toBe('Room 8'); // the one that moved most
  });

  it('opens a chart only as far as it has colours to tell its series apart', () => {
    const tracks = Array.from({ length: 15 }, (_, i) => track(`sensor.t${i}`, `Room ${i}`, 0, i));
    const [chart] = chartsOf(undefined, t, windowOf(tracks), { expanded: ['°C|temperature'] });
    expect(chart?.tracks).toHaveLength(GRAPH_COLOURS);
    expect(chart?.hidden).toBe(3);
  });

  it('gives a series the colour of its entity, whatever else is on the chart', () => {
    const ids = [
      'sensor.living_temperature',
      'sensor.bedroom_temperature',
      'sensor.office_temperature',
      'sensor.hall_temperature',
      'sensor.kitchen_temperature',
      'sensor.attic_temperature',
    ];
    const tracks = ids.map((id, i) => track(id, id, 20 - i, 20 + i));
    const house = coloursOf(tracks);
    // no two measures of one house share a colour, however their ids hash
    expect(new Set(house.values()).size).toBe(ids.length);
    // the order they arrive in never changes what they are given
    const shuffled = coloursOf([...tracks].reverse());
    for (const id of ids) expect(shuffled.get(id)).toBe(house.get(id));
    // and what a chart draws is what the model decided, through a search and an opening alike
    const window = windowOf(tracks);
    const drawn = (o: Parameters<typeof chartsOf>[3]) =>
      Object.fromEntries(
        (chartsOf(undefined, t, window, o)[0]?.tracks ?? []).map((one, i) => [
          one.entityId,
          chartsOf(undefined, t, window, o)[0]?.colours[i],
        ]),
      );
    const plain = drawn({});
    const opened = drawn({ expanded: ['°C|temperature'] });
    const searched = drawn({ search: 'o' });
    for (const [id, colour] of Object.entries(plain)) {
      expect(colour).toBe(house.get(id));
      if (opened[id] !== undefined) expect(opened[id]).toBe(colour);
      if (searched[id] !== undefined) expect(searched[id]).toBe(colour);
    }
    // and one chart never draws two series in one colour
    const drawnColours = chartsOf(undefined, t, window, {})[0]?.colours ?? [];
    expect(new Set(drawnColours).size).toBe(drawnColours.length);
  });

  it('counts in the head exactly what the body draws', () => {
    const shown = shownOf(
      undefined,
      t,
      windowOf([track('sensor.a', 'A', 1, 2)], [line('light.a', 'A', 3)]),
      {},
    );
    expect(shown.tracks).toBe(1);
    expect(shown.lines).toHaveLength(1);
  });

  it('narrows to what the search says, in any case and without accents', () => {
    const window = windowOf(
      [track('sensor.a', 'Café corner', 1, 2), track('sensor.b', 'Kitchen', 1, 2)],
      [line('light.a', 'Café corner', 1)],
    );
    const shown = shownOf(undefined, t, window, { search: 'CAFE' });
    expect(shown.tracks).toBe(1);
    expect(shown.lines).toHaveLength(1);
    expect(linesOf(window, { search: 'nothing' }).lines).toHaveLength(0);
  });
});

describe('the axis', () => {
  it('names the window it draws, at both ends', () => {
    const start = Date.UTC(2026, 8, 20, 4, 33);
    const labels = axisLabels(page({ start, end: start + DAY }), 920);
    expect(labels[0]?.[0]).toBe(0);
    expect(labels[labels.length - 1]?.[0]).toBe(1);
    // the two ends of a 24 h window would read alike, so they say which day they are
    expect(labels[0]?.[1]).toBe('w0 04:33');
    expect(labels[labels.length - 1]?.[1]).toBe('w1 04:33');
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every label its own room from its neighbours', () => {
    const start = Date.UTC(2026, 8, 20, 4, 33);
    for (const width of [248, 348, 528, 920]) {
      const labels = axisLabels(page({ start, end: start + DAY }), width);
      // even the narrowest column says something between its ends
      expect(labels.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < labels.length; i++)
        expect((labels[i]![0] - labels[i - 1]![0]) * width).toBeGreaterThanOrEqual(
          roomFor() - 0.001,
        );
    }
  });

  it('never says one day twice, whatever the width or the window', () => {
    for (const days of [1, 7, 30]) {
      const start = Date.UTC(2026, 8, 14);
      for (const width of [248, 288, 340, 528, 632, 1112, 920]) {
        const labels = axisLabels(page({ start, end: start + days * DAY }), width).map(
          ([, name]) => name,
        );
        expect(new Set(labels).size, `${days}d at ${width}: ${labels.join(' · ')}`).toBe(
          labels.length,
        );
        expect(labels.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('says days once a window is wider than two of them', () => {
    const start = Date.UTC(2026, 8, 14);
    expect(axisLabels(page({ start, end: start + 7 * DAY }), 920)[1]?.[1]).toMatch(/^d/);
    expect(axisLabels(page({ start, end: start + 30 * DAY }), 920)[1]?.[1]).toMatch(/^D/);
  });
});

describe('the column a card leaves', () => {
  it('is what a card leaves, at every width', () => {
    expect(cardWidth(960)).toBe(960 - CARD_PADDING);
    expect(cardWidth(380)).toBe(380 - CARD_PADDING);
    expect(cardWidth(0)).toBe(240);
  });
});

describe('how a card writes its figures', () => {
  const chartOf = (unit: string, values: number[], average = values[0] ?? 0) =>
    ({
      unit,
      tracks: [
        {
          entityId: 'sensor.a',
          points: values.map((v, i) => ({ t: i, v })),
          min: Math.min(...values),
          max: Math.max(...values),
          average,
        },
      ],
    }) as unknown as Parameters<typeof scaleOf>[0];

  it('takes the unit a typical reading takes, and holds it for the whole card', () => {
    const watts = scaleOf(chartOf('W', [40, 1870, 592], 592), undefined);
    expect(watts).toEqual({ unit: 'W', factor: 1, digits: 0 });
    const kilowatts = scaleOf(chartOf('W', [3200, 9100, 4000], 4000), undefined);
    expect(kilowatts.unit).toBe('kW');
    expect(kilowatts.digits).toBe(2);
  });

  it('gives a measure the decimals it moves in, and none to one that never leaves whole numbers', () => {
    expect(scaleOf(chartOf('%', [44.2, 51.8, 48], 48), undefined).digits).toBe(1);
    expect(scaleOf(chartOf('€/kWh', [0.108, 0.112], 0.11), undefined).digits).toBe(3);
    expect(scaleOf(chartOf('Lamps', [0, 5, 4], 2), undefined).digits).toBe(0);
  });

  it("keeps Home Assistant's own precision while the unit is untouched", () => {
    const hass = { entities: { 'sensor.a': { display_precision: 2 } } } as never;
    expect(scaleOf(chartOf('°C', [20.4, 22.1], 21), hass).digits).toBe(2);
  });
});

describe('what the cursor calls an instant', () => {
  const moment = (range: { start: number; end: number }, period: string, ms: number): string =>
    (FluvyHistory.prototype.moment as (this: unknown, ms: number) => string).call(
      { ...page(range), period },
      ms,
    );
  const start = Date.UTC(2026, 8, 20, 4, 0);

  it('names it at the resolution the window can tell apart', () => {
    // a day: the clock. a week: the day and the hour. a month of daily averages: the day alone
    expect(moment({ start, end: start + DAY }, 'raw', start + HOUR)).toBe('05:00');
    expect(moment({ start, end: start + 7 * DAY }, 'hour', start + 50 * HOUR)).toMatch(
      /, \d\d:\d\d$/,
    );
    expect(moment({ start, end: start + 30 * DAY }, 'day', start + 10 * DAY)).toBe('D30');
  });
});

describe('what a period is called', () => {
  const words = {
    today: 'Today',
    yesterday: 'Yesterday',
    period: 'Period',
    week: 'Last 7 days',
    lastDay: 'Last 24 hours',
    days: (n: number) => `${n} days`,
    since: (when: string) => `Since ${when}`,
  };
  const describe_ = (range: { start: number; end: number }, now: number) =>
    describePeriod({
      range,
      now,
      language: 'en',
      time: (ms: number) => new Date(ms).toISOString().slice(11, 16),
      words,
    });

  it('calls the last day by its name', () => {
    const now = Date.UTC(2026, 8, 20, 12);
    expect(describe_({ start: now - DAY, end: now }, now).title).toBe('Last 24 hours');
  });

  it('never calls a window that ends in the future the last day', () => {
    const now = Date.UTC(2026, 8, 20, 12);
    const title = describe_({ start: now + HOUR, end: now + HOUR + DAY }, now).title;
    expect(title).not.toBe('Last 24 hours');
    expect(title).toContain('–');
  });
});
