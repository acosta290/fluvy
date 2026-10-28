// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { FluvyEntitiesCard, type EntitiesCardConfig } from './entities-card.js';

if (!customElements.get('fluvy-entities-card'))
  customElements.define('fluvy-entities-card', FluvyEntitiesCard);

const hass = {
  states: {
    'lock.front_door': {
      entity_id: 'lock.front_door',
      state: 'locked',
      attributes: { friendly_name: 'Front door' },
      last_changed: '',
      last_updated: '',
    },
  },
  entities: {},
  devices: {},
  areas: {},
  language: 'en',
  locale: { language: 'en' },
  config: { unit_system: { temperature: '°C' } },
} as unknown as HomeAssistant;

async function mount(config: Omit<EntitiesCardConfig, 'type'>): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-entities-card') as FluvyEntitiesCard;
  card.setConfig({ type: 'custom:fluvy-entities-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card.shadowRoot as ShadowRoot;
}

describe('the entities card’s "N more" row (#78)', () => {
  it('ends the rows with the house’s fold row, how many more, the chevron to where they are', async () => {
    const root = await mount({
      title: 'Security',
      rows: ['lock.front_door'],
      more: 4,
      more_path: '/fluvy-auto/home-security',
    });
    const rows = root.querySelectorAll('.fv-row');
    expect(rows.length).toBe(2);
    const more = rows[1] as HTMLElement;
    expect(more.querySelector('.fv-row__title')?.textContent).toBe('4 more');
    expect(more.querySelector('.fv-row__chevron')).not.toBeNull();
    expect(more.getAttribute('role')).toBe('button');
  });

  it('is a card of its own with the row alone, its height counted with the row', async () => {
    const root = await mount({ more: 9, more_path: '/fluvy-auto/climate-humidity' });
    expect(root.querySelector('.fv-empty')).toBeNull();
    expect(root.querySelectorAll('.fv-row').length).toBe(1);
    const alone = { type: 'custom:fluvy-entities-card', more: 9, more_path: '/x' };
    expect(FluvyEntitiesCard.layoutHeight(alone)).toBe(24 + 60);
    expect(FluvyEntitiesCard.layoutHeight({ ...alone, title: 'Security', rows: ['lock.a'] })).toBe(
      92 + 2 * 60,
    );
    // without where to go, there is no row
    expect(
      FluvyEntitiesCard.layoutHeight({ ...alone, more_path: '', title: 'T', rows: ['lock.a'] }),
    ).toBe(92 + 60);
  });
});
