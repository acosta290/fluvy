import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { sectionsHeight } from './heights.js';
import {
  conditionIds,
  drawnOf,
  holds,
  isRow,
  listedOf,
  sectionOf,
  shownOf,
  type Listed,
  type ShowWhen,
} from './lists.js';

/*
 * A list in parts and rows on a condition (#157): what a list's entries are read as, what it draws of them while
 * rows come and go, when a condition holds, and what its sections add to the height its config declares.
 */

const house = (states: Record<string, string>): HomeAssistant =>
  ({
    states: Object.fromEntries(
      Object.entries(states).map(([entity_id, state]) => [
        entity_id,
        { entity_id, state, attributes: {} },
      ]),
    ),
  }) as unknown as HomeAssistant;

describe('a section among a list’s entries', () => {
  it('reads Home Assistant’s section and divider, and a section in a line', () => {
    expect(sectionOf({ type: 'section', label: 'Upstairs' })).toEqual({
      label: 'Upstairs',
      line: false,
    });
    expect(sectionOf({ type: 'section', label: 'Upstairs', line: true })).toEqual({
      label: 'Upstairs',
      line: true,
    });
    expect(sectionOf({ section: 'Upstairs' })).toEqual({ label: 'Upstairs', line: false });
    expect(sectionOf({ section: 'Upstairs', line: true })).toEqual({
      label: 'Upstairs',
      line: true,
    });
    // a divider is the hairline alone
    expect(sectionOf({ type: 'divider' })).toEqual({ label: '', line: true });
  });

  it('reads a label a row’s alias wrote as its name, a figure as its words, and none as none', () => {
    // `label` is read as `name` on every item of a list (`ITEM_ALIASES`)
    expect(sectionOf({ type: 'section', name: 'Upstairs' })?.label).toBe('Upstairs');
    expect(sectionOf({ section: 2 })?.label).toBe('2');
    expect(sectionOf({ type: 'section', label: '  Loft ' })?.label).toBe('Loft');
    // one with no label yet: the editor keeps it to be named, a card draws nothing for it
    expect(sectionOf({ type: 'section' })).toEqual({ label: '', line: false });
    // only `line: true` draws the hairline
    expect(sectionOf({ section: 'Loft', line: 'yes' })?.line).toBe(false);
  });

  it('is nothing else: a row, an id, another kind of entry, nothing', () => {
    for (const entry of [
      'light.a',
      { entity: 'light.a' },
      { type: 'button' },
      { name: 'x' },
      null,
      7,
    ])
      expect(sectionOf(entry)).toBeUndefined();
  });
});

describe('a list as it is laid out', () => {
  it('keeps its rows as items and its sections between them, in its order', () => {
    expect(
      listedOf([
        { type: 'section', label: 'Down' },
        'sensor.a',
        { entity: 'sensor.b', name: 'B' },
        { type: 'divider' },
        '',
        null,
        { type: 'weblink' },
        { type: 'section' },
        { section: 'Up', line: true },
        'sensor.c',
      ]),
    ).toEqual([
      { label: 'Down', line: false },
      { entity: 'sensor.a' },
      { entity: 'sensor.b', name: 'B' },
      { label: '', line: true },
      { label: 'Up', line: true },
      { entity: 'sensor.c' },
    ]);
    expect(listedOf(undefined)).toEqual([]);
    expect(listedOf('sensor.a')).toEqual([]);
  });
});

/** A list said in a line: a word is a label, `-` a hairline alone, anything with a dot a row; `!` marks a row away. */
const shown = (list: string): string => {
  const away = new Set<string>();
  const listed: Listed<{ entity: string }>[] = list.split(' ').map((word) => {
    if (word === '-') return { label: '', line: true };
    if (!word.includes('.')) return { label: word, line: false };
    const id = word.replace('!', '');
    if (word.endsWith('!')) away.add(id);
    return { entity: id };
  });
  return shownOf(listed, (row) => !away.has(row.entity))
    .map((entry) => (isRow(entry) ? entry.entity : entry.label || '-'))
    .join(' ');
};

