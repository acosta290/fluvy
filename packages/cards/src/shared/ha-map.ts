import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { css, type CSSResult, type ReactiveController, type ReactiveControllerHost } from 'lit';

/**
 * Home Assistant's own map card on a plate of ours (the Map card's `map`, the Vehicle card's mini map, #266), a chunk
 * of its own (`ha-map`) fetched by the first card that draws one: Home Assistant's map and its tiles, from its own
 * proxy, with no key and nothing asked of anyone else. It is made once through Home Assistant's card helpers, when its
 * plate has a box, and laid out as in a section's grid (`layout`), filling the plate: in its own shape it was a square
 * under the plate's 16:10, the plate showing its top, so what it fits to the people sat under the plate's middle
 * (#220). One observer of the plate, never a timer: the map is made once the plate has a size (folded in an Expander,
 * or on a Swipe's hidden page, it has none), and fitted again each time its size settles otherwise. It is told the
 * house as the card hears of it, and its config again when what the card asks of it changes (the page turning dark).
 * Home Assistant draws keys of its own on it: the card that owns the plate may ask some of them not drawn (`MapKeys`),
 * by a sheet of ours in the map card's root and its map's, and nothing else of Home Assistant's is touched; the Map
 * card asks none.
 */

type MapElement = HTMLElement & {
  hass?: HomeAssistant;
  layout?: string;
  setConfig?: (config: LovelaceCardConfig) => void;
  /** Lit's, once its element is defined: settled as it has drawn. */
  updateComplete?: Promise<unknown>;
};

/** Home Assistant's map inside its card: what fits it to the people again (`fitMap`, a method of its own). */
type Leaflet = HTMLElement & { fitMap?: () => void };

/** The card that draws the map: the house as Home Assistant handed it over, and where it renders. */
export interface MapHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly rawHass: HomeAssistant | undefined;
}

/**
 * What of Home Assistant's own keys a card asks its map not to draw (#266): `fit` its card's fit key, and the grouping
 * key above it where it shows more than one entity (the map fits itself to what it shows); `keys` its zoom keys too (a
 * still map, whose plate is one button: a key there is dead). The tiles' attribution is never one of them.
 */
export type MapKeys = 'fit' | 'keys';

/**
 * Each word's sheet, adopted whole in the map card's root and in its map's, each reading what it holds of it: the
 * card's keys under its `#root` (`hui-map-card`), the zoom keys in the map (MapLibre's group, or Leaflet's where the
 * map falls back to it: `ha-map`).
 */
const SHEETS: Readonly<Record<MapKeys, CSSResult>> = {
  fit: css`
    #root > #buttons {
      display: none;
    }
  `,
  keys: css`
    #root > #buttons,
    .maplibregl-ctrl-group,
    .leaflet-control-zoom {
      display: none;
    }
  `,
};

/** Whether a root's sheet is one of ours. */
const ours = (sheet: CSSStyleSheet): boolean =>
  Object.values(SHEETS).some((one) => one.styleSheet === sheet);

/** A root of Home Assistant's refused our sheet: its map keeps its keys from then on, said once. */
let refused = false;

/** A plate's laid-out size, as the map was fitted at it. */
const sizeOf = (plate: HTMLElement): string => `${plate.clientWidth}×${plate.clientHeight}`;

