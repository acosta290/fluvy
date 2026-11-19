// @vitest-environment happy-dom
import { render } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import type { TextRuler } from '../shared/fit.js';
import { energyLegend, type LegendEntry } from './legend-row.js';

/** A stand-in for the card's ruler: a name's letters at 8, a figure's (and its unit's) at 10. */
const ruler = {
  width: (cls: string, text: string, _unitCls?: string, unit = ''): number =>
    cls === 'en-legend__name' ? text.length * 8 : (text.length + unit.length) * 10,
} as unknown as TextRuler;

const item = (name: string, value = '1.2', extra: Partial<LegendEntry> = {}): LegendEntry => ({
  ink: 'en-ink--home',
  name,
  value,
  unit: 'kWh',
  ...extra,
});

function drawn(
  items: readonly LegendEntry[],
  width = 320,
  lift?: (key?: string) => void,
): HTMLElement {
  const host = document.createElement('div');
  render(energyLegend(items, width, ruler, undefined, lift), host);
  return host.querySelector('.en-legend') as HTMLElement;
}

describe('the energy cards’ legend', () => {
  it('folds when a name does not hold its column, and lays a short last row across the width', () => {
    // three columns of 106: "Washing machine" (20 + 120) does not hold one, two of 160 do: two, two and one
    const legend = drawn(
      ['Boiler', 'Studio', 'Washing machine', 'Oven', 'Fridge'].map((n) => item(n)),
    );
    expect(legend.style.gridTemplateColumns).toContain('repeat(');
    expect(legend.querySelectorAll('.en-legend__item')).toHaveLength(5);
  });

  it('gives a name that is only an id’s no more room than its figure: a device away never folds it (1.9)', () => {
    const here = drawn([item('Boiler'), item('Studio'), item('Sauna')]);
    const away = drawn([
      item('Boiler'),
      item('Studio'),
      item('sensor.basement_sauna_heater_energy', '1.2', { idName: true }),
    ]);
    // three in a row both times: the id's 35 letters would take 300 and fold it to one a line
    expect(here.getAttribute('style')).toBeNull();
    expect(away.getAttribute('style')).toBeNull();
    // the id ends in an ellipsis in its column, as a name may
    expect(away.querySelectorAll('.en-legend__text[data-name]')).toHaveLength(1);
    expect(here.querySelectorAll('.en-legend__text[data-name]')).toHaveLength(0);
  });

  it('a legend that does not answer the pointer has no roles, no focus and no targets', () => {
    const legend = drawn([item('Boiler'), item('Studio', '2.0', { open: () => undefined })]);
    expect(legend.classList.contains('en-legend--live')).toBe(false);
    expect(legend.querySelectorAll('[role], [tabindex], [data-target]')).toHaveLength(0);
  });

  it('given `lift`, every item is reached by the keyboard and lifts what it names; a meter’s is a button', () => {
    const lift = vi.fn();
    const open = vi.fn();
    const legend = drawn(
      [
        item('Boiler', '4.2', { key: 'device:0', open }),
        item('Not measured', '3.3', { key: 'unmeasured', square: 'dashed' }),
      ],
      320,
      lift,
    );
    expect(legend.classList.contains('en-legend--live')).toBe(true);
    const [meter, worked] = [...legend.querySelectorAll<HTMLElement>('.en-legend__item')];
    expect(meter?.getAttribute('role')).toBe('button');
    expect(meter?.hasAttribute('data-target')).toBe(true);
    expect(meter?.getAttribute('tabindex')).toBe('0');
    expect(meter?.dataset['key']).toBe('device:0');
    // a figure worked out opens nothing: the image of its words, its square its bar's dashed outline
    expect(worked?.getAttribute('role')).toBe('img');
    expect(worked?.getAttribute('aria-label')).toBe('Not measured 3.3 kWh');
    expect(worked?.hasAttribute('data-target')).toBe(false);
    expect(worked?.getAttribute('tabindex')).toBe('0');
    expect(worked?.querySelector('.en-sq')?.classList.contains('is-dashed')).toBe(true);

    meter?.dispatchEvent(new Event('pointerenter'));
    meter?.dispatchEvent(new Event('pointerleave'));
    worked?.dispatchEvent(new Event('focus'));
    worked?.dispatchEvent(new Event('blur'));
    expect(lift.mock.calls).toEqual([['device:0'], [], ['unmeasured'], []]);

    meter?.click();
    meter?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    worked?.click();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
