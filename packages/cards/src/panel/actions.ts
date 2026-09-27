/** The fluvy panel's actions beyond the look: the automatic dashboard, the settings file, the reset, the facts. */
import { HOUSE_DEFAULTS, parseHouse, parsePersonal } from '@fluvy/core';
import { VIEWS } from '../strategy/home-views.js';
import { strategyOptions, type PanelContext } from './model.js';
import type { FluvyPanel } from './panel.js';

interface FluvyHost {
  readonly version?: string;
  readonly shell?: { report(): { active: boolean; sheets: readonly { attached: boolean }[] } };
}

/** The automatic dashboard as the panel creates it. */
const AUTO = { url: 'fluvy-auto', title: 'Fluvy auto', icon: 'fluvy:sun' } as const;

export function createAuto(panel: FluvyPanel, ctx: PanelContext): void {
  if (panel.creating) return;
  panel.creating = true;
  ctx.run(async () => {
    try {
      await ctx.hass.callWS({
        type: 'lovelace/dashboards/create',
        url_path: AUTO.url,
        title: AUTO.title,
        icon: AUTO.icon,
        show_in_sidebar: true,
        require_admin: false,
        mode: 'storage',
      });
      await ctx.hass.callWS({
        type: 'lovelace/config/save',
        url_path: AUTO.url,
        config: { strategy: { type: 'custom:fluvy-home' } },
      });
      await panel.loadDashboards();
    } finally {
      panel.creating = false;
    }
  });
}

/** Lists the automatic dashboard in Home Assistant's sidebar, or takes its entry out (the dashboard stays). */
export function showInSidebar(panel: FluvyPanel, ctx: PanelContext, on: boolean): void {
  const auto = panel.dashboards.find((d) => d.strategy);
  if (!auto?.id) return;
  const id = auto.id;
  ctx.run(async () => {
    await ctx.hass.callWS({
      type: 'lovelace/dashboards/update',
      dashboard_id: id,
      show_in_sidebar: on,
    });
    await panel.loadDashboards();
  });
}

/**
 * Everything Fluvy keeps, as a file to carry to another house: the house's settings (look, where it applies,
 * the frame, the menus' icons), this person's, and the automatic dashboard's options.
 */
export function exportSettings(panel: FluvyPanel, ctx: PanelContext): void {
  const { house, personal } = ctx.handle.store;
  const strategy = panel.dashboards.find((d) => d.strategy)?.strategy;
  const file = {
    fluvy: 1,
    version: aboutFacts().version,
    exported: new Date().toISOString(),
    house,
    personal,
    ...(strategy
      ? {
          dashboard: strategyOptions(
            strategy,
            VIEWS.map((view) => view.key),
          ),
        }
      : {}),
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
      dashboard?: unknown;
    };
    if (data.fluvy !== 1) throw new Error(panel.t('about.invalid'));
    await handle.store.saveHouse(parseHouse(data.house));
    await handle.store.savePersonal(parsePersonal(data.personal));
    // the automatic dashboard takes the file's options when this house has one
    const auto = panel.dashboards.find((d) => d.strategy);
    if (auto && data.dashboard !== undefined) {
      await panel.hass?.callWS({
        type: 'lovelace/config/save',
        url_path: auto.urlPath,
        config: {
          strategy: {
            type: 'custom:fluvy-home',
            ...strategyOptions(
              data.dashboard,
              VIEWS.map((view) => view.key),
            ),
          },
        },
      });
      await panel.loadDashboards();
    }
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
