import { mdiGoogleCirclesCommunities, mdiImageFilterCenterFocus } from '@mdi/js';
import {
  domainOf,
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardConfig,
} from '@fluvy/core';

/*
 * Home Assistant's card wrapper (`hui-card`) is not here: a stand-in builds the card of a config as Home Assistant's
 * does, for the cards that hold others (the Expander) — a card of Fluvy's by its type; a card of Home Assistant's own
 * (`entities`, `markdown`, `tile`, `heading`, `picture`, `map`) as a plate drawn the way its `ha-card` is under Fluvy's
 * theme, with the padding Home Assistant gives each, in the `--ha-card-*` a holder may change, so a frame shows how
 * one sits; an error in its place for a config it cannot build. It is hidden
 * while the card's `visibility` (a state's, here) does not hold or while the card hides itself, and says so
 * (`card-visibility-changed`), and it builds a card whose element is defined late again.
 */

const VISIBILITY_EVENT = 'card-visibility-changed';

/** A condition of a card's `visibility`, as far as the sheets write one: an entity's state is, or is not, a word. */
interface StateCondition {
  readonly condition?: string;
  readonly entity?: string;
  readonly state?: string;
  readonly state_not?: string;
}

const shows = (config: LovelaceCardConfig | undefined, hass: HomeAssistant | undefined): boolean =>
  ((config?.visibility ?? []) as readonly StateCondition[]).every(
    ({ entity, state, state_not: not }) => {
      const now = hass?.states[entity ?? '']?.state ?? 'unavailable';
      return (state === undefined || now === state) && (not === undefined || now !== not);
    },
  );

/** `ha-card` as Fluvy's theme dresses it: the card's fill, hairline and corners, each through its `--ha-card-*`. */
const PLATE = `
  :host { display: block; }
  .card {
    box-sizing: border-box;
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--fluvy-border));
    border-radius: var(--ha-card-border-radius, var(--fluvy-radius-card));
    background: var(--ha-card-background, var(--fluvy-card));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--fluvy-text);
    font: 500 14px/20px Inter, system-ui, sans-serif;
  }
  .header { padding: 12px 16px 16px; font-size: 20px; font-weight: 600; line-height: 32px; }
  .content { padding: 16px; }
  .header + .content { padding-top: 0; }
  .row { display: flex; align-items: center; height: 40px; }
  .row + .row { margin-top: 8px; }
  .badge { flex: 0 0 40px; display: grid; place-items: center; height: 40px; color: var(--fluvy-text-secondary); }
  .badge.is-on { color: var(--fluvy-accent); }
  ha-state-icon { width: 24px; height: 24px; }
  .name { flex: 1 1 auto; min-width: 0; margin-left: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .state { flex: 0 0 auto; margin-left: 8px; color: var(--fluvy-text); }
  p { margin: 0; }
  .tile { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 0 10px; }
  .tile .badge { flex-basis: 36px; height: 36px; border-radius: 50%; background: var(--fluvy-inset, var(--fluvy-page)); }
  .tile .name { margin-left: 0; font-size: var(--ha-tile-info-primary-font-size, 14px); font-weight: var(--ha-tile-info-primary-font-weight, 500); line-height: 20px; letter-spacing: var(--ha-tile-info-primary-letter-spacing, 0.1px); }
  .tile .state { display: block; margin-left: 0; font-size: var(--ha-tile-info-secondary-font-size, 12px); font-weight: var(--ha-tile-info-secondary-font-weight, 400); line-height: 16px; letter-spacing: var(--ha-tile-info-secondary-letter-spacing, 0.4px); color: var(--ha-tile-info-secondary-color, var(--fluvy-text-secondary)); overflow: hidden; text-overflow: ellipsis; }
  .card:has(> .heading) { border: 0; background: none; }
  .heading { padding: 0 4px; font-size: 16px; line-height: 24px; }
  .card:has(> img) { overflow: hidden; }
  img { display: block; width: 100%; height: 180px; object-fit: cover; }
  .error { color: var(--fluvy-text-secondary); }
  .error__title { font-weight: 600; color: var(--fluvy-danger); }
  .card:has(> #root) { position: relative; height: 100%; overflow: hidden; }
  #root { position: relative; height: 100%; }
  ha-map { position: absolute; inset: 0; z-index: 0; display: block; overflow: hidden; }
  #buttons { position: absolute; top: 75px; left: 3px; display: flex; flex-direction: column; }
  ha-icon-button { display: grid; place-items: center; width: 48px; height: 48px; cursor: pointer; }
  ha-icon-button > svg { width: 24px; height: 24px; fill: currentColor; }
`;