describe('what a list draws while rows come and go', () => {
  it('draws every row that shows, with its sections', () => {
    expect(shown('Down a.1 a.2 Up b.1')).toBe('Down a.1 a.2 Up b.1');
    expect(shown('a.1 - b.1')).toBe('a.1 - b.1');
  });

  it('draws no label with no row showing under it', () => {
    expect(shown('Down a.1! a.2! Up b.1')).toBe('Up b.1');
    expect(shown('Down a.1 Up b.1!')).toBe('Down a.1');
    expect(shown('Down Up b.1')).toBe('Up b.1');
    expect(shown('a.1 Up')).toBe('a.1');
  });

  it('draws a hairline alone only between rows that show, and once', () => {
    expect(shown('- a.1 - b.1 -')).toBe('a.1 - b.1');
    expect(shown('a.1! - b.1')).toBe('b.1');
    expect(shown('a.1 - b.1!')).toBe('a.1');
    expect(shown('a.1 - - b.1')).toBe('a.1 - b.1');
    expect(shown('a.1 - b.1! - c.1')).toBe('a.1 - c.1');
  });

  it('ends a label’s part at a hairline: no label stands over another part’s rows', () => {
    expect(shown('a.1 - Up b.1')).toBe('a.1 - Up b.1');
    expect(shown('a.1 Down a.2! - b.1')).toBe('a.1 - b.1');
    expect(shown('a.1 Down a.2! - Up b.1')).toBe('a.1 - Up b.1');
    expect(shown('Down a.1! - b.1')).toBe('b.1');
    expect(shown('Down a.1 - b.1')).toBe('Down a.1 - b.1');
  });

  it('draws nothing of a list none of whose rows shows', () => {
    expect(shown('Down a.1! - Up b.1!')).toBe('');
    expect(shown('Down -')).toBe('');
  });

  it('leaves out a section that says nothing, which ends no part either', () => {
    expect(
      shownOf(
        listedOf([{ section: 'Down' }, { type: 'section' }, 'sensor.a', { type: 'section' }]),
        () => true,
      ),
    ).toEqual([{ label: 'Down', line: false }, { entity: 'sensor.a' }]);
  });
});

describe('a row’s condition', () => {
  const hass = house({
    'sensor.low': '18',
    'sensor.mid': '47',
    'sensor.high': '84',
    'sensor.gone': 'unavailable',
    'sensor.blank': '',
    'switch.on': 'on',
    'switch.off': 'off',
    'cover.door': 'opening',
  });
  const when = (id: string, condition: ShowWhen | undefined): boolean => holds(hass, id, condition);

  it('none always holds, and one that says nothing asks nothing', () => {
    expect(when('sensor.low', undefined)).toBe(true);
    expect(when('sensor.low', {})).toBe(true);
    expect(when('sensor.gone', {})).toBe(true);
    // a bound not typed yet, a list of no states
    expect(when('sensor.high', { below: null } as unknown as ShowWhen)).toBe(true);
    expect(when('sensor.high', { above: '' } as unknown as ShowWhen)).toBe(true);
    expect(when('switch.off', { state: [] })).toBe(true);
    // a slip that is no condition at all
    expect(when('sensor.low', 'below 30' as unknown as ShowWhen)).toBe(true);
  });

  it('a number strictly above one, below one, or between both', () => {
    expect(when('sensor.low', { below: 30 })).toBe(true);
    expect(when('sensor.mid', { below: 30 })).toBe(false);
    expect(when('sensor.low', { below: 18 })).toBe(false);
    expect(when('sensor.high', { above: 80 })).toBe(true);
    expect(when('sensor.high', { above: 84 })).toBe(false);
    expect(when('sensor.mid', { above: 30, below: 80 })).toBe(true);
    expect(when('sensor.high', { above: 30, below: 80 })).toBe(false);
    // a bound written as text is the number it says
    expect(when('sensor.low', { below: '30' } as unknown as ShowWhen)).toBe(true);
  });

  it('a state that is no number is neither above nor below one', () => {
    expect(when('sensor.gone', { below: 30 })).toBe(false);
    expect(when('sensor.gone', { above: 30 })).toBe(false);
    expect(when('sensor.blank', { below: 30 })).toBe(false);
    expect(when('switch.on', { above: 0 })).toBe(false);
  });

  it('a state that is a word, one of several, or none of them', () => {
    expect(when('switch.on', { state: 'on' })).toBe(true);
    expect(when('switch.off', { state: 'on' })).toBe(false);
    expect(when('cover.door', { state: ['open', 'opening'] })).toBe(true);
    expect(when('cover.door', { state_not: ['closed', 'closing'] })).toBe(true);
    expect(when('sensor.gone', { state_not: 'unavailable' })).toBe(false);
    expect(when('switch.on', { state_not: 'unavailable' })).toBe(true);
  });

  it('reads a YAML dashboard’s unquoted on and off as the words', () => {
    expect(when('switch.on', { state: true } as unknown as ShowWhen)).toBe(true);
    expect(when('switch.off', { state: true } as unknown as ShowWhen)).toBe(false);
    expect(when('switch.off', { state_not: false } as unknown as ShowWhen)).toBe(false);
  });

  it('every part given must hold', () => {
    expect(when('sensor.low', { below: 30, state_not: '18' })).toBe(false);
    expect(when('sensor.low', { below: 30, state_not: 'unavailable' })).toBe(true);
  });

  it('reads another entity where it names one', () => {
    expect(when('sensor.high', { entity: 'switch.on', state: 'on' })).toBe(true);
    expect(when('sensor.high', { entity: 'switch.off', state: 'on' })).toBe(false);
    expect(when('switch.on', { entity: 'sensor.low', below: 30 })).toBe(true);
  });

  it('reads an entity the house does not hold as out of reach', () => {
    expect(when('sensor.nowhere', { state: 'unavailable' })).toBe(true);
    expect(when('sensor.nowhere', { state_not: 'unavailable' })).toBe(false);
    expect(when('sensor.nowhere', { below: 30 })).toBe(false);
    expect(holds(undefined, 'sensor.low', { below: 30 })).toBe(false);
  });

  it('is data compared with a state, never evaluated', () => {
    const before = Object.keys(globalThis).length;
    const hostile = { state: '${globalThis.pwned = 1}', below: 'alert(1)' } as unknown as ShowWhen;
    expect(when('sensor.low', hostile)).toBe(false);
    expect(Object.keys(globalThis).length).toBe(before);
    expect((globalThis as { pwned?: unknown }).pwned).toBeUndefined();
  });
});

