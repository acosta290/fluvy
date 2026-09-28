// @vitest-environment happy-dom
import { demoHass } from '@fluvy/demo-home';
import { describe, expect, it } from 'vitest';
// the cards register their heights with core: the strategy lays columns out with them
import '../index.js';
import { defineHomeStrategy } from './define.js';
import { FluvyHomeStrategy } from './home-strategy.js';

describe('the strategy defined for Home Assistant', () => {
  it('answers with the strategy’s own views once its file has arrived', async () => {
    defineHomeStrategy();
    defineHomeStrategy(); // a second definition is not an error: the tag is defined once
    const defined = customElements.get('ll-strategy-dashboard-fluvy-home') as unknown as {
      generate: (config: unknown, hass: unknown) => Promise<unknown>;
    };
    expect(defined).toBeDefined();
    const config = { type: 'custom:fluvy-home' as const };
    const hass = demoHass() as never;
    await expect(defined.generate(config, hass)).resolves.toEqual(
      await FluvyHomeStrategy.generate(config, hass),
    );
  });
});
