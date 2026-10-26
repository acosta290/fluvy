// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { FluvyGaugeCard, type GaugeCardConfig } from './gauge-card.js';

await familiesDefined;

/** A house with one power sensor reading 2 308 W (or `state`), its registry precision when given. */
const house = (precision?: number, state = '2308'): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.grid': {
        entity_id: 'sensor.grid',
        state,
        attributes: { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Grid' },
        last_changed: '',
        last_updated: '',
      },
    },
    entities: precision === undefined ? {} : { 'sensor.grid': { display_precision: precision } },
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

type CardElement = FluvyGaugeCard & { updateComplete: Promise<boolean> };

async function mount(config: Partial<GaugeCardConfig>, hass: HomeAssistant): Promise<CardElement> {
  const card = document.createElement('fluvy-gauge-card') as CardElement;
  // the bar: its figure is a readout (the ring's is the dial's own)
  card.setConfig({
    type: 'custom:fluvy-gauge-card',
    entity: 'sensor.grid',
    variant: 'bar',
    max: 5000,
    ...config,
  });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

/** The figure over the bar: its number and its unit, as one run. */
const figure = (card: CardElement): string =>
  card.shadowRoot?.querySelector('.so-top .fv-readout__value')?.textContent?.replace(/\s+/g, '') ??
  '';

describe('the gauge’s unit and decimals (issue #69)', () => {
  it('reads in the unit the set asks for by default, the sensor’s precision in the sensor’s own unit', async () => {
    // 2 308 W under a 5 000 W ceiling: kilowatts, one decimal
    expect(figure(await mount({}, house()))).toBe('2.3kW');
    // a set under a kilowatt keeps watts, where the registry's precision is the sensor's own
    expect(figure(await mount({ max: 500 }, house(1, '450')))).toBe('450.0W');
  });

  it('reads in the unit asked, where it is of the sensor’s class, at the decimals asked', async () => {
    expect(figure(await mount({ unit: 'W' }, house()))).toBe('2,308W');
    expect(figure(await mount({ unit: 'kW', decimals: 2 }, house()))).toBe('2.31kW');
    expect(figure(await mount({ decimals: 0 }, house()))).toBe('2kW');
    // a unit of another class, or the editor's automatic one, is not asked
    expect(figure(await mount({ unit: 'kWh' }, house()))).toBe('2.3kW');
    expect(figure(await mount({ unit: 'auto', decimals: 'auto' as never }, house()))).toBe('2.3kW');
  });

  it('keeps its height whatever the figures ask', () => {
    for (const variant of ['ring', 'bar', 'signed'] as const)
      expect(FluvyGaugeCard.layoutHeight({ type: '', variant, unit: 'W', decimals: 0 })).toBe(
        FluvyGaugeCard.layoutHeight({ type: '', variant }),
      );
  });
});
