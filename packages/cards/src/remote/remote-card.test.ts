// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { appsBlock, appsLayout, remoteHeight } from '../remote-family.js';
import {
  cardForm,
  drawEditor,
  type FormStub,
  listTitles,
  shownNames,
} from '../shared/fixtures/editor.js';
import { FluvyRemoteCard } from './remote-card.js';

// the index fetches the lazy families, this card's among them: they land before this file's page goes
beforeAll(() => familiesDefined);

const STAMP = '2026-11-09T20:00:00+00:00';
type Seed = readonly [id: string, state: string, attributes?: Record<string, unknown>];

/* media_player supported_features */
const TV = 1 | 4 | 8 | 16 | 32 | 128 | 256 | 2048 | 4096 | 16384;
const RECEIVER = 4 | 8 | 128 | 256;

interface Call {
  readonly service: string;
  readonly data: Record<string, unknown>;
  readonly target: { entity_id?: string } | undefined;
}

/** A house with the entities given, their integrations, and the services each card call sends. */
function house(
  seeds: readonly Seed[],
  platforms: Readonly<Record<string, string>> = {},
): { readonly hass: HomeAssistant; readonly calls: Call[] } {
  const calls: Call[] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: Object.fromEntries(
      seeds.map(([entity_id, state, attributes]) => [
        entity_id,
        {
          entity_id,
          state,
          attributes: { ...attributes },
          last_changed: STAMP,
          last_updated: STAMP,
        },
      ]),
    ),
    entities: Object.fromEntries(
      Object.entries(platforms).map(([entity_id, platform]) => [
        entity_id,
        { entity_id, platform },
      ]),
    ),
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService: (
      domain: string,
      service: string,
      data: Record<string, unknown>,
      target: unknown,
    ) => {
      calls.push({ service: `${domain}.${service}`, data, target: target as Call['target'] });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

const LIVING: readonly Seed[] = [
  [
    'media_player.tv',
    'playing',
    {
      friendly_name: 'Living room TV',
      device_class: 'tv',
      app_name: 'Netflix',
      source: 'Netflix',
      source_list: ['HDMI 1', 'Netflix', 'YouTube', 'Disney+'],
      volume_level: 0.32,
      is_volume_muted: false,
      supported_features: TV,
    },
  ],
  ['remote.tv', 'on', { friendly_name: 'Living room TV' }],
  [
    'media_player.receiver',
    'on',
    {
      friendly_name: 'Receiver',
      volume_level: 0.4,
      is_volume_muted: false,
      supported_features: RECEIVER,
    },
  ],
  [
    'media_player.tv_off',
    'off',
    { friendly_name: 'Bedroom TV', supported_features: TV, volume_level: 0.2 },
  ],
  ['remote.tv_off', 'off', { friendly_name: 'Bedroom TV' }],
  [
    'media_player.lg',
    'on',
    { friendly_name: 'LG', source_list: ['HDMI 1'], volume_level: 0.2, supported_features: TV },
  ],
  ['media_player.gone', 'unavailable', { friendly_name: 'Den TV', supported_features: TV }],
  ['remote.gone', 'unavailable', { friendly_name: 'Den TV' }],
];
const ANDROID = {
  'media_player.tv': 'androidtv_remote',
  'remote.tv': 'androidtv_remote',
  'media_player.lg': 'webostv',
};

/* media_player supported_features of Android TV Remote's player: no sources, an app launched by `play_media` */
const ATV = 1 | 8 | 16 | 32 | 128 | 256 | 512 | 1024 | 4096 | 16384 | 131072;
/**
 * A television on Android TV Remote as the integration draws it: its player lists no source and says the app running
 * by its package (`app_id`, and `app_name` where the integration's own list names none), its remote the same
 * (`current_activity`); and an Apple TV, whose remote takes no `activity`.
 */
const SET_TOP: readonly Seed[] = [
  [
    'media_player.atv',
    'on',
    {
      friendly_name: 'Living room TV',
      device_class: 'tv',
      app_id: 'com.disney.disneyplus',
      app_name: 'com.disney.disneyplus',
      volume_level: 0.2,
      is_volume_muted: false,
      supported_features: ATV,
    },
  ],
  [
    'remote.atv',
    'on',
    {
      friendly_name: 'Living room TV',
      current_activity: 'com.disney.disneyplus',
      activity_list: [],
    },
  ],
  ['media_player.box', 'on', { friendly_name: 'Apple TV', supported_features: 1 | 128 | 256 }],
  ['remote.box', 'on', { friendly_name: 'Apple TV' }],
];
const SET_TOPS = {
  ...ANDROID,
  'media_player.atv': 'androidtv_remote',
  'remote.atv': 'androidtv_remote',
  'media_player.box': 'apple_tv',
  'remote.box': 'apple_tv',
};

/** The card drawn in the page: its shadow root. */
async function draw(config: Record<string, unknown>, hass: HomeAssistant): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-remote-card') as FluvyRemoteCard;
  card.setConfig({ ...config, type: 'custom:fluvy-remote-card' } as LovelaceCardConfig);
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve));
  await card.updateComplete;
  return card.shadowRoot!;
}

