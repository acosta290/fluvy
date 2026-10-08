// @vitest-environment happy-dom
import { demoHass } from '@fluvy/demo-home';
import { afterAll, describe, expect, it } from 'vitest';
// the cards register their heights with core: the strategy lays columns out with them
import { familiesDefined } from '../index.js';
import { defineStrategies, TEMPLATE_IDS } from './define.js';
import { generate } from './generate.js';
import { TEMPLATES } from './templates.js';

describe('the strategies defined for Home Assistant', () => {
  // the families' chunks are fetched as the module loads: they land before the file's environment goes
  afterAll(() => familiesDefined);

  it('defines one element per template, and names the same five the templates do', () => {
    defineStrategies();
    defineStrategies(); // a second definition is not an error: each tag is defined once
    for (const id of TEMPLATE_IDS)
      expect(customElements.get(`ll-strategy-dashboard-fluvy-${id}`)).toBeDefined();
    expect(TEMPLATES.map((template) => template.id)).toEqual(TEMPLATE_IDS);
  });

  it('answers with the template’s own views once its file has arrived', async () => {
    defineStrategies();
    const hass = demoHass() as never;
    for (const template of TEMPLATES) {
      const defined = customElements.get(
        `ll-strategy-dashboard-fluvy-${template.id}`,
      ) as unknown as {
        generate: (config: unknown, hass: unknown) => Promise<unknown>;
      };
      const config = { type: template.type };
      await expect(defined.generate(config, hass)).resolves.toEqual(await generate(config, hass));
    }
  });
});
