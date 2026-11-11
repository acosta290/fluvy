// @vitest-environment happy-dom
import { baseStyles } from '@fluvy/ui';
import { html, type CSSResultGroup, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { cardBorder, FluvyCard, setCardDefaults, type FluvyCardConfig } from '../card.js';
import type { HomeAssistant } from '../ha/types.js';

/**
 * A card without its border (1.19, #171): whether a card draws its border is its own `card_border` › the house's ›
 * drawn; without it the host is marked `borderless` (what `ui/styles/fluvy/surfaces.css` takes the hairline off by),
 * a card that draws no surface never.
 */
class BorderCard extends FluvyCard {
  static override styles: CSSResultGroup = [...baseStyles];
  protected renderCard(): TemplateResult {
    return html`<article class="fv-card"></article>`;
  }
}
customElements.define('fluvy-card-border-test-card', BorderCard);

/** The same, drawing no surface of its own (a heading, a greeting). */
class BareCard extends BorderCard {
  protected override get surface(): boolean {
    return false;
  }
}
customElements.define('fluvy-card-border-bare-test-card', BareCard);

const HOUSE = { opacity: 100, blur: true, unavailable: 'dashed', border: true } as const;

async function mounted(
  config: Omit<FluvyCardConfig, 'type'> = {},
  tag = 'fluvy-card-border-test-card',
): Promise<FluvyCard> {
  const card = document.createElement(tag) as FluvyCard;
  card.setConfig({ ...config, type: `custom:${tag}` });
  card.hass = { states: {}, themes: { darkMode: false } } as unknown as HomeAssistant;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  setCardDefaults(HOUSE);
  document.body.replaceChildren();
});

describe('a card’s border', () => {
  it('is its own, else the house’s, else drawn', () => {
    expect(cardBorder(undefined)).toBe(true);
    expect(cardBorder({ type: 'x' })).toBe(true);
    expect(cardBorder({ type: 'x', card_border: false })).toBe(false);
    setCardDefaults({ ...HOUSE, border: false });
    expect(cardBorder({ type: 'x' })).toBe(false);
    // its own drawn on a house without one
    expect(cardBorder({ type: 'x', card_border: true })).toBe(true);
    // not a switch: unsaid
    for (const card_border of ['false', 0, null, 'none'])
      expect(cardBorder({ type: 'x', card_border } as unknown as FluvyCardConfig)).toBe(false);
  });

  it('marks the card without it, and nothing on a card that draws it', async () => {
    expect((await mounted()).hasAttribute('borderless')).toBe(false);
    expect((await mounted({ card_border: true })).hasAttribute('borderless')).toBe(false);
    expect((await mounted({ card_border: false })).hasAttribute('borderless')).toBe(true);
  });

  it('follows the house at once, a card’s own kept', async () => {
    const plain = await mounted();
    const own = await mounted({ card_border: true });
    setCardDefaults({ ...HOUSE, border: false });
    expect(plain.hasAttribute('borderless')).toBe(true);
    expect(own.hasAttribute('borderless')).toBe(false);
    setCardDefaults(HOUSE);
    expect(plain.hasAttribute('borderless')).toBe(false);
  });

  it('follows its config as it changes', async () => {
    const card = await mounted({ card_border: false });
    card.setConfig({ type: 'custom:fluvy-card-border-test-card' });
    await card.updateComplete;
    expect(card.hasAttribute('borderless')).toBe(false);
  });

  it('is never taken off a card that draws no surface', async () => {
    setCardDefaults({ ...HOUSE, border: false });
    const bare = await mounted({ card_border: false }, 'fluvy-card-border-bare-test-card');
    expect(bare.hasAttribute('borderless')).toBe(false);
  });
});
