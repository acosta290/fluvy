// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { expect, it } from 'vitest';
import { loadDoing } from '../climate-family.js';
import { FluvyTileCard } from './tile-card.js';

/*
 * What says what a thermostat is doing travels with the Thermostat card's chunk (#185): a tile asked to say it draws
 * before that has landed as the tile it was, and again as it lands. This file never imports the index, which fetches
 * the chunk as the bundle starts: the tile's first frame here is the one a page draws before it.
 */

customElements.define('fluvy-tile-card', FluvyTileCard);

const STAMP = '2026-11-14T08:00:00+00:00';
const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { unit_system: { temperature: '°C' } },
  states: {
    'climate.living': {
      entity_id: 'climate.living',
      state: 'heat',
      attributes: {
        friendly_name: 'Living room',
        hvac_action: 'heating',
        temperature: 21.5,
        current_temperature: 20.8,
        target_temp_step: 0.5,
      },
      last_changed: STAMP,
      last_updated: STAMP,
    },
  },
  entities: {},
  devices: {},
  areas: {},
  formatEntityState: (state: { state: string }) => state.state,
} as unknown as HomeAssistant;

it('says its state until the reading has landed, then what it is doing, on a tile of the same size', async () => {
  const card = document.createElement('fluvy-tile-card') as FluvyTileCard;
  const config = {
    type: 'custom:fluvy-tile-card',
    entity: 'climate.living',
    size: 'compact',
    show_action: true,
  } as LovelaceCardConfig;
  card.setConfig(config);
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  const said = (): string | undefined =>
    card.shadowRoot!.querySelector('.fv-tile__state')?.textContent?.trim();
  expect(said()).toBe('Heat');
  await loadDoing();
  await card.updateComplete;
  expect(said()).toBe('Heating · 21.5°');
  expect(FluvyTileCard.layoutHeight(config)).toBe(76);
  card.remove();
});
