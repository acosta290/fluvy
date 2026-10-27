// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  setChartDefaults,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { FluvyDistributionCard, type DistributionCardConfig } from './distribution-card.js';
import * as distributionEditor from './distribution-editor.js';

if (!customElements.get('fluvy-distribution-card'))
  customElements.define('fluvy-distribution-card', FluvyDistributionCard);

const power = (id: string, state: string) => ({
  entity_id: id,
  state,
  attributes: { unit_of_measurement: 'W', device_class: 'power', friendly_name: id },
  last_changed: '',
  last_updated: '',
});

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.heat': power('sensor.heat', '900'),
      'sensor.wash': power('sensor.wash', '1400'),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

async function mount(config: Partial<DistributionCardConfig>): Promise<FluvyDistributionCard> {
  const card = document.createElement('fluvy-distribution-card') as FluvyDistributionCard;
  card.setConfig({
    type: 'custom:fluvy-distribution-card',
    entities: ['sensor.heat', 'sensor.wash'],
    ...config,
  });
  card.hass = house();
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const stack = (card: FluvyDistributionCard): Element | null =>
  card.shadowRoot!.querySelector('.fv-stack');

afterEach(() => {
  document.body.replaceChildren();
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('the distribution’s stack, in its chart styles', () => {
  it('draws classic as 1.10 did, and soft where the card or the house says so', async () => {
    expect(stack(await mount({}))?.classList.contains('is-soft')).toBe(false);
    expect(stack(await mount({ chart: 'soft' }))?.classList.contains('is-soft')).toBe(true);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, style: 'soft' }, sets: [] });
    expect(stack(await mount({}))?.classList.contains('is-soft')).toBe(true);
    // a card that says classic keeps it; a style it cannot draw is classic
    expect(stack(await mount({ chart: 'classic' }))?.classList.contains('is-soft')).toBe(false);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, style: 'step' }, sets: [] });
    expect(stack(await mount({}))?.classList.contains('is-soft')).toBe(false);
  });

  it('offers classic and soft to the stack, and nothing to the rows, which draw no bar', () => {
    const field = distributionEditor
      .getConfigForm()
      .schema.find((item) => item.name === 'chart') as HaFormSchemaItem;
    expect(
      (field.selector as { select: { options: { value: string }[] } }).select.options.map(
        (o) => o.value,
      ),
    ).toEqual(['classic', 'soft']);
    expect(field.when?.({})).toBe(true);
    expect(field.when?.({ variant: 'rows' })).toBe(false);
  });
});