/**
 * Inside Home Assistant's map (`ha-map`'s own root): the plan in a map's quiet colours, its markers, and MapLibre's
 * keys at their size and place (`maplibre-gl.css` 6.16, which Home Assistant 2026.11 links into this root) as Home
 * Assistant wears them (`ha-map.ts`): the zoom keys, a group of two 29 keys ringed by 2, 10 in from the top left; the
 * tiles' attribution folded to its 24 "i", 10 in from the bottom right and over what a card keeps clear
 * (`--ha-map-bottom-inset`); dark where the map is.
 */
const MAP = `
  #map { position: relative; height: 100%; overflow: hidden; background: var(--land); font: 12px/20px "Helvetica Neue", Arial, Helvetica, sans-serif; --land: #ece8e1; --road: #fbfaf7; --park: #dce4cf; --water: #cfdde6; }
  #map.dark { --land: #1d1c1a; --road: #35332f; --park: #222b20; --water: #17252d; }
  #map > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .park { fill: var(--park); }
  .water, .road { fill: none; stroke: var(--road); stroke-linecap: round; }
  .water { stroke: var(--water); stroke-width: 26; }
  .road { stroke-width: 2.5; }
  .road.is-main { stroke-width: 5.5; }
  .trail { fill: var(--fluvy-accent); }
  .marker { position: absolute; display: grid; place-items: center; width: 48px; height: 48px; margin: -24px 0 0 -24px; box-sizing: border-box; border: 1px solid var(--fluvy-accent); border-radius: 50%; background: var(--fluvy-card); color: var(--fluvy-text); font: 400 20px/24px Inter, system-ui, sans-serif; }
  .maplibregl-ctrl-top-left, .maplibregl-ctrl-bottom-right { position: absolute; z-index: 2; pointer-events: none; }
  .maplibregl-ctrl-top-left { top: 0; left: 0; margin-left: var(--ha-map-left-inset, 0); }
  .maplibregl-ctrl-bottom-right { right: 0; bottom: 0; margin-right: var(--ha-map-right-inset, 0); margin-bottom: var(--ha-map-bottom-inset, 0); }
  .maplibregl-ctrl { clear: both; pointer-events: auto; }
  .maplibregl-ctrl-top-left .maplibregl-ctrl { float: left; margin: 10px 0 0 10px; }
  .maplibregl-ctrl-group { border-radius: 4px; background: #fff; box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1); }
  .maplibregl-ctrl-group button { display: block; width: 29px; height: 29px; padding: 0; border: 0; box-sizing: border-box; background: transparent; cursor: pointer; }
  .maplibregl-ctrl-group button + button { border-top: 1px solid #ddd; }
  .maplibregl-ctrl-icon { display: block; width: 100%; height: 100%; fill: #333; }
  .maplibregl-ctrl-attrib.maplibregl-compact { position: relative; float: right; min-height: 20px; margin: 10px; padding: 2px 24px 2px 0; box-sizing: content-box; border-radius: 12px; background: #fff; color: #000; }
  .maplibregl-compact .maplibregl-ctrl-attrib-inner { display: none; }
  .maplibregl-ctrl-attrib-button { position: absolute; top: 0; right: 0; display: block; width: 24px; height: 24px; box-sizing: border-box; border-radius: 12px; background: hsla(0, 0%, 100%, 0.5); list-style: none; cursor: pointer; }
  .maplibregl-ctrl-attrib-button::-webkit-details-marker { display: none; }
  .maplibregl-ctrl-attrib-button > svg { display: block; }
  .dark .maplibregl-ctrl-group { background-color: #1c1c1c; }
  .dark .maplibregl-ctrl-group button + button { border-top-color: #313131; }
  .dark .maplibregl-ctrl-icon, .dark .maplibregl-ctrl-attrib-button { filter: invert(1); }
  .dark .maplibregl-ctrl-attrib.maplibregl-compact { background-color: #1c1c1c; }
`;

/**
 * MapLibre's keys in the shape its controls take in the map (`maplibre-gl` 6.16): the zoom keys in the top left
 * corner's group, the attribution folded to its key in the bottom right's (Home Assistant folds it after a moment).
 * Words and pills of ours keep clear of each (`data-keep-clear`, which the measurer reads inside what it skips).
 */
