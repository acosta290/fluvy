// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expanderHeight } from '../expander-family.js';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, nextConfig, shownNames } from '../shared/fixtures/editor.js';
import type { FormHelper } from '../shared/rows-editor.js';
import type { FluvyExpanderCard } from './expander-card.js';
import { getConfigForm } from './expander-editor.js';
import { DEVICE_KEY, expanderKey, USER_KEY } from './memory.js';

// the Expander card's chunk lands before a card is drawn
await familiesDefined;

const TYPE = 'custom:fluvy-expander-card';
/** The fold's motion, which the cards wait out before they leave the page. */
const MOTION = 240;

/** Home Assistant's card wrapper, as the expander speaks to it: what it was handed, and how often it was asked to build. */
class Wrapper extends HTMLElement {
  static built: Wrapper[] = [];
  config: LovelaceCardConfig | undefined;
  hass: HomeAssistant | undefined;
  preview = false;
  loads = 0;

  load(): void {
    this.loads += 1;
    Wrapper.built.push(this);
  }

  getCardSize(): number {
    return Number(this.config?.['rows'] ?? 2);
  }

  /** The wrapper hides or shows itself, as Home Assistant's does for a card's conditions, and says so. */
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
customElements.define('hui-card', Wrapper);

const state = (id: string, value: string, attributes: Record<string, unknown> = {}): HassEntity =>
  ({ entity_id: id, state: value, attributes, last_changed: '', last_updated: '' }) as HassEntity;

/** What the socket was asked, and what Home Assistant keeps for the person. */
const asked: { type: string; [key: string]: unknown }[] = [];
let kept: unknown;

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
    connection: CONNECTION,
    localize: (key: string) => key,
    formatEntityState: (entity: { state: string }) => entity.state,
    callService: () => Promise.resolve(),
    callWS: (message: { type: string; [key: string]: unknown }) => {
      asked.push(message);
      if (message.type === 'frontend/set_user_data') kept = message['value'];
      return Promise.resolve({ value: kept });
    },
  }) as unknown as HomeAssistant;
/** One connection for a test's houses: what the person's memory is kept by. */
let CONNECTION = {};

const LIGHTS = [
  state('light.terrace', 'on'),
  state('light.path', 'off'),
  state('switch.lawn', 'on'),
  state('binary_sensor.door', 'off'),
];
const CARDS: LovelaceCardConfig[] = [
  { type: 'custom:fluvy-light-card', entity: 'light.terrace' },
  { type: 'entities', entities: ['switch.lawn'], rows: 3 },
];

type Card = FluvyExpanderCard & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant | undefined;
  width: number;
  preview: boolean;
};

const GARDEN = { title: 'Garden', cards: CARDS };

async function drawn(
  config: Record<string, unknown> = GARDEN,
  hass: HomeAssistant = house(LIGHTS),
  width = 360,
): Promise<{ card: Card; root: ShadowRoot; head: () => HTMLButtonElement }> {
  const card = document.createElement('fluvy-expander-card') as Card;
  card.setConfig({ type: TYPE, ...config });
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  const root = card.shadowRoot!;
  return { card, root, head: () => root.querySelector<HTMLButtonElement>('.fv-card__tap')! };
}

/** The cards in the page: the wrappers the expander holds as its own children. */
const held = (card: Card): Wrapper[] => [...card.children] as Wrapper[];
/** Open, as the card says it: what it holds can be reached. */
const isOpen = (root: ShadowRoot): boolean => !root.getElementById('cards')!.hasAttribute('inert');
/** The fold drawn open: the row grown, the chevron up. */
const unfolded = (root: ShadowRoot): boolean => root.querySelector('.is-open') !== null;
/** A tap on the head, drawn. */
async function tap(card: Card, button: HTMLElement): Promise<void> {
  button.click();
  await card.updateComplete;
}
/** The fold come to rest: the frame it waits to open and its clock run out, the card drawn again. */
async function rest(card: Card): Promise<void> {
  await vi.advanceTimersByTimeAsync(MOTION + 32);
  await card.updateComplete;
}

