import { describe, expect, it } from 'vitest';

import { typical } from './scale.js';

describe('a typical bar', () => {
  it('is the middle one by size, so a spike reads in the unit of the rest', () => {
    // a lifetime meter after a restart, as Home Assistant counts it: 18,257.3 kWh counted again on one day
    expect(typical([24.1, 31.5, 28.2, 26.4, 18_280.2, 30.8, 27.5])).toBe(28.2);
    expect(typical([35_400, 34_400, 28_600, 26_500])).toBe(34_400);
  });

  it('counts a bar below zero by its size, and leaves out the bars with nothing in them', () => {
    expect(typical([5.2, -3.1, 7.8, -6.4, 2.2])).toBe(5.2);
    expect(typical([null, 0, 0, 12_400, 0, null])).toBe(12_400);
    expect(typical([null, 0])).toBe(0);
    expect(typical([])).toBe(0);
  });
});
