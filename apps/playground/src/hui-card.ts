import {
  domainOf,
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardConfig,
} from '@fluvy/core';

/*
 * Home Assistant's card wrapper (`hui-card`) is not here: a stand-in builds the card of a config as Home Assistant's
 * does, for the cards that hold others (the Expander) — a card of Fluvy's by its type; a card of Home Assistant's own
 * (`entities`, `markdown`, `tile`, `heading`, `picture`) as a plate drawn the way its `ha-card` is under Fluvy's
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
  .tile .name { margin-left: 0; line-height: 20px; }
  .tile .state { display: block; margin-left: 0; font-size: 12px; line-height: 16px; color: var(--fluvy-text-secondary); }
  .card:has(> .heading) { border: 0; background: none; }
  .heading { padding: 0 4px; font-size: 16px; line-height: 24px; }
  .card:has(> img) { overflow: hidden; }
  img { display: block; width: 100%; height: 180px; object-fit: cover; }
  .error { color: var(--fluvy-text-secondary); }
  .error__title { font-weight: 600; color: var(--fluvy-danger); }
`;

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
  // a tile: its icon and its two lines in a row of 56 with its hairline, padded by 10 at the sides alone
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