const CONTROLS = `<div class="maplibregl-control-container">
  <div class="maplibregl-ctrl-top-left">
    <div class="maplibregl-ctrl maplibregl-ctrl-group" data-keep-clear>
      <button class="maplibregl-ctrl-zoom-in" type="button" aria-label="Zoom in"><svg class="maplibregl-ctrl-icon" viewBox="0 0 29 29" aria-hidden="true"><path d="M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5" /></svg></button>
      <button class="maplibregl-ctrl-zoom-out" type="button" aria-label="Zoom out"><svg class="maplibregl-ctrl-icon" viewBox="0 0 29 29" aria-hidden="true"><path d="M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13z" /></svg></button>
    </div>
  </div>
  <div class="maplibregl-ctrl-bottom-right">
    <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact" open data-keep-clear>
      <summary class="maplibregl-ctrl-attrib-button" aria-label="Toggle attribution"><svg width="24" height="24" viewBox="0 0 20 20" fill-rule="evenodd" aria-hidden="true"><path d="M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0" /></svg></summary>
      <div class="maplibregl-ctrl-attrib-inner">© OpenStreetMap</div>
    </details>
  </div>
</div>`;

/** One of the map card's own keys (`ha-icon-button`: 48, its glyph 24), black or white as its map is. */
const key = (label: string, path: string, dark: boolean): HTMLElement => {
  const button = document.createElement('ha-icon-button');
  button.setAttribute('role', 'button');
  button.setAttribute('aria-label', label);
  button.tabIndex = 0;
  button.style.color = dark ? '#ffffff' : '#000000';
  button.dataset['keepClear'] = '';
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
  return button;
};

/**
 * Home Assistant's map as the playground draws it: a still plan of a few streets, a park and a river in a map's own
 * quiet colours, light or dark as the config says (`theme_mode`), nearer or further by its zoom (14 where it names
 * none), a trail's last points where it asks for hours of one — nothing of Home Assistant's cartography, its tiles or
 * its gestures; its keys are drawn (`CONTROLS`, and the card's own in `OWN.map`).
 */
const PLAN = `<svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <g class="plan">
    <g transform="rotate(-12 160 80)">
      <path class="water" d="M176 262C214 178 290 200 318 128S404 96 452 20" />
      <rect class="park" x="158" y="-34" width="52" height="46" rx="6" />
      <path class="road" d="M-120-90H480M-120 16H480M-120 136H480M-120 196H480M-60-160V320M30-160V320M214-160V320M392-160V320" />
      <path class="road is-main" d="M-120 80H480M150-160V320M302-160V320" />
    </g>
  </g>
</svg>`;
/** Where a map's markers stand on its plate, the first in its middle (the map is fitted to it), in % of the plate. */
const MARKERS: ReadonlyArray<readonly [x: number, y: number]> = [
  [50, 50],
  [76, 34],
  [22, 30],
];
/** A trail's last points behind the first marker, older ones fainter (viewBox units). */
const TRAIL: ReadonlyArray<readonly [x: number, y: number]> = [
  [40, 107],
  [66, 101],
  [92, 95],
  [116, 90],
  [138, 85],
];

/** The entities of a map's config: each an id, or an entry that names one (`{ entity, … }`). */
const trackersOf = (config: LovelaceCardConfig): string[] =>
  ((config['entities'] ?? []) as readonly unknown[]).map((entry) =>
    String(typeof entry === 'string' ? entry : (entry as { entity?: unknown } | null)?.entity),
  );

/** Home Assistant's own cards the sheets name, each drawn into the plate. */
const OWN: Readonly<
  Record<string, (config: LovelaceCardConfig, hass: HomeAssistant | undefined) => HTMLElement[]>
