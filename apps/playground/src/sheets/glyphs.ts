import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '@fluvy/core';
import { baseStyles } from '@fluvy/ui';
import { CLIMATE_GLYPHS } from '@fluvy/ui/glyph-sets/climate';
import { DEVICE_GLYPHS } from '@fluvy/ui/glyph-sets/devices';
import { ENERGY_GLYPHS } from '@fluvy/ui/glyph-sets/energy';
import { HOME_GLYPHS } from '@fluvy/ui/glyph-sets/home';
import { LEVEL_GLYPHS } from '@fluvy/ui/glyph-sets/levels';
import { OUTDOOR_GLYPHS } from '@fluvy/ui/glyph-sets/outdoor';
import { ROOM_GLYPHS } from '@fluvy/ui/glyph-sets/rooms';
import { SAFETY_GLYPHS } from '@fluvy/ui/glyph-sets/safety';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { APPLIANCE_GLYPHS, PICKABLE } from '../../../../packages/cards/src/appliance/glyphs.js';
import { FluvyTileCard } from '../../../../packages/cards/src/tile/tile-card.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-tile-card')) customElements.define('fluvy-tile-card', FluvyTileCard);

/*
 * Fluvy's glyph sets of 1.23 (#226), the review page's source and the release notes': every new glyph by its family,
 * with its `fluvy:` name, at 16, 20 (a circle's, on its tone's fill) and 24 — drawn from their
 * strokes, the design itself; the ladders the house's levels pick by (a battery's charge, a signal's bars, a valve);
 * then real tiles in one icon language, the set's glyphs Home Assistant draws (`fluvy:router`, through `<ha-icon>`)
 * beside the strokes a card draws by itself, and the tiles of what reads a level — the house's levels are the page's
 * (`&levels=1` turns them on, as fluvy's settings → Appearance › Cards › Icons show their level does). Light and dark
 * are the page's (`&mode=dark`).
 */

type Glyph = string | readonly [string, number];

const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** A glyph from its strokes, as the set draws it. */
const stroke = (glyph: Glyph): TemplateResult => {
  const [body, width] = typeof glyph === 'string' ? [glyph, 1.75] : glyph;
  return html`<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width=${width}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${unsafeSVG(body)}
  </svg>`;
};

/** Each family the sheet draws, by the key a frame's card names it with. */
const FAMILIES: Readonly<Record<string, Readonly<Record<string, Glyph>>>> = {
  levels: LEVEL_GLYPHS,
  energy: ENERGY_GLYPHS,
  devices: DEVICE_GLYPHS,
  climate: CLIMATE_GLYPHS,
  safety: SAFETY_GLYPHS,
  outdoor: OUTDOOR_GLYPHS,
  home: HOME_GLYPHS,
  rooms: ROOM_GLYPHS,
  appliances: Object.fromEntries(PICKABLE.map((name) => [name, APPLIANCE_GLYPHS[name]])),
};

/** What the house's levels pick, reading by reading (`core/src/icons/levels.ts`). */
const LADDERS: ReadonlyArray<
  readonly [title: string, steps: ReadonlyArray<readonly [string, string]>]
> = [
  [
    'A battery by its charge',
    [
      ['5 %', 'batteryEmpty'],
      ['25 %', 'batteryLow'],
      ['60 %', 'batteryHalf'],
      ['95 %', 'batteryFull'],
      ['Charging', 'batteryCharging'],
    ],
  ],
  [
    'A signal by its bars',
    [
      ['−95 dBm', 'signalNone'],
      ['−80 dBm', 'signalWeak'],
      ['−70 dBm', 'signalFair'],
      ['−60 dBm', 'signalGood'],
      ['−50 dBm', 'signalStrong'],
    ],
  ],
  [
    'A valve as it stands',
    [
      ['Open', 'valveOpen'],
      ['Closed', 'valveShut'],
    ],
  ],
];

/**
 * A family of glyphs (`family: energy`), each with its name at 16, 20 and 24; or the ladders (`family: ladders`), each
 * step with the reading that picks it.
 */
