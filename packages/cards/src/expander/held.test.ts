// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hold } from './held.js';

/*
 * A Home Assistant without its card wrapper (`hui-card` is not defined in this file's page): the card itself, from the
 * card helpers, in a box of the expander's.
 */

/** A card as the helpers build one: what it was handed, and how it hides itself. */
class Built extends HTMLElement {
  config: LovelaceCardConfig | undefined;
  hass: HomeAssistant | undefined;
  preview = false;

  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 4;
  }

  hide(hidden: boolean): void {
    this.hidden = hidden;
    this.dispatchEvent(
      new CustomEvent('card-visibility-changed', { bubbles: true, composed: true }),
    );
  }
}
customElements.define('built-card', Built);

const helpers = (): { made: Built[] } => {
  const made: Built[] = [];
  window.loadCardHelpers = () =>
    Promise.resolve({
      createCardElement: (config: LovelaceCardConfig) => {
        const card = document.createElement('built-card') as Built;
        card.setConfig(config);
        made.push(card);
        return card;
      },
    });
  return { made };
};

const HOUSE = { states: {} } as unknown as HomeAssistant;
const CONFIG: LovelaceCardConfig = { type: 'entities', entities: [] };
/** The helpers answered, the box filled. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  delete window.loadCardHelpers;
  document.body.replaceChildren();
});

describe('a card held without Home Assistant’s wrapper', () => {
  it('is the card the helpers build, in a box, handed the house and the preview', async () => {
    const { made } = helpers();
    const held = hold(CONFIG, HOUSE, true);
    expect(held.element.localName).toBe('div');
    expect(held.element.classList.contains('ex-other')).toBe(true);
    expect(held.size()).toBe(1);
    await settled();
    expect([...held.element.children]).toEqual(made);
    expect(made[0]).toMatchObject({ config: CONFIG, hass: HOUSE, preview: true });
    expect(held.size()).toBe(4);
  });

  it('hears the house and the preview from then on, the last said before it was built too', async () => {
    const { made } = helpers();
    const held = hold({ type: 'custom:fluvy-light-card', entity: 'light.x' }, undefined, false);
    expect(held.element.classList.contains('ex-other')).toBe(false);
    held.hass(HOUSE);
    held.preview(true);
    await settled();
    expect(made[0]).toMatchObject({ hass: HOUSE, preview: true });
    const next = { states: {} } as unknown as HomeAssistant;
    held.hass(next);
    held.preview(false);
    expect(made[0]).toMatchObject({ hass: next, preview: false });
  });

  it('hides its box with a card that hides itself, before whoever holds it hears', async () => {
    const { made } = helpers();
    const held = hold(CONFIG, HOUSE, false);
    const holder = document.createElement('div');
    holder.append(held.element);
    document.body.append(holder);
    await settled();
    const seen: boolean[] = [];
    holder.addEventListener('card-visibility-changed', () =>
      seen.push(Boolean(held.element.hidden)),
    );
    made[0]?.hide(true);
    made[0]?.hide(false);
    expect(seen).toEqual([true, false]);
  });

  it('builds a card again that asks to be rebuilt, in the same box', async () => {
    const { made } = helpers();
    const held = hold(CONFIG, HOUSE, false);
    await settled();
    const outside = vi.fn();
    document.body.append(held.element);
    document.body.addEventListener('ll-rebuild', outside);
    made[0]?.dispatchEvent(new CustomEvent('ll-rebuild', { bubbles: true, composed: true }));
    expect(made).toHaveLength(2);
    expect([...held.element.children]).toEqual([made[1]]);
    expect(outside).not.toHaveBeenCalled();
    document.body.removeEventListener('ll-rebuild', outside);
  });

  it('leaves the box empty where there are no helpers to ask', async () => {
    const held = hold(CONFIG, HOUSE, false);
    await settled();
    expect(held.element.children).toHaveLength(0);
    expect(held.size()).toBe(1);
    expect(() => held.hass(HOUSE)).not.toThrow();
  });
});
