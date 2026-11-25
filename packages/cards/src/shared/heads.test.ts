// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogue } from '../index.js';
import { hass } from './fixtures/house.js';

/**
 * The actions' contract (#42), held for every card of the catalogue: an action its editor offers has somewhere to be
 * reached, and nothing is drawn as a button that does nothing. A card is drawn from its own stub in a house of every
 * kind of thing, with a tap and a hold that go somewhere (`navigate`); then one of its surfaces must take the tap
 * there — a click, as a finger gives it — and one the hold, each with a name a reader hears. A head's circle is never
 * the button (a head that fits gives it away); with neither action able to run, a head is no button at all. The 44 a
 * finger needs is the browser's to measure: the measurer's `head-target` and `touch-target` rules.
 */

const CATALOGUE = await catalogue();

type CardClass = CustomElementConstructor & {
  editor(): Promise<{ readonly base: readonly string[] }>;
  getStubConfig?(hass: unknown, entities: readonly string[]): LovelaceCardConfig;
};
type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** Every navigation the cards ask for, as Home Assistant hears it (`location-changed`). */
const went: string[] = [];
window.addEventListener('location-changed', () => went.push(window.location.pathname));

const TAP = { action: 'navigate', navigation_path: '/t' };
const HOLD = { action: 'navigate', navigation_path: '/h' };

async function drawn(
  tag: string,
  card: CardClass,
  actions: Record<string, unknown>,
): Promise<ShadowRoot | null> {
  let config: LovelaceCardConfig;
  try {
    config = {
      ...card.getStubConfig?.(hass, Object.keys(hass.states)),
      type: `custom:${tag}`,
      ...actions,
    };
  } catch {
    unfilled.add(tag);
    return null;
  }
  const element = document.createElement(tag) as CardElement;
  try {
    element.setConfig(config);
  } catch {
    unfilled.add(tag);
    return null;
  }
  element.hass = hass;
  (element as unknown as { width: number }).width = 360;
  document.body.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  // a card this house cannot fill draws its one quiet line, with nothing to tap: there is nothing to hold it to
  if (!element.shadowRoot || element.shadowRoot.querySelector('.fv-card--empty')) {
    unfilled.add(tag);
    return null;
  }
  return element.shadowRoot;
}

/** The cards this house leaves empty (a printer, an appliance, a car: devices of their own); any other must be drawn and held. */
const UNFILLABLE = new Set(['fluvy-printer-card', 'fluvy-appliance-card', 'fluvy-vehicle-card']);
const unfilled = new Set<string>();

/** What a reader hears for a surface: its label, or its words. */
const named = (el: Element): boolean =>
  Boolean(el.getAttribute('aria-label')?.trim() || el.textContent?.trim());

type Pressable = HTMLElement & { fvTap?: () => void; fvHold?: () => void };
const all = (root: ShadowRoot): Pressable[] => [...root.querySelectorAll<Pressable>('*')];

/** A pointer's click on `el`, after a still press on it (so a held or dragged earlier press is forgotten). */
function click(el: HTMLElement): void {
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      button: 0,
      pointerType: 'mouse',
    }),
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 1 }),
  );
}

const cards = await Promise.all(
  CATALOGUE.map(async ([tag, element]) => {
    const card = element as unknown as CardClass;
    return { tag, card, base: (await card.editor()).base };
  }),
);
/** Whether a card's editor offers an action: one of the base fields it honours. */
const offers = (key: string) => (entry: { readonly base: readonly string[] }) =>
  entry.base.includes(key);

describe('every action a card offers has somewhere to be reached (#42)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    went.length = 0;
    vi.useRealTimers();
  });

  it.each(cards.filter(offers('tap_action')))(
    '$tag: a named surface takes the tap',
    async ({ tag, card }) => {
      const root = await drawn(tag, card, { tap_action: TAP, hold_action: HOLD });
      if (!root) return;
      const surfaces = all(root).filter(
        (el) => el.matches('button, [role="button"]') || typeof el.fvTap === 'function',
      );
      const taken = surfaces.find((el) => {
        went.length = 0;
        click(el);
        return went.includes('/t');
      });
      expect(taken, `${tag}: no surface runs its tap_action`).toBeDefined();
      expect(named(taken!), `${tag}: its tap has no name`).toBe(true);
    },
  );

  it.each(cards.filter(offers('hold_action')))(
    '$tag: a surface takes the hold',
    async ({ tag, card }) => {
      const root = await drawn(tag, card, { tap_action: TAP, hold_action: HOLD });
      if (!root) return;
      const held = all(root).find((el) => {
        if (typeof el.fvHold !== 'function') return false;
        went.length = 0;
        el.fvHold();
        return went.includes('/h');
      });
      expect(held, `${tag}: no surface runs its hold_action`).toBeDefined();
    },
  );

  it.each(cards)('$tag: a head’s circle is never its button', async ({ tag, card }) => {
    const root = await drawn(tag, card, { tap_action: TAP, hold_action: HOLD });
    if (!root) return;
    // its own circle, never a control raised beside it (a light's round in a room's head)
    expect(root.querySelector('.fv-card__head > :is(button.fv-ico, .fv-ico--tap)')).toBeNull();
    for (const tap of root.querySelectorAll('.fv-card__tap'))
      expect(named(tap), `${tag}: a head's button has no name`).toBe(true);
  });

  it.each(cards)('$tag: a head with nothing to run is no button', async ({ tag, card }) => {
    const none = { action: 'none' };
    const root = await drawn(tag, card, { tap_action: none, hold_action: none });
    if (!root) return;
    expect(root.querySelector('.fv-card__tap'), tag).toBeNull();
    expect(root.querySelector('.fv-card__head--tap'), tag).toBeNull();
  });

  it('drew every card but those this house cannot fill', () => {
    expect([...unfilled].sort()).toEqual([...UNFILLABLE].sort());
  });
});
