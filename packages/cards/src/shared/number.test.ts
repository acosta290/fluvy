// @vitest-environment happy-dom
import { resolveEntity, type HassEntity, type HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FluvyHelpersCard } from '../helpers/helpers-card.js';
import { numberFigures, typedNumber } from './number-controls.js';
import { numberModel } from './number.js';

if (!customElements.get('fluvy-helpers-card'))
  customElements.define('fluvy-helpers-card', FluvyHelpersCard);

/*
 * #218: a number's figure typed for it — read in either decimal mark, held to its range and its step — the figures its
 * control is laid out for, and the Helpers card's figures typed (`number_entry`).
 */

const state = (entity_id: string, value: string, attributes: Record<string, unknown>) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1], ...attributes },
    last_changed: '',
    last_updated: '',
  }) as HassEntity;
const PRESET = { min: 5, max: 30, step: 0.5, unit_of_measurement: '°C', mode: 'box' };
const STATES = [
  state('input_number.comfort', '21.5', PRESET),
  state('number.power', '1500', { min: 0, max: 3000, step: 1, unit_of_measurement: 'W' }),
  state('counter.pods', '12', { step: 1 }),
];
const house = (callService = vi.fn(() => Promise.resolve())) =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language' },
    states: Object.fromEntries(STATES.map((one) => [one.entity_id, one])),
    entities: {},
    devices: {},
    areas: {},
    callService,
  }) as unknown as HomeAssistant;
const model = (id: string) => {
  const view = resolveEntity(house(), id);
  return numberModel(view, view.state, false);
};

describe('a figure typed for a number', () => {
  it('reads a point or a comma as the decimal mark, the last where both are typed', () => {
    const comfort = model('input_number.comfort');
    expect(typedNumber('19.5', comfort)).toBe(19.5);
    expect(typedNumber('19,5', comfort)).toBe(19.5);
    expect(typedNumber(' 20 ', comfort)).toBe(20);
    const power = model('number.power');
    expect(typedNumber('1.500,0', power)).toBe(1500);
    expect(typedNumber('1,500.0', power)).toBe(1500);
    expect(typedNumber('1 500', power)).toBe(1500);
  });

  it('holds it to the range and the step’s grid, and reads nothing as none', () => {
    const comfort = model('input_number.comfort');
    expect(typedNumber('19.7', comfort)).toBeNull();
    expect(typedNumber('4.5', comfort)).toBeNull();
    expect(typedNumber('30.5', comfort)).toBeNull();
    expect(typedNumber('', comfort)).toBeNull();
    expect(typedNumber('warm', comfort)).toBeNull();
    expect(typedNumber('30', comfort)).toBe(30);
  });

  it('lays a control out for its ends, and for a figure now where an end is open', () => {
    const hass = house();
    expect(numberFigures(hass, model('input_number.comfort'))).toEqual(['5.0', '30.0']);
    // a counter with neither end counts on from where it stands
    expect(numberFigures(hass, model('counter.pods'))).toEqual(['12']);
  });
});

describe('the Helpers card’s figures typed (#218)', () => {
  afterEach(() => document.body.replaceChildren());

  async function draw(config: Record<string, unknown>, hass: HomeAssistant) {
    const card = document.createElement('fluvy-helpers-card') as FluvyHelpersCard;
    card.setConfig({ type: 'custom:fluvy-helpers-card', title: 'Presets', ...config });
    card.hass = hass;
    document.body.append(card);
    await card.updateComplete;
    return card;
  }

  it('keeps the figure as it was where the card does not ask', async () => {
    const card = await draw({ rows: ['input_number.comfort'] }, house());
    expect(card.shadowRoot!.querySelector('.nm-figure')).toBeNull();
    expect(card.shadowRoot!.querySelector('span.in-field__value')).not.toBeNull();
  });

  it('opens a field from the figure, sends a figure held to its range and step, and keeps a counter stepped', async () => {
    const callService = vi.fn(() => Promise.resolve());
    const card = await draw(
      { number_entry: true, rows: ['input_number.comfort', 'counter.pods'] },
      house(callService),
    );
    const root = card.shadowRoot!;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.nm-figure');
    // the counter keeps its figure, stepped
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute('aria-label')).toBe('comfort · 21.5 °C');
    buttons[0]!.click();
    await card.updateComplete;
    const input = root.querySelector<HTMLInputElement>('.nm-entry > input')!;
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.value).toBe('21.5');
    input.value = '22,5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await card.updateComplete;
    expect(callService).toHaveBeenLastCalledWith(
      'input_number',
      'set_value',
      { value: 22.5 },
      { entity_id: 'input_number.comfort' },
    );
    expect(root.querySelector('.nm-entry')).toBeNull();
  });

  it('offers it in the editor while the rows hold a number that takes a figure', async () => {
    const { getConfigForm } = await import('../helpers/helpers-editor.js');
    const field = getConfigForm()
      .schema.flatMap((item) => item.schema ?? [item])
      .find((item) => item.name === 'number_entry')!;
    expect(field.when?.({ rows: ['counter.pods'] })).toBe(false);
    expect(field.when?.({ entities: ['number.power', 'counter.pods'] })).toBe(true);
  });
});
