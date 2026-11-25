import { FluvyRemoteCard } from '../../../../packages/cards/src/remote/remote-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the remote sheet does
if (!customElements.get('fluvy-remote-card'))
  customElements.define('fluvy-remote-card', FluvyRemoteCard);

const REMOTE = 'custom:fluvy-remote-card';

/* media_player supported_features of the Xbox's player (python-xbox): no source and no level, an app by `play_media` */
const PAUSE = 1;
const VOLUME_MUTE = 8;
const PREVIOUS = 16;
const NEXT = 32;
const TURN_ON = 128;
const TURN_OFF = 256;
const PLAY_MEDIA = 512;
const VOLUME_STEP = 1024;
const PLAY = 16384;
const BROWSE_MEDIA = 131072;
const XBOX =
  PAUSE | VOLUME_MUTE | TURN_ON | TURN_OFF | PLAY_MEDIA | VOLUME_STEP | PLAY | BROWSE_MEDIA;

/** An Xbox's player as Home Assistant's integration draws it: the app it runs by its store id and its title. */
const xbox = (name: string, extra: Record<string, unknown> = {}) => ({
  friendly_name: name,
  is_volume_muted: false,
  supported_features: XBOX,
  ...extra,
});

const entry = (entity: string, area = 'rx_living') =>
  [entity, { entity_id: entity, area_id: area, platform: 'xbox' }] as const;

/** The reporter's five apps (#255), opened by their store ids, their names left to their labels. */
const FIVE = [
  { app: 'netflix' },
  { app: 'appletv' },
  { app: 'disneyplus' },
  { app: 'jellyfin' },
  { app: 'plutotv' },
];

/** The controller's card: the apps, the pad round A, the face buttons with View, Xbox and Menu, the playback. */
const controller = (extra: Record<string, unknown> = {}) => ({
  type: REMOTE,
  entity: 'media_player.rx_xbox',
  remote: 'remote.rx_xbox',
  groups: ['apps', 'dpad', 'gamepad', 'transport'],
  nav: ['back', 'guide', 'mute', 'home'],
  transport: ['previous', 'play_pause', 'next'],
  apps: FIVE,
  apps_names: false,
  apps_tint: 'always',
  ...extra,
});

/**
 * An Xbox on the TV remote card (#255): its remote with no commands of the config's sends the console's own (the
 * arrows, A for OK, B for back, GoHome, Menu), a key the console has none for drawn disabled; the controller's face
 * buttons in their diamond in the console's colours (and plain), View, the Xbox button and Menu beside them or in a
 * row under them in a narrow column; the reporter's five apps opened by their store ids, their names hidden, the one
 * running lit by its id; a key wearing the person's icon; off and out of reach.
 */
export const sheet: SheetSpec = {
  states: [
    [
      'media_player.rx_xbox',
      'playing',
      xbox('Living room Xbox', {
        media_content_type: 'app',
        media_content_id: '9WZDNCRFJ3TJ',
        media_title: 'Netflix',
        supported_features: XBOX | PREVIOUS | NEXT,
      }),
    ],
    ['remote.rx_xbox', 'on', { friendly_name: 'Living room Xbox' }],
    ['media_player.rx_xbox_off', 'off', xbox('Games room Xbox')],
    ['remote.rx_xbox_off', 'off', { friendly_name: 'Games room Xbox' }],
    [
      'media_player.rx_xbox_gone',
      'unavailable',
      { friendly_name: 'Games room Xbox', supported_features: XBOX },
    ],
    ['remote.rx_xbox_gone', 'unavailable', { friendly_name: 'Games room Xbox' }],
  ],
  registry: {
    areas: {
      rx_living: { area_id: 'rx_living', name: 'Living room' },
      rx_games: { area_id: 'rx_games', name: 'Games room' },
    },
    entities: Object.fromEntries([
      entry('media_player.rx_xbox'),
      entry('remote.rx_xbox'),
      entry('media_player.rx_xbox_off', 'rx_games'),
      entry('remote.rx_xbox_off', 'rx_games'),
      entry('media_player.rx_xbox_gone', 'rx_games'),
      entry('remote.rx_xbox_gone', 'rx_games'),
    ]),
  },
  frames: [
    // the default groups: the console's own commands, Subtitles, Rewind and Fast forward disabled
    {
      title: 'Xbox',
      heights: [211, 266],
      cards: [{ type: REMOTE, entity: 'media_player.rx_xbox', remote: 'remote.rx_xbox' }],
    },
    {
      title: 'Xbox · controller',
      heights: [211, 266],
      cards: [controller()],
    },
    {
      title: 'Xbox · controller 211',
      width: 211,
      cards: [controller()],
    },
    {
      title: 'Xbox · face buttons',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rx_xbox',
          remote: 'remote.rx_xbox',
          groups: ['gamepad'],
        },
      ],
    },
    {
      title: 'Xbox · face buttons plain',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rx_xbox',
          remote: 'remote.rx_xbox',
          groups: ['gamepad'],
          gamepad_tint: 'plain',
        },
      ],
    },
    {
      title: 'Xbox · face buttons, two keys',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rx_xbox',
          remote: 'remote.rx_xbox',
          groups: ['gamepad'],
          gamepad_keys: ['view', 'menu'],
        },
      ],
    },
    // the apps with their names, the running one lit by its store id
    {
      title: 'Xbox · apps',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rx_xbox',
          remote: 'remote.rx_xbox',
          groups: ['apps'],
          apps: [...FIVE, { app: 'youtube' }],
        },
      ],
    },
    // the person's icons: the Xbox button on a compact row, the assistant wearing the console's mark
    {
      title: 'Xbox · own icons',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rx_xbox',
          remote: 'remote.rx_xbox',
          variant: 'compact',
          keys: ['back', 'nexus', 'a', 'b', 'assistant'],
          icons: { assistant: 'mdi:microsoft-xbox-controller' },
          commands: { assistant: 'Nexus' },
        },
      ],
    },
    {
      title: 'Xbox · off',
      cards: [controller({ entity: 'media_player.rx_xbox_off', remote: 'remote.rx_xbox_off' })],
    },
    {
      title: 'Xbox · out of reach',
      cards: [controller({ entity: 'media_player.rx_xbox_gone', remote: 'remote.rx_xbox_gone' })],
    },
  ],
};
