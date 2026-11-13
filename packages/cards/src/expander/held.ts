import {
  VISIBILITY_EVENT,
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardConfig,
} from '@fluvy/core';

/*
 * A card the expander holds, built by Home Assistant itself so that any card stands there — Fluvy's, Home Assistant's
 * own, a custom one: by its card wrapper (`hui-card`: the card of a config, an error card in its place where the
 * config cannot be built, the card's own `visibility` conditions, a card whose element is defined late built again),
 * as a stack holds its cards; or, in a Home Assistant without the wrapper, the card itself from the card helpers
 * (`createCardElement`, which says a bad config in an error card too) in a box of ours.
 */

/** Home Assistant's card wrapper, as far as the expander speaks to it. */
interface Wrapper extends HTMLElement {
  config?: LovelaceCardConfig;
  hass?: HomeAssistant | undefined;
  preview?: boolean;
  load?(): void;
  getCardSize?(): number | Promise<number>;
}

/** Home Assistant's card helpers (`window.loadCardHelpers`), as far as the expander asks them. */
interface CardHelpers {
  createCardElement?(config: LovelaceCardConfig): LovelaceCard;
}

/** A card held: what stands in the page for it, and what it is told. */
export interface Held {
  /** The wrapper, or the box: `hidden` while its card is (by its conditions, or by itself). */
  readonly element: HTMLElement;
  hass(hass: HomeAssistant | undefined): void;
  preview(preview: boolean): void;
  /** Its height in a masonry view's rows of 50; 1 until its card can say. */
  size(): number | Promise<number>;
}

/** The mark of a card that is not Fluvy's: its padding is its own, which the expander's surface takes in as it can. */
export const OTHER = 'ex-other';

/** Whether a config names a card of Fluvy's. */
const ours = (config: LovelaceCardConfig): boolean =>
  typeof config.type === 'string' && config.type.startsWith('custom:fluvy-');

/** A card of `config`, built and handed the house: not in the page yet. */
export function hold(
  config: LovelaceCardConfig,
  hass: HomeAssistant | undefined,
  preview: boolean,
): Held {
  if (customElements.get('hui-card')) {
    const wrapper: Wrapper = document.createElement('hui-card');
    wrapper.classList.toggle(OTHER, !ours(config));
    wrapper.config = config;
    wrapper.hass = hass;
    wrapper.preview = preview;
    try {
      wrapper.load?.();
    } catch {
      // its first update builds it, and says in an error card why it cannot
    }
    return {
      element: wrapper,
      hass: (next) => {
        wrapper.hass = next;
      },
      preview: (next) => {
        wrapper.preview = next;
      },
      size: () => wrapper.getCardSize?.() ?? 1,
    };
  }
  const box = document.createElement('div');
  box.classList.toggle(OTHER, !ours(config));
  let card: LovelaceCard | undefined;
  let house = hass;
  let previewed = preview;
  const build = (helpers: CardHelpers): void => {
    const built = helpers.createCardElement?.(config);
    if (!built) return;
    card = built;
    built.hass = house;
    built.preview = previewed;
    // a custom card defined after the page asked for it is built again in its place
    built.addEventListener(
      'll-rebuild',
      (event) => {
        event.stopPropagation();
        build(helpers);
      },
      { once: true },
    );
    box.replaceChildren(built);
    box.hidden = built.hidden;
  };
  // a card that hides itself hides its box, heard before the expander hears it
  box.addEventListener(VISIBILITY_EVENT, () => {
    box.hidden = card?.hidden ?? false;
  });
  void Promise.resolve(window.loadCardHelpers?.())
    .then((helpers) => {
      if (helpers) build(helpers as CardHelpers);
    })
    .catch(() => undefined); // no helpers: the box stays empty, as a stack's place would
  return {
    element: box,
    hass: (next) => {
      house = next;
      if (card) card.hass = next;
    },
    preview: (next) => {
      previewed = next;
      if (card) card.preview = next;
    },
    size: () => card?.getCardSize() ?? 1,
  };
}
