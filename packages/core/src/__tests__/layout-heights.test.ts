import { describe, expect, it } from 'vitest';
import { declaredHeights, declareHeight, layoutHeightOf } from '../layout-heights.js';

describe('the heights cards declare', () => {
  it('answers a declared card from its config and anything else with the fallback', () => {
    declareHeight('fluvy-test-card', (config) => (config['tall'] ? 300 : 100));
    expect(layoutHeightOf({ type: 'custom:fluvy-test-card' }, 64)).toBe(100);
    expect(layoutHeightOf({ type: 'custom:fluvy-test-card', tall: true }, 64)).toBe(300);
    expect(layoutHeightOf({ type: 'custom:someone-else' }, 64)).toBe(64);
    expect(layoutHeightOf({ type: 'entities' }, 64)).toBe(64);
    expect(declaredHeights().has('fluvy-test-card')).toBe(true);
  });
});
