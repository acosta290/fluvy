// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import { FluvyScenesCard, type ScenesCardConfig } from './scenes-card.js';

// the index fetches the families: they land before this file's page goes
afterAll(() => familiesDefined);

/*
 * The Scenes card in groups and as chips (#189): its own sections or the house's rooms under quiet labels, the scenes
 * as pills that fill their rows, the last run one filled; a config without them draws as 1.20 did.
 */

const scene = (id: string, name: string, state = 'unknown') => ({
  entity_id: `scene.${id}`,
  state,
  attributes: { friendly_name: name },
  last_changed: '',
  last_updated: '',
});
const callService = vi.fn(async () => undefined);
const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  states: Object.fromEntries(
    [
      scene('kitchen_cooking', 'Lights Cooking', '2026-09-17T19:20:00Z'),
      scene('kitchen_dinner', 'Lights Dinner'),
      scene('kitchen_evening', 'Lights Evening', '2026-09-17T05:40:00Z'),
      scene('living_relax', 'Living room Relax', '2026-09-17T16:30:00Z'),
      scene('living_movie', 'Movie Living room'),
      scene('good_night', 'Good night'),
      scene('gone', 'Garden path', 'unavailable'),
    ].map((state) => [state.entity_id, state]),
  ),
  entities: {
    'scene.kitchen_cooking': { entity_id: 'scene.kitchen_cooking', area_id: 'kitchen' },
    'scene.kitchen_dinner': { entity_id: 'scene.kitchen_dinner', area_id: 'kitchen' },
    'scene.kitchen_evening': { entity_id: 'scene.kitchen_evening', area_id: 'kitchen' },
    'scene.living_relax': { entity_id: 'scene.living_relax', area_id: 'living' },
    'scene.living_movie': { entity_id: 'scene.living_movie', area_id: 'living' },
  },
  devices: {},
  areas: {
    living: { area_id: 'living', name: 'Living room' },
    kitchen: { area_id: 'kitchen', name: 'Kitchen' },
  },
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  callService,
} as unknown as HomeAssistant;

const SCENES = [
  'scene.kitchen_cooking',
  'scene.kitchen_dinner',
  'scene.kitchen_evening',
  'scene.living_relax',
  'scene.living_movie',
  'scene.good_night',
];

type Mounted = HTMLElement & { updateComplete: Promise<boolean> };

/** The card, once what lays its groups out and draws its chips has landed. */
async function mount(config: Omit<ScenesCardConfig, 'type'>): Promise<Mounted> {
  const card = document.createElement('fluvy-scenes-card') as Mounted & {
    setConfig(config: ScenesCardConfig): void;
    hass: HomeAssistant;
    width: number;
  };
  card.setConfig({ type: 'custom:fluvy-scenes-card', ...config });
  card.hass = hass;
  document.body.append(card);
  card.width = 360;
  await card.updateComplete;
  await import('../shared/groups.js');
  await new Promise((resolve) => setTimeout(resolve));
  await card.updateComplete;
  return card;
}

/** What the card holds, in its order: a label's words, or a scene's name (a pressed one marked). */
const drawn = (card: HTMLElement): string[] =>
  [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-group, .am-scene, .fv-chip')].map((el) =>
    el.classList.contains('fv-group')
      ? `# ${el.textContent}`
      : `${(el.querySelector('.fv-row__title, .fv-chip__name')?.textContent ?? '').trim()}${
          el.getAttribute('aria-pressed') === 'true' ? ' *' : ''
        }`,
  );
const height = (config: Omit<ScenesCardConfig, 'type'>): number =>
  FluvyScenesCard.layoutHeight({ type: 'custom:fluvy-scenes-card', ...config });