describe('a card’s list as drawn now', () => {
  const hass = house({
    'sensor.a': '10',
    'sensor.b': '50',
    'sensor.c': '90',
    'sensor.d': '95',
    'switch.x': 'off',
  });
  const list = [
    { section: 'Low' },
    'sensor.a',
    { entity: 'sensor.b', show_when: { below: 60 } },
    { section: 'High' },
    { entity: 'sensor.c', show_when: {} },
    { entity: 'sensor.d', show_when: 'always' },
  ];

  it('gives every row the card’s condition, a row’s own winning over it', () => {
    const ids = (every?: ShowWhen): string[] =>
      drawnOf<{ entity: string }>(hass, list, every)
        .filter(isRow)
        .map((row) => row.entity);
    expect(ids()).toEqual(['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d']);
    // the card's for the bare id; `sensor.b` keeps to its own 60, `sensor.c` asks nothing, `sensor.d` shows always
    expect(ids({ below: 30 })).toEqual(['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d']);
    expect(ids({ above: 30 })).toEqual(['sensor.b', 'sensor.c', 'sensor.d']);
    expect(ids({ entity: 'switch.x', state: 'on' })).toEqual(['sensor.b', 'sensor.c', 'sensor.d']);
  });

  it('names the other entities its conditions read, to be watched', () => {
    expect(
      conditionIds(
        [
          { entity: 'sensor.a' },
          { entity: 'sensor.b', show_when: { entity: 'switch.x', state: 'on' } },
          { entity: 'sensor.c', show_when: { below: 3 } },
          { entity: 'sensor.d', show_when: 'always' },
        ],
        { entity: 'input_boolean.guests', state: 'on' },
      ),
    ).toEqual(['input_boolean.guests', 'switch.x']);
    expect(conditionIds([{ entity: 'sensor.a' }])).toEqual([]);
  });
});

describe('what a list’s sections add to its declared height', () => {
  it('a label 28, the list’s first its own line, a hairline alone 16', () => {
    expect(sectionsHeight(['sensor.a'])).toBe(0);
    expect(sectionsHeight([{ section: 'Down' }, 'sensor.a'])).toBe(20);
    expect(sectionsHeight(['sensor.a', { section: 'Up' }, 'sensor.b'])).toBe(28);
    expect(sectionsHeight([{ section: 'Down' }, 'sensor.a', { section: 'Up' }, 'sensor.b'])).toBe(
      48,
    );
    expect(sectionsHeight(['sensor.a', { type: 'divider' }, 'sensor.b'])).toBe(16);
    // a list that sits 8 under its head gives its first label that 8 too
    expect(sectionsHeight([{ section: 'Down' }, 'sensor.a'], 28)).toBe(28);
    // a label's hairline is drawn inside its band: as tall with it as without; one with no label is a hairline alone
    expect(
      sectionsHeight([
        { section: 'Down', line: true },
        'sensor.a',
        { section: 'Up', line: true },
        'sensor.b',
      ]),
    ).toBe(48);
    expect(sectionsHeight(['sensor.a', { type: 'section', line: true }, 'sensor.b'])).toBe(16);
  });

  it('counts what the config can ever draw: every row showing, whatever its condition says now', () => {
    const list = [
      { section: 'Down' },
      { entity: 'sensor.a', show_when: { below: 1 } },
      { type: 'divider' },
      'sensor.b',
    ];
    expect(sectionsHeight(list)).toBe(36);
    // a label no row follows and a hairline that ends the list are never drawn
    expect(sectionsHeight(['sensor.a', { section: 'Up' }, { type: 'divider' }])).toBe(0);
    expect(sectionsHeight(undefined)).toBe(0);
  });
});
