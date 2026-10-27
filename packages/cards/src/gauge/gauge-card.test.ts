// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { FluvyGaugeCard, type GaugeCardConfig } from './gauge-card.js';
import * as gaugeEditor from './gauge-editor.js';

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

describe('the ring’s gauge styles', () => {
  const ring = (gauge?: GaugeCardConfig['gauge']) =>
    mount({ variant: 'ring', ...(gauge ? { gauge } : {}) }, house());

  it('draws its ticks as 1.10 did while the house keeps its factory gauge: the dial in gauge mode, its own', async () => {
    const card = await ring();
    const dial = card.shadowRoot!.querySelector('.so-gauge > fluvy-dial');
    expect(dial?.hasAttribute('gauge')).toBe(true);
    expect((dial as unknown as { radius: number }).radius).toBe(96);
    expect(card.shadowRoot!.querySelector('.fc-gauge')).toBeNull();
  });

  it('draws the thermostat’s dial read, and a ring with its knob, in the dial’s room', async () => {
    const dial = await ring('dial');
    const read = dial.shadowRoot!.querySelector('.so-gauge fluvy-dial');
    expect(read?.hasAttribute('readonly')).toBe(true);
    expect(read?.hasAttribute('gauge')).toBe(false);
    const root = (await ring('ring')).shadowRoot!;
    expect(root.querySelector('.fc-ring__lit')).not.toBeNull();
    expect(root.querySelector('.fc-gauge .fv-knob')).not.toBeNull();
    // the dial's room: its box wide, as tall as it is down to its range's labels, the ring as tall as it
    const room = root.querySelector('.so-gauge > div') as HTMLElement;
    expect([room.style.width, room.style.height]).toEqual(['240px', '224px']);
    expect((root.querySelector('.fc-gauge') as HTMLElement).style.height).toBe('224px');
  });

  it('offers the ring its three styles, and the bar and the signed ring none', () => {
    const field = gaugeEditor.getConfigForm().schema.find((item) => item.name === 'gauge') as
      HaFormSchemaItem | undefined;
    const options = (field?.selector as { select: { options: { value: string }[] } }).select
      .options;
    expect(options.map((o) => o.value)).toEqual(['ticks', 'dial', 'ring']);
    expect(field?.when?.({})).toBe(true);
    expect(field?.when?.({ variant: 'bar' })).toBe(false);
    expect(field?.when?.({ variant: 'signed' })).toBe(false);
  });
});

describe('the ring’s moving gauges', () => {
  it('draws one that reads the sensor in the dial’s room, in its own tone where the card names none', async () => {
    const root = (await mount({ variant: 'ring', gauge: 'pulse' }, house())).shadowRoot!;
    const scene = root.querySelector('.so-gauge .fc-pulse') as HTMLElement;
    expect([scene.style.width, scene.style.height]).toEqual(['240px', '224px']);
    expect(scene.classList.contains('fv-tone--accent')).toBe(true);
    expect(root.querySelector('.fc-reading b')?.textContent).toBe('2.3');
  });

  it('draws one that does not read it as its ticks: the sky is for a temperature', async () => {
    const root = (await mount({ variant: 'ring', gauge: 'thermo' }, house())).shadowRoot!;
    expect(root.querySelector('.fc-scene')).toBeNull();
    expect(root.querySelector('.so-gauge > fluvy-dial')?.hasAttribute('gauge')).toBe(true);
  });

  it('rests on its first frame where the card says so', async () => {
    const root = (await mount({ variant: 'ring', gauge: 'sun', animate: false }, house()))
      .shadowRoot!;
    expect(root.querySelector('.fc-sun')?.classList.contains('is-still')).toBe(true);
  });

  it('offers the ring the gauges that read the sensor, and motion only beside one of them', () => {
    const hass = house();
    const config = { type: 'custom:fluvy-gauge-card', entity: 'sensor.grid' };
    const gauges = gaugeEditor.choices(config, hass)['gauge']?.map((o) => o.value);
    expect(gauges).toEqual(['ticks', 'dial', 'ring', 'pulse', 'sun']);
    const animate = gaugeEditor.getConfigForm().schema.find((item) => item.name === 'animate');
    expect(animate?.when?.({ ...config, gauge: 'pulse' }, hass)).toBe(true);
    expect(animate?.when?.({ ...config, gauge: 'thermo' }, hass)).toBe(false);
    expect(animate?.when?.({ ...config, gauge: 'ring' }, hass)).toBe(false);
    expect(gaugeEditor.defaults({ ...config, gauge: 'thermo' }, hass)['gauge']).toBe('ticks');
  });
});