beforeEach(() => {
  Wrapper.built = [];
  asked.length = 0;
  kept = undefined;
  CONNECTION = {};
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// a fold's motion that a test began on real timers ends while the file's document is still there, never after it, on
// a busy machine too
afterAll(() => new Promise((done) => setTimeout(done, MOTION * 2)));

describe('the config', () => {
  it('refuses cards that are no list, in words', () => {
    const card = document.createElement('fluvy-expander-card') as Card;
    expect(() => card.setConfig({ type: TYPE, cards: { type: 'entities' } })).toThrow(
      'fluvy-expander-card: "cards" must be a list of cards',
    );
  });

  it('draws with nothing but its type: its own title, folded, on a surface, its chevron at the end', async () => {
    const { root, head } = await drawn({});
    expect(head().textContent?.trim()).toBe('Expander');
    expect(isOpen(root)).toBe(false);
    expect(root.querySelector('article.fv-card.ex-card')).not.toBeNull();
    const parts = [...root.querySelector('.ex-head')!.children].map((part) => part.className);
    expect(parts.at(-1)).toContain('ex-chevron');
    expect(root.querySelector('.fv-ico')).not.toBeNull();
  });

  it('says its count on the line, after the person’s own words, and leaves it out when asked', async () => {
    const entities = ['light.terrace', 'light.path', 'switch.lawn'];
    const sub = async (config: Record<string, unknown>): Promise<string | undefined> =>
      (await drawn({ ...GARDEN, entities, ...config })).root
        .querySelector('.fv-card__sub')
        ?.textContent?.trim();
    expect(await sub({})).toBe('2 of 3 on');
    expect(await sub({ subtitle: 'Back of the house' })).toBe('Back of the house · 2 of 3 on');
    expect(await sub({ show_summary: false })).toBeUndefined();
    expect(await sub({ show_summary: false, subtitle: 'Back of the house' })).toBe(
      'Back of the house',
    );
  });

  it('wears its colour as every card does, and a colour of its circle’s own on the head alone', async () => {
    const rules = (card: Card): string[] =>
      [...(card.shadowRoot!.adoptedStyleSheets.at(-1)?.cssRules ?? [])].map((rule) => rule.cssText);
    // the card's colour, on what it holds too: a card of Fluvy's inside that names none inherits it
    const whole = await drawn({ ...GARDEN, color: '#2f6f5e' });
    expect(whole.root.querySelector('.ex-head')?.hasAttribute('data-accent')).toBe(false);
    expect(rules(whole.card).some((rule) => rule.startsWith(':host > *'))).toBe(true);
    expect(whole.root.querySelector('.fv-ico')?.className).toContain('fv-ico--accent');

    const circle = await drawn({ ...GARDEN, tone: 'neutral', icon_color: '#2f6f5e' });
    const mark = circle.root.querySelector('.ex-head')?.getAttribute('data-accent');
    expect(mark).toBeTruthy();
    expect(rules(circle.card).some((rule) => rule.startsWith(':host > *'))).toBe(false);
    expect(rules(circle.card).some((rule) => rule.includes(`[data-accent="${mark}"]`))).toBe(true);
    // a tone asked for by name stays the circle's
    expect(circle.root.querySelector('.fv-ico')?.className).toContain('fv-ico--neutral');
  });

  it('stands on the page with no surface (plain), and wears no wash there', async () => {
    const { card, root } = await drawn({ ...GARDEN, style: 'plain', card_color: 'teal' });
    expect(root.querySelector('.fv-card')).toBeNull();
    expect(root.querySelector('.ex-plain')).not.toBeNull();
    expect(card.config?.card_color).toBeUndefined();
    const washed = await drawn({ ...GARDEN, card_color: 'teal' });
    expect(washed.card.config?.card_color).toBe('teal');
  });

  it('puts the chevron at the start, or draws none', async () => {
    const start = await drawn({ ...GARDEN, chevron_position: 'start' });
    expect(start.root.querySelector('.ex-head')?.firstElementChild?.className).toContain(
      'ex-chevron',
    );
    const none = await drawn({ ...GARDEN, show_chevron: false });
    expect(none.root.querySelector('.ex-chevron')).toBeNull();
  });
});

describe('heights', () => {
  it('declares its head, by its config alone', () => {
    expect(expanderHeight({ type: TYPE })).toBe(84);
    expect(expanderHeight({ type: TYPE, expanded: true, cards: CARDS })).toBe(84);
    expect(expanderHeight({ type: TYPE, style: 'plain' })).toBe(44);
    const element = customElements.get('fluvy-expander-card') as unknown as {
      layoutHeight(config: LovelaceCardConfig): number;
    };
    expect(element.layoutHeight({ type: TYPE, style: 'plain' })).toBe(44);
  });

  it('takes a section’s whole width in rows of its own, three columns at least', async () => {
    const { card } = await drawn();
    expect(card.getGridOptions()).toEqual({ columns: 12, rows: 'auto', min_columns: 3 });
  });

  it('is one row in a masonry view folded, and one more than its cards open', async () => {
    vi.useFakeTimers();
    const { card, head } = await drawn();
    expect(card.getCardSize()).toBe(1);
    await tap(card, head());
    await rest(card);
    // the light card's 2 and the entities card's 3
    expect(card.getCardSize()).toBe(6);
    await tap(card, head());
    expect(card.getCardSize()).toBe(1);
  });

  it('lays its cards side by side while each keeps half a phone’s section', async () => {
    const columns = async (config: Record<string, unknown>, width: number): Promise<string> =>
      (await drawn({ ...GARDEN, expanded: true, ...config }, house(LIGHTS), width)).root
        .querySelector<HTMLElement>('.ex-cards')!
        .style.getPropertyValue('--ex-columns');
    expect(await columns({}, 360)).toBe('1');
    expect(await columns({ columns: 2 }, 360)).toBe('2');
    // three would leave each 120 on the surface: two it is
    expect(await columns({ columns: 3 }, 360)).toBe('2');
    expect(await columns({ columns: 3 }, 1400)).toBe('3');
    expect(await columns({ columns: 9 }, 1400)).toBe('4');
    expect(await columns({ columns: 3, style: 'plain' }, 360)).toBe('2');
    expect(await columns({ columns: 2 }, 172)).toBe('1');
  });

  it('keeps the room between its cards its style’s, or the config’s on the 4 grid', async () => {
    const gap = async (config: Record<string, unknown>): Promise<string> =>
      (await drawn({ ...GARDEN, expanded: true, ...config })).root
        .querySelector<HTMLElement>('.ex-cards')!
        .style.getPropertyValue('--ex-gap');
    expect(await gap({})).toBe('40px');
    expect(await gap({ style: 'plain' })).toBe('16px');
    expect(await gap({ gap: 22 })).toBe('24px');
    expect(await gap({ gap: 0 })).toBe('0px');
    expect(await gap({ gap: 500 })).toBe('64px');
  });
});

describe('its cards', () => {
  it('builds none while it is folded, and all of them by the first opening', async () => {
    vi.useFakeTimers();
    const hass = house(LIGHTS);
    const { card, root, head } = await drawn(GARDEN, hass);
    expect(Wrapper.built).toHaveLength(0);
    expect(held(card)).toHaveLength(0);
    // nor a box for them under the fold: nothing stands past the head
    expect(root.querySelector('.ex-cards')).toBeNull();

    await tap(card, head());
    expect(isOpen(root)).toBe(true);
    expect(held(card).map((wrapper) => wrapper.config)).toEqual(CARDS);
    expect(held(card).every((wrapper) => wrapper.loads === 1 && wrapper.hass === hass)).toBe(true);
    expect(held(card).every((wrapper) => wrapper.preview === false)).toBe(true);
    // a card of Fluvy's turns its own padding out; another's is marked, to be taken in as it is
    expect(held(card).map((wrapper) => wrapper.classList.contains('ex-other'))).toEqual([
      false,
      true,
    ]);
  });

  it('opens the fold a frame after its cards are in the page, and folds it at once', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn();
    await tap(card, head());
    // open, its cards there, the row still shut over them: their first frame is drawn where nobody sees it
    expect(isOpen(root)).toBe(true);
    expect(held(card)).toHaveLength(2);
    expect(unfolded(root)).toBe(false);
    await vi.advanceTimersToNextFrame();
    await card.updateComplete;
    expect(unfolded(root)).toBe(true);
    // clipped while it moves, not at rest
    expect(root.querySelector('.is-rest')).toBeNull();
    await rest(card);
    expect(root.querySelector('.is-open.is-rest')).not.toBeNull();

    await tap(card, head());
    expect(unfolded(root)).toBe(false);
    expect(held(card)).toHaveLength(2);
  });

  it('is drawn open from its first frame where it starts open', async () => {
    const { card, root } = await drawn({ ...GARDEN, expanded: true });
    expect(unfolded(root)).toBe(true);
    expect(root.querySelector('.is-open.is-rest')).not.toBeNull();
    expect(held(card)).toHaveLength(2);
  });

  it('lets its cards go at once when it is folded before its fold had opened', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn();
    head().click();
    await card.updateComplete;
    head().click();
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    expect(held(card)).toHaveLength(0);
    await rest(card);
    expect(unfolded(root)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes them out of the page once the fold has closed, and puts the same ones back', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn();
    await tap(card, head());
    const first = held(card);
    await rest(card);

    await tap(card, head());
    // folding: still in the page, under the fold
    expect(isOpen(root)).toBe(false);
    expect(held(card)).toEqual(first);
    await rest(card);
    expect(held(card)).toHaveLength(0);

    await tap(card, head());
    expect(held(card)).toEqual(first);
    expect(Wrapper.built).toHaveLength(2);
  });

  it('hands them the house only while they are in the page, and the house as it is when they come back', async () => {
    vi.useFakeTimers();
    const { card, head } = await drawn();
    await tap(card, head());
    const [light] = held(card);
    const second = house(LIGHTS);
    card.hass = second;
    expect(light?.hass).toBe(second);

    await tap(card, head());
    await rest(card);
    const third = house(LIGHTS);
    card.hass = third;
    expect(light?.hass).toBe(second);

    await tap(card, head());
    expect(light?.hass).toBe(third);
  });

  it('builds them anew when the config lists others, and keeps them when it does not', async () => {
    vi.useFakeTimers();
    const { card, head } = await drawn();
    await tap(card, head());
    const first = held(card);
    card.setConfig({ type: TYPE, ...GARDEN, title: 'Back garden' });
    await card.updateComplete;
    expect(held(card)).toEqual(first);

    card.setConfig({ type: TYPE, title: 'Back garden', cards: [CARDS[1]!] });
    await card.updateComplete;
    expect(held(card)).toHaveLength(1);
    expect(held(card)[0]).not.toBe(first[1]);
    expect(first.every((wrapper) => !wrapper.isConnected)).toBe(true);
  });

  it('says so where it holds none yet', async () => {
    const { root } = await drawn({ title: 'Garden', expanded: true });
    expect(root.querySelector('.ex-empty')?.textContent).toBe('No cards yet');
    const folded = await drawn({ title: 'Garden' });
    expect(folded.root.querySelector('.ex-empty')).toBeNull();
  });

  it('hides itself while every card it holds is hidden, and comes back with the first that shows', async () => {
    const { card } = await drawn({ ...GARDEN, expanded: true });
    const said: boolean[] = [];
    card.addEventListener('card-visibility-changed', (event) => {
      if (event.target === card) said.push((event as CustomEvent<{ value: boolean }>).detail.value);
    });
    const [light, entities] = held(card);
    light?.show(false);
    expect(card.hidden).toBe(false);
    entities?.show(false);
    expect(card.hidden).toBe(true);
    expect(card.connectedWhileHidden).toBe(true);
    light?.show(true);
    expect(card.hidden).toBe(false);
    expect(said).toEqual([false, true]);
  });

  it('keeps what its cards say of themselves to itself', async () => {
    const { card } = await drawn({ ...GARDEN, expanded: true });
    const heard = vi.fn();
    document.body.addEventListener('card-visibility-changed', heard);
    held(card)[0]?.show(false);
    expect(heard).not.toHaveBeenCalled();
    document.body.removeEventListener('card-visibility-changed', heard);
  });

  it('is always open in the editor’s preview, its cards told they are previewed', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn();
    card.preview = true;
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    expect(held(card).every((wrapper) => wrapper.preview)).toBe(true);
    card.preview = false;
    await card.updateComplete;
    await rest(card);
    expect(isOpen(root)).toBe(false);
    expect(held(card)).toHaveLength(0);
  });
});

