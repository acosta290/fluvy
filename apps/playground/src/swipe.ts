import '@fluvy/cards';
import {
  attachViewSwipe,
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardConfig,
  type SwipeHost,
  type ViewLike,
} from '@fluvy/core';
import type { createHass, StateSeed } from './hass.js';

/**
 * `?swipe=1`: a phone whose dashboard has tabs, on a stand-in for Home Assistant's `hui-root` — a host with a
 * `#view` box holding the one view on screen, the views, the route and the person, changed the way Home Assistant
 * changes them (the old view removed, the new one put in) — with the shell's swipe engine attached to it. It is
 * where the gesture is tried by hand and by `tools/render/interactions-swipe.mjs`.
 *   &pref=off   this person turned the gesture off
 *   &dir=rtl    a right-to-left page
 */

interface View extends ViewLike {
  readonly path: string;
  readonly title: Record<'en' | 'es', string>;
  readonly cards: readonly LovelaceCardConfig[];
}

const VIEWS: readonly View[] = [
  {
    path: 'home',
    title: { en: 'Home', es: 'Inicio' },
    cards: [
      {
        type: 'custom:fluvy-tiles-card',
        columns: 2,
        tiles: [
          { entity: 'light.ceiling' },
          { entity: 'light.reading' },
          { entity: 'switch.desk_plug', readouts: ['sensor.desk_plug_power'] },
          { entity: 'cover.blinds' },
        ],
      },
      { type: 'custom:fluvy-tile-card', entity: 'sensor.house_power' },
      { type: 'custom:fluvy-tile-card', entity: 'light.porch' },
    ],
  },
  {
    path: 'lights',
    title: { en: 'Lights', es: 'Luces' },
    cards: [
      { type: 'custom:fluvy-light-card', entity: 'light.ceiling' },
      { type: 'custom:fluvy-light-card', entity: 'light.reading' },
    ],
  },
  {
    path: 'energy',
    title: { en: 'Energy', es: 'Energía' },
    cards: [
      {
        type: 'custom:fluvy-tile-card',
        entity: 'switch.desk_plug',
        readouts: ['sensor.desk_plug_power', 'sensor.desk_plug_energy'],
      },
      { type: 'custom:fluvy-tile-card', entity: 'sensor.house_power' },
    ],
  },
  // a subview (a room's page): reached by a link, never by a swipe
  { path: 'detail', subview: true, title: { en: 'Detail', es: 'Detalle' }, cards: [] },
];

/** The phone's house, seeded into the page's mock. */
export const SWIPE_STATES: readonly StateSeed[] = [
  [
    'light.ceiling',
    'on',
    {
      friendly_name: 'Ceiling',
      brightness: 178,
      supported_color_modes: ['color_temp'],
      color_mode: 'color_temp',
      color_temp_kelvin: 3200,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
    },
  ],
  ['light.reading', 'off', { friendly_name: 'Reading', supported_color_modes: ['brightness'] }],
  ['light.porch', 'on', { friendly_name: 'Porch', supported_color_modes: ['onoff'] }],
  ['switch.desk_plug', 'on', { friendly_name: 'Desk plug', device_class: 'outlet' }],
  [
    'sensor.desk_plug_power',
    '142',
    { friendly_name: 'Desk plug Power', unit_of_measurement: 'W', device_class: 'power' },
  ],
  [
    'sensor.desk_plug_energy',
    '1.2',
    { friendly_name: 'Desk plug Energy', unit_of_measurement: 'kWh', device_class: 'energy' },
  ],
  [
    'sensor.house_power',
    '1840',
    { friendly_name: 'House power', unit_of_measurement: 'W', device_class: 'power' },
  ],
  [
    'cover.blinds',
    'open',
    {
      friendly_name: 'Blinds',
      current_position: 40,
      device_class: 'blind',
      supported_features: 15,
    },
  ],
];

const PREFIX = '/pg';

/** The host's own sheet: the view box and the view, laid out as `hui-root` lays out its own. */
const HOST_CSS = `
:host { display: block; }
#view { position: relative; display: flex; box-sizing: border-box; min-height: 100%; padding: 0 16px 16px; }
.pg-view { flex: 1 1 100%; min-width: 0; display: grid; gap: 16px; align-content: start; }
`;

export function mountSwipe(
  stage: HTMLElement,
  mock: ReturnType<typeof createHass>,
  options: { language: string; enabled: boolean; rtl: boolean },
): void {
  const language = options.language === 'es' ? 'es' : 'en';
  if (options.rtl) document.documentElement.dir = 'rtl';

  const phone = document.createElement('div');
  phone.className = 'pg-phone';
  phone.dataset['frame'] = 'swipe/Phone';
  const bar = document.createElement('nav');
  bar.className = 'pg-phone__bar';
  bar.setAttribute('aria-label', 'Views');
  const host = document.createElement('div') as SwipeHost;
  host.className = 'pg-phone__root';
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(HOST_CSS);
  shadow.adoptedStyleSheets = [sheet];
  const box = document.createElement('div');
  box.id = 'view';
  shadow.append(box);
  phone.append(bar, host);
  stage.append(phone);

  const cards: LovelaceCard[] = [];
  mock.subscribe((hass: HomeAssistant) => {
    for (const card of cards) card.hass = hass;
  });

  host.lovelace = { config: { views: VIEWS }, editMode: false };
  host.hass = { user: { id: 'u1' } };

  /** Home Assistant's way: the route moves, the old view goes, the new one is put in the box. */
  const show = (index: number): void => {
    const view = VIEWS[index];
    if (!view) return;
    host.route = { prefix: PREFIX, path: `/${view.path}` };
    phone.dataset['view'] = view.path;
    box.querySelector('.pg-view')?.remove();
    cards.length = 0;
    const element = document.createElement('div');
    element.className = 'pg-view';
    for (const config of view.cards) {
      const card = document.createElement(
        String(config['type']).replace(/^custom:/, ''),
      ) as LovelaceCard;
      card.setConfig(config);
      card.hass = mock.hass();
      cards.push(card);
      element.append(card);
    }
    box.append(element);
    host.scrollTop = 0;
    for (const tab of bar.querySelectorAll<HTMLButtonElement>('.pg-phone__tab'))
      tab.classList.toggle('is-active', tab.dataset['path'] === view.path);
  };

  const navigate = (path: string): void => {
    const segment = path.slice(PREFIX.length + 1);
    const index = VIEWS.findIndex((view) => view.path === segment);
    if (index >= 0) show(index);
  };

  VIEWS.forEach((view) => {
    if (view.subview) return;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'pg-phone__tab';
    tab.dataset['path'] = view.path;
    tab.textContent = view.title[language];
    tab.addEventListener('click', () => navigate(`${PREFIX}/${view.path}`));
    bar.append(tab);
  });

  show(0);
  attachViewSwipe(host, { enabled: () => options.enabled, navigate });
}
