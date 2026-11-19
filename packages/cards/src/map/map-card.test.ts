// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';

// the map card lands with the index
await familiesDefined;

/*
 * The map card's `map` (#220): Home Assistant's own map card on a plate, made through its card helpers once the plate
 * has a box, laid out as in a section's grid so it fills the plate (in its own shape it was a square under the
 * plate's 16:10, what it fitted to the people under the plate's middle), and fitted again each time the plate's size
 * settles otherwise: opened in an Expander, a Swipe's page or a sheet. Home Assistant's card is a stub here, its map
 * a stub that counts its fits; the layout is the observer's to report (happy-dom lays nothing out).
 */

/** A ResizeObserver the test tells: what changed size, every observer watching it is told. */
class Sizes {
  static made: Sizes[] = [];
  readonly watched = new Set<Element>();
  constructor(readonly told: () => void) {
    Sizes.made.push(this);
  }
  observe(target: Element): void {
    this.watched.add(target);
  }
  unobserve(target: Element): void {
    this.watched.delete(target);
  }
  disconnect(): void {
    this.watched.clear();
  }
  static change(target: Element): void {
    for (const one of Sizes.made) if (one.watched.has(target)) one.told();
  }
}

/** A box's size as the layout would give it. */
const sized = (element: Element, width: number, height: number): void => {
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
};

/** Home Assistant's map card as its helpers make it: its map inside, counting the fits it is asked for. */
class MapStub extends HTMLElement {
  static made: MapStub[] = [];
  config: LovelaceCardConfig | undefined;
  layout: string | undefined;
  hass: unknown;
  fits = 0;
  constructor() {
    super();
    const map = document.createElement('ha-map') as HTMLElement & { fitMap(): void };
    map.fitMap = () => {
      this.fits += 1;
    };
    this.attachShadow({ mode: 'open' }).append(map);
    MapStub.made.push(this);
  }
  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
  }
}
customElements.define('map-card-stub', MapStub);

const HOUSE = {
  states: {
    'person.ona': {
      entity_id: 'person.ona',
      state: 'home',
      attributes: { friendly_name: 'Ona' },
      last_changed: '2026-09-17T19:00:00Z',
      last_updated: '2026-09-17T19:00:00Z',
    },
  },
  entities: {},
  devices: {},
  areas: {},
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { unit_system: { length: 'km', temperature: '°C' } },
  themes: { darkMode: false },
  localize: (key: string) => key,
} as unknown as HomeAssistant;

type MapCard = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

async function mounted(): Promise<{ card: MapCard; plate: () => HTMLElement | null }> {
  const card = document.createElement('fluvy-map-card') as MapCard;
  card.setConfig({ type: 'custom:fluvy-map-card', variant: 'map', entities: ['person.ona'] });
  card.hass = HOUSE;
  document.body.append(card);
  await card.updateComplete;
  return { card, plate: () => card.shadowRoot!.querySelector<HTMLElement>('.mp-plate') };
}

/** The card helpers' promise and the card's own update settled. */
const settle = async (card: MapCard): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;
  }
};

beforeEach(() => {
  Sizes.made = [];
  MapStub.made = [];
  vi.stubGlobal('ResizeObserver', Sizes);
  window.loadCardHelpers = () =>
    Promise.resolve({
      createCardElement: (config: LovelaceCardConfig) => {
        const element = document.createElement('map-card-stub') as MapStub;
        element.setConfig(config);
        return element;
      },
    });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('Home Assistant’s map on the plate (#220)', () => {
  it('is made only once the plate has a box, and fills it as in a section’s grid', async () => {
    const { card, plate } = await mounted();
    await settle(card);
    // folded in an Expander, or on a Swipe's hidden page: no box, no map yet
    expect(plate()).not.toBeNull();
    expect(MapStub.made).toHaveLength(0);
    sized(plate()!, 320, 200);
    Sizes.change(plate()!);
    await settle(card);
    expect(MapStub.made).toHaveLength(1);
    const map = MapStub.made[0]!;
    expect(map.layout).toBe('grid');
    expect(map.config).toMatchObject({ type: 'map', entities: ['person.ona'], auto_fit: true });
    expect(map.hass).toBeDefined();
    expect(plate()!.contains(map)).toBe(true);
  });

  it('fits its map to the people again once the plate’s size settles otherwise, and only then', async () => {
    const { card, plate } = await mounted();
    sized(plate()!, 320, 200);
    Sizes.change(plate()!);
    await settle(card);
    const map = MapStub.made[0]!;
    // the size it was made at is the one it fits itself at as it loads
    Sizes.change(plate()!);
    expect(map.fits).toBe(0);
    // opened wider (a sheet, a desktop's column)
    sized(plate()!, 480, 300);
    Sizes.change(plate()!);
    expect(map.fits).toBe(1);
    Sizes.change(plate()!);
    expect(map.fits).toBe(1);
    // hidden for a while (no box) and shown again at the same size: nothing to fit
    sized(plate()!, 0, 0);
    Sizes.change(plate()!);
    sized(plate()!, 480, 300);
    Sizes.change(plate()!);
    expect(map.fits).toBe(1);
    expect(MapStub.made).toHaveLength(1);
  });

  it('watches its plate again when it comes back to the page', async () => {
    const { card, plate } = await mounted();
    sized(plate()!, 320, 200);
    Sizes.change(plate()!);
    await settle(card);
    card.remove();
    expect(Sizes.made.some((one) => one.watched.has(plate()!))).toBe(false);
    document.body.append(card);
    await card.updateComplete;
    expect(Sizes.made.some((one) => one.watched.has(plate()!))).toBe(true);
  });
});