describe('remembering', () => {
  const key = expanderKey({ type: TYPE, ...GARDEN }, location.pathname);

  it('keeps how it was left on this device, and stands that way the next time', async () => {
    const { card, head } = await drawn();
    await tap(card, head());
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({ [key]: true });
    expect(asked).toHaveLength(0);

    const again = await drawn();
    expect(isOpen(again.root)).toBe(true);
    expect(held(again.card)).toHaveLength(2);
  });

  it('forgets a card that is as its config says again', async () => {
    const { card, head } = await drawn();
    await tap(card, head());
    await tap(card, head());
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({});

    const open = await drawn({ ...GARDEN, expanded: true });
    await tap(open.card, open.head());
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({ [key]: false });
    expect(isOpen((await drawn({ ...GARDEN, expanded: true })).root)).toBe(false);
  });

  it('tells two cards apart by their view, their head and what they hold', () => {
    const garden = { type: TYPE, ...GARDEN };
    expect(expanderKey(garden, '/lovelace/home')).not.toBe(expanderKey(garden, '/lovelace/garden'));
    expect(expanderKey({ ...garden, title: 'Garage' }, '/a')).not.toBe(expanderKey(garden, '/a'));
    expect(expanderKey({ ...garden, cards: [] }, '/a')).not.toBe(expanderKey(garden, '/a'));
    // what it looks like is not what it is
    expect(expanderKey({ ...garden, style: 'plain', columns: 2 }, '/a')).toBe(
      expanderKey(garden, '/a'),
    );
  });

  it('stands as it is through a config that changes its looks, and starts anew where the config starts it another way', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn({ ...GARDEN, remember: 'off' });
    await tap(card, head());
    card.setConfig({ type: TYPE, ...GARDEN, remember: 'off', title: 'Back garden', columns: 2 });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    card.setConfig({ type: TYPE, ...GARDEN, remember: 'device' });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    card.setConfig({ type: TYPE, ...GARDEN, remember: 'device', expanded: true });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
  });

  it('keeps nothing with remember: off, and reads nothing', async () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ [key]: true }));
    const { card, root, head } = await drawn({ ...GARDEN, remember: 'off' });
    expect(isOpen(root)).toBe(false);
    await tap(card, head());
    await tap(card, head());
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({ [key]: true });
    expect(asked).toHaveLength(0);
  });

  it('opens and folds all the same where the browser keeps nothing', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    const { card, root, head } = await drawn();
    expect(isOpen(root)).toBe(false);
    await tap(card, head());
    expect(isOpen(root)).toBe(true);
  });

  it('skips what is stored there and is no table of ours', async () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ [key]: 'yes' }));
    expect(isOpen((await drawn()).root)).toBe(false);
    localStorage.setItem(DEVICE_KEY, '[true]');
    expect(isOpen((await drawn()).root)).toBe(false);
  });

  it('keeps it with the person in Home Assistant (user), read once the house is there', async () => {
    kept = { [key]: true };
    const { card, root, head } = await drawn({ ...GARDEN, remember: 'user' });
    await Promise.resolve();
    await card.updateComplete;
    expect(asked).toEqual([{ type: 'frontend/get_user_data', key: USER_KEY }]);
    expect(isOpen(root)).toBe(true);
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull();

    // folded again, it is as its config says: forgotten, the table read again before it is written
    await tap(card, head());
    await vi.waitFor(() => expect(kept).toEqual({}));
    expect(asked.map((message) => message.type)).toEqual([
      'frontend/get_user_data',
      'frontend/get_user_data',
      'frontend/set_user_data',
    ]);
  });

  it('lets the person’s tap stand over what is remembered arriving late', async () => {
    kept = { [key]: false };
    const { card, root, head } = await drawn({ ...GARDEN, remember: 'user', expanded: true });
    head().click();
    await card.updateComplete;
    await vi.waitFor(() => expect(asked.length).toBeGreaterThan(1));
    await card.updateComplete;
    // open by its config, folded by the tap: the answer that it was folded changes nothing
    expect(isOpen(root)).toBe(false);
  });
});