const press = async (root: ShadowRoot, label: string): Promise<void> => {
  const button = root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  expect(button, label).not.toBeNull();
  button!.click();
  await new Promise((resolve) => setTimeout(resolve));
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('the TV remote card (#143)', () => {
  it('declares its heights by the config alone: 572 full, 144 compact, 276 pad, 76 row', () => {
    expect(remoteHeight({ type: 'x' })).toBe(572);
    expect(remoteHeight({ type: 'x', variant: 'compact' })).toBe(144);
    expect(remoteHeight({ type: 'x', variant: 'pad' })).toBe(276);
    expect(remoteHeight({ type: 'x', variant: 'row' })).toBe(76);
    expect(remoteHeight({ type: 'x', groups: ['dpad'] })).toBe(276);
    expect(remoteHeight({ type: 'x', groups: ['volume', 'channel'] })).toBe(64 + 88 + 88 + 20);
    // seven apps are two rows of six; six custom keys one row of 50 cells 4 apart, seven two rows
    expect(
      remoteHeight({ type: 'x', groups: ['apps'], apps: Array(7).fill({ app: 'netflix' }) }),
    ).toBe(64 + 16 + 68 + 76 + 20);
    expect(
      remoteHeight({ type: 'x', groups: ['custom'], custom: Array(6).fill({ name: 'k' }) }),
    ).toBe(64 + 16 + 44 + 20);
    expect(
      remoteHeight({ type: 'x', groups: ['custom'], custom: Array(7).fill({ name: 'k' }) }),
    ).toBe(64 + 16 + 44 + 16 + 44 + 20);
    expect(FluvyRemoteCard.layoutHeight({ type: 'x', variant: 'pad' })).toBe(276);
  });

  it('declares each option as it draws: the pad’s shapes, its keys in a row, the apps as chips, what a device has none of', () => {
    const pad = 64 + 16 + 176 + 20;
    expect(remoteHeight({ type: 'x', variant: 'pad', dpad: 'grid' })).toBe(pad - 12);
    expect(remoteHeight({ type: 'x', variant: 'pad', side_keys: 'row' })).toBe(pad + 60);
    expect(remoteHeight({ type: 'x', variant: 'pad', side_keys: 'row', nav: [] })).toBe(pad);
    expect(remoteHeight({ type: 'x', groups: ['dpad'], side_keys: 'row' })).toBe(pad + 60);
    // the sources and the apps the house says it has none of draw nothing, 16 above them included
    expect(remoteHeight({ type: 'x', groups: ['source', 'apps'] }, { sources: [], apps: [] })).toBe(
      64 + 20,
    );
    // the keys' groups draw nothing where nothing takes the keys
    expect(remoteHeight({ type: 'x', groups: ['dpad', 'channel'] }, { keyed: false })).toBe(
      64 + 20,
    );
    expect(remoteHeight({ type: 'x', groups: ['custom'] })).toBe(64 + 20);
    // six apps as chips with their logos: three a row where six circles would take two rows of 68
    const six = ['Netflix', 'YouTube', 'Spotify', 'Disney+', 'Prime', 'Apple TV'];
    expect(remoteHeight({ type: 'x', groups: ['apps'], apps_style: 'chips' }, { apps: six })).toBe(
      64 + 16 + 2 * 44 + 20,
    );
  });

  it('declares a compact card by the columns it is given: half a section wraps its five keys', () => {
    const half = { type: 'x', variant: 'compact', grid_options: { columns: 6 } };
    expect(remoteHeight(half)).toBe(64 + 16 + 3 * 44 + 2 * 16 + 20);
    expect(remoteHeight({ ...half, keys: ['back', 'home'] })).toBe(64 + 16 + 44 + 20);
    expect(remoteHeight({ ...half, grid_options: { columns: 12 } })).toBe(144);
  });

  it('its stub takes the house’s first player and its first remote', () => {
    expect(FluvyRemoteCard.getStubConfig({}, ['light.a', 'remote.tv', 'media_player.tv'])).toEqual({
      type: 'custom:fluvy-remote-card',
      entity: 'media_player.tv',
      remote: 'remote.tv',
    });
  });

  it('draws the full anatomy: the power round, the sources, the ring with its four keys and OK, the transport, the volume, the apps', async () => {
    const { hass } = house(LIVING, ANDROID);
    const root = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', volume_entity: 'media_player.receiver' },
      hass,
    );
    expect(root.querySelector('.fv-card__head [aria-label="Turn off"]')).not.toBeNull();
    // the app is its own source here: said once
    expect(root.querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Netflix');
    // the platforms among the sources go to the apps row; the inputs stay chips
    expect([...root.querySelectorAll('.fv-chip__pill')].map((c) => c.textContent?.trim())).toEqual([
      'HDMI 1',
    ]);
    expect(root.querySelectorAll('.rm-arrow').length).toBe(4);
    expect(root.querySelector('.rm-ok')?.textContent?.trim()).toBe('OK');
    expect(root.querySelectorAll('.rm-pad__key').length).toBe(4);
    expect(root.querySelectorAll('.rm-transport .fv-round').length).toBe(3);
    expect(
      [...root.querySelectorAll('.rm-label span')].map((span) => span.textContent?.trim()),
    ).toEqual(['Volume · Receiver', '40 %']);
    expect(root.querySelector('fluvy-ruler')).not.toBeNull();
    expect([...root.querySelectorAll('.rm-app__name')].map((n) => n.textContent)).toEqual([
      'Netflix',
      'YouTube',
      'Disney+',
    ]);
    expect(root.querySelector('.rm-app.is-active .rm-app__name')?.textContent).toBe('Netflix');
  });

  it('a key goes to the remote as its integration takes it; the power and the volume to the players’ own services', async () => {
    const { hass, calls } = house(LIVING, ANDROID);
    const root = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', volume_entity: 'media_player.receiver' },
      hass,
    );
    await press(root, 'OK');
    await press(root, 'Home');
    await press(root, 'Turn off');
    await press(root, 'Mute');
    expect(calls.map((c) => c.service)).toEqual([
      'remote.send_command',
      'remote.send_command',
      'media_player.turn_off',
      'media_player.volume_mute',
    ]);
    expect(calls[0]!.data).toEqual({ command: 'DPAD_CENTER' });
    expect(calls[0]!.target).toEqual({ entity_id: 'remote.tv' });
    expect(calls[1]!.data).toEqual({ command: 'HOME' });
    expect(calls[3]!.target).toEqual({ entity_id: 'media_player.receiver' });
    // an app opens its source on the player
    root.querySelector<HTMLButtonElement>('.rm-app__circle')!.click();
    expect(calls.at(-1)).toMatchObject({
      service: 'media_player.select_source',
      data: { source: 'Netflix' },
    });
  });

  it('a webOS television takes its buttons on the player itself; a command of the config’s wins over the table', async () => {
    const { hass, calls } = house(LIVING, ANDROID);
    const root = await draw({ entity: 'media_player.lg', commands: { back: 'EXIT' } }, hass);
    await press(root, 'OK');
    await press(root, 'Back');
    expect(calls.map((c) => `${c.service}:${c.data['button']}`)).toEqual([
      'webostv.button:ENTER',
      'webostv.button:EXIT',
    ]);
    expect(calls[0]!.target).toEqual({ entity_id: 'media_player.lg' });
  });

  it('a television that is off: the power round on the primary fill, every key alive, or power alone', async () => {
    const { hass, calls } = house(LIVING, { 'remote.tv_off': 'samsungtv' });
    const live = await draw({ entity: 'media_player.tv_off', remote: 'remote.tv_off' }, hass);
    expect(
      live.querySelector('[aria-label="Turn on"]')?.classList.contains('fv-round--accent'),
    ).toBe(true);
    expect(live.querySelector<HTMLButtonElement>('[aria-label="Home"]')?.disabled).toBe(false);
    await press(live, 'Home');
    expect(calls.at(-1)).toMatchObject({
      service: 'remote.send_command',
      data: { command: 'KEY_HOME' },
    });
    await press(live, 'Turn on');
    expect(calls.at(-1)?.service).toBe('media_player.turn_on');
    document.body.replaceChildren();
    const power = await draw(
      { entity: 'media_player.tv_off', remote: 'remote.tv_off', off_keys: 'power' },
      hass,
    );
    expect(power.querySelector<HTMLButtonElement>('[aria-label="Home"]')?.disabled).toBe(true);
    expect(power.querySelector<HTMLButtonElement>('[aria-label="Turn on"]')?.disabled).toBe(false);
  });

  it('out of reach it keeps its anatomy in the dashed skin and answers nothing', async () => {
    const { hass, calls } = house(LIVING, { 'remote.gone': 'androidtv_remote' });
    const root = await draw(
      {
        entity: 'media_player.gone',
        remote: 'remote.gone',
        volume_entity: 'media_player.receiver',
      },
      hass,
    );
    expect(root.querySelector('.fv-card')?.classList.contains('is-off')).toBe(true);
    expect(root.querySelectorAll('.rm-arrow').length).toBe(4);
    expect(root.querySelector('fluvy-ruler')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.rm-ok')!.click();
    expect(calls).toEqual([]);
  });

  it('the compact row, the pad and the row: their keys, and the row’s rounds', async () => {
    const { hass } = house(LIVING, ANDROID);
    const compact = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'compact' },
      hass,
    );
    expect(
      [...compact.querySelectorAll('.rm-cells .fv-action')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Back', 'Home', 'Play or pause', 'Volume down', 'Volume up']);
    document.body.replaceChildren();
    const pad = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'pad' },
      hass,
    );
    expect(pad.querySelectorAll('.rm-ring').length).toBe(1);
    expect(pad.querySelector('.rm-transport')).toBeNull();
    document.body.replaceChildren();
    const row = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'row' },
      hass,
    );
    expect(
      [...row.querySelectorAll('.rm-row__rounds .fv-round')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Back', 'Home', 'Turn off']);
  });

  describe('the editor', () => {
    const shown = async (config: Record<string, unknown>): Promise<string[]> => {
      const editor = await FluvyRemoteCard.getConfigElement();
      const drawn = await drawEditor(editor, {
        ...config,
        type: 'custom:fluvy-remote-card',
      } as LovelaceCardConfig);
      return shownNames(cardForm(drawn).schema);
    };

    it('the full card offers its groups, its pad, its volume and its apps; the compact its keys, the row its rounds', async () => {
      const full = await shown({ entity: 'media_player.tv' });
      for (const name of [
        'groups',
        'dpad',
        'ok_label',
        'side_keys',
        'nav',
        'transport',
        'volume',
        'apps_style',
        'apps_tint',
        'off_keys',
        'commands',
      ])
        expect(full, name).toContain(name);
      expect(full).not.toContain('keys');
      const compact = await shown({ entity: 'media_player.tv', variant: 'compact' });
      expect(compact).toContain('keys');
      expect(compact).not.toContain('dpad');
      const row = await shown({ entity: 'media_player.tv', variant: 'row' });
      expect(row).toContain('controls');
      // the keys round a grid are no "sides": the field goes
      const grid = await shown({ entity: 'media_player.tv', dpad: 'grid' });
      expect(grid).not.toContain('side_keys');
    });

    it('lists the apps and the custom keys while their groups are drawn', async () => {
      const editor = await FluvyRemoteCard.getConfigElement();
      const drawn = await drawEditor(editor, {
        type: 'custom:fluvy-remote-card',
        entity: 'media_player.tv',
        groups: ['dpad', 'apps', 'custom'],
      });
      expect(listTitles(drawn)).toEqual(['Apps', 'Custom keys']);
      const padOnly = await drawEditor(await FluvyRemoteCard.getConfigElement(), {
        type: 'custom:fluvy-remote-card',
        entity: 'media_player.tv',
        groups: ['dpad'],
      });
      expect(listTitles(padOnly)).toEqual([]);
    });
  });
  it('draws a picture of the person’s own in place of the logo, and the logo again where it will not load', async () => {
    const { hass } = house(LIVING, ANDROID);
    const root = await draw(
      {
        entity: 'media_player.tv',
        remote: 'remote.tv',
        groups: ['apps'],
        apps: [{ app: 'disneyplus', image: '/local/disney.svg' }, { app: 'netflix' }],
      },
      hass,
    );
    const circles = root.querySelectorAll('.rm-app__circle');
    const picture = circles[0]?.querySelector('img');
    expect(picture?.getAttribute('src')).toBe('/local/disney.svg');
    expect(circles[1]?.querySelector('img')).toBeNull();
    picture?.dispatchEvent(new Event('error'));
    await (root.host as FluvyRemoteCard).updateComplete;
    expect(root.querySelector('.rm-app__circle img')).toBeNull();
  });

  it('leaves no app alone on the last row: the same rows, shared evenly', () => {
    const names = (count: number): string[] => Array.from({ length: count }, () => 'Abc');
    expect(appsLayout(names(5), 300, () => 20).perRow).toBe(5);
    expect(appsLayout(names(6), 300, () => 20).perRow).toBe(3);
    expect(appsLayout(names(7), 300, () => 20).perRow).toBe(4);
    expect(appsLayout(names(10), 300, () => 20).perRow).toBe(5);
    // the rows, and so the height, are what five a row would have taken
    expect(
      appsBlock(
        6,
        appsLayout(names(6), 300, () => 20),
      ),
    ).toBe(appsBlock(6, { perRow: 5, names: true }));
  });

  describe('the apps on Android TV Remote', () => {
    /** Every app of the row tapped in turn: what each sent, as `service activity → target`. */
    const tapAll = async (root: ShadowRoot, calls: readonly Call[]): Promise<string[]> => {
      for (const circle of root.querySelectorAll<HTMLButtonElement>('.rm-app__circle'))
        circle.click();
      await new Promise((resolve) => setTimeout(resolve));
      return calls.map(
        (c) =>
          `${c.service} ${String(c.data['activity'] ?? c.data['source'])} → ${c.target?.entity_id}`,
      );
    };

    it('opens an app by its platform’s deep link, else by its package; a person’s own activity wins over both', async () => {
      const { hass, calls } = house(SET_TOP, SET_TOPS);
      const root = await draw(
        {
          entity: 'media_player.atv',
          remote: 'remote.atv',
          groups: ['apps'],
          apps: [
            { app: 'netflix' },
            { app: 'youtube' },
            { app: 'disneyplus' },
            { app: 'primevideo' },
            { app: 'appletv' },
            { app: 'dazn' },
            // no source confirms a deep link for Kodi: its package, as Home Assistant's page gives it
            { app: 'kodi' },
            {
              app: 'netflix',
              name: 'Wednesday',
              activity: 'https://www.netflix.com/title/81231974?source=30',
            },
            { app: 'jellyfin', activity: 'org.jellyfin.androidtv' },
            // an activity with a space in it is no activity: the platform's own goes
            { app: 'plex', activity: 'plex:// home' },
          ],
        },
        hass,
      );
      expect(await tapAll(root, calls)).toEqual([
        'remote.turn_on netflix:// → remote.atv',
        'remote.turn_on https://www.youtube.com → remote.atv',
        'remote.turn_on https://www.disneyplus.com → remote.atv',
        'remote.turn_on https://app.primevideo.com → remote.atv',
        'remote.turn_on https://tv.apple.com → remote.atv',
        'remote.turn_on https://open.dazn.com/ → remote.atv',
        'remote.turn_on org.xbmc.kodi → remote.atv',
        'remote.turn_on https://www.netflix.com/title/81231974?source=30 → remote.atv',
        'remote.turn_on org.jellyfin.androidtv → remote.atv',
        'remote.turn_on plex:// → remote.atv',
      ]);
      // the app running is read by its package, never by its link
      expect(root.querySelector('.rm-app.is-active .rm-app__name')?.textContent).toBe('Disney+');
    });

    it('a source the player lists still wins; the platform’s link where it lists none', async () => {
      const { hass, calls } = house(LIVING, ANDROID);
      const root = await draw(
        {
          entity: 'media_player.tv',
          remote: 'remote.tv',
          groups: ['apps'],
          apps: [{ app: 'netflix' }, { app: 'dazn' }],
        },
        hass,
      );
      expect(await tapAll(root, calls)).toEqual([
        'media_player.select_source Netflix → media_player.tv',
        'remote.turn_on https://open.dazn.com/ → remote.tv',
      ]);
    });

    it('a remote alone: its current activity lights the app it runs, a tap opens another by its link', async () => {
      const { hass, calls } = house(SET_TOP, SET_TOPS);
      const root = await draw(
        {
          remote: 'remote.atv',
          groups: ['apps'],
          apps: [{ app: 'netflix' }, { app: 'disneyplus' }],
        },
        hass,
      );
      expect(root.querySelector('.rm-app.is-active .rm-app__name')?.textContent).toBe('Disney+');
      root.querySelector<HTMLButtonElement>('.rm-app__circle')!.click();
      expect(calls.at(-1)).toMatchObject({
        service: 'remote.turn_on',
        data: { activity: 'netflix://' },
        target: { entity_id: 'remote.atv' },
      });
    });

    it('no other integration is sent an activity: on an Apple TV an app with no source rests', async () => {
      const { hass, calls } = house(SET_TOP, SET_TOPS);
      const root = await draw(
        {
          entity: 'media_player.box',
          remote: 'remote.box',
          groups: ['apps'],
          apps: [{ app: 'netflix' }, { app: 'dazn', activity: 'https://open.dazn.com/' }],
        },
        hass,
      );
      const circles = [...root.querySelectorAll<HTMLButtonElement>('.rm-app__circle')];
      expect(circles.map((circle) => circle.disabled)).toEqual([true, true]);
      expect(await tapAll(root, calls)).toEqual([]);
    });

    it('a remote the registry does not name is sent no activity: Harmony’s would take it for its own', async () => {
      // the house's states as Android TV Remote draws them, its registry naming neither entity
      const { hass, calls } = house(SET_TOP);
      const root = await draw(
        {
          entity: 'media_player.atv',
          remote: 'remote.atv',
          groups: ['apps'],
          apps: [{ app: 'netflix' }, { app: 'jellyfin', activity: 'org.jellyfin.androidtv' }],
        },
        hass,
      );
      const circles = [...root.querySelectorAll<HTMLButtonElement>('.rm-app__circle')];
      expect(circles.map((circle) => circle.disabled)).toEqual([true, true]);
      expect(await tapAll(root, calls)).toEqual([]);
    });

    it('the editor asks for an app’s activity only where the card names a remote to send it to', async () => {
      const itemFields = async (config: Record<string, unknown>): Promise<string[]> => {
        const drawn = await drawEditor(await FluvyRemoteCard.getConfigElement(), {
          ...config,
          type: 'custom:fluvy-remote-card',
          groups: ['apps'],
          apps: [{ app: 'netflix' }],
        } as LovelaceCardConfig);
        const form = drawn.shadowRoot!.querySelector<FormStub>('.item ha-form')!;
        return shownNames(form.schema);
      };
      expect(await itemFields({ entity: 'media_player.atv', remote: 'remote.atv' })).toContain(
        'activity',
      );
      expect(await itemFields({ entity: 'media_player.atv' })).not.toContain('activity');
    });

    /** Every word the card shows or speaks: its text, and its labels and titles. */
    const words = (root: ShadowRoot): string =>
      [
        root.textContent ?? '',
        ...[...root.querySelectorAll('[aria-label], [title]')].flatMap((el) => [
          el.getAttribute('aria-label') ?? '',
          el.getAttribute('title') ?? '',
        ]),
      ].join(' ');

    /** The owner's television as Android TV Remote reports it, its integration naming no app: the package is the name. */
    const owners = (app: string): Seed[] => [
      [
        'media_player.owner',
        'on',
        {
          friendly_name: 'Salón TV',
          device_class: 'tv',
          app_id: app,
          app_name: app,
          volume_level: 0.12,
          is_volume_muted: false,
          supported_features: ATV,
        },
      ],
      [
        'remote.owner',
        'on',
        { friendly_name: 'Salón TV', current_activity: app, activity_list: [] },
      ],
    ];
    const OWNERS = { 'media_player.owner': 'androidtv_remote', 'remote.owner': 'androidtv_remote' };
    const APPS = ['netflix', 'youtube', 'disneyplus', 'primevideo', 'appletv', 'dazn'].map(
      (app) => ({ app }),
    );

    it('says the app a television runs by its platform’s name, never its package, in every shape', async () => {
      const { hass } = house(owners('com.amazon.amazonvideo.livingroom'), OWNERS);
      for (const variant of ['full', 'compact', 'row'] as const) {
        const root = await draw(
          { entity: 'media_player.owner', remote: 'remote.owner', variant, apps: APPS },
          hass,
        );
        expect(root.querySelector('.fv-card__sub')?.textContent?.trim(), variant).toBe(
          'Prime Video',
        );
        expect(words(root), variant).not.toContain('com.');
        if (variant === 'full')
          expect(
            root.querySelector('.rm-app.is-active .rm-app__circle')?.getAttribute('aria-label'),
          ).toBe('Open Prime Video');
        document.body.replaceChildren();
      }
    });

    it('a package no platform knows is not said: the line says the state, as with no app', async () => {
      const { hass } = house(owners('com.example.launcher'), OWNERS);
      const root = await draw(
        { entity: 'media_player.owner', remote: 'remote.owner', apps: APPS },
        hass,
      );
      expect(root.querySelector('.fv-card__sub')?.textContent?.trim()).toBe('On');
      expect(words(root)).not.toContain('com.');
      expect(root.querySelector('.rm-app.is-active')).toBeNull();
    });

    it('a name the integration gives stays as it is', async () => {
      const seeds = owners('com.amazon.amazonvideo.livingroom');
      const named: Seed[] = [
        [seeds[0]![0], seeds[0]![1], { ...seeds[0]![2], app_name: 'Amazon Prime' }],
        seeds[1]!,
      ];
      const { hass } = house(named, OWNERS);
      const root = await draw({ entity: 'media_player.owner', remote: 'remote.owner' }, hass);
      expect(root.querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Amazon Prime');
    });

    it('the sources a player lists by package: a chip by its platform’s name, an unknown one left out, the house counting the same', async () => {
      const box = (sources: readonly string[]): Seed[] => [
        [
          'media_player.box',
          'on',
          {
            friendly_name: 'Fire TV',
            app_id: 'com.example.box',
            app_name: 'com.example.box',
            source: 'com.example.box',
            source_list: sources,
            supported_features: 2048 | 128 | 256,
          },
        ],
      ];
      const packages = ['HDMI 1', 'com.netflix.ninja', 'com.example.box'];
      const { hass, calls } = house(box(packages), { 'media_player.box': 'androidtv' });
      const root = await draw({ entity: 'media_player.box', groups: ['source'] }, hass);
      const chips = [...root.querySelectorAll('.fv-chip__pill')].map((c) => c.textContent?.trim());
      expect(chips).toEqual(['HDMI 1', 'Netflix']);
      expect(words(root)).not.toContain('com.');
      root.querySelectorAll<HTMLElement>('.fv-chip')[1]!.click();
      expect(calls.at(-1)).toMatchObject({
        service: 'media_player.select_source',
        data: { source: 'com.netflix.ninja' },
      });
      document.body.replaceChildren();
      // with the apps row drawn, Netflix is its circle and the chips keep the input alone
      const both = await draw({ entity: 'media_player.box', groups: ['source', 'apps'] }, hass);
      expect(
        [...both.querySelectorAll('.fv-chip__pill')].map((c) => c.textContent?.trim()),
      ).toEqual(['HDMI 1']);
      expect([...both.querySelectorAll('.rm-app__name')].map((n) => n.textContent)).toEqual([
        'Netflix',
      ]);
      // the automatic dashboard plans the chips the card draws: the same height as a player listing their words
      const config = {
        type: 'custom:fluvy-remote-card',
        entity: 'media_player.box',
        groups: ['source'],
      };
      const said = house(box(['HDMI 1', 'Netflix']), { 'media_player.box': 'androidtv' });
      expect(houseHeightOf(config, -1, hass)).toBe(houseHeightOf(config, -1, said.hass));
    });
  });
});
