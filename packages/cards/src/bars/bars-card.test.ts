// @vitest-environment happy-dom
import { CHART_DEFAULTS, setChartDefaults, type HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { FluvyBarsCard, type BarsCardConfig } from './bars-card.js';

if (!customElements.get('fluvy-bars-card')) customElements.define('fluvy-bars-card', FluvyBarsCard);

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.east': {
        entity_id: 'sensor.east',
        state: '1400',
        attributes: { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'East' },
        last_changed: '',
        last_updated: '',
      },
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

async function mount(config: Partial<BarsCardConfig>): Promise<FluvyBarsCard> {
  const card = document.createElement('fluvy-bars-card') as FluvyBarsCard;
  card.setConfig({ type: 'custom:fluvy-bars-card', rows: ['sensor.east'], ...config });
  card.hass = house();
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const soft = (card: FluvyBarsCard): boolean =>
  card.shadowRoot!.querySelector('.so-rows')?.classList.contains('is-soft') ?? false;

afterEach(() => {
  document.body.replaceChildren();
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('the bars, in their chart styles', () => {
  it('draws classic as 1.10 did, and soft where the card or the house says so', async () => {
    const classic = await mount({});
    expect(soft(classic)).toBe(false);
    expect(classic.shadowRoot!.querySelector('.fv-bar__fill')).not.toBeNull();
    expect(soft(await mount({ chart: 'soft' }))).toBe(true);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, style: 'soft' }, sets: [] });
    expect(soft(await mount({}))).toBe(true);
    expect(soft(await mount({ chart: 'classic' }))).toBe(false);
  });
});
