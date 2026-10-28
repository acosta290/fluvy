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
import { loadChartEngine } from '../shared/chart-load.js';

if (!customElements.get('fluvy-humidity-card'))
  customElements.define('fluvy-humidity-card', FluvyHumidityCard);
// the liquid is the chart engine's: it lands as the bundle starts, so a card has it from its first render
await loadChartEngine();

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

  it('offers its three looks, the classic one by its word, and motion beside the liquid', () => {
    const row = humidityEditor
      .getConfigForm()
      .schema.find((item) => item.schema?.some((field) => field.name === 'gauge'));
    const [gauge, animate] = row?.schema as HaFormSchemaItem[];
    expect(
      (gauge?.selector as { select: { options: { value: string }[] } }).select.options.map(
        (o) => o.value,
      ),
    ).toEqual(['ticks', 'ruler', 'liquid']);
    expect(animate?.name).toBe('animate');
    expect(animate?.when?.({ gauge: 'liquid' })).toBe(true);
    expect(animate?.when?.({ gauge: 'ruler' })).toBe(false);
  });
});

describe('the humidity’s liquid', () => {
  it('takes the ruler’s room and its labels’, its level the reading, where the card or the house says liquid', async () => {
    const card = await mount({ gauge: 'liquid' });
    const scene = card.shadowRoot!.querySelector('.so-band .fc-water') as HTMLElement;
    expect(scene.style.height).toBe('64px');
    expect(ruler(card)).toBeNull();
    expect(card.shadowRoot!.querySelector('.fv-ruler-labels')).toBeNull();
    // the figure is the readout's over it: the liquid says nothing
    expect(scene.querySelector('.fc-reading')).toBeNull();
    setChartDefaults({ settings: { ...CHART_DEFAULTS, gauge: 'liquid' }, sets: [] });
    expect((await mount({})).shadowRoot!.querySelector('.so-band .fc-water')).not.toBeNull();
  });

  it('rests on its first frame where the card says so', async () => {
    const card = await mount({ gauge: 'liquid', animate: false });
    expect(card.shadowRoot!.querySelector('.fc-water')?.classList.contains('is-still')).toBe(true);
  });
});
