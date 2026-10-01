import { describe, expect, it } from 'vitest';
import { phaseBar, phaseSpan } from './phases.js';

describe('a phase centred on zero', () => {
  it('reaches twice the busiest phase on a round step, 1 kW at least', () => {
    expect(phaseSpan([-400, 1000, 900])).toBe(2000);
    expect(phaseSpan([-1900, 300, null])).toBe(4000);
    expect(phaseSpan([50, null])).toBe(1000);
    expect(phaseSpan([])).toBe(1000);
  });

  it('goes out to the left and in to the right, never past its side', () => {
    expect(phaseBar(-400, 2000)).toEqual({ way: 'out', reach: 0.2 });
    expect(phaseBar(1000, 2000)).toEqual({ way: 'in', reach: 0.5 });
    expect(phaseBar(5000, 2000)).toEqual({ way: 'in', reach: 1 });
  });

  it('rests below its threshold, and is nothing when it cannot be read', () => {
    expect(phaseBar(6, 1000)).toEqual({ way: '', reach: 0 });
    expect(phaseBar(null, 1000)).toEqual({ way: '', reach: 0 });
    expect(phaseBar(30, 1000, 50)).toEqual({ way: '', reach: 0 });
  });
});
