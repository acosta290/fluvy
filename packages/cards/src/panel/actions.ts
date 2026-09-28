/** The fluvy panel's actions beyond the look: the automatic dashboards, the settings file, the reset, the facts. */
import { HOUSE_DEFAULTS, parseHouse, parsePersonal } from '@fluvy/core';
import { HOME_TEMPLATE, strategyOptions, type Template } from '../strategy/templates.js';
import type { PanelContext } from './model.js';
import type { FluvyPanel } from './panel.js';

interface FluvyHost {
  readonly version?: string;
  readonly shell?: { report(): { active: boolean; sheets: readonly { attached: boolean }[] } };
}

/** A template's dashboard as the panel creates it: its url path, "Fluvy · Rooms" in the administrator's language, its icon. */
export function createDashboard(panel: FluvyPanel, ctx: PanelContext, template: Template): void {
  if (panel.creating) return;
  panel.creating = template.url;
  ctx.run(async () => {
    try {
      await ctx.hass.callWS({
        type: 'lovelace/dashboards/create',
        url_path: template.url,
        title: `Fluvy · ${ctx.t(template.title)}`,
        icon: template.icon,
        show_in_sidebar: true,
        require_admin: false,
        mode: 'storage',
      });
      await ctx.hass.callWS({
        type: 'lovelace/config/save',
        url_path: template.url,
        config: { strategy: { type: template.type } },
      });
      await panel.loadDashboards();
    } finally {
      panel.creating = '';
    }
  });
}

/**
 * Two taps within four seconds recreate a dashboard: its configuration becomes the bare strategy again (every
 * option back to its default; the dashboard itself, its url and its sidebar entry stay). The first tap arms the
 * row (it says so, in the warning tone), the second does it.
 */
export function recreateDashboard(panel: FluvyPanel, ctx: PanelContext, urlPath: string): void {
  const dashboard = panel.dashboards.find((d) => d.urlPath === urlPath);
  if (!dashboard?.template) return;
  if (panel.recreateArmed !== urlPath) {
    panel.recreateArmed = urlPath;
    clearTimeout(panel.recreateTimer);
    panel.recreateTimer = window.setTimeout(() => (panel.recreateArmed = ''), 4000);
    return;
  }
  clearTimeout(panel.recreateTimer);
  panel.recreateArmed = '';
  const { type } = dashboard.template;
  panel.run(async () => {
    await ctx.hass.callWS({
      type: 'lovelace/config/save',
      url_path: urlPath,
      config: { strategy: { type } },
    });
    await panel.loadDashboards();
  }, 'dashboard.recreated');
}

/** Lists a dashboard in Home Assistant's sidebar, or takes its entry out (the dashboard stays). */
export function showInSidebar(
  panel: FluvyPanel,
  ctx: PanelContext,
  urlPath: string,
  on: boolean,
): void {
  const id = panel.dashboards.find((d) => d.urlPath === urlPath)?.id;
  if (!id) return;
  ctx.run(async () => {
    await ctx.hass.callWS({
      type: 'lovelace/dashboards/update',
      dashboard_id: id,
      show_in_sidebar: on,
    });
    await panel.loadDashboards();
  });
}

/** The options of every one of our dashboards, by url path: what the settings file carries. */
function dashboardOptions(panel: FluvyPanel): Record<string, Record<string, unknown>> {
  const options: Record<string, Record<string, unknown>> = {};
  for (const dashboard of panel.dashboards)
    if (dashboard.strategy && dashboard.template)
      options[dashboard.urlPath] = strategyOptions(dashboard.strategy, dashboard.template);
  return options;
}

/**
 * Everything Fluvy keeps, as a file to carry to another house: the house's settings (look, where it applies,
 * the frame, the menus' icons), this person's, and the options of every one of our dashboards.
 */
export function exportSettings(panel: FluvyPanel, ctx: PanelContext): void {
  const { house, personal } = ctx.handle.store;
  const dashboards = dashboardOptions(panel);
  const file = {
    fluvy: 1,
    version: aboutFacts().version,
    exported: new Date().toISOString(),
    house,
    personal,
    ...(Object.keys(dashboards).length ? { dashboards } : {}),
  };
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'fluvy-settings.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function importSettings(panel: FluvyPanel, file: File): void {
  const handle = panel.look;
  if (!handle) return;
  panel.run(async () => {
    const data = JSON.parse(await file.text()) as {
      fluvy?: unknown;
      house?: unknown;
      personal?: unknown;
      /** A 1.2 file: the home dashboard's options alone. */
      dashboard?: unknown;
      dashboards?: unknown;
    };
    if (data.fluvy !== 1) throw new Error(panel.t('about.invalid'));
    await handle.store.saveHouse(parseHouse(data.house));
    await handle.store.savePersonal(parsePersonal(data.personal));
    // every dashboard of ours this house has takes the file's options for it (a 1.2 file names only the home's)
    const carried: Record<string, unknown> =
      typeof data.dashboards === 'object' && data.dashboards !== null
        ? (data.dashboards as Record<string, unknown>)
        : {};
    const home = panel.dashboards.find((d) => d.template?.id === HOME_TEMPLATE.id);
    if (home && data.dashboard !== undefined && carried[home.urlPath] === undefined)
      carried[home.urlPath] = data.dashboard;
    let written = false;
    for (const [urlPath, options] of Object.entries(carried)) {
      const dashboard = panel.dashboards.find((d) => d.urlPath === urlPath);
      const template = dashboard?.template;
      if (!template) continue;
      await panel.hass?.callWS({
        type: 'lovelace/config/save',
        url_path: urlPath,
        config: { strategy: { type: template.type, ...strategyOptions(options, template) } },
      });
      written = true;
    }
    if (written) await panel.loadDashboards();
  }, 'about.imported');
}

/** Two taps within four seconds: the first arms it (the row says so, in the warning tone), the second resets. */
export function resetHouse(panel: FluvyPanel): void {
  if (!panel.resetArmed) {
    panel.resetArmed = true;
    clearTimeout(panel.resetTimer);
    panel.resetTimer = window.setTimeout(() => (panel.resetArmed = false), 4000);
    return;
  }
  clearTimeout(panel.resetTimer);
  panel.resetArmed = false;
  const handle = panel.look;
  if (handle) panel.run(() => handle.store.saveHouse(HOUSE_DEFAULTS), 'about.reset_done');
}

/** The bundle's version, and how much of Home Assistant's shell wears the look. */
export function aboutFacts(): { version: string; shell: { styled: number; total: number } | null } {
  const host = (window as unknown as { __fluvy?: FluvyHost }).__fluvy;
  const report = host?.shell?.report();
  return {
    version: host?.version ?? '',
    shell: report?.active
      ? {
          styled: report.sheets.filter((sheet) => sheet.attached).length,
          total: report.sheets.length,
        }
      : null,
  };
}
