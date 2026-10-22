// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { glyph, type GlyphName } from '@fluvy/ui';
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';

// the camera and the lock land with the devices family, defined before a page needs them
await familiesDefined;

/*
 * Every card draws an entity's circle by one order (`iconOf`, 1.10): the card's own icon; the one the person set in
 * Home Assistant; Fluvy's glyph for its kind, as it stands; its integration's; Home Assistant's own for its state. A
 * gate is drawn open and shut on a tile, in a camera's and a lock's rows and in a list.
 */

const STAMP = '2026-10-22T08:00:00Z';
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: STAMP,
    last_updated: STAMP,
  }) as HassEntity;

const STATES = [
  state('cover.drive_gate', 'closed', { device_class: 'gate', supported_features: 3 }),
  state('cover.yard_gate', 'open', { device_class: 'gate', supported_features: 3 }),
  state('camera.porch', 'idle', { entity_picture: '/api/camera_proxy/camera.porch?token=1' }),
  state('lock.front', 'locked', { supported_features: 0 }),
  // its integration's icon, on a sensor of no class
  state('sensor.pollen', '3', { icon: 'mdi:flower-pollen' }),
  // the person's icon, which Home Assistant writes into the state too
  state('light.desk', 'on', { icon: 'mdi:desk-lamp' }),
  // a class Fluvy does not draw
  state('binary_sensor.washer_vibration', 'off', { device_class: 'vibration' }),
];

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { time_zone: 'UTC', unit_system: { temperature: '°C', length: 'km' } },
  states: Object.fromEntries(STATES.map((s) => [s.entity_id, s])),
  entities: { 'light.desk': { entity_id: 'light.desk', icon: 'mdi:desk-lamp' } },
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  hassUrl: (path: string) => path,
  callWS: () => new Promise(() => undefined),
} as unknown as HomeAssistant;

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** The circles a card draws, in their order: its head's, its tiles', its rows'. */
async function circles(tag: string, config: Record<string, unknown>): Promise<HTMLElement[]> {
  const card = document.createElement(tag) as CardElement;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  return [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-ico')];
}

/** The circles of a card's rows. */
const rowCircles = async (tag: string, config: Record<string, unknown>) =>
  (await circles(tag, config)).filter((circle) => circle.closest('.fv-row'));

/** The glyph as a circle draws it. */
function drawn(name: GlyphName): string {
  const box = document.createElement('div');
  render(glyph(name), box);
  return box.querySelector('svg')!.innerHTML;
}
const glyphIn = (circle: HTMLElement | undefined): string | undefined =>
  circle?.querySelector('svg')?.innerHTML;

const GATES = ['cover.drive_gate', 'cover.yard_gate'];

afterEach(() => document.body.replaceChildren());

describe('a gate drawn as it stands, on every card', () => {
  it('on a tile', async () => {
    const [shut] = await circles('fluvy-tile-card', { entity: 'cover.drive_gate' });
    document.body.replaceChildren();
    const [open] = await circles('fluvy-tile-card', { entity: 'cover.yard_gate' });
    expect(glyphIn(shut)).toBe(drawn('gate'));
    expect(glyphIn(open)).toBe(drawn('gateOpen'));
  });

  it('in a camera’s rows', async () => {
    const [shut, open] = await rowCircles('fluvy-camera-card', {
      entity: 'camera.porch',
      rows: GATES,
    });
    expect(glyphIn(shut)).toBe(drawn('gate'));
    expect(glyphIn(open)).toBe(drawn('gateOpen'));
  });

  it('in a lock’s rows', async () => {
    const [shut, open] = await rowCircles('fluvy-lock-card', { entity: 'lock.front', rows: GATES });
    expect(glyphIn(shut)).toBe(drawn('gate'));
    expect(glyphIn(open)).toBe(drawn('gateOpen'));
  });

  it('in a list', async () => {
    const [shut, open] = await rowCircles('fluvy-entities-card', { entities: GATES });
    expect(glyphIn(shut)).toBe(drawn('gate'));
    expect(glyphIn(open)).toBe(drawn('gateOpen'));
  });

  it('as the card names it, whatever it stands as', async () => {
    const [own] = await rowCircles('fluvy-entities-card', {
      entities: [{ entity: 'cover.yard_gate', icon: 'mdi:boom-gate' }],
    });
    expect(own?.querySelector<HTMLElement & { icon?: string }>('ha-icon')?.icon).toBe(
      'mdi:boom-gate',
    );
  });
});

describe('the icons Home Assistant knows', () => {
  /** The `<ha-icon>` a list draws for each of its rows. */
  const haIcons = async (entities: string[]) =>
    (await rowCircles('fluvy-entities-card', { entities })).map(
      (circle) => circle.querySelector<HTMLElement & { icon?: string }>('ha-icon')?.icon,
    );

  it('the person’s, before Fluvy’s glyph for the kind', async () => {
    expect(await haIcons(['light.desk'])).toEqual(['mdi:desk-lamp']);
    const [tile] = await circles('fluvy-tile-card', { entity: 'light.desk' });
    expect(tile?.querySelector<HTMLElement & { icon?: string }>('ha-icon')?.icon).toBe(
      'mdi:desk-lamp',
    );
  });

  it('its integration’s, on a sensor of no class', async () => {
    expect(await haIcons(['sensor.pollen'])).toEqual(['mdi:flower-pollen']);
  });

  it('Home Assistant’s own for the state, where Fluvy has no glyph for the kind', async () => {
    const [row] = await rowCircles('fluvy-entities-card', {
      entities: ['binary_sensor.washer_vibration'],
    });
    const icon = row?.querySelector<HTMLElement & { stateObj?: unknown; stateValue?: string }>(
      'ha-state-icon',
    );
    expect(icon?.stateObj).toBe(hass.states['binary_sensor.washer_vibration']);
    expect(icon?.stateValue).toBe('off');
    expect(row?.querySelector('svg')).toBeNull();
  });
});
