// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { roundsGrid, roundsHeight } from '../rounds-family.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { saidWidths } from '../shared/fixtures/widths.js';
import { visibleFields } from '../shared/form.js';
import { FluvyRoundsCard } from './rounds-card.js';
import * as roundsEditor from './rounds-editor.js';

// the index fetches the lazy families, the rounds among them: the card's tag is defined before a page needs it
beforeAll(() => familiesDefined);
afterEach(() => document.body.replaceChildren());

/*
 * The Rounds card (#224): any entities as rounds, lit while on, the dashed ring out of reach; a tap flips what is safe
 * to flip (a lock locks at once and asks before it unlocks) and opens the rest, a hold opens the details. The
 * reporter's "Quick picks": a kitchen light and a washer on plugs, a kitchen window, the hall's motion, the front
 * door's lock and a plug that is gone.
 */

const STAMP = '2026-11-19T08:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

const STATES = {
  'switch.kitchen_light': state('switch.kitchen_light', 'on', { friendly_name: 'Kitchen light' }),
  'switch.washer': state('switch.washer', 'off', { friendly_name: 'Washer' }),
  'binary_sensor.kitchen_window': state('binary_sensor.kitchen_window', 'on', {
    friendly_name: 'Kitchen window',
    device_class: 'window',
  }),
  'binary_sensor.motion_hall': state('binary_sensor.motion_hall', 'off', {
    friendly_name: 'Hall motion',
    device_class: 'motion',
  }),
  'lock.front_door': state('lock.front_door', 'locked', { friendly_name: 'Front door' }),
  'switch.ghost': state('switch.ghost', 'unavailable', { friendly_name: 'Ghost' }),
  'light.desk': state('light.desk', 'on', {
    friendly_name: 'Desk lamp',
    brightness: 128,
    supported_color_modes: ['brightness'],
  }),
  'scene.movie': state('scene.movie', STAMP, { friendly_name: 'Movie night' }),
  'vacuum.robot': state('vacuum.robot', 'docked', { friendly_name: 'Robot' }),
};

const QUICK_PICKS = [
  'switch.kitchen_light',
  'switch.washer',
  'binary_sensor.kitchen_window',
  'binary_sensor.motion_hall',
  'lock.front_door',
  'switch.ghost',
];

/** The house, with the calls it is sent kept. */
const house = (states: Record<string, unknown> = STATES) => {
  const calls: unknown[][] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states,
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: (...call: unknown[]) => (calls.push(call), Promise.resolve()),
  } as unknown as HomeAssistant;
  return { hass, calls };
};

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};
type Round = HTMLElement & { fvTap?: () => void; fvHold?: () => void };

async function drawn(
  config: Partial<LovelaceCardConfig>,
  hass = house().hass,
  width = 360,
): Promise<CardElement> {
  const card = document.createElement('fluvy-rounds-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-rounds-card', items: QUICK_PICKS, ...config });
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}
const root = (card: CardElement): ShadowRoot => card.shadowRoot!;
const rounds = (card: CardElement): Round[] => [...root(card).querySelectorAll<Round>('.lt-bulb')];