describe('the scenes card in groups', () => {
  afterEach(() => {
    document.body.replaceChildren();
    callService.mockClear();
  });

  it('draws a plain list as it always did: tiles two a row, the last run one filled, no label', async () => {
    const card = await mount({ title: 'Scenes', scenes: SCENES });
    const root = card.shadowRoot!;
    expect(root.querySelector('.fv-group')).toBeNull();
    expect(root.querySelector('.am-chips')).toBeNull();
    expect(drawn(card)).toEqual([
      'Lights Cooking *',
      'Lights Dinner',
      'Lights Evening',
      'Living room Relax',
      'Movie Living room',
      'Good night',
    ]);
    // the title's 40, three rows of 76, 16 apart
    expect(height({ title: 'Scenes', scenes: SCENES })).toBe(40 + 3 * 76 + 2 * 16);
  });

  it('labels its own sections over their tiles, and the house’s rooms where asked', async () => {
    const own = await mount({
      scenes: [
        'scene.good_night',
        { section: 'Kitchen' },
        'scene.kitchen_cooking',
        'scene.kitchen_dinner',
        'scene.kitchen_evening',
        { section: 'Later' },
        'scene.living_relax',
      ],
    });
    // short under a room of the house (its three share "Lights"), whole under words of its own
    expect(drawn(own)).toEqual([
      'Good night',
      '# Kitchen',
      'Cooking *',
      'Dinner',
      'Evening',
      '# Later',
      'Living room Relax',
    ]);
    const house = await mount({ scenes: SCENES, group_by: 'area' });
    expect(drawn(house)).toEqual([
      '# Kitchen',
      'Cooking *',
      'Dinner',
      'Evening',
      '# Living room',
      'Relax',
      'Movie',
      '# Other',
      'Good night',
    ]);
    // a row for the one before the first label; Kitchen's three, two rows; a row under Later
    expect(
      height({
        scenes: [
          'scene.good_night',
          { section: 'Kitchen' },
          'scene.kitchen_cooking',
          'scene.kitchen_dinner',
          'scene.kitchen_evening',
          { section: 'Later' },
          'scene.living_relax',
        ],
      }),
    ).toBe(76 + (16 + 28 + 2 * 76 + 16) + (16 + 28 + 76));
  });

  it('draws the scenes as chips on one card: pills that fill their rows under each room, the last run one filled', async () => {
    const card = await mount({
      title: 'Scenes',
      variant: 'chips',
      group_by: 'area',
      scenes: [...SCENES, 'scene.gone'],
    });
    const root = card.shadowRoot!;
    expect(root.querySelector('.hm-section__title')?.textContent).toBe('Scenes');
    expect(root.querySelector('.fv-card.am-chips[data-card]')).not.toBeNull();
    expect(root.querySelector('.am-scene')).toBeNull();
    expect(drawn(card)).toEqual([
      '# Kitchen',
      'Cooking *',
      'Dinner',
      'Evening',
      '# Living room',
      'Relax',
      'Movie',
      '# Other',
      'Good night',
      'Garden path',
    ]);
    const rows = [...root.querySelectorAll('.fv-chips')];
    expect(rows.every((row) => row.classList.contains('fv-chips--fill'))).toBe(true);
    // one out of reach wears the dashed ring
    expect(root.querySelector('.fv-chip.is-unavailable')?.textContent?.trim()).toBe('Garden path');
  });

  it('runs a chip’s scene on a tap, the pill filling at once; one out of reach takes none', async () => {
    const card = await mount({ variant: 'chips', scenes: [...SCENES, 'scene.gone'] });
    const chips = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-chip')];
    // no label, no room: the names whole, in the list's order
    expect(drawn(card)[1]).toBe('Lights Dinner');
    chips[1]!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    chips[1]!.click();
    await card.updateComplete;
    expect(callService).toHaveBeenCalledTimes(1);
    expect(callService.mock.calls[0]?.slice(0, 2)).toEqual(['scene', 'turn_on']);
    expect(drawn(card).filter((name) => name.endsWith('*'))).toEqual(['Lights Dinner *']);
    chips.at(-1)!.click();
    expect(callService).toHaveBeenCalledTimes(1);
  });

  it('shows a chip’s own glyph and colour where the config gives them', async () => {
    const card = await mount({
      variant: 'chips',
      scenes: [
        { entity: 'scene.kitchen_cooking', icon: 'mdi:pot-steam', color: 'orange' },
        'scene.kitchen_dinner',
      ],
    });
    const [cooking, dinner] = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-chip')];
    expect(cooking?.querySelector('ha-icon, svg, .fv-haicon')).not.toBeNull();
    expect(cooking?.classList.contains('fv-chip--toned')).toBe(true);
    expect(cooking?.hasAttribute('data-accent')).toBe(true);
    expect(dinner?.querySelector('ha-icon, svg, .fv-haicon')).toBeNull();
    expect(dinner?.hasAttribute('data-accent')).toBe(false);
  });

  it('keeps its empty panel as chips too, under its title', async () => {
    const card = await mount({ title: 'Scenes', variant: 'chips', scenes: [] });
    expect(card.shadowRoot!.querySelector('.fv-empty-state')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('.am-chips')).toBeNull();
    expect(height({ title: 'Scenes', variant: 'chips', scenes: [] })).toBe(40 + 120);
  });

  it('declares its chips’ rows from its config: the names it gives, else the ids’ words; with the house, its own', () => {
    const chips = { variant: 'chips' as const };
    // four short names hold one row; the card's 20 round them
    expect(
      height({
        ...chips,
        scenes: ['Bright', 'Relax', 'TV', 'Movie'].map((name) => ({
          entity: `scene.${name}`,
          name,
        })),
      }),
    ).toBe(40 + 44);
    // six go three a row, eight three, three and two
    const six = ['Daylight', 'Bright', 'Cooking', 'Dinner', 'Evening', 'Nightlight'];
    const named = (names: readonly string[]) =>
      names.map((name) => ({ entity: `scene.${name.toLowerCase()}`, name }));
    expect(height({ ...chips, scenes: named(six) })).toBe(40 + 2 * 44);
    expect(height({ ...chips, scenes: named([...six, 'Concentrate', 'Rest']) })).toBe(40 + 3 * 44);
    // a title's 40; a label 28 a group, 16 over each but the first
    expect(
      height({
        ...chips,
        title: 'Scenes',
        scenes: [{ section: 'Kitchen' }, ...named(six), { section: 'Dining room' }, ...named(six)],
      }),
    ).toBe(40 + 40 + (28 + 2 * 44) + (16 + 28 + 2 * 44));
    // by its config alone a card cannot know the rooms, nor its scenes' names: the ids' own words, in one group
    const byArea = { ...chips, group_by: 'area' as const, scenes: SCENES };
    expect(height(byArea)).toBe(40 + 3 * 44);
    // with the house: Kitchen's three in a row, the living room's two, the one in no room, a label each
    const type = 'custom:fluvy-scenes-card';
    expect(houseHeightOf({ type, ...byArea }, -1, hass)).toBe(
      40 + (28 + 44) + (16 + 28 + 44) + (16 + 28 + 44),
    );
    // as tiles: Kitchen's three (two rows), the living room's two, the one in no room
    expect(houseHeightOf({ type, group_by: 'area', scenes: SCENES }, -1, hass)).toBe(
      28 + (2 * 76 + 16) + (16 + 28 + 76) + (16 + 28 + 76),
    );
    for (const config of [byArea, { scenes: SCENES, group_by: 'area' as const }])
      expect(houseHeightOf({ type, ...config }, -1, hass) % 4).toBe(0);
  });

  it('keeps a word whole under a label: a name too wide for half a tile takes a row, where a plain list reads as 1.20 did', () => {
    const scenes = [
      { entity: 'scene.kitchen_cooking', name: 'Concentrate' },
      { entity: 'scene.kitchen_dinner', name: 'Read' },
    ];
    // a plain list: two a row, as before
    expect(height({ scenes })).toBe(76);
    // in a group its names are short and often one word: one a row rather than a word broken in two
    expect(height({ scenes: [{ section: 'Dining room' }, ...scenes] })).toBe(28 + 2 * 76 + 16);
    // words that hold half a tile stay two a row
    expect(
      height({
        scenes: [
          { section: 'Dining room' },
          { entity: 'scene.kitchen_cooking', name: 'Dinner' },
          { entity: 'scene.kitchen_dinner', name: 'Read' },
        ],
      }),
    ).toBe(28 + 76);
    // kana and kanji run together: a line may end anywhere in them
    expect(
      height({
        scenes: [
          { section: 'リビング' },
          { entity: 'scene.kitchen_cooking', name: 'リラックスタイム照明' },
          { entity: 'scene.kitchen_dinner', name: '映画' },
        ],
      }),
    ).toBe(28 + 76);
  });

  it('offers in its editor what can act: a tile’s columns and tint to tiles, the groups’ order to the house’s', async () => {
    const editor = await FluvyScenesCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = hass;
    const shown = async (config: Record<string, unknown>): Promise<string[]> =>
      shownNames(
        cardForm(await drawEditor(editor, { type: 'custom:fluvy-scenes-card', ...config })).schema,
      );
    const tiles = await shown({ scenes: SCENES });
    expect(tiles).toEqual(expect.arrayContaining(['variant', 'columns', 'tint', 'group_by']));
    expect(tiles).not.toContain('group_order');
    expect(tiles).not.toContain('short_names');
    const chips = await shown({ scenes: SCENES, variant: 'chips', group_by: 'area' });
    expect(chips).toEqual(
      expect.arrayContaining(['variant', 'group_by', 'group_order', 'short_names']),
    );
    expect(chips).not.toContain('columns');
    expect(chips).not.toContain('tint');
  });
});
