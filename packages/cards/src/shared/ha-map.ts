import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Home Assistant's own map card on a plate of ours (the Map card's `map`), a chunk of its own (`ha-map`) fetched by
 * the first card that draws one: Home Assistant's map and its tiles, from its own proxy, with no key and nothing
 * asked of anyone else. It is made once through Home Assistant's card helpers, when its plate has a box, and laid out
 * as in a section's grid (`layout`), filling the plate: in its own shape it was a square under the plate's 16:10, the
 * plate showing its top, so what it fits to the people sat under the plate's middle (#220). One observer of the plate,
 * never a timer: the map is made once the plate has a size (folded in an Expander, or on a Swipe's hidden page, it has
 * none), and fitted again each time its size settles otherwise. It is told the house as the card hears of it, and its
 * config again when what the card asks of it changes (the page turning dark).
 */

type MapElement = HTMLElement & {
  hass?: HomeAssistant;
  layout?: string;
  setConfig?: (config: LovelaceCardConfig) => void;
};

/** Home Assistant's map inside its card: what fits it to the people again (`fitMap`, a method of its own). */
type Leaflet = HTMLElement & { fitMap?: () => void };

/** The card that draws the map: the house as Home Assistant handed it over, and where it renders. */
export interface MapHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly rawHass: HomeAssistant | undefined;
}

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
   */
  constructor(
    private readonly host: MapHost,
    private readonly plate: string,
    private readonly config: () => LovelaceCardConfig | undefined,
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
   * The plate laid out anew: the map is made once it has a box, and fitted again where its size settled otherwise than
   * it was fitted at.
   */
  private onPlate(): void {
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
    if (!config) return;
    this.tell(this.element);
    const asked = JSON.stringify(config);
    if (asked === this.told) return;
    this.told = asked;
    this.element.setConfig?.(config);
  }

  hostConnected(): void {
    if (this.observed) this.sizes?.observe(this.observed);
  }

  hostDisconnected(): void {
    this.sizes?.disconnect();
  }
}