describe('the Rounds card (#224)', () => {
  it('draws a round an entity, in its order: lit while on, the dashed ring out of reach, no head without a title', async () => {
    const card = await drawn({});
    const all = rounds(card);
    expect(all.map((round) => round.getAttribute('aria-label'))).toEqual([
      'Kitchen light',
      'Washer',
      'Kitchen window',
      'Hall motion',
      'Front door',
      'Ghost',
    ]);
    expect(all.map((round) => round.classList.contains('is-on'))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
    // a lit round's full ring; an off one none; the plug that is gone, the dashed ring and no tap
    expect(all[0]!.querySelector('.lt-ring')).not.toBeNull();
    expect(all[1]!.querySelector('.lt-ring')).toBeNull();
    expect(all[5]!.classList.contains('fv-ico--off')).toBe(true);
    expect(all[5]!.getAttribute('aria-disabled')).toBe('true');
    expect(all[5]!.fvTap).toBeUndefined();
    expect(root(card).querySelector('.fv-card__head')).toBeNull();
  });

  it('flips what is safe to flip at a tap, locks a lock and asks before it unlocks, opens the rest', async () => {
    const asked: unknown[] = [];
    const ask = (event: Event): void => void asked.push((event as CustomEvent).detail);
    const opened: string[] = [];
    const open = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    document.addEventListener('hass-action', ask);
    document.addEventListener('hass-more-info', open);
    try {
      const { hass, calls } = house();
      const card = await drawn(
        { items: [...QUICK_PICKS.slice(0, 5), 'scene.movie', 'vacuum.robot'] },
        hass,
      );
      for (const round of rounds(card)) round.fvTap?.();
      await new Promise((resolve) => setTimeout(resolve));
      // the kitchen light off and the washer on (their own calls); the window, the motion, the scene and the robot
      // opened; the locked door asked about
      expect(calls.map(([domain, service]) => `${domain}.${service}`)).toEqual([
        'switch.turn_off',
        'switch.turn_on',
      ]);
      expect(opened).toEqual([
        'binary_sensor.kitchen_window',
        'binary_sensor.motion_hall',
        'scene.movie',
        'vacuum.robot',
      ]);
      expect(asked).toHaveLength(1);
      expect((asked[0] as { config: { tap_action: unknown } }).config.tap_action).toMatchObject({
        perform_action: 'lock.unlock',
        confirmation: true,
      });
      // unlocked, one tap locks it
      const unlocked = house({
        ...STATES,
        'lock.front_door': state('lock.front_door', 'unlocked', { friendly_name: 'Front door' }),
      });
      const door = await drawn({ items: ['lock.front_door'] }, unlocked.hass);
      rounds(door)[0]!.fvTap?.();
      await new Promise((resolve) => setTimeout(resolve));
      expect(unlocked.calls).toEqual([['lock', 'lock', {}, { entity_id: 'lock.front_door' }]]);
      expect(asked).toHaveLength(1);
    } finally {
      document.removeEventListener('hass-action', ask);
      document.removeEventListener('hass-more-info', open);
    }
  });

  it('a hold opens the details, the gone plug’s too; an item’s own actions run in their place', async () => {
    const opened: string[] = [];
    const open = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    document.addEventListener('hass-more-info', open);
    try {
      const { hass, calls } = house();
      const card = await drawn(
        {
          items: [
            'switch.ghost',
            {
              entity: 'scene.movie',
              tap_action: { action: 'perform-action', perform_action: 'scene.turn_on' },
            },
          ],
        },
        hass,
      );
      const [ghost, movie] = rounds(card);
      ghost!.fvHold?.();
      movie!.fvHold?.();
      movie!.fvTap?.();
      await new Promise((resolve) => setTimeout(resolve));
      expect(opened).toEqual(['switch.ghost', 'scene.movie']);
      expect(calls.map(([domain, service]) => `${domain}.${service}`)).toEqual(['scene.turn_on']);
    } finally {
      document.removeEventListener('hass-more-info', open);
    }
  });

  it('a title brings its head, "2 of 6 on" under it unless asked not to', async () => {
    const card = await drawn({ title: 'Quick picks' });
    expect(root(card).querySelector('.fv-card__title')?.textContent?.trim()).toBe('Quick picks');
    expect(root(card).querySelector('.fv-card__sub')?.textContent?.trim()).toBe('2 of 6 on');
    const quiet = await drawn({ title: 'Quick picks', show_count: false });
    expect(root(quiet).querySelector('.fv-card__sub')).toBeNull();
  });

  it('its names under the rounds where asked, each in its cell; a light’s ring its level', async () => {
    const card = await drawn({ items: ['light.desk', ...QUICK_PICKS], show_names: true });
    const names = [...root(card).querySelectorAll('.rd-name')].map((name) => name.textContent);
    expect(names[0]).toBe('Desk lamp');
    expect(names).toHaveLength(7);
    const dash = rounds(card)[0]!
      .querySelector('.lt-ring circle')!
      .getAttribute('stroke-dasharray');
    const [lit = 0, whole = 1] = dash!.split(' ').map(Number);
    expect(Math.round((lit / whole) * 100)).toBe(50);
  });

  it('labels: each round says its state under its glyph, out of reach a dash', async () => {
    const card = await drawn({ variant: 'labels' });
    const said = rounds(card).map((round) => round.querySelector('.lt-said')?.textContent ?? '');
    expect(said).toEqual(['On', 'Off', 'On', 'Off', 'Locked', '—']);
    expect(rounds(card).every((round) => round.classList.contains('lt-bulb--under'))).toBe(true);
  });

  it('labels: a key each, every one as wide as the widest words and 12 a side on the 4 grid, 64 the least', async () => {
    const restore = saidWidths();
    try {
      // "Locked" lays out 42: 42 and 24 on the 4 grid, the card's six keys alike
      const widths = (card: CardElement): string[] => rounds(card).map((key) => key.style.width);
      expect(widths(await drawn({ variant: 'labels' }))).toEqual(Array(6).fill('68px'));
      document.body.replaceChildren();
      // "On" and "Off" alone: a key as wide as it is tall
      const short = await drawn({ variant: 'labels', items: QUICK_PICKS.slice(0, 2) });
      expect(widths(short)).toEqual(['64px', '64px']);
      document.body.replaceChildren();
      // a word its cell cannot hold with its sides leaves its round a round: in a 66 column "Locked" needs 68
      const items = ['lock.front_door', 'switch.washer'];
      const narrow = await drawn({ variant: 'labels', items }, house().hass, 106);
      const said = rounds(narrow).map((key) => key.querySelector('.lt-said')?.textContent ?? '');
      expect(said).toEqual(['', 'Off']);
      expect(widths(narrow)).toEqual(['', '64px']);
    } finally {
      restore();
    }
    // a cell where keys say their states is 72 at the least: half a phone's section of six stands them two a line
    expect(roundsGrid({ type: '', variant: 'labels', items: QUICK_PICKS }, 226).perLine).toBe(2);
    expect(roundsGrid({ type: '', show_names: true, items: QUICK_PICKS }, 226).perLine).toBe(3);
  });

  it('row: a list row each, its name over its state, the row its round’s tap', async () => {
    const { hass, calls } = house();
    const card = await drawn({ variant: 'row', title: 'Quick picks' }, hass);
    const rows = [...root(card).querySelectorAll<HTMLElement>('.rd-rows .fv-row')];
    expect(rows).toHaveLength(6);
    expect(rows[0]!.querySelector('.fv-row__title')?.textContent).toBe('Kitchen light');
    expect(rows[0]!.querySelector('.fv-row__sub')?.textContent).toBe('On');
    expect(rows[5]!.querySelector('.fv-ico--off')).not.toBeNull();
    rows[1]!.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(calls.map(([domain, service]) => `${domain}.${service}`)).toEqual(['switch.turn_on']);
  });

  it('declares its height from its config alone: its lines, its rows, its head, never its states', () => {
    const height = (config: Partial<LovelaceCardConfig>): number =>
      FluvyRoundsCard.layoutHeight({
        type: 'custom:fluvy-rounds-card',
        items: QUICK_PICKS,
        ...config,
      });
    // six bare rounds on one line of a 320: 20 + 44 + 20
    expect(height({})).toBe(84);
    expect(height({ title: 'Quick picks' })).toBe(144);
    // seven: two lines, 8 apart (balanced, four and three)
    expect(height({ items: [...QUICK_PICKS, 'light.desk'] })).toBe(136);
    expect(roundsGrid({ type: '', items: [...QUICK_PICKS, 'light.desk'] }, 320).perLine).toBe(4);
    // two a line asked for: three lines
    expect(height({ columns: 2 })).toBe(40 + 3 * 44 + 2 * 8);
    // names: four a line, 64 each with their 20, 16 apart
    expect(height({ show_names: true })).toBe(40 + 2 * 64 + 16);
    // states under their glyphs: 64 a line; with names, 84
    expect(height({ variant: 'labels' })).toBe(40 + 2 * 64 + 16);
    expect(height({ variant: 'labels', show_names: true })).toBe(40 + 2 * 84 + 16);
    // a round's own state is a pill too; labels with every round saying none are rounds
    expect(height({ items: [{ entity: 'lock.front_door', show_state: true }] })).toBe(104);
    expect(
      height({ variant: 'labels', items: [{ entity: 'lock.front_door', show_state: false }] }),
    ).toBe(84);
    // a row each: 8 under the head, or 8 into the padding at each end
    expect(height({ variant: 'row' })).toBe(24 + 6 * 60);
    expect(height({ variant: 'row', title: 'Quick picks' })).toBe(92 + 6 * 60);
    // nothing to show: the panel and its hint
    expect(height({ items: [] })).toBe(172);
    // Home Assistant's `entities` read as its items
    expect(roundsHeight({ type: 'custom:fluvy-rounds-card', entities: QUICK_PICKS })).toBe(84);
  });

  it('draws what it declares at a 360 column, whatever its states say', async () => {
    for (const config of [
      {},
      { title: 'Quick picks' },
      { show_names: true },
      { variant: 'labels' },
      { variant: 'labels', show_names: true, columns: 3 },
      { items: [...QUICK_PICKS, 'light.desk'], align: 'spread' },
    ] as Partial<LovelaceCardConfig>[]) {
      const card = await drawn(config);
      const grid = roundsGrid({ type: '', items: QUICK_PICKS, ...config }, 320);
      const box = root(card).querySelector<HTMLElement>('.rd-rounds')!;
      expect(box.style.height, JSON.stringify(config)).toBe(
        `${grid.lines * grid.line + (grid.lines - 1) * grid.gap}px`,
      );
      document.body.replaceChildren();
    }
  });

  it('stands its rounds from the line’s start, in its middle or from edge to edge, on whole pixels', async () => {
    const lefts = async (align: string): Promise<string[]> => {
      const card = await drawn({ items: QUICK_PICKS.slice(0, 3), align });
      return [...root(card).querySelectorAll<HTMLElement>('.rd-cell')].map(
        (cell) => cell.style.left,
      );
    };
    expect(await lefts('start')).toEqual(['0px', '52px', '104px']);
    // three rounds of six: (320 − 148) / 2 from the start
    expect(await lefts('center')).toEqual(['86px', '138px', '190px']);
    // the line their own: the first on its start, the last on its end
    expect(await lefts('spread')).toEqual(['0px', '138px', '276px']);
    // rounds alone stand from the start by default too
    expect(await lefts('')).toEqual(['0px', '52px', '104px']);
  });

  it('fills the line with rounds that have words under them by default: equal shares, every line in the same columns', async () => {
    const cells = async (config: Partial<LovelaceCardConfig>): Promise<string[]> => {
      const card = await drawn(config);
      const all = [...root(card).querySelectorAll<HTMLElement>('.rd-cell')];
      document.body.replaceChildren();
      return all.map((cell) => `${cell.style.left} ${cell.style.width}`);
    };
    // six keys in 320, three a line: three shares of 101, the first on the line's start, the last on its end, the
    // second line in the first's columns
    const filled = ['0px 101px', '110px 101px', '219px 101px'];
    expect(await cells({ variant: 'labels' })).toEqual([...filled, ...filled]);
    expect(await cells({ variant: 'labels', align: 'fill' })).toEqual([...filled, ...filled]);
    // names under the rounds alike; seven, four columns on both lines
    expect((await cells({ show_names: true })).slice(0, 3)).toEqual(filled);
    const seven = await cells({ show_names: true, items: [...QUICK_PICKS, 'light.desk'] });
    expect(seven.slice(4)).toEqual(seven.slice(0, 3));
    // asked to stand from the start: 96 a cell, 8 apart, as before
    expect((await cells({ variant: 'labels', align: 'start' })).slice(0, 3)).toEqual([
      '0px 96px',
      '104px 96px',
      '208px 96px',
    ]);
  });

  it('its editor: its rounds a list of their own, its lines’ options only where they act', async () => {
    const editor = await drawEditor(await FluvyRoundsCard.getConfigElement(), {
      type: 'custom:fluvy-rounds-card',
      items: QUICK_PICKS,
    });
    expect(listTitles(editor)).toEqual(['Rounds']);
    const shown = (data: Record<string, unknown>): string[] =>
      shownNames(visibleFields(roundsEditor.getConfigForm().schema, data));
    const bare = shown({ items: QUICK_PICKS });
    expect(bare).toEqual(expect.arrayContaining(['variant', 'show_names', 'columns', 'align']));
    expect(bare).not.toContain('show_count');
    expect(bare).not.toContain('tap_action');
    const titled = shown({ items: QUICK_PICKS, title: 'Quick picks' });
    expect(titled).toEqual(expect.arrayContaining(['show_count', 'show_icon', 'tap_action']));
    const rows = shown({ items: QUICK_PICKS, variant: 'row' });
    expect(rows).not.toContain('align');
    expect(rows).not.toContain('show_names');
    expect(cardForm(editor).schema.length).toBeGreaterThan(0);
  });
});