class GlyphSheet extends LitElement implements LovelaceCard {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: block;
      }
      /* cells of 108 on the 4 grid, a column of them in a half section's card; each glyph's three sizes a drawing, its
         words centred under it */
      .pg-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, 108px);
        gap: 16px 12px;
        margin-top: 16px;
      }
      .pg-glyph {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
      }
      .pg-sizes {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 44px;
      }
      .pg-bare {
        display: inline-flex;
        color: var(--fluvy-text);
      }
      .pg-bare--16 svg {
        width: 16px;
        height: 16px;
      }
      .pg-bare--24 svg {
        width: 24px;
        height: 24px;
      }
      .pg-name,
      .pg-reading {
        font-size: 12px;
        line-height: 16px;
        text-align: center;
        white-space: nowrap;
        color: var(--fluvy-text-secondary);
      }
      .pg-reading {
        font-size: 13px;
        font-weight: 600;
        line-height: 20px;
        color: var(--fluvy-text);
      }
    `,
  ];

  static override properties = { config: { state: true } };

  declare config: { family?: string; title?: string };

  constructor() {
    super();
    this.config = {};
  }

  setConfig(config: LovelaceCardConfig): void {
    this.config = config as GlyphSheet['config'];
  }

  set hass(_hass: HomeAssistant) {
    // the glyphs are the sets': nothing of the house's is read
  }

  getCardSize(): number {
    return 6;
  }

  /** A glyph at the three sizes: 16, a circle's 20 on its tone's fill, 24. */
  private sizes(glyph: Glyph): TemplateResult {
    return html`<div class="pg-sizes" data-measure="drawn">
      <span class="pg-bare pg-bare--16">${stroke(glyph)}</span>
      <span class="fv-ico fv-ico--accent">${stroke(glyph)}</span>
      <span class="pg-bare pg-bare--24">${stroke(glyph)}</span>
    </div>`;
  }

  protected override render(): TemplateResult {
    const { family = 'levels', title = '' } = this.config;
    const head = html`<div class="fv-card__titles">
      <h3 class="fv-card__title">${title}</h3>
    </div>`;
    if (family === 'ladders')
      return html`<article class="fv-card" data-card>
        ${head}
        ${LADDERS.map(
          ([label, steps]) =>
            html`<p class="fv-label">${label}</p>
              <div class="pg-grid">
                ${steps.map(
                  ([reading, name]) =>
                    html`<figure class="pg-glyph">
                      ${this.sizes(LEVEL_GLYPHS[name as keyof typeof LEVEL_GLYPHS])}
                      <figcaption class="pg-reading">${reading}</figcaption>
                      <span class="pg-name">${kebab(name)}</span>
                    </figure>`,
                )}
              </div>`,
        )}
      </article>`;
    return html`<article class="fv-card" data-card>
      ${head}
      <div class="pg-grid">
        ${Object.entries(FAMILIES[family] ?? {}).map(
          ([name, glyph]) =>
            html`<figure class="pg-glyph">
              ${this.sizes(glyph)}
              <figcaption class="pg-name">${kebab(name)}</figcaption>
            </figure>`,
        )}
      </div>
    </article>`;
  }
}
if (!customElements.get('pg-glyphs')) customElements.define('pg-glyphs', GlyphSheet);

/** A family's frame: its glyphs by their `fluvy:` names at 16, 20 and 24, on a phone's column and on a desktop's page. */
const family = (key: string, title: string): FrameSpec[] => {
  const card = { type: 'custom:pg-glyphs', family: key, title };
  return [
    { title: `${title} · fluvy:<name> at 16, 20 and 24 · phone`, cards: [card] },
    { title: `${title} · fluvy:<name> at 16, 20 and 24 · 1400`, width: 1400, cards: [card] },
  ];
};

const TILE = 'custom:fluvy-tile-card';
/** A tile on a wall tablet's row: a quarter of the section on a page, half of it on a phone's column. */
const tile = (entity: string, more: Record<string, unknown> = {}) => ({
  type: TILE,
  entity,
  cols: 6,
  ...more,
});

/** The wall tablet's row (#226's picture): the set's new glyphs Home Assistant draws, beside a card's own strokes. */
const WALL = [
  tile('switch.gl_router', { icon: 'fluvy:router' }),
  tile('sensor.gl_solar', { icon: 'fluvy:solar-panel' }),
  tile('light.gl_ceiling', { icon: 'fluvy:ceiling-light' }),
  tile('light.gl_lamp'),
  tile('sensor.gl_co2', { icon: 'fluvy:co2' }),
  tile('switch.gl_radiators', { icon: 'fluvy:radiator' }),
  tile('sensor.gl_rain_tank', { icon: 'fluvy:tank' }),
  tile('switch.gl_sprinklers', { icon: 'fluvy:sprinkler' }),
  tile('binary_sensor.gl_mailbox', { icon: 'fluvy:mailbox' }),
  tile('lock.gl_front'),
  tile('sensor.gl_kids_temperature', { icon: 'fluvy:kids-room', name: 'Kids’ room' }),
  tile('sensor.gl_kitchen_temperature', { icon: 'fluvy:kitchen', name: 'Kitchen' }),
];

/** What reads a level: drawn by its kind's one glyph, or by its level where the house shows levels (`&levels=1`). */
const LEVELS = [
  tile('sensor.gl_hall_motion_battery'),
  tile('sensor.gl_back_door_battery'),
  tile('sensor.gl_thermostat_battery'),
  tile('sensor.gl_garden_battery'),
  tile('binary_sensor.gl_phone_charging'),
  tile('binary_sensor.gl_smoke_battery'),
  tile('sensor.gl_shed_camera_signal'),
  tile('sensor.gl_garage_plug_signal'),
  tile('sensor.gl_porch_light_signal'),
  tile('sensor.gl_desk_plug_signal'),
  tile('sensor.gl_router_signal'),
  tile('valve.gl_garden'),
  tile('valve.gl_main_water'),
];

const battery = (name: string, level: string) =>
  [level, { friendly_name: name, device_class: 'battery', unit_of_measurement: '%' }] as const;
const signal = (name: string, level: string) =>
  [
    level,
    { friendly_name: name, device_class: 'signal_strength', unit_of_measurement: 'dBm' },
  ] as const;

export const sheet: SheetSpec = {
  states: [
    ['switch.gl_router', 'on', { friendly_name: 'Router' }],
    [
      'sensor.gl_solar',
      '2.4',
      { friendly_name: 'Solar panels', device_class: 'power', unit_of_measurement: 'kW' },
    ],
    ['light.gl_ceiling', 'on', { friendly_name: 'Kitchen ceiling', brightness: 191 }],
    ['light.gl_lamp', 'off', { friendly_name: 'Reading lamp' }],
    [
      'sensor.gl_co2',
      '612',
      {
        friendly_name: 'Living room CO₂',
        device_class: 'carbon_dioxide',
        unit_of_measurement: 'ppm',
      },
    ],
    ['switch.gl_radiators', 'on', { friendly_name: 'Radiators' }],
    ['sensor.gl_rain_tank', '68', { friendly_name: 'Rain tank', unit_of_measurement: '%' }],
    ['switch.gl_sprinklers', 'off', { friendly_name: 'Sprinklers' }],
    ['binary_sensor.gl_mailbox', 'on', { friendly_name: 'Mailbox' }],
    ['lock.gl_front', 'locked', { friendly_name: 'Front door' }],
    [
      'sensor.gl_kids_temperature',
      '20.5',
      { friendly_name: 'Kids’ room', device_class: 'temperature', unit_of_measurement: '°C' },
    ],
    [
      'sensor.gl_kitchen_temperature',
      '22.1',
      { friendly_name: 'Kitchen', device_class: 'temperature', unit_of_measurement: '°C' },
    ],
    ['sensor.gl_hall_motion_battery', ...battery('Hall motion', '5')],
    ['sensor.gl_back_door_battery', ...battery('Back door', '25')],
    ['sensor.gl_thermostat_battery', ...battery('Thermostat', '60')],
    ['sensor.gl_garden_battery', ...battery('Garden sensor', '95')],
    [
      'binary_sensor.gl_phone_charging',
      'on',
      { friendly_name: 'Marta’s phone', device_class: 'battery_charging' },
    ],
    [
      'binary_sensor.gl_smoke_battery',
      'on',
      { friendly_name: 'Smoke alarm battery', device_class: 'battery' },
    ],
    ['sensor.gl_shed_camera_signal', ...signal('Shed camera', '-95')],
    ['sensor.gl_garage_plug_signal', ...signal('Garage plug', '-80')],
    ['sensor.gl_porch_light_signal', ...signal('Porch light', '-70')],
    ['sensor.gl_desk_plug_signal', ...signal('Desk plug', '-60')],
    ['sensor.gl_router_signal', ...signal('Living room speaker', '-50')],
    ['valve.gl_garden', 'open', { friendly_name: 'Garden irrigation', supported_features: 3 }],
    ['valve.gl_main_water', 'closed', { friendly_name: 'Main water', supported_features: 3 }],
  ],
  frames: [
    {
      title: 'The ladders the house’s levels pick by · phone',
      cards: [{ type: 'custom:pg-glyphs', family: 'ladders', title: 'Levels' }],
    },
    {
      title: 'The ladders the house’s levels pick by · 1400',
      width: 1400,
      cards: [{ type: 'custom:pg-glyphs', family: 'ladders', title: 'Levels' }],
    },
    ...family('levels', 'Levels'),
    ...family('energy', 'Energy'),
    ...family('devices', 'Devices'),
    ...family('climate', 'Climate and air'),
    ...family('safety', 'Water and safety'),
    ...family('outdoor', 'Outdoors'),
    ...family('home', 'Home'),
    ...family('rooms', 'Rooms'),
    ...family('appliances', 'Appliances a person picks'),
    { title: 'A wall tablet in one icon language · phone', cards: WALL },
    {
      title: 'A wall tablet in one icon language · 1400',
      width: 1400,
      cards: WALL.map((card) => ({ ...card, cols: 3 })),
    },
    { title: 'What reads a level (&levels=1 shows it) · phone', cards: LEVELS },
    {
      title: 'What reads a level (&levels=1 shows it) · 1400',
      width: 1400,
      cards: LEVELS.map((card) => ({ ...card, cols: 3 })),
    },
  ],
};
