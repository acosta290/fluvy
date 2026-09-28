import type { HomeAssistant } from '@fluvy/core';
import { buildContext, COLUMNS, framed, withCards } from './context.js';
import { VIEWS } from './home-views.js';
import type { FluvyHomeStrategyConfig, View, ViewKey } from './types.js';

/** The `custom:fluvy-home` dashboard: its views built from the house, each framed. Fetched when a dashboard asks. */
export async function generate(
  config: FluvyHomeStrategyConfig,
  hass: HomeAssistant,
): Promise<{ views: View[] }> {
  const ctx = await buildContext(config, hass);
  const hidden = new Set<ViewKey>(config.hide ?? []);
  const views = VIEWS.filter((spec) => spec.key === 'home' || !hidden.has(spec.key))
    .map((spec) => ({ spec, sections: withCards(spec.build(ctx)) }))
    .filter(({ spec, sections }) => (spec.when ? spec.when(ctx) : sections.length > 0))
    .map(({ spec, sections }): View => ({
      title: ctx.t(spec.title),
      icon: spec.icon,
      path: spec.key,
      type: 'sections',
      max_columns: COLUMNS,
      sections,
    }));
  return { views: views.map((view) => framed(view, ctx, views)) };
}
