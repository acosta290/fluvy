import { FluvyMapCard } from '../../../../packages/cards/src/map/map-card.js';
import { FluvyRoomCard } from '../../../../packages/cards/src/room/room-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-room-card')) customElements.define('fluvy-room-card', FluvyRoomCard);
if (!customElements.get('fluvy-map-card')) customElements.define('fluvy-map-card', FluvyMapCard);

/** A drawing stands in for the living room's photo: the playground fetches nothing. */
const PHOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c7a8"/><stop offset="1" stop-color="#8c6f4e"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><rect x="40" y="110" width="150" height="50" rx="10" fill="#5b4632"/><circle cx="250" cy="70" r="30" fill="#f3e6c8" opacity="0.8"/></svg>',
)}`;

const room = (config: Record<string, unknown>) => ({ type: 'custom:fluvy-room-card', ...config });

export const sheet: SheetSpec = {
  states: [
    [
      'light.rm_ceiling',
      'on',
      { friendly_name: 'Ceiling', brightness: 178, supported_color_modes: ['brightness'] },
    ],
    [
      'light.rm_reading',
      'off',
      { friendly_name: 'Reading lamp', supported_color_modes: ['brightness'] },
    ],
    ['light.rm_shelf', 'on', { friendly_name: 'Shelf', supported_color_modes: ['onoff'] }],
    ['switch.rm_tv_plug', 'on', { friendly_name: 'TV plug', device_class: 'outlet' }],
    [
      'cover.rm_blinds',
      'open',
      { friendly_name: 'Blinds', current_position: 40, supported_features: 15 },
    ],
    ['media_player.rm_tv', 'off', { friendly_name: 'Living room TV' }],
    [
      'climate.rm_living',
      'heat',
      {
        friendly_name: 'Living room',
        temperature: 21.5,
        current_temperature: 21.4,
        hvac_action: 'heating',
        hvac_modes: ['heat', 'off'],
      },
    ],
    [
      'sensor.rm_living_temperature',
      '21.4',
      {
        friendly_name: 'Living room temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      },
    ],
    [
      'sensor.rm_living_humidity',
      '46',
      { friendly_name: 'Living room humidity', device_class: 'humidity', unit_of_measurement: '%' },
    ],
    ['sensor.rm_dead', 'unavailable', { friendly_name: 'Loft sensor' }],
    ['light.rm_kitchen', 'off', { friendly_name: 'Kitchen', supported_color_modes: ['onoff'] }],
    ['switch.rm_kettle', 'off', { friendly_name: 'Kettle', device_class: 'outlet' }],
    [
      'sensor.rm_kitchen_temperature',
      '22.8',
      {
        friendly_name: 'Kitchen temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      },
    ],
    [
      'light.rm_bedroom',
      'off',
      { friendly_name: 'Bedroom', supported_color_modes: ['brightness'] },
    ],
    [
      'fan.rm_bedroom',
      'on',
      { friendly_name: 'Bedroom fan', percentage: 40, supported_features: 1 },
    ],
  ],
  registry: {
    entities: {
      'light.rm_ceiling': { entity_id: 'light.rm_ceiling', area_id: 'rm_living' },
      'light.rm_reading': { entity_id: 'light.rm_reading', area_id: 'rm_living' },
      'light.rm_shelf': { entity_id: 'light.rm_shelf', area_id: 'rm_living' },
      'switch.rm_tv_plug': { entity_id: 'switch.rm_tv_plug', area_id: 'rm_living' },
      'cover.rm_blinds': { entity_id: 'cover.rm_blinds', area_id: 'rm_living' },
      'media_player.rm_tv': { entity_id: 'media_player.rm_tv', area_id: 'rm_living' },
      'climate.rm_living': { entity_id: 'climate.rm_living', area_id: 'rm_living' },
      'sensor.rm_living_temperature': {
        entity_id: 'sensor.rm_living_temperature',
        area_id: 'rm_living',
      },
      'sensor.rm_living_humidity': { entity_id: 'sensor.rm_living_humidity', area_id: 'rm_living' },
      'sensor.rm_dead': { entity_id: 'sensor.rm_dead', area_id: 'rm_living' },
      'light.rm_kitchen': { entity_id: 'light.rm_kitchen', area_id: 'rm_kitchen' },
      'switch.rm_kettle': { entity_id: 'switch.rm_kettle', area_id: 'rm_kitchen' },
      'sensor.rm_kitchen_temperature': {
        entity_id: 'sensor.rm_kitchen_temperature',
        area_id: 'rm_kitchen',
      },
      'light.rm_bedroom': { entity_id: 'light.rm_bedroom', area_id: 'rm_bedroom' },
      'fan.rm_bedroom': { entity_id: 'fan.rm_bedroom', area_id: 'rm_bedroom' },
    },
    areas: {
      rm_living: {
        area_id: 'rm_living',
        name: 'Living room',
        floor_id: 'rm_ground',
        icon: 'mdi:sofa',
        picture: PHOTO,
      },
      rm_kitchen: {
        area_id: 'rm_kitchen',
        name: 'Kitchen',
        floor_id: 'rm_ground',
        icon: 'mdi:silverware-fork-knife',
      },
      rm_bedroom: {
        area_id: 'rm_bedroom',
        name: 'Bedroom',
        floor_id: 'rm_upstairs',
        icon: 'mdi:bed',
      },
      rm_empty: { area_id: 'rm_empty', name: 'Attic' },
    },
    floors: {
      rm_ground: { floor_id: 'rm_ground', name: 'Ground floor', level: 0 },
      rm_upstairs: { floor_id: 'rm_upstairs', name: 'Upstairs', level: 1 },
    },
  },
  frames: [
    // the approved area anatomy: the photo, the readouts, the category rows
    {
      title: 'Room · photo',
      cards: [room({ area: 'rm_living', path: '/fluvy-auto/room-rm_living' })],
    },
    // its controls as compact tiles instead of rows
    {
      title: 'Room · tiles',
      cards: [room({ area: 'rm_living', controls: 'tiles', path: '/fluvy-auto/room-rm_living' })],
    },
    // no picture: the accent's gradient under the pill; no path, so no chevrons
    { title: 'Room · no photo', cards: [room({ area: 'rm_kitchen' })] },
    // the head and the controls
    {
      title: 'Room · tile',
      cards: [
        room({
          area: 'rm_living',
          variant: 'tile',
          controls: 'tiles',
          path: '/fluvy-auto/room-rm_living',
        }),
      ],
    },
    // a compact tile: two a row
    {
      title: 'Room · rows',
      cards: [
        room({ area: 'rm_living', variant: 'row', cols: 6, path: '/fluvy-auto/room-rm_living' }),
        room({ area: 'rm_bedroom', variant: 'row', cols: 6 }),
      ],
    },
    // an area with nothing in it, and one that is not there
    {
      title: 'Room · empty, missing',
      cards: [room({ area: 'rm_empty' }), room({ area: 'rm_ghost' })],
    },
  ],
};