describe('the head', () => {
  it('is one button that says whether it is open, and what it folds', async () => {
    const { card, root, head } = await drawn();
    const button = head();
    expect(button.localName).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('cards');
    expect(root.getElementById('cards')?.hasAttribute('inert')).toBe(true);
    expect(button.title).toBe('Open Garden');
    // the chevron is a mark of the button, not a stop of its own
    expect(root.querySelector('.ex-chevron')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('button')).toHaveLength(1);

    // Enter and Space are a button's own click
    await tap(card, button);
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(root.getElementById('cards')?.hasAttribute('inert')).toBe(false);
    expect(head().title).toBe('Close Garden');
  });

  it('folds on a toggle with nothing of its own to toggle, as with no action at all', async () => {
    const { card, root, head } = await drawn({ ...GARDEN, tap_action: { action: 'toggle' } });
    await tap(card, head());
    expect(isOpen(root)).toBe(true);
  });

  it('runs a tap of its own and leaves the fold to the chevron, a round then', async () => {
    const { card, root, head } = await drawn({
      ...GARDEN,
      tap_action: { action: 'navigate', navigation_path: '/lovelace/garden' },
    });
    const went = vi.fn();
    window.addEventListener('location-changed', went);
    expect(head().hasAttribute('aria-expanded')).toBe(false);
    await tap(card, head());
    expect(went).toHaveBeenCalledTimes(1);
    expect(isOpen(root)).toBe(false);
    window.removeEventListener('location-changed', went);

    const round = root.querySelector<HTMLButtonElement>('button.fv-round')!;
    expect(round.getAttribute('aria-label')).toBe('Open Garden');
    expect(round.getAttribute('aria-expanded')).toBe('false');
    await tap(card, round);
    expect(isOpen(root)).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('button.fv-round')?.getAttribute('aria-label'),
    ).toBe('Close Garden');
  });

  it('is no button with a tap of none, the chevron alone folding it', async () => {
    const { root } = await drawn({ ...GARDEN, tap_action: { action: 'none' } });
    expect(root.querySelector('.fv-card__tap')).toBeNull();
    expect(root.querySelector('button.fv-round')).not.toBeNull();
  });

  it('holds only where the person gave it a hold: the menu key runs it', async () => {
    const plain = await drawn();
    expect(plain.root.querySelector('.fv-card__head--hold')).toBeNull();

    const { root, head } = await drawn({
      ...GARDEN,
      hold_action: { action: 'navigate', navigation_path: '/lovelace/garden' },
    });
    expect(root.querySelector('.fv-card__head--hold')).not.toBeNull();
    const went = vi.fn();
    window.addEventListener('location-changed', went);
    head().dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true }));
    expect(went).toHaveBeenCalledTimes(1);
    expect(isOpen(root)).toBe(false);
    window.removeEventListener('location-changed', went);
  });
});

