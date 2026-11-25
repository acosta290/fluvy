// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { visibleFields } from '../shared/form.js';
import { vacuumHeight } from '../vacuum-family.js';
import { getConfigForm, lists } from './vacuum-editor.js';

// the Vacuum card's family lands with the index: its tag is defined before a card is made
await familiesDefined;

/*
 * The Vacuum card's extra rows (#262, by @frankchief123), the Lock card's own engine: what they add to the card's
 * height, where they stand (under the map and before the presets, so a floor's select sits by the map it changes;
 * else at the card's foot), that a card that names none carries none, and what the editor shows.
 */

const STAMP = '2026-11-25T08:00:00Z';
/* PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · LOCATE 512 · START 8192 */
const FEATURES = 4 + 8 + 16 + 32 + 64 + 512 + 8192;
const ROBOT = 'vacuum.robot';
const FLOOR = 'select.floor';
const MAP = { image: 'camera.robot_map' };
const PRESETS = [{ name: 'Cooker', zone: [1100, 100, 2000, 900] }, { name: 'Full clean' }];

/** A house with a robot, its map's camera and the select that picks its floor. */
function house(): HomeAssistant {
  const entity = (id: string, at: string, attributes: Record<string, unknown>) => ({
    entity_id: id,
    state: at,
    attributes,
    last_changed: STAMP,
    last_updated: STAMP,
  });
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C', length: 'km' } },
    states: {
      [ROBOT]: entity(ROBOT, 'docked', {
        friendly_name: 'Robot',
        supported_features: FEATURES,
        battery_level: 80,
        fan_speed: 'quiet',
        fan_speed_list: ['quiet', 'max'],
      }),
      'camera.robot_map': entity('camera.robot_map', 'idle', {
        friendly_name: 'Map',
        entity_picture: '/api/camera_proxy/camera.robot_map?token=t',
      }),
      [FLOOR]: entity(FLOOR, 'Ground floor', {
        friendly_name: 'Floor',
        options: ['Ground floor', 'Upstairs'],
      }),
    },
    entities: { [ROBOT]: { entity_id: ROBOT, platform: 'xiaomi_miio' } },
    devices: {},
    areas: {},
    services: { vacuum: { start: { target: {} } } },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: () => Promise.resolve(),
  } as unknown as HomeAssistant;
}

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** A card drawn, its map's chunk landed where its config names a map or presets. */
async function draw(config: Record<string, unknown>): Promise<CardElement> {
  const card = document.createElement('fluvy-vacuum-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-vacuum-card', entity: ROBOT, ...config });
  card.hass = house();
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  if (config['map'] !== undefined || config['presets'] !== undefined) {
    await vi.waitFor(() => expect(customElements.get('fluvy-vacuum-map')).toBeDefined());
    await card.updateComplete;
    await card.updateComplete;
  }
  return card;
}

/** The card's parts in their order, each by what it is. */
const parts = (card: CardElement): string[] =>
  [...card.shadowRoot!.querySelector('article')!.children].map((part) =>
    part.localName === 'div' ? `.${part.classList[0]}` : part.localName,
  );

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the height the card declares', () => {
  const base = vacuumHeight({ type: 'x', entity: ROBOT });

  it('takes its rows, 16 and 60 each, unless they are hidden', () => {
    const rows = [FLOOR, { entity: 'sensor.filter' }];
    expect(vacuumHeight({ type: 'x', entity: ROBOT, rows })).toBe(base + 16 + 120);
    expect(vacuumHeight({ type: 'x', entity: ROBOT, rows, show_rows: false })).toBe(base);
    expect(vacuumHeight({ type: 'x', entity: ROBOT, rows: [] })).toBe(base);
  });

  it('is the compact card’s whatever rows it names', () => {
    const compact = vacuumHeight({ type: 'x', entity: ROBOT, variant: 'compact' });
    expect(vacuumHeight({ type: 'x', entity: ROBOT, variant: 'compact', rows: [FLOOR] })).toBe(
      compact,
    );
  });
});

describe('the card’s rows', () => {
  it('are none on a card that names none: the card it was', async () => {
    const card = await draw({});
    expect(parts(card)).toEqual(['.fv-card__head', '.vc-body']);
    expect(card.shadowRoot!.querySelector('.dv-rows')).toBeNull();
  });

  it('stand under the map and before the presets, by the map a floor’s select changes', async () => {
    const card = await draw({ map: MAP, presets: PRESETS, rows: [FLOOR] });
    expect(parts(card)).toEqual([
      '.fv-card__head',
      'fluvy-vacuum-map',
      '.dv-rows',
      '.vc-presets',
      '.vc-body',
    ]);
    // a map hidden is no map to stand under: the rows close the card
    const hidden = await draw({ map: MAP, presets: PRESETS, rows: [FLOOR], show_map: false });
    expect(parts(hidden)).toEqual(['.fv-card__head', '.vc-presets', '.vc-body', '.dv-rows']);
  });

  it('close the card where it has no map, as the Lock card’s do', async () => {
    expect(parts(await draw({ rows: [FLOOR] }))).toEqual([
      '.fv-card__head',
      '.vc-body',
      '.dv-rows',
    ]);
    expect(parts(await draw({ presets: PRESETS, rows: [FLOOR] }))).toEqual([
      '.fv-card__head',
      '.vc-presets',
      '.vc-body',
      '.dv-rows',
    ]);
  });

  it('are left out where they are hidden, and on the compact card', async () => {
    expect(parts(await draw({ rows: [FLOOR], show_rows: false }))).toEqual([
      '.fv-card__head',
      '.vc-body',
    ]);
    expect(parts(await draw({ rows: [FLOOR], variant: 'compact' }))).toEqual([
      '.fv-card__head',
      '.vc-body',
    ]);
  });

  it('say the entity’s name and take its state from the house', async () => {
    const card = await draw({ rows: [FLOOR] });
    const row = card.shadowRoot!.querySelector('.dv-rows')!;
    expect(row.textContent).toContain('Floor');
    expect(row.textContent).toContain('Ground floor');
  });
});

describe('the editor', () => {
  it('edits the rows item by item, as the Lock card’s, after the presets', () => {
    expect(lists.map((list) => [list.key, list.idKey ?? 'entity'])).toEqual([
      ['presets', 'name'],
      ['rows', 'entity'],
    ]);
    const rows = lists.find((list) => list.key === 'rows');
    expect(rows?.when?.({ variant: 'full' })).toBe(true);
    expect(rows?.when?.({ variant: 'compact' })).toBe(false);
  });

  it('offers what hides the rows on the full card only', () => {
    const names = (data: Record<string, unknown>): string[] => {
      const found: string[] = [];
      const walk = (items: readonly { name: string; schema?: readonly unknown[] }[]): void => {
        for (const item of items) {
          if (item.name) found.push(item.name);
          if (item.schema) walk(item.schema as { name: string; schema?: readonly unknown[] }[]);
        }
      };
      walk(visibleFields(getConfigForm().schema, data) as never);
      return found;
    };
    expect(names({ variant: 'full', rows: [FLOOR] })).toContain('show_rows');
    expect(names({ variant: 'compact', rows: [FLOOR] })).not.toContain('show_rows');
  });
});
