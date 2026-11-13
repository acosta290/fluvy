// the dashboards' words first: they are here before anything in the strategy's chunk says them
import './english.js';
import type { HomeAssistant } from '@fluvy/core';
import { appliancesView } from './appliances.js';
import { moreHost } from './caps.js';
import { buildContext, framed, withCards } from './context.js';
import { arranged, editOf, pinned } from './edit.js';
import { roomView } from './rooms.js';
import { HOME_TEMPLATE, templateOf, viewsOf, type Template } from './templates.js';
import type { FluvyStrategyConfig, MoreHost, View } from './types.js';

/** An automatic dashboard: the template its type names, built from the house. Fetched when a dashboard asks. */
export async function generate(
  config: FluvyStrategyConfig,
  hass: HomeAssistant,
): Promise<{ views: View[] }> {
  return generateWith(templateOf(config.type) ?? HOME_TEMPLATE, config, hass);
}

/**
 * A template's dashboard: its views built from the house (the first always, the others when the house has what they
 * show and the configuration keeps them), each framed; then a subview per room the template opens, the one of every
 * appliance its Home leads to, and the ones the views' capped lists open (#78), each under the view it leads back to.
 * What a person changed on it (`edit`, #170) is laid over it as it is built: a view hidden or moved among the tabs, a
 * view's parts in their order, their own cards after them. `built` gathers the views as they were built, each with its
 * parts (Customise lists them).
 */
export async function generateWith(
  template: Template,
  config: FluvyStrategyConfig,
  hass: HomeAssistant,
  base?: string,
  built?: MoreHost[],
): Promise<{ views: View[] }> {
  const made = await buildContext(config, hass, base);
  // a template without the greeting opens its columns with nothing
  const ctx = template.header === 'hello' ? made : { ...made, header: 0 };
  const edit = editOf(config.edit);
  const hidden = new Set([
    ...(config.hide ?? []),
    ...Object.keys(edit.views ?? {}).filter((path) => edit.views?.[path]?.hidden === true),
  ]);
  /** A view's host: what it is built on, kept for whoever asked for them. */
  const hostOf = (path: string, title: string, icon: string): MoreHost => {
    const more = moreHost(path, title, icon, template.columns, edit);
    built?.push(more);
    return more;
  };
  const kept = pinned(
    viewsOf(template, ctx)
      .filter((spec, index) => index === 0 || !hidden.has(spec.key))
      .map((spec) => {
        const title = spec.name ?? ctx.t(spec.title);
        const more = hostOf(spec.key, title, spec.icon);
        return {
          spec,
          title,
          more,
          sections: withCards(arranged(more, spec.build({ ...ctx, more }))),
        };
      })
      .filter(
        ({ spec, sections }, index) =>
          index === 0 || (spec.when ? spec.when(ctx) : sections.length > 0),
      ),
    ({ spec }) => edit.views?.[spec.key]?.order,
  );
  const views = kept.map(({ spec, title, sections }): View => ({
    title,
    icon: spec.icon,
    path: spec.key,
    type: 'sections',
    max_columns: template.columns,
    sections,
  }));
  const framedViews = views.map((view) => framed(view, ctx, views, template));
  // a subview per room: reached from a room's card (never a tab), with the same frame
  const rooms = (
    template.rooms?.(
      ctx,
      views.map((view) => view.path),
    ) ?? []
  ).map(({ area, back }) => {
    const more = hostOf(`room-${area.area_id}`, area.name, area.icon ?? 'fluvy:home');
    return { view: roomView({ ...ctx, more }, area, template.columns, back), more };
  });
  const appliances =
    template.appliances && ctx.home.applianceDevices.length
      ? [framed(appliancesView(ctx, template.columns, hostOf), ctx, views, template)]
      : [];
  const lists = [...kept, ...rooms].flatMap(({ more }) => more.views);
  return {
    views: [
      ...framedViews,
      ...rooms.map(({ view }) => framed(view, ctx, views, template)),
      ...appliances,
      ...lists.map((view) => framed(view, ctx, views, template)),
    ],
  };
}
