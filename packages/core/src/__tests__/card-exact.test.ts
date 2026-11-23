// @vitest-environment happy-dom
import * as exact from '@fluvy/tokens/exact';
import { baseStyles, setFallbackTokens } from '@fluvy/ui';
import { html, type CSSResultGroup, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import {
  exactColors,
  exactDefault,
  FluvyCard,
  setExactDefault,
  type FluvyCardConfig,
} from '../card.js';
import type { HomeAssistant } from '../ha/types.js';
import { accentCss, accentHex, AccentSheet, litCss } from '../look/accent.js';

/**
 * Colours worn as they are named (1.25, #250): a card's `exact_colors` › the house's › off. A card that asks wears Home
 * Assistant's own value for a name and a hex as given, in its own colour, its items', its lit surfaces and its figures'
 * inks, from its first frame (the chunk that wears them fetched before it draws); every other card the palette's tones,
 * as before.
 */
class NamedCard extends FluvyCard {
  static override styles: CSSResultGroup = [...baseStyles];
  protected renderCard(): TemplateResult {
    return html`<article
      data-accent=${this.accents.item(this.config?.['item_color']) ?? ''}
      data-ink=${this.accents.ink('#ffc107')}
    ></article>`;
  }
}
customElements.define('fluvy-card-exact-test-card', NamedCard);

async function mounted(config: Omit<FluvyCardConfig, 'type'>): Promise<NamedCard> {
  const card = document.createElement('fluvy-card-exact-test-card') as NamedCard;
  card.setConfig({ ...config, type: 'custom:fluvy-card-exact-test-card' });
  card.hass = { states: {}, themes: { darkMode: false } } as unknown as HomeAssistant;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const drawn = (card: NamedCard): string =>
  card.shadowRoot!.querySelector('article')!.getAttribute('data-accent') ?? '';
/** The card's own colour sheet, as one text. */
const ownSheet = (card: NamedCard): string =>
  [...card.shadowRoot!.adoptedStyleSheets.at(-1)!.cssRules].map((rule) => rule.cssText).join('');

afterEach(() => {
  setExactDefault(false);
  document.body.replaceChildren();
  setFallbackTokens(':host([no-theme]){--fluvy-palette:mist}');
});

describe('a card’s colours as named', () => {
  it('are its own where it is a switch, else the house’s, off until the house chooses', () => {
    expect(exactDefault()).toBe(false);
    expect(exactColors(undefined)).toBe(false);
    expect(exactColors({ type: 'x', exact_colors: true })).toBe(true);
    setExactDefault(true);
    expect(exactColors({ type: 'x' })).toBe(true);
    // its own off wears the palette's tones in a house of exact colours
    expect(exactColors({ type: 'x', exact_colors: false })).toBe(false);
    // anything but a switch is unsaid
    expect(exactColors({ type: 'x', exact_colors: 'yes' } as unknown as FluvyCardConfig)).toBe(
      true,
    );
  });

  it('wear Home Assistant’s own amber on a card that asks, from its first frame; the palette’s on one that does not', async () => {
    setFallbackTokens(':host([no-theme]){--fluvy-palette:mist}');
    const asks = await mounted({ exact_colors: true, color: 'amber', item_color: 'teal' });
    expect(drawn(asks)).toBe('#009688');
    expect(ownSheet(asks)).toContain('--fluvy-accent: #ffc107');
    expect(asks.hasAttribute('exact-colors')).toBe(true);
    const plain = await mounted({ color: 'amber', item_color: 'teal' });
    expect(drawn(plain)).toBe(accentHex('mist', 'light', 'teal'));
    expect(ownSheet(plain)).not.toContain('--fluvy-accent: #ffc107');
    expect(plain.hasAttribute('exact-colors')).toBe(false);
  });

  it('follow the house as it changes, and a card’s own off keeps the palette’s tones', async () => {
    const card = await mounted({ item_color: 'indigo' });
    const own = await mounted({ item_color: 'indigo', exact_colors: false });
    expect(drawn(card)).toBe(accentHex('mist', 'light', 'indigo'));
    setExactDefault(true);
    await card.updateComplete;
    expect(drawn(card)).toBe('#3f51b5');
    expect(drawn(own)).toBe(accentHex('mist', 'light', 'indigo'));
    setExactDefault(false);
    await card.updateComplete;
    expect(drawn(card)).toBe(accentHex('mist', 'light', 'indigo'));
  });

  it('say a figure in the colour, nudged only as far as it reads, and keep apart from the palette’s in every sheet', async () => {
    const card = await mounted({ exact_colors: true });
    const ink = /\[data-ink="#ffc107"\] \{ --fv-ink: (#[0-9a-f]{6}); \}/.exec(ownSheet(card))?.[1];
    // amber is too pale to read as words on Mist's white: the same hue taken deeper, never the palette's amber
    expect(ink).toBeDefined();
    expect(ink).not.toBe('#ffc107');
    const sheet = new AccentSheet();
    sheet.wears('mist', 'light');
    sheet.begin(exact);
    expect(sheet.inkOf('#ffc107')).toBe('#ffc107');
    sheet.begin();
    expect(sheet.inkOf('#ffc107')).not.toBe('#ffc107');
    // the kept derivations of a colour named exactly and of the palette's tone of it never stand in for each other
    expect(accentCss('mist', 'light', '#ffc107', exact)).not.toBe(
      accentCss('mist', 'light', '#ffc107'),
    );
    expect(litCss('mist', 'light', '#ffc107', 1, exact)).not.toBe(
      litCss('mist', 'light', '#ffc107', 1),
    );
  });
});