> = {
  entities: (config, hass) => {
    const content = document.createElement('div');
    content.className = 'content';
    for (const id of (config['entities'] ?? []) as readonly string[]) {
      const state = hass?.states[id];
      const row = document.createElement('div');
      row.className = 'row';
      const badge = document.createElement('span');
      badge.className = `badge ${state && ['on', 'playing', 'open'].includes(state.state) ? 'is-on' : ''}`;
      const icon = document.createElement('ha-state-icon') as HTMLElement & { stateObj?: unknown };
      icon.stateObj = state;
      badge.append(icon);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = String(state?.attributes['friendly_name'] ?? id);
      const value = document.createElement('span');
      value.className = 'state';
      value.textContent = state ? (hass?.formatEntityState?.(state) ?? state.state) : domainOf(id);
      row.append(badge, name, value);
      content.append(row);
    }
    return [content];
  },
  markdown: (config) => {
    const content = document.createElement('div');
    content.className = 'content';
    const words = document.createElement('p');
    words.textContent = String(config['content'] ?? '');
    content.append(words);
    return [content];
  },
  // a tile: its icon and its two lines in a row of 56 with its hairline, padded by 10 at the sides alone; its words in
  // the size, weight and tracking a theme gives Home Assistant's own (`--ha-tile-info-*`, #240), else Home Assistant's
  tile: (config, hass) => {
    const state = hass?.states[String(config['entity'] ?? '')];
    const content = document.createElement('div');
    content.className = 'tile';
    const badge = document.createElement('span');
    badge.className = `badge ${state?.state === 'on' ? 'is-on' : ''}`;
    const icon = document.createElement('ha-state-icon') as HTMLElement & { stateObj?: unknown };
    icon.stateObj = state;
    badge.append(icon);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = String(state?.attributes['friendly_name'] ?? config['entity'] ?? '');
    const value = document.createElement('span');
    value.className = 'state';
    value.textContent = state ? (hass?.formatEntityState?.(state) ?? state.state) : '';
    name.append(value);
    content.append(badge, name);
    return [content];
  },
  // a heading: no surface of its own, its words 4 in
  heading: (config) => {
    const content = document.createElement('div');
    content.className = 'heading';
    content.textContent = String(config['heading'] ?? '');
    return [content];
  },
  // a picture: the card whole, nothing round it
  picture: (config) => {
    const image = document.createElement('img');
    image.src = String(config['image'] ?? '');
    image.alt = '';
    return [image];
  },
  // a map, in the shape Home Assistant's map card draws (`hui-map-card`): its `#root` holding its `ha-map`, whose own
  // root holds the plan, each tracker that says where it is (marked as Home Assistant marks one with no picture, by
  // the initials of its name, the first in the middle) and MapLibre's keys; and the card's own keys under the zoom
  // keys (`#buttons`, 75 from the top and 3 in): grouping where it shows more than one entity, then fitting
  map: (config, hass) => {
    const mode = config['theme_mode'];
    const dark = mode === 'dark' || (mode !== 'light' && Boolean(hass?.themes?.darkMode));
    const root = document.createElement('div');
    root.id = 'root';
    const map = document.createElement('ha-map');
    // Home Assistant's own drawing: none of it is held to Fluvy's grid
    map.dataset['measure'] = 'skip';
    const inside = map.attachShadow({ mode: 'open' });
    inside.innerHTML = `<style>${MAP}</style><div id="map" class="maplibregl-map${dark ? ' dark' : ''}">${PLAN}</div>`;
    const drawn = inside.getElementById('map') as HTMLElement;
    const zoom = Number(config['default_zoom'] ?? 14);
    const plan = drawn.querySelector<SVGGElement>('.plan');
    plan?.setAttribute(
      'transform',
      `translate(160 80) scale(${Math.min(4, Math.max(0.4, 2 ** ((zoom - 14) / 2)))}) translate(-160 -80)`,
    );
    if (Number(config['hours_to_show']) > 0)
      TRAIL.forEach(([x, y], index) => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('class', 'trail');
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));
        dot.setAttribute('r', '3');
        dot.setAttribute('opacity', String(0.25 + index * 0.15));
        drawn.querySelector('svg')?.append(dot);
      });
    const placed = trackersOf(config)
      .map((id) => hass?.states[id])
      .filter((state) => typeof state?.attributes['latitude'] === 'number');
    placed.slice(0, MARKERS.length).forEach((state, index) => {
      const marker = document.createElement('span');
      marker.className = 'marker';
      marker.style.left = `${MARKERS[index]?.[0]}%`;
      marker.style.top = `${MARKERS[index]?.[1]}%`;
      marker.textContent = String(state?.attributes['friendly_name'] ?? '')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 3);
      drawn.append(marker);
    });
    drawn.insertAdjacentHTML('beforeend', CONTROLS);
    const buttons = document.createElement('div');
    buttons.id = 'buttons';
    buttons.dataset['measure'] = 'skip';
    if (trackersOf(config).length > 1)
      buttons.append(key('Toggle grouping', mdiGoogleCirclesCommunities, dark));
    buttons.append(key('Reset focus', mdiImageFilterCenterFocus, dark));
    root.append(map, buttons);
    return [root];
  },
  // what Home Assistant draws in the place of a card it cannot build: that it is a configuration error, and why
  error: (config) => {
    const content = document.createElement('div');
    content.className = 'content error';
    const title = document.createElement('p');
    title.className = 'error__title';
    title.textContent = 'Configuration error';
    const why = document.createElement('p');
    why.textContent = String(config['error'] ?? '');
    content.append(title, why);
    return [content];
  },
};

