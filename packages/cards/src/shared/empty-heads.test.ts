// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { houseHeightOf } from '../house-heights.js';
import { catalogue } from '../index.js';
import { hass } from './fixtures/house.js';
import { headless } from './head-lines.js';

/*
 * A head with nothing in it (#259): a card whose config asks its circle away (`show_icon: never`), hides its name
 * (`name_lines: 0`) and switches off its line, its badge and whatever trails its head draws no head at all, its title
 * read aloud alone, and what it declares drops the head and the gap under it — the same card with any one of those
 * back on keeps its head. Every card is drawn from its own stub in a house of every kind of thing; that what each
 * declares is what it draws, the browser measures (`heights.mjs` on the `empty-heads` sheet).
 */

const CATALOGUE = await catalogue();

type CardClass = CustomElementConstructor & {
  getStubConfig?(hass: unknown, entities: readonly string[]): LovelaceCardConfig;
};
type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** What empties every head: no circle, no name. */
const EMPTY = { show_icon: 'never', name_lines: '0' } as const;

/**
 * Each card whose head its config can empty, in each layout that draws one: what it adds to empty it (`undefined`
 * takes a key away), and what its declared height drops with the head (its 44 and the gap under it — 16 under most
 * heads, 4 over the bar rows, 20 over a block or rings, 24 over a cover's ruler; a list that stands in the card's
 * padding with no head, as with no title, its own).
 */
const EMPTIED: ReadonlyArray<
  readonly [
    card: string,
    layout: Record<string, unknown>,
    quiet: Record<string, unknown>,
    drop: number,
  ]
