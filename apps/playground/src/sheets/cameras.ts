import { FluvyCamerasCard } from '../../../../packages/cards/src/camera/cameras-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-cameras-card'))
  customElements.define('fluvy-cameras-card', FluvyCamerasCard);

/** A still that needs no network: a night scene drawn as an SVG data URI, 16:9. */
const still = (body: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">${body}</svg>`,
  )}`;

/** The mockup's four pictures (#60): the driveway, the garden, the terrace and the garage, at night. */
const DRIVEWAY = still(`
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11140f"/><stop offset="1" stop-color="#2a2a22"/></linearGradient>
    <radialGradient id="l" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff1c8" stop-opacity="0.9"/><stop offset="1" stop-color="#fff1c8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#s)"/>
  <path d="M0 120 Q200 90 400 110 L640 100 L640 360 L0 360 Z" fill="#3b3a31"/>
  <path d="M120 360 Q260 200 520 150 L640 160 L640 360 Z" fill="#6d6657"/>
  <circle cx="200" cy="170" r="90" fill="url(#l)"/>
  <rect x="330" y="80" width="120" height="110" rx="6" fill="#d9d2c0"/>
  <rect x="352" y="104" width="22" height="40" rx="3" fill="#6b655a"/>
  <rect x="300" y="92" width="26" height="110" fill="#2b2a24"/>
  <path d="M170 360 L300 150" stroke="#1d1c18" stroke-width="10"/>
  <g stroke="#1d1c18" stroke-width="4"><path d="M190 330 L310 150"/><path d="M215 330 L322 155"/><path d="M240 330 L330 160"/></g>
  <circle cx="200" cy="170" r="6" fill="#fff6dc"/>`);

const GARDEN = still(`
  <defs>
    <radialGradient id="t" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5e6b0" stop-opacity="0.95"/><stop offset="1" stop-color="#f5e6b0" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="360" fill="#0f1612"/>
  <path d="M0 150 Q320 110 640 150 L640 360 L0 360 Z" fill="#2f5a2c"/>
  <circle cx="300" cy="110" r="110" fill="url(#t)"/>
  <rect x="294" y="150" width="12" height="80" fill="#4a3a26"/>
  <path d="M380 360 L470 190 L640 200 L640 360 Z" fill="#8a8170"/>
  <rect x="450" y="250" width="140" height="44" rx="4" fill="#3a2f24"/>
  <path d="M520 110 L560 200 L480 200 Z" fill="#e8e1d2"/>
  <rect x="518" y="200" width="4" height="60" fill="#d8d0c0"/>
  <g fill="#ffe9a8"><circle cx="120" cy="260" r="5"/><circle cx="210" cy="300" r="5"/><circle cx="400" cy="230" r="5"/></g>`);

const TERRACE = still(`
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f3a33"/><stop offset="1" stop-color="#6e655a"/></linearGradient>
  </defs>
  <rect width="640" height="360" fill="#101512"/>
  <rect x="0" y="40" width="300" height="240" fill="url(#w)"/>
  <rect x="40" y="90" width="200" height="190" fill="#c9a96a"/>
  <g stroke="#3f3a33" stroke-width="6"><path d="M106 90 V280"/><path d="M172 90 V280"/></g>
  <path d="M300 220 Q480 180 640 200 L640 360 L300 360 Z" fill="#2c5228"/>
  <path d="M0 280 L380 260 L460 360 L0 360 Z" fill="#7d7466"/>
  <rect x="250" y="220" width="160" height="50" rx="10" fill="#b8ad9b"/>
  <rect x="270" y="200" width="120" height="26" rx="8" fill="#a39886"/>
  <rect x="180" y="250" width="70" height="30" rx="4" fill="#2e2a25"/>
  <circle cx="60" cy="300" r="34" fill="#3e6b2f"/>
  <circle cx="470" cy="200" r="40" fill="#35602c"/>`);

const GARAGE = still(`
  <rect width="640" height="360" fill="#14181c"/>
  <rect x="60" y="40" width="580" height="240" fill="#dedad2"/>
  <rect x="60" y="30" width="580" height="16" fill="#9e998f"/>
  <rect x="190" y="90" width="360" height="190" rx="2" fill="#3a3d42"/>
  <g stroke="#2c2f33" stroke-width="3"><path d="M190 128 H550"/><path d="M190 166 H550"/><path d="M190 204 H550"/><path d="M190 242 H550"/></g>
  <g fill="#fff3d0"><rect x="140" y="110" width="12" height="22" rx="3"/><rect x="590" y="110" width="12" height="22" rx="3"/></g>
  <path d="M0 280 H640 V360 H0 Z" fill="#8f8a80"/>
  <g stroke="#7a756c" stroke-width="2"><path d="M0 310 H640"/><path d="M0 340 H640"/><path d="M160 280 L120 360"/><path d="M320 280 L320 360"/><path d="M480 280 L520 360"/></g>
  <path d="M0 220 Q60 200 90 240 L90 300 L0 300 Z" fill="#1d1f22"/>`);

const camera = (id: string, name: string, picture: string, extra: Record<string, unknown> = {}) =>
  [
    id,
    'idle',
    { friendly_name: name, entity_picture: picture, supported_features: 2, ...extra },
  ] as StateSeed;

/** A camera's device, its motion sensor on it: what the card reads a camera's line from. */
const onDevice = (id: string, device: string, area: string) => [
  id,
  { entity_id: id, device_id: device, area_id: area, labels: [] },
];
const device = (id: string, name: string, area: string) => [
  id,
  {
    id,
    name,
    name_by_user: null,
    model: 'Doorbell Pro',
    manufacturer: '',
    area_id: area,
    labels: [],
    via_device_id: null,
  },
];

/** The four as the mockup names and pictures them. */
const MOCKUP = [
  { entity: 'camera.cm_driveway', name: 'Einfahrt', icon: 'mdi:fence' },
  { entity: 'camera.cm_garden', name: 'Garten', icon: 'mdi:sprout' },
  { entity: 'camera.cm_terrace', name: 'Terrasse', icon: 'mdi:umbrella-outline' },
  { entity: 'camera.cm_garage', name: 'Garage', icon: 'mdi:garage' },
];
const FOUR = ['camera.cm_driveway', 'camera.cm_garden', 'camera.cm_terrace', 'camera.cm_garage'];
const card = (extra: Record<string, unknown>) => ({ type: 'custom:fluvy-cameras-card', ...extra });

export const sheet: SheetSpec = {
  states: [
    camera('camera.cm_driveway', 'Driveway', DRIVEWAY),
    camera('camera.cm_garden', 'Garden', GARDEN),
    camera('camera.cm_terrace', 'Terrace', TERRACE),
    camera('camera.cm_garage', 'Garage', GARAGE, { brand: 'Reolink' }),
    camera('camera.cm_porch', 'Front porch', DRIVEWAY),
    ['camera.cm_shed', 'recording', { friendly_name: 'Shed', entity_picture: GARDEN }],
    ['camera.cm_back', 'unavailable', { friendly_name: 'Back gate' }],
    // a camera whose stream never plays (the playground's stream marks it): stills again, tried again later
    camera('camera.cm_side', 'Side path', TERRACE, { pg_stream: 'fails' }),
    // a picture that never arrives: the camera is there, its image is not
    [
      'camera.cm_cellar',
      'idle',
      { friendly_name: 'Cellar', entity_picture: 'data:image/png;base64,iVBORw0KAAAA' },
    ],
    [
      'binary_sensor.cm_driveway_motion',
      'on',
      { friendly_name: 'Driveway motion', device_class: 'motion' },
    ],
    [
      'binary_sensor.cm_garden_person',
      'off',
      { friendly_name: 'Garden person', device_class: 'occupancy' },
    ],
  ],
  registry: {
    entities: Object.fromEntries([
      onDevice('camera.cm_driveway', 'cm-d-driveway', 'cm_front'),
      onDevice('binary_sensor.cm_driveway_motion', 'cm-d-driveway', 'cm_front'),
      onDevice('camera.cm_garden', 'cm-d-garden', 'cm_garden'),
      onDevice('binary_sensor.cm_garden_person', 'cm-d-garden', 'cm_garden'),
      onDevice('camera.cm_terrace', 'cm-d-terrace', 'cm_garden'),
      onDevice('camera.cm_garage', 'cm-d-garage', 'cm_front'),
      onDevice('camera.cm_porch', 'cm-d-porch', 'cm_front'),
    ]),
    devices: Object.fromEntries([
      device('cm-d-driveway', 'Driveway camera', 'cm_front'),
      device('cm-d-garden', 'Garden camera', 'cm_garden'),
      device('cm-d-terrace', 'Terrace camera', 'cm_garden'),
      device('cm-d-garage', 'Garage camera', 'cm_front'),
      device('cm-d-porch', 'Porch camera', 'cm_front'),
    ]),
    areas: {
      cm_front: { area_id: 'cm_front', name: 'Front of house', icon: 'mdi:fence' },
      cm_garden: { area_id: 'cm_garden', name: 'Garden', icon: 'mdi:sprout' },
    },
  },
  frames: [
    // the mockup (#60), as it is drawn: four cameras two a row, a motion sensor on two of them
    { title: 'Cameras · the mockup', cards: [card({ cameras: MOCKUP, columns: 2 })] },
    // half a section: each camera a row, the picture across it
    {
      title: 'Cameras · half a section',
      cards: [
        card({ cameras: FOUR.slice(0, 2), cols: 6 }),
        card({ cameras: FOUR.slice(2), cols: 6, variant: 'compact' }),
      ],
    },
    { title: 'Cameras · one', cards: [card({ cameras: ['camera.cm_driveway'] })] },
    {
      title: 'Cameras · three',
      cards: [card({ cameras: FOUR.slice(0, 3), title: 'Outside' })],
    },
    {
      title: 'Cameras · five, one recording',
      cards: [card({ cameras: [...FOUR, 'camera.cm_shed'] })],
    },
    // two pictures stream, the other two keep to stills
    {
      title: 'Cameras · live, two at once',
      cards: [card({ cameras: FOUR, camera_view: 'live', max_live: 2 })],
    },
    {
      title: 'Cameras · out of reach',
      cards: [
        card({
          cameras: ['camera.cm_driveway', 'camera.cm_back', 'camera.cm_cellar', 'camera.cm_garage'],
        }),
      ],
    },
    {
      title: 'Cameras · a stream that fails',
      cards: [card({ cameras: ['camera.cm_side', 'camera.cm_garden'], camera_view: 'live' })],
    },
    {
      title: 'Cameras · list',
      cards: [
        card({
          cameras: [...MOCKUP, 'camera.cm_back'],
          variant: 'list',
          subtitle: 'Around the house',
        }),
      ],
    },
    {
      title: 'Cameras · compact',
      cards: [
        card({ cameras: [...FOUR, 'camera.cm_shed', 'camera.cm_porch'], variant: 'compact' }),
      ],
    },
    // no list: the area's cameras
    {
      title: 'Cameras · an area',
      cards: [card({ area: 'cm_front', title: 'Front of house', status: 'state' })],
    },
    {
      title: 'Cameras · lines hidden, no live',
      cards: [
        card({ cameras: FOUR, show_status: false, show_live: false, show_fullscreen: false }),
      ],
    },
    { title: 'Cameras · empty', cards: [card({ cameras: [] })] },
    // the head's round opens it: every camera, and the switch that shows them all live (docked, at the sheet's 392)
    {
      title: 'Cameras · sheet',
      width: 392,
      cards: [card({ cameras: [...MOCKUP, 'camera.cm_back'], _sheet: true })],
    },
  ],
};
