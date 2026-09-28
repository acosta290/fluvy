// @vitest-environment happy-dom
import { declaredHeights, layoutHeightOf, type LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../index.js';

type CardClass = {
  layoutHeight?: (config: LovelaceCardConfig) => number;
  getStubConfig?: (hass: unknown, entities: readonly string[]) => LovelaceCardConfig;
};

describe('every card knows its height at a 360 column', () => {
  it.each(CATALOGUE.map(([tag, element]) => ({ tag, card: element as unknown as CardClass })))(
    '$tag',
    ({ tag, card }) => {
      expect(typeof card.layoutHeight, tag).toBe('function');
      const config = card.getStubConfig?.(undefined, ['light.a', 'sensor.b']) ?? {
        type: `custom:${tag}`,
      };
      const height = card.layoutHeight!({ ...config, type: `custom:${tag}` });
      expect(Number.isFinite(height) && height > 0, `${tag}: ${height}`).toBe(true);
      expect(height % 4, `${tag}: ${height} is not on the 4 px grid`).toBe(0);
      expect(declaredHeights().has(tag), `${tag} is registered`).toBe(true);
      expect(layoutHeightOf({ ...config, type: `custom:${tag}` }, -1)).toBe(height);
    },
  );
});