> = [
  ['actions', {}, { subtitle: '' }, 60],
  ['alarm', {}, { subtitle: '', show_badge: false }, 60],
  ['alarm', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['alerts', { variant: 'rows' }, { show_count: false }, 48],
  ['appliances', { appliances: ['washer', 'dryer'] }, { show_count: false }, 48],
  ['appliances', { appliances: ['washer'], variant: 'compact' }, { subtitle: '' }, 48],
  ['appliances', { appliances: ['washer'], variant: 'tiles' }, { show_count: false }, 60],
  ['appliances', { appliances: [] }, { show_count: false }, 60],
  ['automations', {}, { subtitle: '', show_add: false }, 60],
  ['bars', {}, { show_badge: false }, 60],
  ['batteries', {}, { subtitle: '', show_badge: false }, 60],
  ['compass', {}, { subtitle: '', show_badge: false }, 60],
  ['compass', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['cover', {}, { subtitle: '', show_badge: false }, 68],
  ['cover', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['cover', { variant: 'horizontal' }, { subtitle: '', show_badge: false }, 68],
  ['distribution', {}, { subtitle: '', show_badge: false }, 60],
  ['distribution', { variant: 'rows' }, { subtitle: '', show_badge: false }, 60],
  ['energy', { variant: 'sources' }, { subtitle: '', entity: undefined }, 60],
  ['energy', { variant: 'overview' }, { subtitle: '', entity: undefined }, 60],
  ['energy-balance', {}, { subtitle: '', show_badge: false }, 64],
  ['energy-balance', { period: 'day' }, { subtitle: '', show_badge: false }, 60],
  ['energy-flow', {}, { subtitle: '', badge: 'none' }, 60],
  ['energy-sankey', {}, { subtitle: '' }, 60],
  ['energy-score', {}, { subtitle: '' }, 60],
  ['energy-score', { show_period: false }, { subtitle: '' }, 64],
  ['energy-usage', {}, { subtitle: '', show_badge: false }, 60],
  ['energy-usage', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['energy-usage', { variant: 'mini' }, { subtitle: '', show_badge: false }, 60],
  ['entities', { title: 'Kitchen' }, {}, 68],
  ['gauge', {}, { subtitle: '', show_badge: false }, 60],
  ['gauge', { variant: 'bar' }, { subtitle: '', show_badge: false }, 60],
  ['gauge', { variant: 'signed' }, { subtitle: '', show_badge: false }, 60],
  ['grid', {}, { subtitle: '', show_badge: false }, 60],
  ['helpers', {}, { subtitle: '' }, 60],
  ['history-bars', {}, { subtitle: '', head: [] }, 64],
  ['history-bars', { variant: 'compact' }, { subtitle: '', head: [] }, 64],
  ['humidity', {}, { subtitle: '', show_badge: false }, 60],
  ['items', {}, { show_count: false }, 60],
  ['items', { variant: 'tiles' }, { show_count: false }, 60],
  ['lock', {}, { subtitle: '', show_badge: false }, 60],
  ['lock', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['openings', {}, { subtitle: '', show_count: false }, 60],
  ['production', {}, { subtitle: '', show_badge: false }, 60],
  ['production', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['production', { day: 'tomorrow' }, { subtitle: '', show_badge: false }, 60],
  ['rounds', { title: 'Quick picks' }, { show_count: false }, 60],
  ['rounds', { title: 'Quick picks', variant: 'row' }, { show_count: false }, 68],
  // with no lead and no badge of an entity's, nothing more
  ['stat-tiles', {}, {}, 60],
  [
    'stat-tiles',
    { entity: 'sensor.solar_power', badge_entity: 'sensor.phone_battery' },
    { subtitle: '', show_badge: false },
    60,
  ],
  ['thermostat', {}, { subtitle: '', show_badge: false }, 60],
  ['thermostat', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['thermostat', { variant: 'ruler' }, { subtitle: '', show_badge: false }, 60],
  ['thermostats', { title: 'Heating' }, { show_count: false }, 60],
  ['todo', {}, { subtitle: '', show_add: false }, 60],
  ['updates', {}, { subtitle: '', show_badge: false }, 60],
  ['vacuum', {}, { subtitle: '', show_badge: false }, 60],
  ['vacuum', { variant: 'compact' }, { subtitle: '', show_badge: false }, 60],
  ['web', { url: '/web/radar.html' }, { subtitle: '' }, 60],
];

/** A key's value `undefined` taken out, as a config written without it. */
const written = (config: Record<string, unknown>): LovelaceCardConfig =>
  Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as LovelaceCardConfig;

/** A card's own stub in the house, its layout's keys over it. */
function stubbed(card: string, layout: Record<string, unknown>): LovelaceCardConfig {
  const tag = `fluvy-${card}-card`;
  const element = CATALOGUE.find(([name]) => name === tag)?.[1] as CardClass | undefined;
  if (!element) throw new Error(`no ${tag}`);
  return {
    ...element.getStubConfig?.(hass, Object.keys(hass.states)),
    type: `custom:${tag}`,
    ...layout,
  };
}

/** The card drawn from `config` 360 wide: its head, the words its head said, the title read aloud with none. */
async function drawn(config: LovelaceCardConfig): Promise<{
  readonly head: boolean;
  readonly title: string | undefined;
  readonly said: string | undefined;
  readonly marked: boolean;
  readonly empty: boolean;
}> {
  const element = document.createElement(config.type.slice('custom:'.length)) as CardElement;
  element.setConfig(config);
  element.hass = hass;
  (element as unknown as { width: number }).width = 360;
  document.body.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  const root = element.shadowRoot!;
  const head = root.querySelector('.fv-card__head');
  const seen = {
    head: head !== null,
    title: root.querySelector('.fv-card__title')?.textContent?.trim(),
    said: root.querySelector('article > h3.fv-sr')?.textContent?.trim(),
    marked: element.hasAttribute('headless'),
    // a head that holds nothing: no circle or picture, no line, nothing after its words, its name hidden
    empty:
      head !== null &&
      !head.querySelector('.fv-ico, [data-icon]') &&
      !head.querySelector('.fv-card__sub')?.textContent?.trim() &&
      !head.querySelector('.fv-card__titles ~ *') &&
      element.getAttribute('name-lines') === '0',
  };
  element.remove();
  return seen;
}

describe('a head with nothing in it (#259)', () => {
  it.each(EMPTIED.map(([card, layout, quiet, drop]) => ({ card, layout, quiet, drop })))(
    '$card $layout: draws none, says its title, and declares its height without it',
    async ({ card, layout, quiet, drop }) => {
      const base = stubbed(card, layout);
      const emptied = written({ ...base, ...quiet, ...EMPTY });
      // its twin: the same with its name back, the head drawn and saying what the hidden one would have
      const twin = written({ ...emptied, name_lines: undefined });
      expect(headless(emptied, true), 'the name hidden where the layout names its head').toBe(true);

      const headed = await drawn(twin);
      expect(headed.head).toBe(true);
      expect(headed.said, 'a head says the title').toBeUndefined();
      const bare = await drawn(emptied);
      expect(bare.head).toBe(false);
      expect(bare.said).toBe(headed.title);

      expect(houseHeightOf(twin, -1) - houseHeightOf(emptied, -1)).toBe(drop);

      // any one of them back on, the head is back, and so is its height
      for (const key of Object.keys({ ...quiet, ...EMPTY })) {
        const back = written({ ...emptied, [key]: base[key] });
        expect((await drawn(back)).head, `${key} back`).toBe(true);
        if (key === 'head')
          expect(houseHeightOf(back, -1)).toBeGreaterThan(houseHeightOf(emptied, -1));
        else expect(houseHeightOf(back, -1), `${key} back`).toBe(houseHeightOf(emptied, -1) + drop);
      }
    },
  );

  it('marks the host of a card that draws its parts from the card’s 20, and no other', async () => {
    const lock = stubbed('lock', {});
    expect(
      (await drawn(written({ ...lock, subtitle: '', show_badge: false, ...EMPTY }))).marked,
    ).toBe(true);
    expect((await drawn(written({ ...lock, subtitle: '', ...EMPTY }))).marked).toBe(false);
    expect((await drawn(lock)).marked).toBe(false);
  });

  /**
   * The cards whose head may be left with nothing in it by what the house says, never by their config alone, so their
   * height follows their config: the EV charger's line says when the car powers the house, the meters' "…" opens the
   * first meter the Energy dashboard names.
   */
  const FROM_THE_HOUSE = new Set(['fluvy-ev-charger-card', 'fluvy-meters-card']);

  // every card of the catalogue, every key a head's parts are switched off by: what still draws a head holds something
  it.each(CATALOGUE.map(([tag]) => tag).filter((tag) => !FROM_THE_HOUSE.has(tag)))(
    '%s: never draws a head with nothing in it',
    async (tag) => {
      const card = tag.replace(/^fluvy-|-card$/g, '');
      let config: LovelaceCardConfig;
      try {
        config = written({
          ...stubbed(card, {}),
          ...EMPTY,
          subtitle: '',
          show_badge: false,
          show_count: false,
          show_average: false,
          show_add: false,
          badge: 'none',
          head: [],
        });
      } catch {
        return; // a card the house cannot fill its stub for
      }
      expect((await drawn(config)).empty).toBe(false);
    },
  );
});

/*
 * The same sweep (#259): a head drawn by hand asks the card whether its circle shows (`show_icon`), as a fitted head
 * does — the calendar's views, the upcoming days' too, with a badge beside the title or none, and a room with no lights.
 */
describe('a head’s circle asked away', () => {
  /** Whether the card's head draws a circle. */
  const circled = async (config: LovelaceCardConfig): Promise<boolean> => {
    const element = document.createElement(config.type.slice('custom:'.length)) as CardElement;
    element.setConfig(config);
    element.hass = hass;
    (element as unknown as { width: number }).width = 360;
    document.body.append(element);
    await element.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    const head = element.shadowRoot!.querySelector('.fv-card__head');
    element.remove();
    expect(head).not.toBeNull();
    return head!.querySelector('.fv-ico') !== null;
  };

  it.each(['agenda', 'week', 'timeline', 'upcoming'])(
    'calendar %s: none where it asks for none, beside a badge too',
    async (variant) => {
      const calendar = {
        type: 'custom:fluvy-calendar-card',
        calendars: ['calendar.home'],
        variant,
      };
      expect(await circled(calendar)).toBe(true);
      expect(await circled({ ...calendar, show_icon: 'never' })).toBe(false);
    },
  );

  it('a room with no lights: none where it asks for none', async () => {
    const room = { type: 'custom:fluvy-lights-card', name: 'Hallway', lights: [] };
    expect(await circled(room)).toBe(true);
    expect(await circled({ ...room, show_icon: 'never' })).toBe(false);
  });
});
