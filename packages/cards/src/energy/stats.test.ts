// @vitest-environment happy-dom
import { resolveEntity, type EntityView, type HomeAssistant } from '@fluvy/core';
import { html, render } from 'lit';
import { describe, expect, it } from 'vitest';
import type { TextRuler } from '../shared/fit.js';
import { legendStats } from './legend.js';
import { statsCols, type Stat } from './stats.js';

/** A stand-in for the card's ruler: a label's letters at 7, a figure's (and its unit's) at 11 at s and 9 at xs. */
const ruler = {
  width(cls: string, text: string, _unitCls?: string, unit = ''): number {
    if (cls.includes('fv-readout__label')) return text.length * 7;
    const pace = cls.includes('fv-readout--xs') ? 9 : 11;
    return (text.length + unit.length) * pace;
  },
} as unknown as TextRuler;

const MONEY: Stat[] = [
  { label: 'Kosten', value: '1,24', unit: '€' },
  { label: 'Einspeisung', value: '0,31', unit: '€' },
  { label: 'Netto', value: '0,93', unit: '€' },
];

function drawn(width: number, stats: readonly Stat[]): HTMLElement {
  const host = document.createElement('div');
  render(statsCols(ruler, width, stats), host);
  return host.querySelector('.ef-cols') as HTMLElement;
}

describe('statsCols', () => {
  it('lays the row in as many columns as hold its words, a shorter last row taking the whole row', () => {
    const wide = drawn(320, MONEY);
    expect(wide.style.getPropertyValue('--cols')).toBe('3');
    expect(wide.classList.contains('fv-cols--odd')).toBe(false);
    // 200: three columns of 56 do not hold "Einspeisung" (77): two and one
    const narrow = drawn(200, MONEY);
    expect(narrow.style.getPropertyValue('--cols')).toBe('2');
    expect(narrow.classList.contains('fv-cols--odd')).toBe(true);
    expect(narrow.getAttribute('data-align')).toBe('center');
  });

  it('lays the balance’s money row two and one at 284 in German, as the charger’s session row', () => {
    // the label face as the card draws it, 11/600 uppercase at 0.06 em: "EINSPEISUNG" is 93, over the 84 of a third
    const upper = {
      width(cls: string, text: string, _unitCls?: string, unit = ''): number {
        if (cls.includes('fv-readout__label')) return Math.round(text.length * 8.5);
        return (text.length + unit.length) * (cls.includes('fv-readout--xs') ? 9 : 11);
      },
    } as unknown as TextRuler;
    const host = document.createElement('div');
    render(statsCols(upper, 284, MONEY), host);
    const row = host.querySelector('.ef-cols') as HTMLElement;
    expect(row.style.getPropertyValue('--cols')).toBe('2');
    expect(row.classList.contains('fv-cols--odd')).toBe(true);
  });

  it('draws each statistic at the row’s size, its own way where it has one', () => {
    const row = drawn(96, [
      ...MONEY,
      { label: 'Seit', value: '2 h 10', unit: 'min', draw: (size) => html`<i>${size}</i>` },
    ]);
    expect([...row.querySelectorAll('.fv-readout--xs')]).toHaveLength(3);
    expect(row.querySelector('i')?.textContent).toBe('xs');
  });

  it('lets a name end in an ellipsis, never a word', () => {
    const row = drawn(320, [{ label: 'Garage', value: '1,2', unit: 'kWh', name: true }, MONEY[0]!]);
    const labels = [...row.querySelectorAll('.fv-readout__label')];
    expect(labels.map((label) => label.hasAttribute('data-name'))).toEqual([true, false]);
  });
});

describe('legendStats', () => {
  const sensor = (state: string, unit: string) => ({
    entity_id: '',
    state,
    attributes: { unit_of_measurement: unit },
  });
  const hass = {
    states: {
      'sensor.grid': sensor('2308', 'W'),
      'sensor.solar': sensor('450', 'W'),
      'sensor.day': sensor('11.2', 'kWh'),
    },
    entities: {},
    language: 'en',
  } as unknown as HomeAssistant;
  const entity = (id: string): EntityView => resolveEntity(hass, id);
  const items = [{ entity: 'sensor.grid' }, { entity: 'sensor.solar' }, { entity: 'sensor.day' }];
  const figures = (stats: readonly Stat[]): string[] => stats.map((s) => `${s.value} ${s.unit}`);

  it('reads every figure of a family in one unit, the largest deciding', () => {
    expect(figures(legendStats(hass, items, entity))).toEqual(['2.3 kW', '0.45 kW', '11.2 kWh']);
  });

  it('reads in the unit and at the decimals the card asks, where its class converts', () => {
    expect(figures(legendStats(hass, items, entity, { unit: 'W' }))).toEqual([
      '2,308 W',
      '450 W',
      '11.2 kWh',
    ]);
    expect(figures(legendStats(hass, items, entity, { unit: 'Wh', decimals: 0 }))).toEqual([
      '2 kW',
      '0 kW',
      '11,200 Wh',
    ]);
  });

  it('lets an item ask for its own', () => {
    const own = [{ entity: 'sensor.grid', unit: 'W', decimals: '1' }, items[1]!, items[2]!];
    expect(figures(legendStats(hass, own, entity))).toEqual(['2,308.0 W', '0.45 kW', '11.2 kWh']);
  });
});