export class HaMap implements ReactiveController {
  /** Home Assistant's map card once it is made: the card draws it in its plate. */
  element: MapElement | undefined;
  /** It cannot be made here (no card helpers): the card draws what stands in for it. */
  failed = false;
  /** Home Assistant's map card is on its way (its card helpers load once). */
  private making = false;
  /** What the map was last told: the house, and its config as one string. */
  private hass: HomeAssistant | undefined;
  private told = '';
  private readonly sizes =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.onPlate()) : undefined;
  private observed: HTMLElement | undefined;
  /** The plate's size the map was last fitted at. */
  private fitted = '';

  /**
   * @param plate the plate's selector in the card's own root
   * @param config Home Assistant's map card's config as the card asks for it now; none while it has nothing to show
   * @param hidden what of Home Assistant's own keys the card asks the map not to draw now; where it asks nothing,
   *   nothing of ours goes into the map's roots
   */
  constructor(
    private readonly host: MapHost,
    private readonly plate: string,
    private readonly config: () => LovelaceCardConfig | undefined,
    private readonly hidden?: () => MapKeys,
  ) {
    host.addController(this);
  }

  private async make(config: LovelaceCardConfig): Promise<void> {
    if (this.element || this.failed || this.making) return;
    this.making = true;
    try {
      const helpers = (await window.loadCardHelpers?.()) as
        { createCardElement?: (config: LovelaceCardConfig) => MapElement } | undefined;
      const element = helpers?.createCardElement?.(config);
      if (!element) throw new Error('no card helpers');
      element.layout = 'grid';
      this.told = JSON.stringify(config);
      this.tell(element);
      this.element = element;
      // it fits itself to the people as it loads, at the plate's size now
      this.fitted = this.observed ? sizeOf(this.observed) : '';
      this.whenDrawn(element);
    } catch {
      this.failed = true;
    } finally {
      this.making = false;
    }
    this.host.requestUpdate();
  }

  /** The house, where the card has heard of it again. */
  private tell(element: MapElement): void {
    const hass = this.host.rawHass;
    if (hass && hass !== this.hass) element.hass = this.hass = hass;
  }

  /**
   * What the card asks hidden, once Home Assistant's map card has drawn: it is defined late (its card helpers fetch
   * it), draws once it lands on the plate, and its map is in its root by then.
   */
  private whenDrawn(element: MapElement): void {
    void customElements
      .whenDefined(element.localName)
      .then(() => element.updateComplete)
      .then(
        () => this.hide(),
        () => undefined,
      );
  }

  /**
   * The keys the card asks hidden: the word's sheet in the map card's root and in its map's, each once that root is
   * there (the card draws late and its map later still: so after the card's update, as the map card has drawn, and as
   * the plate is laid out anew), the other word's taken off. A Home Assistant whose map is drawn otherwise keeps its
   * keys.
   */
  private hide(): void {
    const sheet = this.hidden && !refused ? SHEETS[this.hidden()].styleSheet : undefined;
    const card = this.element?.shadowRoot;
    if (!sheet || !card) return;
    try {
      for (const root of [card, card.querySelector('ha-map')?.shadowRoot]) {
        const worn = root?.adoptedStyleSheets;
        if (!root || !worn || worn.at(-1) === sheet) continue;
        root.adoptedStyleSheets = [...worn.filter((one) => !ours(one)), sheet];
      }
    } catch (error) {
      refused = true;
      console.warn(`[fluvy] Home Assistant's map keeps its keys: ${error}`);
    }
  }

  /**
   * The plate laid out anew: the map is made once it has a box, and fitted again where its size settled otherwise than
   * it was fitted at.
   */
  private onPlate(): void {
    this.hide();
    const plate = this.observed;
    if (!plate?.clientWidth || !plate.clientHeight) return;
    if (!this.element) {
      const config = this.config();
      if (config) void this.make(config);
      return;
    }
    const size = sizeOf(plate);
    if (size === this.fitted) return;
    this.fitted = size;
    this.element.shadowRoot?.querySelector<Leaflet>('ha-map')?.fitMap?.();
  }

  hostUpdated(): void {
    const plate = this.host.renderRoot.querySelector<HTMLElement>(this.plate) ?? undefined;
    if (plate !== this.observed) {
      this.sizes?.disconnect();
      if (plate) this.sizes?.observe(plate);
      this.observed = plate;
    }
    if (!this.element) {
      this.onPlate();
      return;
    }
    const config = plate && this.config();
    if (config) {
      this.tell(this.element);
      const asked = JSON.stringify(config);
      if (asked !== this.told) {
        this.told = asked;
        this.element.setConfig?.(config);
      }
    }
    this.hide();
  }

  hostConnected(): void {
    if (this.observed) this.sizes?.observe(this.observed);
  }

  hostDisconnected(): void {
    this.sizes?.disconnect();
  }
}