/** A card of Home Assistant's own, as a plate (`OWN`): its title in the plate's header, its content under it. */
class MockOwnCard extends HTMLElement implements LovelaceCard {
  private config: LovelaceCardConfig | undefined;
  private house: HomeAssistant | undefined;
  preview = false;
  /** How its holder lays it out (`grid`: it fills the box it is given, as Home Assistant's map does on a plate). */
  layout?: string;

  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
    this.draw();
  }

  get hass(): HomeAssistant | undefined {
    return this.house;
  }
  set hass(hass: HomeAssistant | undefined) {
    this.house = hass;
    this.draw();
  }

  getCardSize(): number {
    return 3;
  }

  private draw(): void {
    const config = this.config;
    const parts = config && OWN[config.type]?.(config, this.house);
    if (!config || !parts) return;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PLATE;
    const card = document.createElement('div');
    card.className = 'card';
    if (typeof config['title'] === 'string') {
      const header = document.createElement('div');
      header.className = 'header';
      header.textContent = config['title'];
      card.append(header);
    }
    card.append(...parts);
    root.replaceChildren(style, card);
  }
}

class MockHuiCard extends HTMLElement {
  config: LovelaceCardConfig | undefined;
  private house: HomeAssistant | undefined;
  private previewed = false;
  private card: LovelaceCard | undefined;

  get hass(): HomeAssistant | undefined {
    return this.house;
  }
  set hass(hass: HomeAssistant | undefined) {
    this.house = hass;
    if (this.card) this.card.hass = hass;
    this.show();
  }

  get preview(): boolean {
    return this.previewed;
  }
  set preview(preview: boolean) {
    this.previewed = preview;
    if (this.card) this.card.preview = preview;
    this.show();
  }

  /** The card of the config, in the wrapper's place: an error where the config cannot be built. */
  load(): void {
    const config = this.config;
    if (!config) throw new Error('Cannot build card without config');
    const type = String(config.type);
    const tag = type.startsWith('custom:') ? type.slice(7) : 'pg-own-card';
    let card = document.createElement(tag) as LovelaceCard;
    try {
      if (!type.startsWith('custom:') && !OWN[type]) throw new Error(`Unknown type: ${type}`);
      // a card not defined yet has no `setConfig`: it is built again as its element is defined
      if (customElements.get(tag)) card.setConfig(config);
      else void customElements.whenDefined(tag).then(() => this.load());
    } catch (error) {
      card = document.createElement('pg-own-card') as LovelaceCard;
      card.setConfig({ type: 'error', error: error instanceof Error ? error.message : error });
    }
    card.hass = this.house;
    card.preview = this.previewed;
    card.addEventListener(VISIBILITY_EVENT, (event) => {
      event.stopPropagation();
      this.show();
    });
    this.card = card;
    this.replaceChildren(card);
    this.show();
  }

  connectedCallback(): void {
    if (!this.card && this.config) this.load();
  }

  getCardSize(): number | Promise<number> {
    return this.card?.getCardSize?.() ?? 1;
  }

  /** Hidden while its conditions do not hold or its card hides itself, never in a preview; said when it changes. */
  private show(): void {
    if (!this.card) return;
    const visible = !this.card.hidden && (this.previewed || shows(this.config, this.house));
    if (this.hidden === !visible) return;
    this.hidden = !visible;
    this.style.display = visible ? '' : 'none';
    this.dispatchEvent(
      new CustomEvent(VISIBILITY_EVENT, {
        detail: { value: visible },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

/** Defines the stand-ins where Home Assistant is not there to define its own. */
export function defineCardWrapper(): void {
  if (!customElements.get('pg-own-card')) customElements.define('pg-own-card', MockOwnCard);
  if (!customElements.get('hui-card')) customElements.define('hui-card', MockHuiCard);
}

/** The trackers a sheet draws Home Assistant's map of (`drawMaps`). */
const mapped = new Set<string>();

/**
 * A sheet's trackers whose map the playground draws (the Vehicle card's mini map): a map of any other entity is not
 * made, as where Home Assistant's card helpers are missing — the Map card's zones stand in for it then.
 */
export function drawMaps(...trackers: readonly string[]): void {
  defineCardWrapper();
  for (const id of trackers) mapped.add(id);
}

/** Home Assistant's map card of a config, as its card helpers make it; none unless a sheet draws its trackers' map. */
export function mapCard(config: LovelaceCardConfig): LovelaceCard | undefined {
  const trackers = trackersOf(config);
  if (!trackers.length || !trackers.every((id) => mapped.has(id))) return undefined;
  const card = document.createElement('pg-own-card') as LovelaceCard;
  card.setConfig(config);
  return card;
}
