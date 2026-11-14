// @vitest-environment happy-dom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setRoomOrder, type HomeAssistant } from '@fluvy/core';
import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextRuler } from './fit.js';
import { laidOut, sceneChips, shortNames, type SceneChip } from './groups.js';
import { asksGroups, groupsHeight, groupsOf } from './lists.js';

/*
 * A list in groups (#189): the names short inside a group, in the languages people name their things in; the groups
 * the house makes of a list, in the house's order of its rooms; a list's own sections; the scenes as chips.
 */

describe('short names inside a group', () => {
  it('drops the room’s name at either end, as whole words, in the name’s case (en)', () => {
    expect(
      shortNames('Kitchen', ['Kitchen Island downlight', 'Kitchen Pendant', 'Counter Kitchen']),
    ).toEqual(['Island downlight', 'Pendant', 'Counter']);
    // a word the cut leaves lower-case takes the name's capital; a name written small stays small
    expect(shortNames('Kitchen', ['Kitchen ceiling light'])).toEqual(['Ceiling light']);
    expect(shortNames('Kitchen', ['kitchen ceiling light'])).toEqual(['ceiling light']);
    // the marks people join a name with go with the room
    expect(
      shortNames('Kitchen', [
        'Kitchen · Pendant',
        'Kitchen: Counter',
        'Hob - Kitchen',
        'Kitchen_Fan',
      ]),
    ).toEqual(['Pendant', 'Counter', 'Hob', 'Fan']);
    // never inside a word, and never the whole of a name
    expect(shortNames('Kitchen', ['Kitchenette lamp', 'Kitchen', 'Kitchen2 lamp'])).toEqual([
      'Kitchenette lamp',
      'Kitchen',
      'Kitchen2 lamp',
    ]);
    // whatever case the house wrote either in
    expect(shortNames('LIVING ROOM', ['Living room Floor lamp'])).toEqual(['Floor lamp']);
  });

  it('drops a first word every name of the group shares, three names at least, each keeping a word', () => {
    // the reporter's scenes: "Lights Cooking" under Kitchen reads "Cooking"
    expect(shortNames('Kitchen', ['Lights Cooking', 'Lights Dinner', 'Lights Evening'])).toEqual([
      'Cooking',
      'Dinner',
      'Evening',
    ]);
    expect(
      shortNames('Kitchen', [
        'Kitchen Lights cooking',
        'Kitchen Lights · dinner',
        'Lights TV Kitchen',
      ]),
    ).toEqual(['Cooking', 'Dinner', 'TV']);
    // two that begin alike say nothing of how the house names its things
    expect(shortNames('Kitchen', ['Island downlight', 'Island uplight'])).toEqual([
      'Island downlight',
      'Island uplight',
    ]);
    // one of them is the word alone: each keeps its own
    expect(shortNames('Kitchen', ['Lights', 'Lights Dinner', 'Lights Evening'])).toEqual([
      'Lights',
      'Lights Dinner',
      'Lights Evening',
    ]);
    // one begins otherwise: nothing is shared
    expect(shortNames('Kitchen', ['Lights Cooking', 'Lights Dinner', 'Hob'])).toEqual([
      'Lights Cooking',
      'Lights Dinner',
      'Hob',
    ]);
  });

  it('never makes two names read alike that the house told apart', () => {
    expect(shortNames('Kitchen', ['Kitchen Lamp', 'Lamp'])).toEqual(['Kitchen Lamp', 'Lamp']);
    // without its room one would read as another does, whatever their case: every name stays whole
    expect(shortNames('Kitchen', ['Kitchen Lights Bright', 'Lights bright', 'Lights Dim'])).toEqual(
      ['Kitchen Lights Bright', 'Lights bright', 'Lights Dim'],
    );
    // the room goes, the word they share stays: without it two would both read "Bright"
    expect(
      shortNames('Kitchen', ['Kitchen Lights Bright', 'Lights Bright · 2', 'Lights · Bright']),
    ).toEqual(['Lights Bright', 'Lights Bright · 2', 'Lights · Bright']);
  });

  it('takes the words that tie a thing to its room with it, and leaves no name hanging', () => {
    expect(shortNames('Kitchen', ['Lamp in the Kitchen', 'Ceiling light Kitchen'])).toEqual([
      'Lamp',
      'Ceiling light',
    ]);
    // a short word nobody can tell from a joining one: the name stays whole
    expect(shortNames('Kitchen', ['Ceiling fan Kitchen', 'Wall tv Kitchen'])).toEqual([
      'Ceiling fan Kitchen',
      'Wall tv Kitchen',
    ]);
    // es, fr, it: the article and the preposition, an elision
    expect(shortNames('Cocina', ['Luz de la cocina', 'Luz techo Cocina'])).toEqual([
      'Luz',
      'Luz techo',
    ]);
    expect(shortNames('Salón', ['Lámpara del Salón'])).toEqual(['Lámpara']);
    expect(shortNames('Entrée', ['Lampe de l’entrée', 'Lampe du salon'])).toEqual([
      'Lampe',
      'Lampe du salon',
    ]);
    expect(shortNames('Cucina', ['Luce della cucina'])).toEqual(['Luce']);
  });

  it('reads German: a compound stays a word, the prepositions go with the room (de)', () => {
    expect(
      shortNames('Küche', [
        'Küche Deckenlampe',
        'Lampe in der Küche',
        'Küchenlampe',
        'Licht Küche',
      ]),
    ).toEqual(['Deckenlampe', 'Lampe', 'Küchenlampe', 'Licht']);
    expect(shortNames('Wohnzimmer', ['Stehlampe im Wohnzimmer', 'Wohnzimmer: Leselampe'])).toEqual([
      'Stehlampe',
      'Leselampe',
    ]);
    // a word no list knows before the room: whole
    expect(shortNames('Treppe', ['Licht ob Treppe'])).toEqual(['Licht ob Treppe']);
  });

  it('reads Japanese: no space stands between a room and its thing, の ties them (ja)', () => {
    expect(
      shortNames('キッチン', ['キッチン照明', 'キッチンのペンダント', 'キッチン カウンター']),
    ).toEqual(['照明', 'ペンダント', 'カウンター']);
    expect(shortNames('リビング', ['リビングライト', '間接照明 リビング', 'リビング'])).toEqual([
      'ライト',
      '間接照明',
      'リビング',
    ]);
    // 厨房的灯 is 灯
    expect(shortNames('厨房', ['厨房的灯', '厨房吊灯'])).toEqual(['灯', '吊灯']);
  });

  it('reads Ukrainian: Cyrillic words stand apart as Latin ones do (uk)', () => {
    expect(shortNames('Кухня', ['Кухня Стеля', 'Світло Кухня', 'Кухня: Витяжка'])).toEqual([
      'Стеля',
      'Світло',
      'Витяжка',
    ]);
    expect(shortNames('Вітальня', ['Лампа у Вітальня', 'Торшер біля Вітальня'])).toEqual([
      'Лампа',
      'Торшер',
    ]);
    // another case of the room's name is another word, and a longer word no room
    expect(shortNames('Кухня', ['Світло на кухні', 'Кухняшка лампа'])).toEqual([
      'Світло на кухні',
      'Кухняшка лампа',
    ]);
    expect(shortNames('Кухня', ['Світло Готування', 'Світло Вечеря', 'Світло Ранок'])).toEqual([
      'Готування',
      'Вечеря',
      'Ранок',
    ]);
  });

  it('knows every joining word the automatic dashboards read, in every language', () => {
    const words = join(dirname(fileURLToPath(import.meta.url)), '../../../core/src/i18n/words');
    const joins = readdirSync(words)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => {
        const stems = (
          JSON.parse(readFileSync(join(words, file), 'utf8')) as { place_joins?: string[] }
        ).place_joins;
        return (stems ?? []).map((stem) => [file, stem] as const);
      })
      // a script whose words stand apart: 的 and 与 tie without a space
      .filter(([, stem]) => /^[\p{Script=Latin}\p{Script=Cyrillic}'’]+$/u.test(stem));
    expect(joins.length).toBeGreaterThan(60);
    for (const [file, stem] of joins) {
      // an elision is written against its room ("l'Atrium")
      const name = /['’]$/.test(stem) ? `Lampa ${stem}Atrium` : `Lampa ${stem} Atrium`;
      expect(shortNames('Atrium', [name]), `${file}: ${stem}`).toEqual(['Lampa']);
    }
  });
});

/** A house of two floors: the kitchen and the living room downstairs, the bedroom up, a porch light in no room. */
const entity = (id: string, name: string) => ({
  entity_id: id,
  state: 'off',
  attributes: { friendly_name: name },
  last_changed: '',
  last_updated: '',
});
const hass = {
  language: 'en',
  states: Object.fromEntries(
    [
      entity('light.kitchen_pendant', 'Kitchen Pendant'),
      entity('light.kitchen_counter', 'Kitchen Counter'),
      entity('light.living_floor', 'Living room Floor lamp'),
      entity('light.bedroom_ceiling', 'Bedroom Ceiling'),
      entity('light.porch', 'Porch'),
      entity('light.hall', 'Hall'),
    ].map((state) => [state.entity_id, state]),
  ),
  entities: {
    'light.kitchen_pendant': { entity_id: 'light.kitchen_pendant', area_id: 'kitchen' },
    // through its device
    'light.kitchen_counter': { entity_id: 'light.kitchen_counter', device_id: 'strip' },
    'light.living_floor': { entity_id: 'light.living_floor', area_id: 'living' },
    'light.bedroom_ceiling': { entity_id: 'light.bedroom_ceiling', area_id: 'bedroom' },
    'light.hall': { entity_id: 'light.hall', area_id: 'hall' },
  },
  devices: { strip: { id: 'strip', name: 'Strip', name_by_user: null, area_id: 'kitchen' } },
  // as Home Assistant orders them: the living room, the bedroom, the kitchen, the hall
  areas: {
    living: { area_id: 'living', name: 'Living room', floor_id: 'ground' },
    bedroom: { area_id: 'bedroom', name: 'Bedroom', floor_id: 'first' },
    kitchen: { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground' },
    hall: { area_id: 'hall', name: 'Hall' },
  },
  floors: {
    first: { floor_id: 'first', name: 'First floor', level: 1 },
    ground: { floor_id: 'ground', name: 'Ground floor', level: 0 },
  },
} as unknown as HomeAssistant;

const LIST = [
  'light.porch',
  'light.kitchen_pendant',
  'light.living_floor',
  { entity: 'light.kitchen_counter' },
  'light.bedroom_ceiling',
  'light.hall',
];
/** The groups as their labels over their entities, and as the names their tiles say. */
const labels = (groups: readonly { label: string; items: readonly { entity: string }[] }[]) =>
  groups.map(({ label, items }) => [label, ...items.map((item) => item.entity.split('.')[1])]);
const names = (groups: readonly { items: readonly { name?: unknown }[] }[]) =>
  groups.map(({ items }) => items.map((item) => item.name));

describe('a list in the house’s groups', () => {
  afterEach(() => setRoomOrder({ sort: 'auto', order: [] }));

  it('gathers a room’s under its name, the rooms as the list first names them, what is in none last', () => {
    const groups = laidOut(hass, { group_by: 'area' }, LIST);
    expect(labels(groups)).toEqual([
      ['Kitchen', 'kitchen_pendant', 'kitchen_counter'],
      ['Living room', 'living_floor'],
      ['Bedroom', 'bedroom_ceiling'],
      ['Hall', 'hall'],
      ['Other', 'porch'],
    ]);
    // each name short under its room; a name that is its room's keeps it
    expect(names(groups)).toEqual([
      ['Pendant', 'Counter'],
      ['Floor lamp'],
      ['Ceiling'],
      [undefined],
      [undefined],
    ]);
  });

  it('follows the house’s order of its rooms, and A to Z where the card says so', () => {
    // Home Assistant's: its first floor before its ground floor, each one's rooms as it lists them
    setRoomOrder({ sort: 'home_assistant', order: [] });
    expect(laidOut(hass, { group_by: 'area' }, LIST).map((group) => group.label)).toEqual([
      'Bedroom',
      'Living room',
      'Kitchen',
      'Hall',
      'Other',
    ]);
    setRoomOrder({ sort: 'auto', order: ['bedroom', 'hall'] });
    expect(laidOut(hass, { group_by: 'area' }, LIST).map((group) => group.label)).toEqual([
      'Bedroom',
      'Hall',
      'Kitchen',
      'Living room',
      'Other',
    ]);
    // the card's own order over the house's
    expect(
      laidOut(hass, { group_by: 'area', group_order: 'name' }, LIST).map((group) => group.label),
    ).toEqual(['Bedroom', 'Hall', 'Kitchen', 'Living room', 'Other']);
  });

  it('gathers by floor, the floors in their own order, what is on none last', () => {
    expect(labels(laidOut(hass, { group_by: 'floor' }, LIST))).toEqual([
      ['Ground floor', 'kitchen_pendant', 'living_floor', 'kitchen_counter'],
      ['First floor', 'bedroom_ceiling'],
      ['Other', 'porch', 'hall'],
    ]);
    setRoomOrder({ sort: 'home_assistant', order: [] });
    expect(laidOut(hass, { group_by: 'floor' }, LIST).map((group) => group.label)).toEqual([
      'First floor',
      'Ground floor',
      'Other',
    ]);
    expect(
      laidOut(hass, { group_by: 'floor', group_order: 'name' }, LIST).map((group) => group.label),
    ).toEqual(['First floor', 'Ground floor', 'Other']);
  });

  it('keeps a list’s own sections where it asks for none of the house’s, and reads `none` as none', () => {
    const own = [
      'light.porch',
      { section: 'Kitchen' },
      'light.kitchen_pendant',
      { entity: 'light.kitchen_counter', name: 'Kitchen Counter' },
      { type: 'section', label: 'Night' },
      { type: 'divider' },
      'light.living_floor',
      { section: 'Nothing here' },
    ];
    for (const config of [{}, { group_by: 'none' as const }]) {
      const groups = laidOut(hass, config, own);
      expect(labels(groups)).toEqual([
        ['', 'porch'],
        ['Kitchen', 'kitchen_pendant', 'kitchen_counter'],
        ['Night', 'living_floor'],
      ]);
      // short under a section that is a room of the house; a name the config gives is never touched, nor one under
      // words of the person's own
      expect(names(groups)).toEqual([[undefined], ['Pendant', 'Kitchen Counter'], [undefined]]);
    }
    // the house's groups take no notice of the list's sections
    expect(laidOut(hass, { group_by: 'area' }, own).map((group) => group.label)).toEqual([
      'Kitchen',
      'Living room',
      'Other',
    ]);
  });

  it('shortens under any label when asked, and never when asked not to', () => {
    const own = [{ section: 'Living' }, 'light.living_floor', 'light.kitchen_pendant'];
    expect(names(laidOut(hass, {}, own))).toEqual([[undefined, undefined]]);
    expect(names(laidOut(hass, { short_names: true }, [{ section: 'Kitchen' }, ...LIST]))).toEqual([
      [undefined, 'Pendant', undefined, 'Counter', undefined, undefined],
    ]);
    expect(names(laidOut(hass, { group_by: 'area', short_names: false }, LIST))).toEqual([
      [undefined, undefined],
      [undefined],
      [undefined],
      [undefined],
      [undefined],
    ]);
  });

  it('lays a list out before the house is there: its own sections, else one group of it all', () => {
    expect(labels(laidOut(undefined, { group_by: 'area' }, LIST))).toEqual([
      [
        '',
        'porch',
        'kitchen_pendant',
        'living_floor',
        'kitchen_counter',
        'bedroom_ceiling',
        'hall',
      ],
    ]);
    expect(laidOut(undefined, {}, undefined)).toEqual([]);
  });
});

describe('what every page carries of a list in groups', () => {
  it('reads a list’s sections as groups: a label over nothing is none, a divider is none', () => {
    expect(
      groupsOf([
        'light.a',
        { section: 'Up' },
        { type: 'divider' },
        'light.b',
        { section: 'Empty' },
      ]),
    ).toEqual([
      { label: '', items: [{ entity: 'light.a' }] },
      { label: 'Up', items: [{ entity: 'light.b' }] },
    ]);
    expect(groupsOf(undefined)).toEqual([]);
    expect(groupsOf([{ section: 'Alone' }])).toEqual([]);
  });

  it('says whether a config asks for groups', () => {
    expect(asksGroups({}, ['light.a'])).toBe(false);
    expect(asksGroups({ group_by: 'none' }, ['light.a'])).toBe(false);
    expect(asksGroups(undefined, undefined)).toBe(false);
    expect(asksGroups({ group_by: 'area' }, [])).toBe(true);
    expect(asksGroups({ group_by: 'floor' }, undefined)).toBe(true);
    expect(asksGroups({}, ['light.a', { section: 'Up' }])).toBe(true);
    // a divider, or a section that says nothing, makes no group
    expect(asksGroups({}, [{ type: 'divider' }, { type: 'section' }, 'light.a'])).toBe(false);
  });

  it('counts a label 28 (its 20 line, 8 under it) and 16 over each but the first', () => {
    const group = (label: string) => ({ label, items: [] });
    expect(groupsHeight([group('')], 8)).toBe(0);
    expect(groupsHeight([group('Kitchen')], 8)).toBe(28);
    expect(groupsHeight([group(''), group('Kitchen')], 8)).toBe(28 + 16);
    expect(groupsHeight([group('Kitchen'), group('Hall'), group('Attic')], 16)).toBe(
      3 * 28 + 2 * 16,
    );
  });
});

describe('scenes as chips', () => {
  afterEach(() => document.body.replaceChildren());

  const chip = (key: string, more: Partial<SceneChip> = {}): SceneChip => ({
    key,
    label: key,
    name: true,
    ...more,
  });

  it('draws each group’s label over its pills, filled rows, the last run one pressed', () => {
    const ran = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    render(
      sceneChips(
        [
          { label: '', items: [chip('All off', { onTap: () => ran('off') })] },
          {
            label: 'Kitchen',
            items: [
              chip('Cooking', { active: true, onTap: () => ran('cooking') }),
              chip('Dinner'),
              chip('Gone', { unavailable: true }),
            ],
          },
        ],
        { ruler: new TextRuler(() => host), width: 320 },
      ),
      host,
    );
    const card = host.querySelector('.fv-card.am-chips');
    expect(card?.hasAttribute('data-card')).toBe(true);
    // the first group stands under no label
    expect([...host.querySelectorAll('.fv-group')].map((label) => label.textContent)).toEqual([
      'Kitchen',
    ]);
    const rows = [...host.querySelectorAll('.fv-chips')];
    expect(rows.map((row) => row.classList.contains('fv-chips--fill'))).toEqual([true, true]);
    expect(rows.map((row) => row.querySelectorAll('.fv-chip').length)).toEqual([1, 3]);
    const chips = [...host.querySelectorAll<HTMLElement>('.fv-chip')];
    expect(chips.map((el) => el.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(chips[3]?.classList.contains('is-unavailable')).toBe(true);
    chips[1]?.click();
    chips[0]?.click();
    // one out of reach takes no tap
    chips[3]?.click();
    expect(ran.mock.calls).toEqual([['cooking'], ['off']]);
  });
});
