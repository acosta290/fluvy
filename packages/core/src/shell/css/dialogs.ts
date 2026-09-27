/*
 * Dialogs, sheets and alerts.
 */

/**
 * `ha-dialog-header` (more-info, pickers, the new dialogs): the title at 600 like every sheet title, and
 * names that end in an ellipsis instead of a hard cut. Clipped sideways only: more-info stacks its
 * breadcrumb over the name and lets both overflow the 24 title line on purpose.
 */
export const dialogHeaderCss = `.header-title { font-weight: 600; letter-spacing: -0.01em; overflow-x: clip; overflow-y: visible; text-overflow: ellipsis; white-space: nowrap; }
.header-subtitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;

/** `ha-alert`: our status panel — the role's pastel fill (not a 12 % wash of its ink), radius 12, 20 px lines, the icon centred. */
export const alertCss = `.issue-type { padding: 12px 16px; border-radius: var(--fluvy-radius-control); align-items: center; isolation: isolate; }
.issue-type::after { opacity: 1; border-radius: var(--fluvy-radius-control); z-index: -1; }
.issue-type.info::after { background-color: var(--fluvy-info-fill); }
.issue-type.warning::after { background-color: var(--fluvy-warning-fill); }
.issue-type.error::after { background-color: var(--fluvy-danger-fill); }
.issue-type.success::after { background-color: var(--fluvy-success-fill); }
.main-content { line-height: 20px; }
.title { font-weight: 600; }`;

/** The "Create automation / script" chooser: as tall as what it lists (HA fixes it at 720). */
export const newAutomationDialogCss =
  'ha-adaptive-dialog, ha-wa-dialog, ha-dialog { --ha-dialog-min-height: 0px; }';

/**
 * Every dialog's footer on the body's 24 column (HA pads the footer 16 against a 24 body: buttons stuck out 8 px
 * past the fields), its buttons 8 apart and one width (112) when two sit side by side.
 */
export const dialogCss = '::slotted([slot="footer"]) { padding: 0 24px 24px; }';
export const bottomSheetCss = '::slotted([slot="footer"]) { padding-inline: 24px; }';
export const dialogFooterCss =
  ':host { --ha-button-height: 48px; } footer { gap: 8px; } ::slotted(ha-button), ::slotted(ha-progress-button) { min-width: 112px; }';

/** The card editor: fields, preview and footer on one 24 column (HA put them at 12, 8 and 16). */
export const editCardDialogCss = `ha-dialog { --dialog-content-padding: 0 24px 8px; }
.content .element-editor { margin-inline-start: 0; padding-inline-end: 0; }
@media (min-width: 1000px) { .content > .element-editor { padding-inline-end: 16px; } }`;

/** The card picker: its search, section titles and card tiles on one column (HA put them at 220, 224 and 228). */
export const cardPickerCss =
  'ha-input-search { padding: 12px 20px 0; } .cards-container-header { padding-inline: 12px; }';

/** Add dashboard: the choices' titles 16/600 in one or two lines, descriptions 13/500 (HA's 1.2 / 0.9 rem broke a title into four lines beside a greedy preview); the section title on the cards' column. */
export const dashboardCardCss = `.card-header { flex: 1 1 0; min-width: 0; padding: 16px; }
.preview { flex: 0 0 40%; box-sizing: border-box; padding: 12px; display: flex; align-items: center; justify-content: center; }
.preview img { max-width: 100%; max-height: 136px; }
h2 { font-size: 16px; line-height: 20px; font-weight: 600; letter-spacing: -0.006em; margin: 0 0 4px; }
p { font-size: 13px; line-height: 16px; font-weight: 500; }`;
export const newDashboardDialogCss =
  '.cards-container-header { padding-inline: 0; font-weight: 600; }';

/** Web Awesome's dialogs rise 12 px instead of scaling from 0.8: a virtual list measured during the scale (Add integration) laid its 56 rows 46 apart and never measured again. */
export const waDialogCss =
  '@keyframes show-dialog { from { opacity: 0; translate: 0 12px; } to { opacity: 1; translate: 0 0; } }';

/** The automation's rename: its description 16 under its name (HA left the textarea out of its margins). */
export const automationSaveDialogCss = 'ha-textarea { margin-top: 16px; }';

/** The date picker: previous / next centred on the week's first and last columns, the month on one line, 40 px days. */
export const datePickerCss = `calendar-date::part(previous) { translate: 16px 0; } calendar-date::part(next) { translate: -16px 0; }
.month-year { white-space: nowrap; }
calendar-month::part(button) { width: 40px; height: 40px; margin: 1px 0; }`;

/** The phone's bottom sheet spans the screen (HA's width assumed a 2 px border; ours is 1). */
export const resizableSheetCss =
  'dialog { width: calc(100% - 2 * var(--ha-bottom-sheet-border-width, 2px) - var(--safe-area-inset-left, 0px) - var(--safe-area-inset-right, 0px)); }';