describe('by itself', () => {
  const door = (open: boolean): HomeAssistant =>
    house([...LIGHTS.slice(0, 3), state('binary_sensor.door', open ? 'on' : 'off')]);
  const WHEN = { ...GARDEN, open_when: { entity: 'binary_sensor.door', state: 'on' } };

  it('opens as its condition starts to hold, and folds again when it no longer does', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn(WHEN, door(false));
    expect(isOpen(root)).toBe(false);
    card.hass = door(true);
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    expect(held(card)).toHaveLength(2);
    card.hass = door(false);
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    // the condition's doing is never remembered: it says it again
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull();
  });

  it('opens at once where its condition holds as the page loads', async () => {
    expect(isOpen((await drawn(WHEN, door(true))).root)).toBe(true);
  });

  it('leaves it to the person once they touched it', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn(WHEN, door(true));
    // folded by hand while the door is open: it stays folded, and the door closing does nothing
    await tap(card, head());
    expect(isOpen(root)).toBe(false);
    card.hass = door(false);
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    // opened by hand, then the door opens and closes: it stays as the person left it
    await tap(card, head());
    card.hass = door(true);
    await card.updateComplete;
    card.hass = door(false);
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
  });

  it('opens on nothing where the condition asks nothing, or names no entity', async () => {
    const open = async (when: unknown): Promise<boolean> =>
      isOpen((await drawn({ ...GARDEN, open_when: when }, door(true))).root);
    expect(await open({ entity: 'binary_sensor.door' })).toBe(false);
    expect(await open({ state: 'on' })).toBe(false);
    expect(await open({ entity: 'binary_sensor.door', state: [] })).toBe(false);
    expect(await open({ entity: 'binary_sensor.door', state_not: 'off' })).toBe(true);
    expect(await open('on')).toBe(false);
  });

  it('draws again as the entity its condition reads changes, though the head counts none', async () => {
    const { card, root } = await drawn(WHEN, door(false));
    const next = door(true);
    card.hass = next;
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
  });

  it('folds after its minutes, and not at all with none', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn({ ...GARDEN, close_after: 2 });
    await tap(card, head());
    await vi.advanceTimersByTimeAsync(119_000);
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    // folded by its clock, it is as its config says: nothing is kept
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({});

    const never = await drawn({ ...GARDEN, title: 'Never' });
    await tap(never.card, never.head());
    await vi.advanceTimersByTimeAsync(3_600_000);
    await never.card.updateComplete;
    expect(isOpen(never.root)).toBe(true);
  });

  it('leaves an open card to its condition while that holds, which folds it when it ends', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn({ ...WHEN, close_after: 1 }, door(false));
    await tap(card, head());
    card.hass = door(true);
    await card.updateComplete;
    await vi.advanceTimersByTimeAsync(60_000);
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    card.hass = door(false);
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
  });

  it('stops its clock as it leaves the page', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn({ ...GARDEN, close_after: 1 });
    await tap(card, head());
    card.remove();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(isOpen(root)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/* ---------- #186: cards for a head, the chevron at the foot and larger, opened by another card ---------- */

/** A clock for a head: a card of Fluvy's that declares 136. */
const CLOCK: LovelaceCardConfig = { type: 'custom:fluvy-clock-card', face: 'digital' };
const TODAY = { title: 'Today', head_cards: [CLOCK], cards: CARDS };
/** The cards of its head, and those it holds: the wrappers by the slot they stand in. */
const heads = (card: Card): Wrapper[] => held(card).filter((wrapper) => wrapper.slot === 'head');
const under = (card: Card): Wrapper[] => held(card).filter((wrapper) => wrapper.slot !== 'head');
/** The round that folds it, and the foot. */
const round = (root: ShadowRoot): HTMLButtonElement | null =>
  root.querySelector<HTMLButtonElement>('button.fv-round');
const foot = (root: ShadowRoot): HTMLButtonElement | null =>
  root.querySelector<HTMLButtonElement>('button.ex-foot');
/** What a card says when its action is Home Assistant's `fire-dom-event`: the action, from the card, to the window. */
const fire = (from: EventTarget, action: Record<string, unknown>): CustomEvent => {
  const event = new CustomEvent('ll-custom', {
    detail: { action: 'fire-dom-event', ...action },
    bubbles: true,
    composed: true,
  });
  from.dispatchEvent(event);
  return event;
};
const stored = (): Record<string, boolean> =>
  JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Record<string, boolean>;

describe('cards for a head', () => {
  it('draws as before without them: a config of 1.20 is the card of 1.20', async () => {
    const { card, root } = await drawn();
    expect(root.querySelector('.ex-heads')).toBeNull();
    expect(root.querySelector('slot[name="head"]')).toBeNull();
    expect(root.querySelector('.ex-foot')).toBeNull();
    expect(root.querySelector('.ex-head')?.className).not.toContain('large');
    expect(held(card)).toHaveLength(0);
    expect(card.getCardSize()).toBe(1);
    // and is remembered by the key it had
    expect(
      expanderKey(
        { type: TYPE, title: 'Garden', icon: 'mdi:leaf', cards: CARDS },
        '/lovelace/garden',
      ),
    ).toBe('2gh8go');
  });

  it('refuses a head that is no list of cards, in words', () => {
    const card = document.createElement('fluvy-expander-card') as Card;
    expect(() => card.setConfig({ type: TYPE, head_cards: CLOCK })).toThrow(
      'fluvy-expander-card: "head_cards" must be a list of cards',
    );
  });

  it('builds them with the card, in the page while it is folded, where its words would stand', async () => {
    const hass = house(LIGHTS);
    const { card, root } = await drawn(TODAY, hass);
    expect(isOpen(root)).toBe(false);
    expect(heads(card).map((wrapper) => wrapper.config)).toEqual([CLOCK]);
    expect(heads(card)[0]).toMatchObject({ loads: 1, hass, preview: false });
    expect(under(card)).toHaveLength(0);
    // no circle, no title, no line: a group named by the title, the cards in its slot
    expect(root.querySelector('.ex-head')).toBeNull();
    expect(root.querySelector('.fv-card__tap')).toBeNull();
    const group = root.querySelector('.ex-heads')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Today');
    expect(group.querySelector('slot[name="head"]')).not.toBeNull();
    // every change of the house reaches them, folded or not
    const next = house(LIGHTS);
    card.hass = next;
    expect(heads(card)[0]?.hass).toBe(next);
  });

  it('folds by its chevron, a round of its own after the cards that says what it does and what it folds', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn(TODAY);
    const button = round(root)!;
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect([...root.querySelector('.ex-heads')!.children].at(-1)).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Open Today');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('cards');

    const [clock] = heads(card);
    await tap(card, button);
    expect(isOpen(root)).toBe(true);
    expect(under(card).map((wrapper) => wrapper.config)).toEqual(CARDS);
    expect(round(root)?.getAttribute('aria-label')).toBe('Close Today');
    expect(round(root)?.getAttribute('aria-expanded')).toBe('true');

    // folded again, what it holds leaves and its head stays, the same card
    await tap(card, round(root)!);
    await rest(card);
    expect(under(card)).toHaveLength(0);
    expect(heads(card)).toEqual([clock]);
    expect(Wrapper.built).toHaveLength(3);
  });

  it('puts the round before the cards at the start, and draws none with no chevron', async () => {
    const start = await drawn({ ...TODAY, chevron_position: 'start' });
    expect(start.root.querySelector('.ex-heads')?.firstElementChild).toBe(round(start.root));
    const none = await drawn({ ...TODAY, show_chevron: false });
    expect(none.root.querySelectorAll('button')).toHaveLength(0);
  });

  it('lays them in the columns and the room of the cards under them, less the round’s column', async () => {
    const grid = async (config: Record<string, unknown>, width = 360): Promise<string> =>
      (await drawn({ ...TODAY, ...config }, house(LIGHTS), width)).root
        .querySelector<HTMLElement>('.ex-heads > .ex-cards')!
        .getAttribute('style')!;
    expect(await grid({})).toBe('--ex-columns:1;--ex-gap:40px');
    expect(await grid({ columns: 2, gap: 16, head_cards: [CLOCK, CLOCK] })).toBe(
      '--ex-columns:2;--ex-gap:16px',
    );
    // beside the round a phone's page holds one card on the page, two on its surface
    expect(await grid({ columns: 2, style: 'plain', head_cards: [CLOCK, CLOCK] })).toBe(
      '--ex-columns:1;--ex-gap:16px',
    );
    expect(
      await grid({
        columns: 2,
        style: 'plain',
        chevron_position: 'bottom',
        head_cards: [CLOCK, CLOCK],
      }),
    ).toBe('--ex-columns:2;--ex-gap:16px');
  });

  it('rules a hairline over each of them but the first row, by the cards that show', async () => {
    const { card } = await drawn({
      ...TODAY,
      columns: 2,
      chevron_position: 'bottom',
      head_cards: [CLOCK, { ...CLOCK, title: 'Tokyo' }, { ...CLOCK, title: 'London' }],
    });
    const first = (): boolean[] =>
      heads(card).map((wrapper) => wrapper.classList.contains('ex-first'));
    expect(first()).toEqual([true, true, false]);
    heads(card)[0]?.show(false);
    expect(first()).toEqual([false, true, true]);
  });

  it('lets the round give way to the foot where a card would not keep half a section beside it', async () => {
    const narrow = await drawn(TODAY, house(LIGHTS), 172);
    expect(round(narrow.root)).toBeNull();
    expect(foot(narrow.root)).not.toBeNull();
    const wide = await drawn(TODAY, house(LIGHTS), 211);
    expect(round(wide.root)).not.toBeNull();
    expect(foot(wide.root)).toBeNull();
    // a head of words keeps its chevron where it is asked, whatever the width
    expect(foot((await drawn(GARDEN, house(LIGHTS), 152)).root)).toBeNull();
  });

  it('builds them anew when the config lists others, and keeps them when it does not', async () => {
    const { card } = await drawn(TODAY);
    const [clock] = heads(card);
    card.setConfig({ type: TYPE, ...TODAY, title: 'This evening', gap: 16 });
    await card.updateComplete;
    expect(heads(card)).toEqual([clock]);
    card.setConfig({ type: TYPE, ...TODAY, head_cards: [{ ...CLOCK, face: 'analog' }] });
    await card.updateComplete;
    expect(heads(card)).toHaveLength(1);
    expect(heads(card)[0]).not.toBe(clock);
    expect(clock?.isConnected).toBe(false);
    // without them again, its words are back
    card.setConfig({ type: TYPE, ...GARDEN });
    await card.updateComplete;
    expect(heads(card)).toHaveLength(0);
    expect(card.shadowRoot?.querySelector('.fv-card__tap')?.textContent?.trim()).toBe('Garden');
  });

  it('hides itself while every card of its head is hidden and nothing under them shows', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn(TODAY);
    heads(card)[0]?.show(false);
    expect(card.hidden).toBe(true);
    heads(card)[0]?.show(true);
    expect(card.hidden).toBe(false);
    // open, a head that shows keeps the card in the page though all it holds is hidden
    await tap(card, round(root)!);
    for (const wrapper of under(card)) wrapper.show(false);
    expect(card.hidden).toBe(false);
    heads(card)[0]?.show(false);
    expect(card.hidden).toBe(true);
  });

  it('counts its head’s rows in a masonry view, and tells its head the preview', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn({ ...TODAY, head_cards: [{ ...CLOCK, rows: 4 }] });
    await rest(card);
    expect(card.getCardSize()).toBe(4);
    await tap(card, round(root)!);
    await rest(card);
    expect(card.getCardSize()).toBe(9);
    card.preview = true;
    await card.updateComplete;
    expect(heads(card)[0]?.preview).toBe(true);
  });

  it('declares its head’s cards by what each declares, row by row, by its config alone', () => {
    const tall = (config: Record<string, unknown>): number =>
      expanderHeight({ type: TYPE, head_cards: [CLOCK], ...config });
    // one card on the surface: what the card declares, its padding the surface's
    expect(tall({})).toBe(136);
    expect(tall({ expanded: true, cards: CARDS })).toBe(136);
    expect(tall({ style: 'plain' })).toBe(136);
    // two rows: a hairline's room between them on the surface (each row's padding its half), 16 on the page
    expect(tall({ head_cards: [CLOCK, CLOCK] })).toBe(272);
    expect(tall({ head_cards: [CLOCK, CLOCK], gap: 16 })).toBe(248);
    expect(tall({ head_cards: [CLOCK, CLOCK], style: 'plain' })).toBe(288);
    // side by side where a 360 section holds two beside the round: a row as tall as its tallest
    const analog = { type: 'custom:fluvy-clock-card' };
    expect(tall({ head_cards: [CLOCK, analog], columns: 2 })).toBe(340);
    expect(tall({ head_cards: [CLOCK, analog], columns: 2, style: 'plain' })).toBe(136 + 16 + 340);
    expect(
      tall({
        head_cards: [CLOCK, analog],
        columns: 2,
        style: 'plain',
        chevron_position: 'bottom',
      }),
    ).toBe(340 + 8 + 44);
    // a card of another maker, or one that names no type, counts as the head it stands for
    expect(tall({ head_cards: [{ type: 'entities' }] })).toBe(84);
    expect(tall({ head_cards: [null], style: 'plain' })).toBe(44);
    expect(tall({ head_cards: [] })).toBe(84);
  });
});

