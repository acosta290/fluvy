import { describe, expect, it } from 'vitest';
import { edited, pinned } from '../../strategy/edit.js';
import type { DashboardEdit } from '../../strategy/types.js';
import {
  leading,
  moved,
  optionsOf,
  patched,
  pinsFor,
  withoutOwn,
  withoutPart,
  withoutView,
  written,
} from './draft.js';

describe('a dashboard’s edit as Customise changes it (#170)', () => {
  const saved: DashboardEdit = {
    views: { climate: { hidden: true } },
    cards: {
      // a room the house no longer has: ignored by the dashboard, kept by every change
      'rooms/room:gone': { hidden: true },
      'home/clock': { options: { variant: 'analog' }, order: 0 },
    },
    entities: { 'home/lights': { drop: ['light.sofa'] } },
  };

  it('lays a change over what is there, entry by entry and key by key', () => {
    const next = patched(saved, 'cards', 'home/flow', { hidden: true });
    expect(next.cards).toEqual({ ...saved.cards, 'home/flow': { hidden: true } });
    expect(next.views).toBe(saved.views);
    expect(next.entities).toBe(saved.entities);
    // a key of an entry: its others stay
    expect(patched(saved, 'cards', 'home/clock', { hidden: true }).cards?.['home/clock']).toEqual({
      options: { variant: 'analog' },
      order: 0,
      hidden: true,
    });
    // the saved edit itself is never touched
    expect(saved.cards?.['home/flow']).toBeUndefined();
  });

  it('takes away a key given nothing, an entry left without keys and a table left without entries', () => {
    const once = patched(saved, 'cards', 'home/clock', { order: undefined });
    expect(once.cards?.['home/clock']).toEqual({ options: { variant: 'analog' } });
    const gone = patched(once, 'cards', 'home/clock', { options: undefined });
    expect(gone.cards).toEqual({ 'rooms/room:gone': { hidden: true } });
    expect(patched(saved, 'views', 'climate', { hidden: undefined }).views).toBeUndefined();
    // an empty list and an empty table are nothing
    expect(patched(saved, 'entities', 'home/lights', { drop: [] }).entities).toBeUndefined();
    expect(patched(saved, 'cards', 'home/flow', { options: {} }).cards).toEqual(saved.cards);
    // an option taken away is a null, which is something
    expect(
      patched({}, 'cards', 'home/clock', { options: { weather: null } }).cards?.['home/clock'],
    ).toEqual({ options: { weather: null } });
  });

  it('writes no edit at all once nothing is left of it', () => {
    expect(written({})).toBeUndefined();
    expect(
      written(patched({ views: { a: { hidden: true } } }, 'views', 'a', { hidden: undefined })),
    ).toBe(undefined);
    expect(written(saved)).toBe(saved);
  });

  it('resets one part: its entry, its list and its cards’ own options, nothing else', () => {
    const edit: DashboardEdit = {
      ...saved,
      cards: {
        ...saved.cards,
        'home/lights': { order: 2 },
        'home/lights:light.desk': { options: { name: 'Desk' } },
        'home/lightsabre': { hidden: true },
      },
    };
    const next = withoutPart(edit, 'home/lights');
    expect(next.cards).toEqual({ ...saved.cards, 'home/lightsabre': { hidden: true } });
    expect(next.entities).toBeUndefined();
    expect(next.views).toEqual(saved.views);
  });

  it('resets one view: its parts, its own entry and its cards of the person’s own', () => {
    const edit: DashboardEdit = {
      views: { home: { order: 1, add: [{ type: 'markdown' }] }, climate: { hidden: true } },
      cards: { 'home/clock': { hidden: true }, 'home/own:0': { order: 0 }, 'rooms/room:a': {} },
      entities: { 'home/lights': { drop: ['light.sofa'] }, 'homework/x': { drop: ['a.b'] } },
    };
    expect(withoutView(edit, 'home')).toEqual({
      views: { climate: { hidden: true } },
      cards: { 'rooms/room:a': {} },
      entities: { 'homework/x': { drop: ['a.b'] } },
    });
  });

  it('takes one of a view’s own cards out, the later ones and their places moving up', () => {
    const [a, b, c] = [{ type: 'a' }, { type: 'b' }, { type: 'c' }];
    const edit: DashboardEdit = {
      views: { home: { add: [a, b, c] } },
      cards: { 'home/own:0': { order: 3 }, 'home/own:2': { order: 0 }, 'home/clock': { order: 1 } },
    };
    expect(withoutOwn(edit, 'home', 1)).toEqual({
      views: { home: { add: [a, c] } },
      cards: { 'home/own:0': { order: 3 }, 'home/own:1': { order: 0 }, 'home/clock': { order: 1 } },
    });
    expect(withoutOwn(edit, 'home', 0)).toEqual({
      views: { home: { add: [b, c] } },
      cards: { 'home/own:1': { order: 0 }, 'home/clock': { order: 1 } },
    });
    expect(withoutOwn({ views: { home: { add: [a] } } }, 'home', 0)).toEqual({});
  });
});

