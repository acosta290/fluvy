import { emptyState, headRow, mask, optionTiles } from './shared.js';

/** Settings' pages (Settings, System) and the glyph each takes in our icons; a page not listed keeps its own icon. */
export const CONFIG_GLYPHS: Readonly<Record<string, string>> = {
  '/config/cloud': 'cloud',
  '/config/integrations': 'devices',
  '/config/automation': 'automation',
  '/config/areas': 'rooms',
  '/config/apps': 'puzzle',
  '/config/lovelace/dashboards': 'grid',
  '/config/connectivity': 'wifi',
  '/config/voice-assistants': 'mic',
  '/config/tags': 'tag',
  '/config/person': 'person',
  '/config/system': 'gear',
  '/config/tools': 'wrench',
  '/config/info': 'info',
  '/config/general': 'home',
  '/config/updates': 'update',
  '/config/repairs': 'warn',
  '/config/logs': 'text',
  '/config/backup': 'archive',
  '/config/entity-id-format': 'tag',
  '/config/analytics': 'chart',
  '/config/ai-tasks': 'sparkle',
  '/config/labs': 'flask',
  '/config/network': 'globe',
  '/config/storage': 'database',
  '/config/hardware': 'chip',
};

/** The glyph of the page an item opens (its path, or the path under which it sits). */
export const configGlyph = (href: string): string | undefined =>
  CONFIG_GLYPHS[href.replace(/[?#].*$/, '').replace(/\/$/, '')];

/**
 * Settings lists: the frontend paints each section's icon on its own brand colour; here every one is our icon
 * circle (accent on the accent's wash) with our glyph (named on the circle by `shell/navigation.ts`).
 */
export const configListCss = `.icon-background { background-color: var(--fluvy-accent-wash) !important; }
.icon-background ha-svg-icon { color: var(--fluvy-accent); }
${[...new Set(Object.values(CONFIG_GLYPHS))]
  .map(
    (glyph) =>
      `.icon-background[data-fluvy-glyph="${glyph}"] > ha-svg-icon { color: transparent; background-color: var(--fluvy-accent); -webkit-mask: ${mask(glyph)} center / 20px 20px no-repeat; mask: ${mask(glyph)} center / 20px 20px no-repeat; }`,
  )
  .join('\n')}`;

/** Card headers (`ha-card` in Settings and the built-in cards): 20/600, the section title's face (the size comes from the theme). */
export const cardHeaderCss =
  '.card-header, :host ::slotted(.card-header) { font-weight: var(--fluvy-weight-semibold); letter-spacing: -0.01em; }';

/** A card's action row (`.card-actions` in Settings, Profile, Tools): a plain button's label and a filled button's edge land on the card's 16 content column. */
export const cardActionsCss = ':host ::slotted(.card-actions) { padding: 8px 16px 8px 0; }';

/** Section and card titles that HA draws as haStyle `h1`s (24/400) or its own `.title` / `.heading` (16/400): the card title's face, 20/600. */
export const sectionHeadingCss = `h1 { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; }
h1.card-header { line-height: 34px; font-weight: 600; letter-spacing: -0.01em; }
.title, .heading { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; color: var(--primary-text-color); }`;

/** Settings' own section header (`ha-config-section`): the same 20/600 title; the phone's 16 gutter. */
export const configSectionCss = `.header { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; }
@media (max-width: 600px) { .content { padding-inline: 16px; } }`;

/**
 * The Settings home: the repairs / updates heads as a card head (16/600, not 16/400); one 16 rhythm between all
 * its cards (HA put 16 after the alerts, 24 before and between the others); the first card 16 under the toolbar
 * at every width (HA's −32 / −42 section margins were sized for its own spacing and put ours 8 px under the bar
 * on a desktop, 2 px on a phone); on the phone 20-radius cards inset 16 — the section's own gutter, once (HA
 * squares its cards there and pulls them out by the safe area; a margin of ours on top of the gutter had put
 * them 32 in) — like every other Settings page.
 */
export const configDashboardCss = `.dashboard-alert-title { font-weight: 600; letter-spacing: -0.006em; }
.dashboard-alerts { margin-top: 16px; }
ha-config-section { margin-top: -16px; }
ha-config-section > ha-card { margin-top: 16px; }
@media all and (max-width: 600px) {
  ha-card { width: 100%; margin-inline: 0; padding-inline: 0; border-width: 1px; border-radius: var(--ha-card-border-radius); }
}`;

/** Material list rows (integration entries, network, Z-Wave pages): the label 500 and the supporting line 13/500, as our rows' two lines (HA leaves both at 400). */
export const mdListItemCss =
  ':host { --md-list-item-label-text-weight: 500; --md-list-item-label-text-line-height: 20px; --md-list-item-supporting-text-size: 13px; --md-list-item-supporting-text-weight: 500; --md-list-item-supporting-text-line-height: 16px; }';

/** Integrations: the search 36 like on the table tabs beside it, the grid on the title's column, the "1 disabled · Show" pill as a 36 control. */
export const integrationsCss = `@media (min-width: 871px) { ha-input-search { --ha-input-search-height: 36px; --ha-input-search-border-radius: var(--fluvy-radius-control); } }
.container { margin: 0; padding: 8px 16px 16px; }
.active-filters { height: 36px; border-radius: var(--fluvy-radius-control); padding-inline: 14px 4px; font-size: 13px; font-weight: 500; }`;
export const integrationHeaderCss = '.primary { font-weight: 600; letter-spacing: -0.006em; }';
/** A discovered integration's card names it as the configured ones do (16/600), its source 13/500 secondary. */
export const integrationActionCardCss = `h2 { font-weight: 600; letter-spacing: -0.006em; }
h3 { font-size: 13px; font-weight: 500; color: var(--secondary-text-color); }`;
export const entryRowCss = ':host([narrow]) { margin-inline: 0; }';

/**
 * Area cards: one-line names with an ellipsis (rows stay level), the menu button on the name's line; the
 * counts line ("3 devices and 12 entities") as a secondary line under the name, which takes no room when
 * the area has none (HA kept a 32 band of whitespace); a floor's heading as a section title on the cards'
 * column (it was 14/500, 8 px in).
 */
export const areasCss = `.card-header { display: block; position: relative; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-inline-end: 56px; }
.card-header ha-icon-button { position: absolute; inset-inline-end: 8px; top: 50%; transform: translateY(-50%); }
.card-content { min-height: 0; margin-top: -12px; padding: 0 16px 16px; }
.card-content > div { font-size: 14px; line-height: 20px; color: var(--secondary-text-color); }
.card-content:empty { display: none; }
.header { padding-inline-start: 0; }
.header h2 { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; color: var(--primary-text-color); }`;

/** The Activity card's head (`.card-header` on the device page, `.logbook-header` on the area page) on the title line of the cards beside it. */
const activityHead = (head: string): string => headRow(head, `${head} ha-icon-button`);

/** An area page's paired actions share one width; its rows on the cards' 16 column; its Activity card is a preview on the cards' title line; "No scenes" and the like are empty states. */
export const areaPageCss = `:host { --fluvy-empty-margin: 0 16px 16px; }
ha-list-item { --mdc-list-side-padding: 16px; }
.action-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.action-buttons ha-button { width: 100%; }
ha-logbook { --fluvy-logbook-preview: 1; }
${activityHead('ha-card > .logbook-header')}
${emptyState('.no-entries', 'list')}`;

/** The device page's Activity card is a preview (a fade at the bottom), not a scroll box inside the page; the card's chevron opens the full Activity; its head sits on the title line of the cards beside it; a filled head button ("Add to…") ends on the column (HA pulls it 8 out, as for a text button). */
export const devicePageCss = `:host { --fluvy-empty-margin: 0 16px 16px; }
.card-header ha-button { margin-inline-end: 0; }
ha-logbook { --fluvy-logbook-preview: 1; }
${activityHead('ha-card:has(ha-logbook) .card-header')}`;

/** "No activity found" (more-info, the Activity cards, the Activity panel) as the empty state; where the logbook has a set height (a card's preview), the panel fills it instead of floating over a blank tail. */
export const logbookEmptyCss = emptyState('.no-entries', 'list');
/** The entities card of a device page: its "Add to dashboard" label on the card's column (its actions are not a direct child of the card, so the card's own rule misses them). */
export const deviceEntitiesCardCss = '.card-actions { padding: 8px 16px 8px 0; }';
export const logbookCss = `${logbookEmptyCss}
:host([virtualize]) { display: flex; flex-direction: column; }
:host([virtualize]) .no-entries { flex: 1 1 auto; }`;
export const logbookRendererCss =
  '@container style(--fluvy-logbook-preview: 1) { lit-virtualizer { overflow: hidden !important; -webkit-mask-image: linear-gradient(#000 calc(100% - 24px), transparent); mask-image: linear-gradient(#000 calc(100% - 24px), transparent); } }';

/** Create helper: a picker list without an inner bar, as tall as it needs up to the dialog. */
export const helperDialogCss =
  'ha-list { height: auto; max-height: calc(60vh - 120px); scrollbar-width: none; padding-bottom: 8px; } ha-list-item { --mdc-list-side-padding: 16px; }';

/** The scene editor: a section's description 16 over its card, the phone's 16 gutter. */
export const sceneEditorCss =
  'ha-config-section > ha-card { margin-top: 16px; } @media (max-width: 600px) { .container { padding-inline: 16px; } }';

/** The schedule helper's week: no default yellow on today, the grid in a 12-radius hairline frame. */
export const scheduleFormCss =
  '#calendar { --fc-today-bg-color: transparent; } .fc-theme-standard .fc-scrollgrid { border-radius: var(--fluvy-radius-control); overflow: hidden; border-color: var(--fluvy-border); }';

/** The filter panes: the search on the rows' 16 column (HA put it at 8). */
export const filterPaneCss = 'ha-input-search { padding: 8px 16px 4px; }';

/**
 * The log cards (condensed and full): the title on a card head's line with its buttons hanging over it
 * (it sat 7 px above their centre), without the extra 8 HA puts above the head; the log rows' text on the
 * card's 16 content column (padded 12: the two-line Material row draws a 4 px space before its text, the
 * template's whitespace after its baseline strut).
 */
export const logCardCss = `ha-card { padding-top: 0; }
${headRow('.header', '.header-buttons, .action-buttons')}
.header { padding-inline-end: 8px; }
.header .card-header { padding: 0; margin: 0; line-height: 34px; }
.header-buttons, .action-buttons { align-items: center; height: auto; }
ha-list-item { padding-inline: 12px 16px; }`;

/** Hardware: the Processor / Memory cards' heads as card heads (the title 20/600 on the head line, the reading beside it in figures), the loading veil inside the card's corners. */
export const hardwareCss = `.header { align-items: center; padding: 12px 16px 16px; line-height: 34px; }
.header .title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--primary-text-color); }
.header .value { font-size: 16px; font-weight: 600; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
.loading-overlay { border-radius: 0 0 calc(var(--ha-card-border-radius) - 1px) calc(var(--ha-card-border-radius) - 1px); }`;

/**
 * Network: the interface panels 8 apart (HA leaves 4) with their header and fields on one 16 column; inside, one
 * 16 rhythm between the fields (the theme takes the 8 every field kept under itself, and this page had nothing
 * else: Gateway and DNS touched), the method row 8 over what follows it; IP address and Netmask free to share a
 * phone's width (they would not shrink under 250 and ran off the screen); Automatic · Static · Disabled as option
 * tiles that fill the row.
 */
export const networkCss = `ha-expansion-panel { margin: 0; --expansion-panel-summary-padding: 0 16px; --expansion-panel-content-padding: 0 16px; }
ha-expansion-panel + ha-expansion-panel { margin-top: 8px; }
ha-expansion-panel > * + *, .nameservers > .address-row + .address-row { margin-top: 16px; }
ha-expansion-panel > ha-radio-group + * { margin-top: 8px; }
.address-row ha-input { min-width: 0; }
${optionTiles('ha-radio-group[orientation="horizontal"]')}`;
/** The URL card: its notice inside the content column (it ran edge to edge), copy fields free to shrink, the Internet / Local network headings 14/600 on 24 above and 8 below (the browser's 18.6 margins put every field after them on a fraction). */
export const urlFormCss = `ha-alert { margin: 16px 0; } ha-input-copy { min-width: 0; }
.description { margin-bottom: 0; } h4 { margin: 24px 0 8px; font-size: 14px; line-height: 20px; font-weight: 600; } .url-container { margin-top: 0; }`;
/** The network adapter's "Detected" line on a 16 line (the checkbox's own label now has its 20). */
export const networkAdapterCss = '.description { line-height: 16px; }';

/** A field with a Copy button (URLs, webhooks, cloud): it may shrink below its text's width (the network page scrolled sideways on the phone), the button on the field's centre. */
export const inputCopyCss =
  '.textfield-container { min-width: 0; } ha-button { margin-bottom: 0; }';

/** Assist: the pipeline rows' text on the card's 16 column (the list's own inset put it at 20). */
export const assistPrefCss = 'ha-list-item { --mdc-list-side-padding-left: 12px; }';

/** A page-level search (Logs, the app store) on the same strip as a table's toolbar: the page fill with a hairline below, the field 16 in and, on a desktop, 36 like the tables'. */
export const pageSearchCss = `.search ha-input-search { padding: 6px 16px; background: var(--primary-background-color); }
@media (min-width: 871px) { .search ha-input-search { --ha-input-search-height: 36px; --ha-input-search-border-radius: var(--fluvy-radius-control); padding-block: 10px; } }`;

/** Energy settings: the page's 16 gutter on the phone, the notice on it too (it ran edge to edge). */
export const energyConfigCss = `.content { padding-inline: 16px; }
@media (max-width: 632px) { ha-alert { margin-inline: 16px; } }`;

/** Brand images in lists (repairs, backup locations): the small tile's corners, not a sharp square. */
export const brandImageCss = 'img { border-radius: 10px; }';
export const brandImageSmallCss = 'img { border-radius: 6px; }';

/** The Assist card's brand mark in the neutral ink (Home Assistant's blue is not the palette), as brand marks in the media browser; partner marks (Google, Alexa) keep their colours. */
export const voiceBrandCss =
  'img[alt="Assist"] { filter: grayscale(1) contrast(0.9) brightness(0.8); }';

/** Zones: the full-height map reserves no floating-button room below it (the page scrolled 80 px for nothing). */
export const zonePageCss =
  '.flex { margin-bottom: calc(-64px - var(--safe-area-inset-bottom, 0px)); }';

/**
 * More-info: its content centred with no band kept for a scrollbar (a reserved gutter pushed the fields in and
 * stopped the sticky footers 10 px short of the dialog's edges); it scrolls without a visible bar, as menus do.
 */
export const moreInfoDialogCss = '.content { scrollbar-gutter: auto; scrollbar-width: none; }';

/** Labs: the features' titles 20/600 (HA draws 24/400 and 20/400), the integration's name 13/500, the actions on the card's content column (the page's own 8 px padding won over the cards' rule). */
export const labsCss = `.feature-title h2 { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; } .integration-name { font-size: 13px; font-weight: 500; }
.card-actions { padding: 8px 16px 8px 0; } .card-actions > ha-button:last-child { margin-inline-start: auto; }`;

/** The storage bar is the language's distribution bar: 2 px gaps, square swatches; the header centred on its button. */
export const segmentedBarCss = '.bar { gap: 2px; } .legend li .bullet { border-radius: 3px; }';
export const storageChartCss = '.header { align-items: center; }';
export const storageSectionCss = `ha-card { margin-bottom: 24px; }
.no-mounts { background: var(--fluvy-page-alt); border-radius: var(--fluvy-radius-lg); min-height: 120px; justify-content: center; gap: 12px; margin: 0 16px 16px; }
.no-mounts ha-svg-icon { background: var(--fluvy-card); box-shadow: inset 0 0 0 1px var(--fluvy-border); width: 44px; height: 44px; padding: 12px; box-sizing: border-box; }
.no-mounts p { margin: 0; color: var(--secondary-text-color); font: 500 14px/20px var(--ha-font-family-body); }`;

/** Option boxes (unit system, box-mode selects): option tiles — radius 12, the chosen one on the accent fill, no radio ring. */
export const selectBoxCss = `.option { padding: 11px 15px; border-radius: var(--fluvy-radius-control); border-color: transparent; background: var(--fluvy-page); }
.option .content .text .label { line-height: 20px; } .option .content .text .description { line-height: 16px; }
.option.selected { background: var(--fluvy-accent-fill); border-color: var(--fluvy-accent-fill-border); }
.option.selected:before { opacity: 0; }
ha-radio-option { display: none; }`;

/** App cards: two lines of description ending in an ellipsis; the store grid fills its row on the page gutter. */
export const appCardCss =
  '.addition { height: auto; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 20px; }';
export const appsGridCss =
  '.card-group { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin: 0; padding: 16px; }';

/**
 * The theme's mode (Auto · Light · Dark, Profile): three option tiles filling the row — a glyph over a
 * 12/500 label on the page fill, the chosen one on the accent fill — instead of three radios hugging the
 * left edge.
 */
const MODE_GLYPHS: Readonly<Record<string, string>> = { auto: 'auto', light: 'sun', dark: 'moon' };
export const themeSettingsCss = `.inputs { margin: 4px 16px 8px; row-gap: 8px; } .color-pickers { gap: 8px; } ha-input { margin: 0; }
ha-radio-group { flex: 1 1 100%; margin-inline-end: 0; }
ha-radio-group::part(form-control-input) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
ha-radio-option { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 0; padding: 12px 12px 8px; border-radius: var(--fluvy-radius-control); background: var(--fluvy-page); color: var(--secondary-text-color); cursor: pointer; transition: background-color var(--fluvy-duration-fast) var(--fluvy-ease-standard); }
ha-radio-option::part(control) { display: none; }
ha-radio-option::part(label) { font-size: 12px; font-weight: 500; line-height: 16px; }
ha-radio-option::before { content: ''; width: 20px; height: 20px; background-color: currentColor; }
${Object.entries(MODE_GLYPHS)
  .map(
    ([value, glyph]) =>
      `ha-radio-option[value="${value}"]::before { -webkit-mask: ${mask(glyph)} center / 20px 20px no-repeat; mask: ${mask(glyph)} center / 20px 20px no-repeat; }`,
  )
  .join('\n')}
ha-radio-option[aria-checked="true"] { background: var(--fluvy-accent-fill); color: var(--fluvy-accent-on-fill); }`;

/**
 * Backup schedule and retention rows: the number and its unit side by side, never overlapping; on the
 * phone each control drops under its label at the row's full width (HA squeezed 160 px selects beside
 * four-line labels: "System opti…", "Kee…").
 */
const backupNarrowRows = `@media all and (max-width: 450px) {
  ha-list-item-base::part(base), ha-row-item::part(base) { flex-wrap: wrap; row-gap: 8px; }
  ha-list-item-base::part(end), ha-row-item::part(end) { flex: 1 1 100%; }
  ha-select, ha-time-input { flex: 1 1 0; width: auto; min-width: 0; }
}`;
export const backupRetentionCss = `ha-input#value { margin: 0 8px 0 0; } ha-select { min-width: 0; } ha-select#type { width: auto; }
${backupNarrowRows}
@media all and (max-width: 450px) { ha-input#value { flex: 1 1 0; width: auto; min-width: 0; margin: 0 8px 0 0; } }`;
export const backupScheduleCss = backupNarrowRows;
/** Backup data: the apps' picker drops under its label on the phone as the cycle's do; the estimate on whole lines (its 38.8 block put every row under it on a fraction). */
export const backupDataCss = `.estimated-size-heading { line-height: 20px; } .estimated-size-value { line-height: 16px; }
@media all and (max-width: 450px) {
  ha-list-item-base:has(> ha-select)::part(base) { flex-wrap: wrap; row-gap: 8px; }
  ha-list-item-base:has(> ha-select)::part(end) { flex: 1 1 100%; }
  ha-list-item-base > ha-select { flex: 1 1 0; width: auto; min-width: 0; }
}`;
/** Backup locations: the footer's icon button on the card's content column, two buttons 8 apart when they stack. */
export const backupSettingsCss = '.card-actions { padding-inline-start: 4px; row-gap: 8px; }';

/** Expanders nested in cards: the 16 of an inner tile, on every page. */
export const expansionPanelCss =
  ':host([outlined]) { --ha-card-border-radius: var(--fluvy-radius-lg); }';
/** A form's expandable group (HTTP server…): its header and its fields on one 16 column (HA put them at 8 and 12). */
export const formExpandableCss = `ha-expansion-panel { --ha-card-border-radius: var(--fluvy-radius-lg); border-radius: var(--fluvy-radius-lg); --expansion-panel-summary-padding: 0 16px; }
.content { padding: 8px 16px 16px; }`;

/** Maps: Leaflet's zoom and attribution in the theme — a 12-radius control of 44 rounds with a hairline, the body font. */
export const mapCss = `.leaflet-bar, .leaflet-touch .leaflet-bar { border: 0; border-radius: var(--fluvy-radius-control); overflow: hidden; box-shadow: 0 0 0 1px var(--fluvy-border), 0 2px 6px -2px #0000001f; }
.leaflet-bar a, .leaflet-touch .leaflet-bar a { width: 44px; height: 44px; line-height: 44px; font: 500 20px/44px var(--ha-font-family-body); color: var(--primary-text-color); background: var(--card-background-color); border-bottom-color: var(--divider-color); }
.leaflet-control-attribution { font: 500 11px var(--ha-font-family-body); }
.leaflet-control-attribution a { color: var(--secondary-text-color); }`;

/** The Assist cloud promotion: our icon circle, not a purple disc. */
export const cloudDiscoverCss =
  '.round-icon { background: var(--fluvy-accent-wash); color: var(--fluvy-accent); }';

/** Dashboard edit mode: the "+" of a section in the text ink (it was the button default, black) on the one tappable radius. */
export const gridSectionCss =
  '.add { color: var(--primary-text-color); border-radius: var(--fluvy-radius-control); }';

/**
 * The energy settings cards: sub-heads ("Grid connections") as heads (600) with 8 to their box, the add button
 * 8 under the box and 24 above the next head, the rows' second line 13 px (it was 0.9 em: 12.6).
 */
export const energySettingsCss = `h3 { font-weight: 600; margin: 24px 0 8px; }
.row:has(> ha-button) { height: auto; }
.items-container + .row { margin-top: 8px; }
.label.secondary { font-size: 13px; }`;

/** Settings pages built on HA's `.content { padding: 28px 20px 0 }`: the 16 gutter of every other page on the phone. */
export const contentGutterCss = '@media (max-width: 600px) { .content { padding-inline: 16px; } }';

/** Profile: on the phone its cards 16 in, as every Settings card (HA runs them edge to edge there, corners cut by the screen). */
export const profileSectionCss =
  '@media (max-width: 632px) { .content > * { margin-inline: 16px; } }';

/** A panel title HA writes as its own `h1` (History, Media): 600 like every other page title (the `h1` rule kept it at 400). */
export const panelTitleCss = '.page-title { font-weight: 600; letter-spacing: -0.01em; }';

/**
 * HA's page-level empty state (History with no target, Activity with nothing to show): the language's idiom —
 * a 44 ring on the card fill with a 20 glyph, a 16/600 line, a 14/500 secondary line — in a 16-radius
 * page-alt panel, instead of a bare 64 glyph over 20/500 text.
 */
export const haEmptyStateCss = `.content { gap: 8px; min-height: 120px; min-width: min(100%, 360px); justify-content: center; padding: 24px 16px; border-radius: var(--fluvy-radius-lg); background: var(--fluvy-page-alt); }
ha-svg-icon { --mdc-icon-size: 20px; width: 44px; height: 44px; padding: 12px; box-sizing: border-box; border-radius: 50%; background: var(--fluvy-card); box-shadow: inset 0 0 0 1px var(--fluvy-border-strong); color: var(--secondary-text-color); }
h2 { font-size: 16px; line-height: 20px; font-weight: 600; letter-spacing: -0.006em; }
p { font-size: 14px; line-height: 20px; font-weight: 500; }`;
