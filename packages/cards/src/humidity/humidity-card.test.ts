// @vitest-environment happy-dom
import {
  setChartDefaults,
  CHART_DEFAULTS,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { FluvyHumidityCard, type HumidityCardConfig } from './humidity-card.js';
import * as humidityEditor from './humidity-editor.js';

if (!customElements.get('fluvy-humidity-card'))
  customElements.define('fluvy-humidity-card', FluvyHumidityCard);

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.humidity': {
        entity_id: 'sensor.humidity',
        state: '46',
        attributes: { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Living' },
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

async function mount(config: Partial<HumidityCardConfig>): Promise<FluvyHumidityCard> {
  const card = document.createElement('fluvy-humidity-card') as FluvyHumidityCard;
  card.setConfig({ type: 'custom:fluvy-humidity-card', entity: 'sensor.humidity', ...config });
  card.hass = house();
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const ruler = (card: FluvyHumidityCard): Element | null =>
  card.shadowRoot!.querySelector('.so-band fluvy-ruler');

afterEach(() => {
  document.body.replaceChildren();
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('the humidity’s ruler, in its gauge styles', () => {
  it('rides its marker on the comfort ruler as 1.10 did while the house keeps its factory gauge', async () => {
    const card = await mount({});
    expect(ruler(card)?.hasAttribute('marker')).toBe(true);
    expect(ruler(card)?.hasAttribute('readonly')).toBe(false);
    expect(card.shadowRoot!.querySelector('.so-band__zone')).not.toBeNull();
  });

  it('reads the ruler lit with Fluvy’s knob where the card or the house says ruler; a dial has no room and reads ticks', async () => {
    expect(ruler(await mount({ gauge: 'ruler' }))?.hasAttribute('readonly')).toBe(true);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, gauge: 'ruler' }, sets: [] });
    expect(ruler(await mount({}))?.hasAttribute('readonly')).toBe(true);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, gauge: 'dial' }, sets: [] });
    expect(ruler(await mount({}))?.hasAttribute('marker')).toBe(true);
  });

  it('offers its two looks, the classic one by its word', () => {
    const field = humidityEditor
      .getConfigForm()
      .schema.find((item) => item.name === 'gauge') as HaFormSchemaItem;
    expect(
      (field.selector as { select: { options: { value: string }[] } }).select.options.map(
        (o) => o.value,
      ),
    ).toEqual(['ticks', 'ruler']);
  });
});
