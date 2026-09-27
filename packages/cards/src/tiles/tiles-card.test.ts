// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { HomeAssistant } from '@fluvy/core';
import '../index.js';

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  states: {
    'switch.kitchen': {
      entity_id: 'switch.kitchen',
      state: 'off',
      attributes: { friendly_name: 'Kitchen' },
      last_changed: '',
      last_updated: '',
    },
    'switch.porch': {
      entity_id: 'switch.porch',
      state: 'on',
      attributes: { friendly_name: 'Porch' },
      last_changed: '',
      last_updated: '',
    },
  },
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
} as unknown as HomeAssistant;

async function group(config: Record<string, unknown>) {
  const card = document.createElement('fluvy-tiles-card') as HTMLElement & {
    setConfig(config: unknown): void;
    hass: HomeAssistant;
    updateComplete: Promise<boolean>;
    getCardSize(): number;
  };
  card.setConfig({
    type: 'custom:fluvy-tiles-card',
    entities: ['switch.kitchen', 'switch.porch'],
    ...config,
  });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('a group of tiles', () => {
  afterEach(() => document.body.replaceChildren());

  it('stays compact by default: one row each, the tile itself the button', async () => {
    const card = await group({});
    const tiles = card.shadowRoot!.querySelectorAll('.fv-tile');
    expect(tiles.length).toBe(2);
    expect(tiles[0]!.classList.contains('fv-tile--compact')).toBe(true);
    expect(card.getCardSize()).toBe(1);
  });

  it('draws large tiles when asked: icon circle and a switch of their own, as a lone large tile', async () => {
    const card = await group({ size: 'large' });
    const root = card.shadowRoot!;
    expect(root.querySelector('.fv-tiles--large')).not.toBeNull();
    expect(root.querySelector('.fv-tile--compact')).toBeNull();
    expect(root.querySelectorAll('.fv-tile .fv-ico').length).toBe(2);
    expect(card.getCardSize()).toBe(3);
  });
});