describe('the chevron at the foot, and larger', () => {
  it('says Show more under the head, and Show less under what it holds', async () => {
    vi.useFakeTimers();
    const { card, root, head } = await drawn({ ...GARDEN, chevron_position: 'bottom' });
    expect(root.querySelector('.ex-chevron')).toBeNull();
    const button = foot(root)!;
    expect(button.textContent?.trim()).toBe('Show more');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('cards');
    expect(button.hasAttribute('aria-label')).toBe(false);
    // the last thing on the card, after the fold
    expect(root.querySelector('[data-card]')?.lastElementChild).toBe(button);
    expect(root.querySelector('[data-card]')?.classList.contains('has-foot')).toBe(true);

    await tap(card, button);
    expect(isOpen(root)).toBe(true);
    expect(foot(root)?.textContent?.trim()).toBe('Show less');
    expect(foot(root)?.getAttribute('aria-expanded')).toBe('true');
    // the head folds it too, as it did
    await tap(card, head());
    expect(isOpen(root)).toBe(false);
  });

  it('brings the head back into view as the foot folds it, and not as it opens', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn({ ...GARDEN, chevron_position: 'bottom' });
    const seen = vi.fn();
    root.querySelector<HTMLElement>('.ex-head')!.scrollIntoView = seen;
    await tap(card, foot(root)!);
    expect(seen).not.toHaveBeenCalled();
    await tap(card, foot(root)!);
    expect(seen).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('is the only button of a head that runs a tap of its own, and none with no chevron', async () => {
    const own = await drawn({
      ...GARDEN,
      chevron_position: 'bottom',
      tap_action: { action: 'navigate', navigation_path: '/lovelace/garden' },
    });
    expect(round(own.root)).toBeNull();
    expect(foot(own.root)).not.toBeNull();
    const none = await drawn({ ...GARDEN, chevron_position: 'bottom', show_chevron: false });
    expect(foot(none.root)).toBeNull();
    expect(none.root.querySelector('[data-card]')?.classList.contains('has-foot')).toBe(false);
  });

  it('stands under cards for a head, which then have the head’s whole width', async () => {
    const { root } = await drawn({ ...TODAY, chevron_position: 'bottom' });
    expect(round(root)).toBeNull();
    expect(foot(root)?.textContent?.trim()).toBe('Show more');
    expect(root.querySelector('.ex-heads')?.children).toHaveLength(1);
  });

  it('is larger where asked: the mark, the round and the foot', async () => {
    const mark = await drawn({ ...GARDEN, chevron_size: 'large' });
    expect(mark.root.querySelector('.ex-chevron')?.classList.contains('ex-chevron--large')).toBe(
      true,
    );
    const own = await drawn({ ...GARDEN, chevron_size: 'large', tap_action: { action: 'none' } });
    expect(round(own.root)?.classList.contains('ex-round--large')).toBe(true);
    const below = await drawn({ ...GARDEN, chevron_size: 'large', chevron_position: 'bottom' });
    expect(foot(below.root)?.classList.contains('ex-foot--large')).toBe(true);
    // and as it was where not
    const regular = await drawn({ ...GARDEN, chevron_position: 'bottom' });
    expect(foot(regular.root)?.className).not.toContain('large');
    expect((await drawn()).root.querySelector('.ex-chevron')?.className).not.toContain('large');
  });

  it('declares the foot’s row under its head: 44, 56 large, 8 under a head on the page', () => {
    const tall = (config: Record<string, unknown>): number =>
      expanderHeight({ type: TYPE, chevron_position: 'bottom', ...config });
    expect(tall({})).toBe(128);
    expect(tall({ style: 'plain' })).toBe(96);
    expect(tall({ chevron_size: 'large' })).toBe(140);
    expect(tall({ chevron_size: 'large', style: 'plain' })).toBe(108);
    expect(tall({ show_chevron: false })).toBe(84);
    expect(tall({ head_cards: [CLOCK] })).toBe(180);
    expect(tall({ head_cards: [CLOCK], style: 'plain' })).toBe(188);
    // a larger chevron in the head takes no height
    expect(expanderHeight({ type: TYPE, chevron_size: 'large' })).toBe(84);
  });
});

describe('opened by another card', () => {
  const NAMED = { ...GARDEN, id: 'garden', remember: 'off' };

  it('opens, folds and toggles by its name, from any card’s fire-dom-event', async () => {
    const { card, root } = await drawn(NAMED);
    const button = document.createElement('div');
    document.body.append(button);
    fire(button, { fluvy_expander: { id: 'garden', action: 'open' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    fire(button, { fluvy_expander: { id: 'garden', action: 'open' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    fire(button, { fluvy_expander: { id: 'garden', action: 'close' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    // toggle, and no word at all
    fire(button, { fluvy_expander: { id: 'garden', action: 'toggle' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    fire(button, { fluvy_expander: { id: 'garden' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    // another name, or an action that is not for an expander, is not its business
    fire(button, { fluvy_expander: { id: 'garage', action: 'open' } });
    fire(button, { browser_mod: { service: 'browser_mod.popup' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
  });

  it('answers the expander-card’s own action too, so a dashboard that comes from it keeps its buttons', async () => {
    const { card, root } = await drawn({ ...NAMED, id: 'my-clock-card' });
    fire(document.body, {
      'expander-card': { data: { 'expander-card-id': 'my-clock-card', action: 'toggle' } },
    });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    fire(document.body, {
      'expander-card': { data: { 'expander-card-id': 'my-clock-card', action: 'close' } },
    });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
  });

  it('answers as a group where several share a name: a toggle opens them all while any is folded', async () => {
    const one = await drawn(NAMED);
    const two = await drawn({ ...NAMED, title: 'Terrace', expanded: true });
    const other = await drawn({ ...NAMED, id: 'garage' });
    const all = async (): Promise<boolean[]> => {
      await Promise.all([one, two, other].map(({ card }) => card.updateComplete));
      return [one, two, other].map(({ root }) => isOpen(root));
    };
    fire(document.body, { fluvy_expander: { id: 'garden', action: 'toggle' } });
    expect(await all()).toEqual([true, true, false]);
    fire(document.body, { fluvy_expander: { id: 'garden', action: 'toggle' } });
    expect(await all()).toEqual([false, false, false]);
  });

  it('listens on the window with the first named expander in the page, and no longer with the last', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const asks = (spy: typeof add | typeof remove): number =>
      spy.mock.calls.filter(([type]) => type === 'll-custom').length;
    // an expander without a name asks nothing of the window
    const bare = await drawn();
    expect(asks(add)).toBe(0);
    const one = await drawn(NAMED);
    const two = await drawn({ ...NAMED, id: 'garage' });
    expect(asks(add)).toBe(1);
    one.card.remove();
    expect(asks(remove)).toBe(0);
    // its name taken away, it is no longer listed
    two.card.setConfig({ type: TYPE, ...GARDEN });
    expect(asks(remove)).toBe(1);
    fire(document.body, { fluvy_expander: { id: 'garage', action: 'open' } });
    await two.card.updateComplete;
    expect(isOpen(two.root)).toBe(false);
    // back in the page with a name, it listens again
    document.body.append(one.card);
    expect(asks(add)).toBe(2);
    one.card.remove();
    bare.card.remove();
    expect(asks(remove)).toBe(2);
    add.mockRestore();
    remove.mockRestore();
  });

  it('takes a name that is a word or a number, as it is written, and refuses anything else in words', async () => {
    const numbered = await drawn({ ...NAMED, id: 7 });
    fire(document.body, { fluvy_expander: { id: '7', action: 'open' } });
    await numbered.card.updateComplete;
    expect(isOpen(numbered.root)).toBe(true);
    // a name is only ever compared: what a selector would choke on is a name like another
    const odd = await drawn({ ...NAMED, id: ' "] , * ' });
    fire(document.body, { fluvy_expander: { id: '"] , *', action: 'open' } });
    await odd.card.updateComplete;
    expect(isOpen(odd.root)).toBe(true);
    const card = document.createElement('fluvy-expander-card') as Card;
    expect(() => card.setConfig({ type: TYPE, id: ['garden'] })).toThrow(
      'fluvy-expander-card: "id" must be a name',
    );
    // no name at all is no name
    expect(() => card.setConfig({ type: TYPE, id: null })).not.toThrow();
    expect(() => card.setConfig({ type: TYPE, id: '' })).not.toThrow();
  });

  it('is the person’s doing: remembered by its view and its name, and no longer its condition’s to fold', async () => {
    const key = expanderKey({ type: TYPE }, location.pathname, 'garden');
    expect(key).not.toBe(expanderKey({ type: TYPE, ...GARDEN }, location.pathname));
    const door = (open: boolean): HomeAssistant =>
      house([...LIGHTS.slice(0, 3), state('binary_sensor.door', open ? 'on' : 'off')]);
    const config = {
      ...GARDEN,
      id: 'garden',
      open_when: { entity: 'binary_sensor.door', state: 'on' },
    };
    const { card, root } = await drawn(config, door(true));
    expect(isOpen(root)).toBe(true);
    expect(stored()).toEqual({});
    // opened by its condition, then asked to open by a person's tap elsewhere: it stays when the door shuts
    fire(document.body, { fluvy_expander: { id: 'garden', action: 'open' } });
    expect(stored()).toEqual({ [key]: true });
    card.hass = door(false);
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    // and stands that way the next time, whatever its title is then
    const again = await drawn({ ...config, title: 'Back garden', open_when: undefined });
    expect(isOpen(again.root)).toBe(true);
  });

  it('folds again after its minutes when it was opened by its name', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn({ ...NAMED, close_after: 5 });
    fire(document.body, { fluvy_expander: { id: 'garden', action: 'open' } });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
  });

  it('is asked nothing in the editor’s preview', async () => {
    const { card } = await drawn({ ...NAMED, remember: 'device' });
    card.preview = true;
    await card.updateComplete;
    fire(document.body, { fluvy_expander: { id: 'garden', action: 'close' } });
    expect(stored()).toEqual({});
  });

  it('is toggled by a card it holds that names none, and no expander round it hears', async () => {
    vi.useFakeTimers();
    const { card, root } = await drawn({ ...TODAY, show_chevron: false });
    const outside = vi.fn();
    window.addEventListener('ll-custom', outside);
    const [clock] = heads(card);
    const event = fire(clock!, { fluvy_expander: {} });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    expect(outside).not.toHaveBeenCalled();
    expect(event.detail).toMatchObject({ action: 'fire-dom-event' });
    // the action's word alone, from a card under the fold too
    fire(under(card)[0]!, { fluvy_expander: 'close' });
    await card.updateComplete;
    expect(isOpen(root)).toBe(false);
    fire(clock!, { fluvy_expander: 'open' });
    fire(clock!, { fluvy_expander: 'open' });
    await card.updateComplete;
    expect(isOpen(root)).toBe(true);
    // what names an expander, or is no ask of one, goes on to the window
    fire(clock!, { fluvy_expander: { id: 'garage' } });
    fire(clock!, { browser_mod: {} });
    expect(outside).toHaveBeenCalledTimes(2);
    window.removeEventListener('ll-custom', outside);
  });
});

describe('the editor without Home Assistant’s stack editor', () => {
  const element = customElements.get('fluvy-expander-card') as unknown as {
    getConfigElement(): Promise<HTMLElement>;
  };

  it('edits the cards in the form’s code field', async () => {
    const editor = await drawEditor(await element.getConfigElement(), { type: TYPE, ...GARDEN });
    expect(editor.localName).toBe('fluvy-expander-editor');
    expect(shownNames(cardForm(editor).schema)).toContain('cards');
    expect(editor.shadowRoot?.querySelector('hui-stack-card-editor')).toBeNull();

    const written = nextConfig(editor);
    cardForm(editor).change('cards', [CARDS[0]]);
    expect(await written).toEqual({ type: TYPE, title: 'Garden', cards: [CARDS[0]] });
  });

  it('shows what the card does where the config says nothing, and writes none of it', async () => {
    const editor = await drawEditor(await element.getConfigElement(), { type: TYPE });
    expect(cardForm(editor).data).toMatchObject({
      expanded: false,
      remember: 'device',
      style: 'card',
      columns: '1',
      gap: 40,
      show_chevron: true,
      chevron_position: 'end',
      chevron_size: 'regular',
      close_after: 0,
    });
    const written = nextConfig(editor);
    cardForm(editor).change('title', 'Garden');
    expect(await written).toEqual({ type: TYPE, title: 'Garden' });
  });

  it('edits the cards of its head in a code field of their own', async () => {
    const editor = await drawEditor(await element.getConfigElement(), { type: TYPE, ...GARDEN });
    expect(shownNames(cardForm(editor).schema).slice(-2)).toEqual(['head_cards', 'cards']);
    const written = nextConfig(editor);
    cardForm(editor).change('head_cards', [CLOCK]);
    expect(await written).toEqual({ type: TYPE, ...GARDEN, head_cards: [CLOCK] });
  });

  it('offers the chevron’s size with a chevron, a name always, and a head’s words only while no cards stand as it', async () => {
    const shown = async (config: Record<string, unknown>): Promise<string[]> =>
      shownNames(
        cardForm(await drawEditor(await element.getConfigElement(), { type: TYPE, ...config }))
          .schema,
      );
    const WORDS = ['icon', 'subtitle', 'entities', 'show_icon', 'tone', 'icon_color', 'tap_action'];
    const bare = await shown({});
    expect(bare).toEqual(expect.arrayContaining([...WORDS, 'chevron_size', 'id']));
    expect(await shown({ show_chevron: false })).not.toContain('chevron_size');
    const headed = await shown({ head_cards: [CLOCK], entities: ['light.terrace'] });
    for (const name of [...WORDS, 'show_summary']) expect(headed).not.toContain(name);
    // its title names the button that folds it, and its colour is what it holds' too
    expect(headed).toEqual(
      expect.arrayContaining(['title', 'color', 'chevron_position', 'chevron_size', 'id']),
    );
  });

  it('says under its name the action another card opens it with, as that card’s YAML takes it', () => {
    const says = (id?: unknown): string | undefined =>
      (getConfigForm().computeHelper as FormHelper)({ name: 'id' }, (key) => key, { id });
    const action = (id: string): string =>
      `Another card opens, folds or toggles it with this action in its YAML: tap_action: {action: fire-dom-event, fluvy_expander: {id: ${id}, action: toggle}}`;
    expect(says('garden')).toBe(action('garden'));
    expect(says(' my-clock_2 ')).toBe(action('my-clock_2'));
    // a name YAML would not read as a word is quoted
    expect(says('my clock: 2')).toBe(action('"my clock: 2"'));
    expect(says(7)).toBe(action('7'));
    // none typed yet: an example
    expect(says()).toBe(action('clock'));
    expect(says('')).toBe(action('clock'));
  });

  it('offers what can act: the count with entities, the chevron’s place with a chevron, a surface’s own with one', async () => {
    const shown = async (config: Record<string, unknown>): Promise<string[]> =>
      shownNames(
        cardForm(await drawEditor(await element.getConfigElement(), { type: TYPE, ...config }))
          .schema,
      );
    const bare = await shown({});
    expect(bare).not.toContain('show_summary');
    expect(bare).toEqual(
      expect.arrayContaining(['chevron_position', 'card_color', 'card_opacity']),
    );
    expect(await shown({ entities: ['light.terrace'] })).toContain('show_summary');
    expect(await shown({ show_chevron: false })).not.toContain('chevron_position');
    const plain = await shown({ style: 'plain' });
    expect(plain).not.toContain('card_color');
    expect(plain).not.toContain('card_opacity');
    expect(plain).not.toContain('card_border');
    expect(plain).toEqual(expect.arrayContaining(['tone', 'color']));
  });

  it('says Never where its condition asks nothing, and asks for the entity it reads', async () => {
    const never = await drawEditor(await element.getConfigElement(), { type: TYPE });
    const field = (editor: typeof never, name: string) =>
      cardForm(editor)
        .schema.flatMap((item) => item.schema ?? [item])
        .find((item) => item.name === name);
    const choices = (
      field(never, 'open_when')?.selector as {
        select: { options: readonly { value: string; label: string }[] };
      }
    ).select.options;
    expect(choices[0]).toEqual({ value: 'always', label: 'Never' });
    expect(field(never, 'when_entity')).toBeUndefined();

    const asked = await drawEditor(await element.getConfigElement(), {
      type: TYPE,
      open_when: { entity: 'binary_sensor.door', state: 'on' },
    });
    // a row's condition falls back on its row's entity, and says so; a card's has none to fall back on
    expect(field(asked, 'when_entity')).toMatchObject({ name: 'when_entity' });
    expect(field(asked, 'when_entity')?.helper).toBeUndefined();
    expect(cardForm(asked).data).toMatchObject({
      open_when: 'state',
      when_state: ['on'],
      when_entity: 'binary_sensor.door',
    });
  });
});
