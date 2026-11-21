// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { swipeColumns, swipeGap, swipeHeight, swipeStops } from '../swipe-family.js';
import { keep, recall, swipeKey } from './memory.js';
import type { FluvySwipeCard } from './swipe-card.js';
import { theirs } from './theirs.js';

// the Swipe card's chunk lands before a card is drawn
await familiesDefined;

const TYPE = 'custom:fluvy-swipe-card';

/** Home Assistant's card wrapper, as the swipe card speaks to it: what it was handed, and its conditions. */
class Wrapper extends HTMLElement {
  config: LovelaceCardConfig | undefined;
  hass: HomeAssistant | undefined;
  preview = false;

  /** Built with its config and the house: hidden where its conditions say so, as Home Assistant's is, unsaid. */
  load(): void {
    this.hidden = this.config?.['shown'] === false;
  }

  /** The wrapper hides or shows itself later, and says so. */
  show(visible: boolean): void {
    this.hidden = !visible;
    this.dispatchEvent(
      new CustomEvent('card-visibility-changed', {
        detail: { value: visible },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
if (!customElements.get('hui-card')) customElements.define('hui-card', Wrapper);

const state = (id: string, value: string, attributes: Record<string, unknown> = {}): HassEntity =>
  ({ entity_id: id, state: value, attributes, last_changed: '', last_updated: '' }) as HassEntity;

const house = (states: readonly HassEntity[] = []): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: Object.fromEntries(states.map((entity) => [entity.entity_id, entity])),
    entities: {},
    devices: {},
    areas: {},
    themes: {},
    config: { unit_system: {} },
    user: { id: 'u', name: 'Marta', is_admin: true },
    connection: {},
    localize: (key: string) => key,
    formatEntityState: (entity: { state: string }) => entity.state,
    callService: () => Promise.resolve(),
    callWS: () => Promise.resolve({}),
  }) as unknown as HomeAssistant;

/** Four pages: a lamp's tile each. */
const PAGES: LovelaceCardConfig[] = ['sofa', 'desk', 'hall', 'porch'].map((name) => ({
  type: 'custom:fluvy-tile-card',
  entity: `light.${name}`,
}));

type Card = FluvySwipeCard & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant | undefined;
  width: number;
  preview: boolean;
  at_: number;
};

async function drawn(
  config: Record<string, unknown> = { cards: PAGES },
  width = 360,
): Promise<{ card: Card; root: ShadowRoot }> {
  const card = document.createElement('fluvy-swipe-card') as Card;
  card.setConfig({ type: TYPE, remember: 'off', ...config });
  card.hass = house();
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  return { card, root: card.shadowRoot! };
}

/** The pages whose cards are in the page, by their place in `cards`. */
const held = (card: Card): number[] =>
  [...card.children].map((child) => Number(child.slot.slice(1))).sort((a, b) => a - b);
const marks = (root: ShadowRoot): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>('.sw-mark'),
];
const lit = (root: ShadowRoot): number =>
  marks(root).findIndex((m) => m.classList.contains('is-on'));

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('its height (config only)', () => {
  const tile = (size: string): LovelaceCardConfig => ({
    type: 'custom:fluvy-tile-card',
    entity: 'light.sofa',
    size,
  });

  it('is its tallest card as each declares itself, and its marks: 24 on the surface, 44 on the page', () => {
    const cards = [tile('compact'), tile('mini')];
    // a tile stands on the page by itself: on the surface, the surface's 20 above and below it
    expect(swipeHeight({ type: TYPE, cards })).toBe(20 + 108 + 20 + 24);
    expect(swipeHeight({ type: TYPE, cards, style: 'plain' })).toBe(108 + 44);
    expect(swipeHeight({ type: TYPE, cards, show_indicators: false })).toBe(20 + 108 + 20);
    // a card turns its padding out into the surface's; a row its 16, the surface's 4 past it above and below
    const lamp = { type: 'custom:fluvy-light-card', entity: 'light.sofa', variant: 'compact' };
    const player = { type: 'custom:fluvy-media-card', entity: 'media_player.den', variant: 'mini' };
    expect(swipeHeight({ type: TYPE, cards: [lamp], show_indicators: false })).toBe(188);
    expect(swipeHeight({ type: TYPE, cards: [player] })).toBe(4 + 76 + 4);
    expect(swipeHeight({ type: TYPE, cards: [player], style: 'plain' })).toBe(76);
  });

  it('draws no marks for one stop: one card, or as many as it shows at once', () => {
    expect(swipeHeight({ type: TYPE, cards: [tile('compact')], style: 'plain' })).toBe(76);
    // two side by side at 360, two cards: the row has one stop
    expect(swipeHeight({ type: TYPE, cards: PAGES.slice(0, 2), columns: 2 })).toBe(
      swipeHeight({ type: TYPE, cards: PAGES.slice(0, 1) }),
    );
  });

  it('counts a card of another maker as a head, and one with no type not at all; no card is its quiet line', () => {
    expect(swipeHeight({ type: TYPE, cards: [{ type: 'entities' }, null, { title: 'x' }] })).toBe(
      84,
    );
    expect(swipeHeight({ type: TYPE })).toBe(60);
    expect(swipeHeight({ type: TYPE, cards: [], style: 'plain' })).toBe(20);
  });

  it('is counted with the house where the automatic dashboard reads its cards so', () => {
    const lamp = { type: 'custom:fluvy-light-card', entity: 'light.sofa' };
    const dims = house([
      state('light.sofa', 'on', { supported_color_modes: ['brightness'], brightness: 128 }),
    ]);
    const config = { type: TYPE, cards: [lamp, lamp] };
    expect(houseHeightOf(config, 0, dims)).toBe(houseHeightOf(lamp, 0, dims) + 24);
    expect(houseHeightOf(config, 0, dims)).toBeLessThan(swipeHeight(config));
  });
});

describe('its layout', () => {
  it('stands its cards a gap apart: 40 on the surface, 16 on the page, the config’s on the 4 grid up to 40', () => {
    expect(swipeGap({ type: TYPE })).toBe(40);
    expect(swipeGap({ type: TYPE, style: 'plain' })).toBe(16);
    expect(swipeGap({ type: TYPE, gap: 10 })).toBe(12);
    expect(swipeGap({ type: TYPE, gap: 99 })).toBe(40);
    expect(swipeGap({ type: TYPE, gap: -4 })).toBe(0);
  });

  it('shows as many side by side as asked while each keeps its width, `slides_per_view` read as `columns`', () => {
    expect(swipeColumns({ type: TYPE }, 360)).toBe(1);
    expect(swipeColumns({ type: TYPE, columns: 2 }, 360)).toBe(2);
    expect(swipeColumns({ type: TYPE, columns: 4 }, 360)).toBe(2);
    expect(swipeColumns({ type: TYPE, columns: 4 }, 1400)).toBe(4);
    expect(swipeColumns({ type: TYPE, slides_per_view: 3 }, 1400)).toBe(3);
  });

  it('stops at every card going round, else from the first to the one that shows the last', () => {
    expect(swipeStops({ type: TYPE }, 4, 1)).toBe(4);
    expect(swipeStops({ type: TYPE }, 4, 2)).toBe(3);
    expect(swipeStops({ type: TYPE, loop: true }, 4, 2)).toBe(4);
    expect(swipeStops({ type: TYPE, loop: true }, 2, 2)).toBe(1);
  });
});

describe('the card', () => {
  it('refuses cards that are no list, in words', () => {
    const card = document.createElement('fluvy-swipe-card') as Card;
    expect(() => card.setConfig({ type: TYPE, cards: { type: 'entities' } })).toThrow(
      'fluvy-swipe-card: "cards" must be a list of cards',
    );
  });

  it('says so with no cards yet, on its surface or on the page', async () => {
    const { root } = await drawn({});
    expect(root.querySelector('article.sw-card .fv-empty')?.textContent).toBe('No cards yet');
    const bare = await drawn({ style: 'plain' });
    expect(bare.root.querySelector('.sw-plain .fv-empty')).not.toBeNull();
  });

  it('holds the cards in view and the next one only, each a group a reader hears by its place', async () => {
    const { card, root } = await drawn();
    expect(held(card)).toEqual([0, 1]);
    const pages = [...root.querySelectorAll('.sw-page')];
    expect(pages.map((page) => page.getAttribute('aria-label'))).toEqual([
      'Page 1 of 4',
      'Page 2 of 4',
      'Page 3 of 4',
      'Page 4 of 4',
    ]);
    expect(pages.map((page) => (page as HTMLElement).inert)).toEqual([false, true, true, true]);
    expect(pages.map((page) => page.getAttribute('role'))).toEqual(Array(4).fill('group'));
  });

  it('hands the house to the cards in the page alone', async () => {
    const { card } = await drawn();
    const next = house([state('light.sofa', 'on')]);
    card.hass = next;
    for (const child of card.children) expect((child as Wrapper).hass).toBe(next);
    expect(card.children).toHaveLength(2);
  });

  it('draws a mark a page, the one it is on lit and current, the only stop of the Tab key', async () => {
    const { root } = await drawn();
    expect(marks(root)).toHaveLength(4);
    expect(lit(root)).toBe(0);
    expect(marks(root).map((mark) => mark.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(marks(root)[0]?.getAttribute('aria-current')).toBe('true');
    expect(marks(root).map((mark) => mark.getAttribute('aria-label'))).toEqual([
      'Page 1 of 4',
      'Page 2 of 4',
      'Page 3 of 4',
      'Page 4 of 4',
    ]);
    expect(root.querySelector('.sw-marks')?.getAttribute('aria-label')).toBe('Pages');
  });

  it('turns to the next page from its mark: lit at once, the page after it built, the one two back gone', async () => {
    const { card, root } = await drawn();
    marks(root)[1]?.click();
    await card.updateComplete;
    expect(card.at_).toBe(1);
    expect(lit(root)).toBe(1);
    expect(held(card)).toEqual([0, 1, 2]);
    marks(root)[2]?.click();
    await card.updateComplete;
    expect(held(card)).toEqual([1, 2, 3]);
  });

  it('glides to the next page once the cards round it stand in the row, never in the frame they change (#235)', async () => {
    const { card, root } = await drawn();
    const track = root.querySelector<HTMLElement>('.sw-track') as HTMLElement;
    // what was in the row as each glide began
    const glides: number[][] = [];
    track.scrollTo = (() => glides.push(held(card))) as typeof track.scrollTo;
    marks(root)[1]?.click();
    expect(glides).toEqual([]);
    await card.updateComplete;
    expect(glides).toEqual([[0, 1, 2]]);
    marks(root)[2]?.click();
    await card.updateComplete;
    expect(glides).toEqual([
      [0, 1, 2],
      [1, 2, 3],
    ]);
  });

  it('draws no marks where asked, nor for one stop', async () => {
    expect(marks((await drawn({ cards: PAGES, show_indicators: false })).root)).toHaveLength(0);
    expect(marks((await drawn({ cards: PAGES.slice(0, 1) })).root)).toHaveLength(0);
  });

  it('draws the counter between its turns where the width holds fewer marks than it has pages', async () => {
    const { card, root } = await drawn({ cards: [...PAGES, ...PAGES] }, 172);
    expect(marks(root)).toHaveLength(0);
    expect(root.querySelector('.sw-count')?.textContent?.trim()).toBe('1 / 8');
    const [back, on] = root.querySelectorAll<HTMLButtonElement>('.sw-turn');
    expect(back?.disabled).toBe(true);
    expect(back?.getAttribute('aria-label')).toBe('Previous page');
    on?.click();
    await card.updateComplete;
    expect(root.querySelector('.sw-count')?.textContent?.trim()).toBe('2 / 8');
    // round, it turns back from the first
    const round = await drawn({ cards: [...PAGES, ...PAGES], loop: true }, 172);
    expect(round.root.querySelector<HTMLButtonElement>('.sw-turn')?.disabled).toBe(false);
  });

  it('opens on its start, counted from 1 and held to its pages', async () => {
    expect((await drawn({ cards: PAGES, start: 3 })).card.at_).toBe(2);
    expect((await drawn({ cards: PAGES, start: 9 })).card.at_).toBe(3);
    expect((await drawn({ cards: PAGES, start: 0 })).card.at_).toBe(0);
    const { card } = await drawn({ cards: PAGES, start: 3 });
    expect(held(card)).toEqual([1, 2, 3]);
  });

  it('opens where a person left it in this tab, and not where it is asked to forget', async () => {
    keep(swipeKey(PAGES, location.pathname), 2);
    expect((await drawn({ cards: PAGES, remember: 'session' })).card.at_).toBe(2);
    expect((await drawn({ cards: PAGES })).card.at_).toBe(0);
    // an unquoted `remember: off` in a YAML dashboard is false: off too
    expect((await drawn({ cards: PAGES, remember: false })).card.at_).toBe(0);
  });

  it('goes round with `loop`: the page before the first is the last, built beside it', async () => {
    const { card, root } = await drawn({ cards: PAGES, loop: true });
    expect(held(card)).toEqual([0, 1, 3]);
    const order = [...root.querySelectorAll<HTMLElement>('.sw-page')].map((page) =>
      Number(page.style.order),
    );
    // the page it is on in the row's middle, the last before it
    expect(order).toEqual([1, 2, 3, 0]);
  });

  it('leaves a card that hides itself out of its row and its marks, and hides itself when all of them do', async () => {
    const hiding = PAGES.map((page, n) => (n === 1 ? { ...page, shown: false } : page));
    const { card, root } = await drawn({ cards: hiding });
    expect(marks(root)).toHaveLength(3);
    expect([...root.querySelectorAll<HTMLElement>('.sw-page')].map((page) => page.hidden)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    // its neighbour is the next page that shows
    expect(held(card)).toEqual([0, 1, 2]);
    // shown again, it is a page again
    (card.querySelector('[slot="p1"]') as Wrapper).show(true);
    await card.updateComplete;
    expect(marks(root)).toHaveLength(4);

    const all = await drawn({
      cards: PAGES.slice(0, 2).map((page) => ({ ...page, shown: false })),
    });
    expect(all.card.hidden).toBe(true);
  });

  it('builds a card with conditions of its own from the first frame, to know whether it is a page', async () => {
    const { card } = await drawn({
      cards: [...PAGES, { ...PAGES[0], visibility: [{ condition: 'state' }] }],
    });
    expect(held(card)).toEqual([0, 1, 4]);
  });

  it('leaves a wash out with no surface to wear it', async () => {
    expect((await drawn({ cards: PAGES, card_color: 'teal' })).card.config?.card_color).toBe(
      'teal',
    );
    const bare = await drawn({ cards: PAGES, card_color: 'teal', style: 'plain' });
    expect(bare.card.config?.card_color).toBeUndefined();
    expect(bare.root.querySelector('.fv-card')).toBeNull();
  });

  it('starts from the picker with the house’s first lights and switches, a tile each', () => {
    const element = customElements.get('fluvy-swipe-card') as unknown as {
      getStubConfig(hass: unknown, entities: readonly string[]): LovelaceCardConfig;
    };
    expect(
      element.getStubConfig(undefined, ['sensor.a', 'light.a', 'switch.b', 'fan.c', 'light.d']),
    ).toEqual({
      type: TYPE,
      cards: ['light.a', 'switch.b', 'fan.c'].map((entity) => ({
        type: 'custom:fluvy-tile-card',
        entity,
      })),
    });
  });
});

describe('turning by itself (autoplay)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('turns a page each time its seconds are up, from the last back to the first', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn({ cards: PAGES.slice(0, 3), autoplay: 5 });
    // no Web Animations here: a turn further than the next page stands there at once
    Object.defineProperty(root.querySelector('.sw-track'), 'animate', { value: undefined });
    await vi.advanceTimersByTimeAsync(4900);
    expect(card.at_).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(card.at_).toBe(1);
    // from the last page, back to the first
    await vi.advanceTimersByTimeAsync(10_000);
    expect(card.at_).toBe(0);
  });

  it('gives a page three seconds at least', async () => {
    vi.useFakeTimers();
    const { card } = await drawn({ cards: PAGES, autoplay: 1 });
    await vi.advanceTimersByTimeAsync(2900);
    expect(card.at_).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(card.at_).toBe(1);
  });

  it('waits while the pointer or the focus is on it, and goes on as they leave', async () => {
    vi.useFakeTimers();
    const { card } = await drawn({ cards: PAGES, autoplay: 5 });
    card.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await vi.advanceTimersByTimeAsync(12_000);
    expect(card.at_).toBe(0);
    card.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    card.dispatchEvent(new FocusEvent('focusin'));
    await vi.advanceTimersByTimeAsync(6000);
    expect(card.at_).toBe(0);
    card.dispatchEvent(new FocusEvent('focusout'));
    await vi.advanceTimersByTimeAsync(5100);
    expect(card.at_).toBe(1);
  });

  it('never turns by itself unless asked, nor in the editor’s preview', async () => {
    vi.useFakeTimers();
    const still = await drawn();
    const previewed = await drawn({ cards: PAGES, autoplay: 5 });
    previewed.card.preview = true;
    await previewed.card.updateComplete;
    await vi.advanceTimersByTimeAsync(20_000);
    expect([still.card.at_, previewed.card.at_]).toEqual([0, 0]);
  });
});

describe('where it was left', () => {
  it('is kept by the view and its pages, forgotten as the start again', () => {
    const key = swipeKey(PAGES, '/home');
    expect(swipeKey(PAGES, '/other')).not.toBe(key);
    expect(swipeKey(PAGES.slice(1), '/home')).not.toBe(key);
    expect(recall(key)).toBeUndefined();
    keep(key, 2);
    expect(recall(key)).toBe(2);
    keep(key, undefined);
    expect(recall(key)).toBeUndefined();
  });

  it('reads a table it cannot read as an empty one', () => {
    sessionStorage.setItem('fluvy:swipes', '{not json');
    expect(recall('x')).toBeUndefined();
    sessionStorage.setItem('fluvy:swipes', JSON.stringify({ x: 'two', y: -1, z: 1 }));
    expect([recall('x'), recall('y'), recall('z')]).toEqual([undefined, undefined, 1]);
  });
});

describe('a drag that is theirs', () => {
  const page = document.createElement('div');
  const path = (target: Element): EventTarget[] => {
    const list: EventTarget[] = [];
    for (let node: Element | null = target; node; node = node.parentElement) list.push(node);
    return list;
  };

  it('on a field, Home Assistant’s slider or map, or anything marked off', () => {
    for (const tag of ['input', 'ha-slider', 'ha-map']) {
      const element = document.createElement(tag);
      page.replaceChildren(element);
      expect(theirs(path(element), page), tag).toBe(true);
    }
    const marked = document.createElement('div');
    marked.dataset['swipe'] = 'off';
    const inside = document.createElement('span');
    marked.append(inside);
    page.replaceChildren(marked);
    expect(theirs(path(inside), page)).toBe(true);
  });

  it('on what pans no way sideways: a ruler, a dial', () => {
    document.body.append(page);
    for (const touch of ['pan-y', 'none']) {
      const ruler = document.createElement('div');
      ruler.style.touchAction = touch;
      page.replaceChildren(ruler);
      expect(theirs(path(ruler), page), touch).toBe(true);
    }
  });

  it('never on plain content, nor on what stands above the page', () => {
    const plain = document.createElement('div');
    page.replaceChildren(plain);
    expect(theirs(path(plain), page)).toBe(false);
    const outside = document.createElement('input');
    outside.append(page);
    expect(theirs(path(plain), page)).toBe(false);
  });
});
