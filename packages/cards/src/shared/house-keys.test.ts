// @vitest-environment happy-dom
import {
  CHART_PRESET_NAMES,
  GAUGE_PRESET_NAMES,
  HOUSE_DEFAULTS,
  setCardDefaults,
  setChartDefaults,
  setLightDefaults,
  setSliderDefaults,
  setTintDefaults,
  type HouseSettings,
} from '@fluvy/core';
import { afterAll, describe, expect, it } from 'vitest';
import { catalogue } from '../index.js';
import type { Card, CardEditor } from './base.js';
import { editorDefaults, HOUSE_KEYS } from './rows-editor.js';

/**
 * The house's keys (`HOUSE_KEYS`), held to every card of the catalogue: a card's editor defaults are read under the
 * factory's house and under others — every setting a default may read moved off the factory's, in every chart style
 * and every gauge — and a key whose default moved with the house is one of the list's; and no key stands in the list
 * that no card's default ever moved with. So a card that reads the house for a new key cannot go unlisted, and what
 * prints the defaults as YAML never pins one.
 */
type Settings = Pick<
  HouseSettings,
  | 'lightTint'
  | 'lightColors'
  | 'stateTint'
  | 'stateTintStyle'
  | 'charts'
  | 'chartSets'
  | 'cards'
  | 'sliders'
>;

/** The house's settings a card's default may read, worn as the look engine wears them (`look/start.ts`). */
const wear = (house: Settings): void => {
  setLightDefaults({ tint: house.lightTint, colors: house.lightColors });
  setTintDefaults({ tint: house.stateTint, style: house.stateTintStyle });
  setChartDefaults({ settings: house.charts, sets: house.chartSets });
  setCardDefaults(house.cards);
  setSliderDefaults(house.sliders);
};

/** A house with every such setting off the factory's, its charts in `style` and its gauges in `gauge`. */
const moved = (
  style: HouseSettings['charts']['style'],
  gauge: HouseSettings['charts']['gauge'],
): Settings => ({
  lightTint: 'always',
  lightColors: true,
  stateTint: 'always',
  stateTintStyle: 'edge',
  charts: {
    ...HOUSE_DEFAULTS.charts,
    style,
    gauge,
    line: 'bold',
    animate: false,
    window: 48,
    points: '15m',
  },
  chartSets: [],
  cards: { opacity: 60, blur: false, unavailable: 'quiet', border: false },
  sliders: { style: 'bar', words: 'none' },
});

/** Every other house: each chart style with a gauge beside it, every gauge among them. */
const HOUSES: readonly Settings[] = Array.from(
  { length: Math.max(CHART_PRESET_NAMES.length, GAUGE_PRESET_NAMES.length) },
  (_, at) =>
    moved(
      CHART_PRESET_NAMES[at % CHART_PRESET_NAMES.length] ?? 'classic',
      GAUGE_PRESET_NAMES[at % GAUGE_PRESET_NAMES.length] ?? 'ticks',
    ),
);

const cards = await Promise.all(
  (await catalogue()).map(async ([tag, element]) => {
    const editor: CardEditor = await (element as unknown as typeof Card).editor();
    return { tag, editor };
  }),
);

/** A card's defaults as its editor shows them on a new card, in the house worn now. */
const defaultsOf = (tag: string, editor: CardEditor): Readonly<Record<string, unknown>> =>
  editorDefaults(editor.getConfigForm(), editor.defaults)?.({ type: `custom:${tag}` }, undefined) ??
  {};

const read = (): ReadonlyMap<string, Readonly<Record<string, unknown>>> =>
  new Map(cards.map(({ tag, editor }) => [tag, defaultsOf(tag, editor)]));

afterAll(() => wear(HOUSE_DEFAULTS));

describe('the house’s keys', () => {
  wear(HOUSE_DEFAULTS);
  const factory = read();
  /** The keys whose default moved with the house, each with the cards it moved on. */
  const followed = new Map<string, Set<string>>();
  for (const house of HOUSES) {
    wear(house);
    for (const [tag, defaults] of read())
      for (const key of new Set([...Object.keys(defaults), ...Object.keys(factory.get(tag) ?? {})]))
        if (JSON.stringify(defaults[key]) !== JSON.stringify(factory.get(tag)?.[key]))
          followed.set(key, (followed.get(key) ?? new Set()).add(tag));
  }
  wear(HOUSE_DEFAULTS);

  it('reads the catalogue, and a house that moves its defaults', () => {
    expect(cards.length).toBeGreaterThanOrEqual(62);
    expect(followed.size).toBeGreaterThan(0);
  });

  it.each([...followed])('`%s` follows the house, and is one of the house’s keys', (key, tags) => {
    expect(HOUSE_KEYS.has(key), `${key} (${[...tags].join(', ')})`).toBe(true);
  });

  it.each([...HOUSE_KEYS])('`%s` is a key some card leaves to the house', (key) => {
    expect(followed.has(key), key).toBe(true);
  });
});
