import { emptyState } from './shared.js';

/*
 * The Settings tables and the pages around them (Devices, Entities, Automations, Backups …): HA
 * still draws their text in Material's body2 (0.875rem with 0.2 px tracking) and their toolbars in
 * 32/10 controls. Here: our type scale, the one field and chip idiom, whole-pixel tabs.
 */

/**
 * `ha-data-table`: 14/20 cells, 13/600 secondary headers, no tracking; 16 px gutters on the phone; group
 * labels centred in their band; icon columns keep room for a one-word title ("Active", "System"); brand
 * images with the small tile's corners; an empty or filtered-out table shows the empty state.
 */
export const dataTableCss = `:host { --fluvy-empty-margin: 16px; }
.mdc-data-table__content, .mdc-data-table__cell { font-size: 14px; line-height: 20px; letter-spacing: 0; }
.mdc-data-table__header-cell { font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: 0; color: var(--secondary-text-color); }
.mdc-data-table__header-cell--icon { padding-inline: 4px; }
.secondary { font-size: 13px; line-height: 16px; letter-spacing: 0; overflow: hidden; text-overflow: ellipsis; }
:host([narrow]) { --_cell-padding-inline: 16px; }
.group-header { padding-top: 0; font-size: 13px; font-weight: 600; letter-spacing: 0; color: var(--secondary-text-color); }
.mdc-data-table__cell img { border-radius: 6px; }
.mdc-data-table__row:has(> .mdc-data-table__cell.grows.center) { height: auto; border-top: 0; }
${emptyState('.mdc-data-table__cell.grows.center', 'list')}
ha-input-search { --ha-input-search-height: 36px; --ha-input-search-border-radius: var(--fluvy-radius-control); }`;

/**
 * The table page's toolbar: the search and the chips on one 36 line; on the phone the chips start at the
 * left and fade where they overflow. The Group by / Sort by menus mark the chosen row as every menu does
 * (the accent fill, no ring); the "1 filter · Clear" pill is a 36 control.
 */
export const tablePageCss = `@media (min-width: 871px) { ha-input-search { --ha-input-search-height: 36px; --ha-input-search-border-radius: var(--fluvy-radius-control); } }
ha-dropdown-item.selected { border: 0; font-weight: 500; color: var(--fluvy-accent-on-fill); background-color: var(--fluvy-accent-fill); --icon-primary-color: var(--fluvy-accent-on-fill); }
.active-filters { height: 36px; box-sizing: border-box; padding-inline: 14px 4px; font-size: 13px; font-weight: 500; }
.active-filters::before { border-radius: var(--fluvy-radius-control); }
ha-assist-chip { --md-assist-chip-container-height: 36px; --ha-assist-chip-container-shape: var(--fluvy-radius-pill, 9999px); }
.narrow-header-row { gap: 8px; }
.narrow-header-row .flex { display: none; }
.narrow-header-row { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent); }`;

/**
 * Tabbed subpages: the toolbar's hairline and the active tab's line drawn as shadows, so the tabs sit on
 * whole pixels; titles 600; the trailing slot always as wide as a button, so the centred tab strip does
 * not move between sibling pages with and without a help button; on the phone the back arrow and the
 * trailing button 12 in, as on every other subpage, and the bottom tabs sharing the bar (HA gives each a
 * quarter, so two tabs cut "System hardware" with half the bar free).
 */
export const tabsSubpageCss = `.toolbar { border-bottom: 0; box-shadow: inset 0 -1px 0 var(--divider-color); }
.main-title { font-weight: 600; letter-spacing: -0.01em; }
:host(:not([narrow])) #toolbar-icon { min-width: 48px; }
:host([narrow]) .toolbar-content { padding-inline: 12px; }
#tabbar.bottom-bar > a { flex: 1 1 0; width: auto; max-width: none; }
.main-title { line-height: 24px; }`;

/** A subpage's title: 600, and a 24 line, so a name that takes two lines on the phone stays inside the 56 bar. */
export const subpageCss =
  '.main-title { font-weight: 600; letter-spacing: -0.01em; line-height: 24px; }';

/** A tab: the active line as a shadow (the label stays on its line); the other tabs in the secondary ink, as the sidebar's items. */
export const tabCss = `:host(:not([narrow])[active]) div { border-bottom: 0; box-shadow: inset 0 -2px 0 var(--primary-color); }
:host(:not([active])) { color: var(--secondary-text-color); }`;

/** Panel headers (Activity, History, Energy, Tools, the 2026 dashboards): 600, as every other page title (a dashboard's own title takes `subpageCss`). */
export const pageTitleCss = '.title { font-weight: 600; letter-spacing: -0.01em; }';