describe('the places a person’s order needs (#170)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  /** `ids` as the strategy reads them with these places. */
  const read = (pins: ReadonlyMap<string, number>): string[] => pinned(ids, (id) => pins.get(id));

  it('pins nothing where the order is the house’s', () => {
    expect(pinsFor(ids, ids).size).toBe(0);
  });

  it('pins one part for one move, from the first near the head and from the last near the foot', () => {
    const up = ['a', 'c', 'b', 'd', 'e', 'f'];
    expect([...pinsFor(ids, up)]).toHaveLength(1);
    expect(read(pinsFor(ids, up))).toEqual(up);
    expect([...pinsFor(ids, ['f', 'a', 'b', 'c', 'd', 'e'])]).toEqual([['f', 0]]);
    expect([...pinsFor(ids, ['b', 'c', 'd', 'e', 'f', 'a'])]).toEqual([['a', -1]]);
    expect([...pinsFor(ids, ['a', 'b', 'c', 'e', 'd', 'f'])]).toEqual([['d', -2]]);
  });

  it('reads back every order it is asked for', () => {
    const orders = [
      ['f', 'e', 'd', 'c', 'b', 'a'],
      ['c', 'a', 'f', 'b', 'e', 'd'],
      ['b', 'a', 'd', 'c', 'f', 'e'],
      ['d', 'e', 'f', 'a', 'b', 'c'],
    ];
    for (const asked of orders) expect(read(pinsFor(ids, asked)), asked.join('')).toEqual(asked);
    // one put last stays last when the house grows; one put first stays first
    const pins = pinsFor(ids, ['f', 'b', 'c', 'd', 'e', 'a']);
    const grown = pinned([...ids, 'g', 'h'], (id) => pins.get(id));
    expect(grown[0]).toBe('f');
    expect(grown.at(-1)).toBe('a');
  });

  it('steps a part past the ones nobody sees', () => {
    const seen = ['a', 'b', 'e', 'f'];
    expect(moved(ids, seen, 'e', 1)).toEqual(['a', 'e', 'b', 'c', 'd', 'f']);
    expect(moved(ids, seen, 'b', 2)).toEqual(['a', 'c', 'd', 'e', 'b', 'f']);
    expect(moved(ids, seen, 'a', -1)).toEqual(ids);
    expect(moved(ids, seen, 'f', 4)).toEqual(ids);
    // one nobody sees, or one that is no part of the list, moves nothing
    expect(moved(ids, seen, 'c', 0)).toEqual(ids);
    expect(moved(ids, seen, 'z', 0)).toEqual(ids);
  });

  it('drops a row on any place among those seen, and a step back is the house’s order again', () => {
    const seen = ['a', 'b', 'e', 'f'];
    // dragged down two rows: right after the one it now follows
    expect(moved(ids, seen, 'a', 2)).toEqual(['b', 'c', 'd', 'e', 'a', 'f']);
    // dragged up two rows: right before the one it now leads
    expect(moved(ids, seen, 'f', 1)).toEqual(['a', 'f', 'b', 'c', 'd', 'e']);
    const down = moved(ids, seen, 'e', 3);
    expect(down).toEqual(['a', 'b', 'c', 'd', 'f', 'e']);
    expect(moved(down, ['a', 'b', 'f', 'e'], 'e', 2)).toEqual(ids);
  });

  it('puts a part at the top or the bottom with one place, past the ones nobody sees', () => {
    // the first and the last of the list are not seen: an end is the list's all the same
    const seen = ['b', 'c', 'd', 'e'];
    const top = moved(ids, seen, 'e', 0);
    expect(top).toEqual(['e', 'a', 'b', 'c', 'd', 'f']);
    expect([...pinsFor(ids, top)]).toEqual([['e', 0]]);
    const bottom = moved(ids, seen, 'b', seen.length - 1);
    expect(bottom).toEqual(['a', 'c', 'd', 'e', 'f', 'b']);
    expect([...pinsFor(ids, bottom)]).toEqual([['b', -1]]);
    // sixteen parts, the last put first: one place, where fifteen steps were pressed before
    const many = Array.from({ length: 16 }, (_, index) => `part${index}`);
    expect([...pinsFor(many, moved(many, many, 'part15', 0))]).toEqual([['part15', 0]]);
  });
});

describe('a list’s order (#170)', () => {
  const house = ['light.a', 'light.b', 'light.c', 'light.d'];
  const read = (order: string[]): readonly string[] =>
    edited(house, { order }, ['light'], () => true);

  it('names only the entities put first, up to where the house’s order follows by itself', () => {
    expect(leading(house, house)).toEqual([]);
    expect(leading(house, ['light.c', 'light.a', 'light.b', 'light.d'])).toEqual(['light.c']);
    expect(leading(house, ['light.a', 'light.d', 'light.b', 'light.c'])).toEqual([
      'light.a',
      'light.d',
    ]);
    const asked = ['light.d', 'light.c', 'light.b', 'light.a'];
    expect(read(leading(house, asked))).toEqual(asked);
    expect(read(leading(house, ['light.b', 'light.a', 'light.c', 'light.d']))).toEqual([
      'light.b',
      'light.a',
      'light.c',
      'light.d',
    ]);
  });
});

describe('a card’s options from its form (#170)', () => {
  const generated = {
    type: 'custom:fluvy-clock-card',
    variant: 'digital',
    weather: 'weather.home',
    grid_options: { columns: 12 },
  };

  it('keeps only what differs from the generated card, a null for what was taken away', () => {
    expect(optionsOf(generated, generated)).toBeUndefined();
    expect(
      optionsOf(generated, {
        type: 'custom:fluvy-clock-card',
        variant: 'analog',
        show_seconds: true,
        grid_options: { columns: 12 },
      }),
    ).toEqual({ variant: 'analog', show_seconds: true, weather: null });
  });

  it('never keeps the type, nor a key Customise edits itself', () => {
    expect(
      optionsOf(
        { type: 'custom:fluvy-entities-card', title: 'Security', rows: [{ entity: 'lock.door' }] },
        { type: 'custom:other', title: 'Doors', rows: [] },
        new Set(['rows']),
      ),
    ).toEqual({ title: 'Doors' });
  });
});
