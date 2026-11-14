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
/** The mark of one Home Assistant draws as a tile: on the expander's surface it keeps its own, as a tile of Fluvy's. */
const TILE = 'ex-tile';

/** Whether a config names a card of Fluvy's. */
const ours = (config: LovelaceCardConfig): boolean =>
  typeof config.type === 'string' && config.type.startsWith('custom:fluvy-');

/** How far a card stands out of its place on the expander's surface, above and below and at its sides, in px. */
type Out = readonly [y: number, x: number];
/** In its place as it is: a card with no padding of its own to turn out. */
const IN_PLACE: Out = [0, 0];

/**
 * The cards of Home Assistant's own that do not pad their content by its `ha-card`'s 16 (what the expander turns any
 * other card out by, 12 above and below), by their type: what each pads it by instead, so its content stands in the
 * head's column too. A picture, a map and a web page fill their card, and a card that holds others (a stack, a grid, a
 * condition) has none of its own: what it holds stands out by itself.
 */
const OUT: ReadonlyMap<string, Out> = new Map<string, Out>([
  ['calendar', [12, 8]],
  ['gauge', [12, 12]],
  ['heading', [0, 4]],
  ...[
    'picture',
    'picture-entity',
    'picture-glance',
    'picture-elements',
    'map',
    'iframe',
    'vertical-stack',
    'horizontal-stack',
    'grid',
    'conditional',
    'entity-filter',
  ].map((type): [string, Out] => [type, IN_PLACE]),
]);

/** What Home Assistant draws as a tile, or as a surface painted whole (a player's artwork): in its place, on its own. */
const TILES: ReadonlySet<string> = new Set([
  'tile',
  'button',
  'entity-button',
  'area',
  'media-control',
]);

/**
 * Marks what stands in the page for a card that is not Fluvy's, for the expander's surface (`expander-card.ts`): that
 * it is another's, how far it is turned out where that is not Home Assistant's 16 and 12 (`--ex-x`, `--ex-y`), and
 * that it keeps a surface of its own.
 */
function mark(element: HTMLElement, config: LovelaceCardConfig): void {
  if (ours(config)) return;
  element.classList.add(OTHER);
  const tile = TILES.has(config.type);
  element.classList.toggle(TILE, tile);
  const out = tile ? IN_PLACE : OUT.get(config.type);
  if (!out) return;
  element.style.setProperty('--ex-y', `${out[0]}px`);
  element.style.setProperty('--ex-x', `${out[1]}px`);
}

/** A card of `config`, built and handed the house: not in the page yet. */
export function hold(
  config: LovelaceCardConfig,
  hass: HomeAssistant | undefined,
  preview: boolean,
): Held {
  if (customElements.get('hui-card')) {
    const wrapper: Wrapper = document.createElement('hui-card');
    mark(wrapper, config);
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
  mark(box, config);
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
