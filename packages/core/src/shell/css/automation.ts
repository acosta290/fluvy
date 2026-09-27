/*
 * The automation and script editors.
 */

/** `manual-automation-editor` / `manual-script-editor`: section headings as section titles (20/600 on the 4 grid), "(optional)" as a quiet label, prose kept readable, the row panel inside the frame (16 above and below). */
export const manualEditorCss = `.header .name { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; margin: 24px 0 12px; }
.header .small { font-size: 13px; font-weight: 500; line-height: 16px; color: var(--secondary-text-color); }
p { max-width: 72ch; margin-block: 0 16px; }
ha-automation-sidebar { height: calc(100dvh - var(--header-height) - 32px - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px)); }`;

/** `ha-automation-editor` / `ha-script-editor`: the editor on the page's 16 gutter, the YAML box inset from the frame. */
export const editorPageCss = `manual-automation-editor, manual-script-editor { padding: 0 16px; }
.yaml-mode { padding: 16px; box-sizing: border-box; }`;

/** The row side panel: a hairline and the lift of a sheet, not a 2 px accent frame (the selected row keeps its accent outline). */
export const sidebarCardCss =
  'ha-card { border-width: 1px; border-color: var(--fluvy-border); box-shadow: var(--fluvy-shadow-lift); } .card-content { padding-top: 8px; }';
export const sidebarCss =
  ':host { --ha-bottom-sheet-border-width: 1px; --ha-bottom-sheet-border-color: var(--fluvy-border); }';

/** A trigger / condition / action row: controls centred on multi-line rows, 56 tall with the border, titles 15/500; the leading glyph a 24 box, not an inline icon on a text line (24.17 px, rows on sub-pixels). */
export const automationRowCss = `.row { align-items: center; min-height: 54px; }
.leading-icon-wrapper { padding-top: 0; }
::slotted([slot="leading-icon"]) { display: flex; }
::slotted([slot="header"]) { font-size: 15px; font-weight: 500; }`;

/** The rows' drag handles (triggers, conditions, actions, options): a 32 box on whole pixels. */
export const rowListCss =
  '.handle { display: flex; } .buttons > ha-button { --ha-button-height: 44px; }';

/** Shortcut hints in the rows' menus ("Ctrl + C") in the interface face, not a code face. */
export const overflowShortcutCss =
  '.overflow-label .shortcut span { font-family: var(--ha-font-family-body); font-size: 12px; font-weight: 500; }';

/**
 * The save button of the editors (automation, script, blueprint, scene) rises from below the frame on a
 * transform when there is something to save, instead of animating its bottom offset (a layout property);
 * nothing moves with reduced motion.
 */
const saveFab = (
  rest: string,
): string => `ha-button[slot="fab"] { bottom: ${rest}; transform: translateY(calc(100% + 32px + var(--safe-area-inset-bottom, 0px))); transition: transform var(--fluvy-duration-normal) var(--fluvy-ease-standard); }
ha-button[slot="fab"].dirty { transform: none; }
@media (prefers-reduced-motion: reduce) { ha-button[slot="fab"] { transition: none; } }`;
export const saveFabCss = saveFab('calc(16px + var(--safe-area-inset-bottom, 0px))');
/** The scene editor's button sits in the page's floating-button slot, which already places it. */
export const sceneSaveFabCss = saveFab('0');

/**
 * The Add trigger / condition / action picker: rows on the menus' idiom (radius 10 inside a 6 px inset,
 * the chosen row on the accent fill); the Time and Sun rows' glyphs in the floors' glyph column (past the
 * tree's 22 px chevron column) with the tree's 12 px gap, so their labels start where the floors' do.
 */
export const addFromTargetCss = `ha-list-item-button { margin-inline: 6px; border-radius: 10px; overflow: hidden; --ha-row-item-padding-inline: 34px 12px; --ha-row-item-gap: 12px; --ha-row-item-min-height: 44px; }
ha-list-item-button:has(> ha-icon-next) { --ha-row-item-padding-inline: 6px 12px; }
ha-floor-icon { display: flex; }
ha-list-item-button.selected { background-color: var(--fluvy-accent-fill); --md-list-item-label-text-color: var(--fluvy-accent-on-fill); --icon-primary-color: var(--fluvy-accent-on-fill); }
ha-list-item-button.selected::part(headline), ha-list-item-button.selected ha-icon, ha-list-item-button.selected ha-svg-icon { color: var(--fluvy-accent-on-fill); }`;

/** A row's targets: our page-fill chip (radius 12, no border) with the integration logos in grey. */
export const rowTargetsCss = `.target { border-radius: var(--fluvy-radius-control); border: 0; background: var(--fluvy-page); }
.target ha-domain-icon { filter: grayscale(1); opacity: 0.85; }`;

/** Action forms: the spacer beside a required field is as wide as the checkbox beside an optional one. */
export const serviceControlCss =
  '.checkbox-spacer { width: 28px; } ha-settings-row[narrow] { padding-bottom: 16px; }';

/** A narrow settings row (an action's field under its label): 12 over the label, the field 16 over the next row's line (HA kept a 56 minimum and 8 / 8). */
export const settingsRowCss = ':host([narrow]) .body { min-height: 0; padding-block: 12px 2px; }';

/** If / Then / Else and a Choose option: their headings 14/600 on the 4 grid, 16 over and 8 under (the browser's 18.6 margins put every nested row on a fraction). */
export const nestedBlockCss =
  'h4 { margin: 16px 0 8px; font-size: 14px; line-height: 20px; font-weight: 600; } h4:first-child, h4.top { margin-top: 0; }';

/** The lists' empty state (no scenes, no scripts): the language's 44 ring with the glyph, a 20/600 title, a secondary line. */
export const emptyPickerCss = `.empty ha-svg-icon { --mdc-icon-size: 20px; width: 44px; height: 44px; padding: 12px; box-sizing: border-box; border-radius: 50%; background: var(--card-background-color); box-shadow: inset 0 0 0 1px var(--fluvy-border-strong); color: var(--secondary-text-color); }
.empty h1 { font-size: 20px; line-height: 24px; font-weight: 600; margin: 16px 0 8px; }
.empty p { color: var(--secondary-text-color); margin: 0 0 16px; }`;

/**
 * The Add trigger / condition / action dialog: its panes on the search field's 16 column and 16 above the
 * dialog's foot (HA insets them 12), the chosen group in the By type list on the accent fill like every
 * chosen row.
 */
export const addElementDialogCss = `ha-automation-add-from-target, .groups { margin: 12px 0 16px 16px; }
ha-bottom-sheet ha-automation-add-from-target, ha-bottom-sheet .groups { margin: 12px 16px 16px; }
.groups .selected { background-color: var(--fluvy-accent-fill); --md-list-item-label-text-color: var(--fluvy-accent-on-fill); --icon-primary-color: var(--fluvy-accent-on-fill); }`;
