/*
 * The more-info dialog's own controls.
 */

/** Mode / preset / fan selectors: the row filled with equal buttons (quality bar: chip rows fill), not two 120 px buttons centred. */
export const selectContainerCss =
  '.controls-scroll { width: 100%; max-width: none; } ::slotted(*) { flex: 1 1 0; max-width: none; }';

/** Command rows (vacuum, lawn mower, cover): the whole width in equal 44 buttons. */
export const buttonGroupCss = ':host(:not([vertical])) { width: 100%; }';

/**
 * Media more-info: a title too long for its line scrolls and fades at its edges (a title that fits sits still
 * and whole); title and artist on the column; the artwork a 20-radius art tile without a Material shadow;
 * play / pause a 56 round like the transport's other rounds; the row of rounds under the volume spread from
 * the previous-track button to the next-track one (two sit on them, three centre the middle one on play).
 */
export const mediaPlayerCss = `ha-marquee-text[overflowing] { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%); }
.media-title { font-weight: 600; }
.media-info-row { margin-inline: 0; }
.controls-row { justify-content: space-between; padding-inline: calc(48px + (100% - 248px) / 4); }
.controls-row:has(> :only-child) { justify-content: center; }
.cover-image { border-radius: var(--fluvy-radius-card); box-shadow: none; }
.center-control { --ha-button-height: 56px; --ha-button-border-radius: var(--fluvy-radius-pill, 9999px); --wa-form-control-padding-inline: 0px; }
.center-control::part(base) { width: 56px; }`;

/** Daily / Hourly as the view switch the language uses (a segmented track, the chosen segment on the accent fill), not a Material underline; the forecast strip fades where it continues on the phone. */
export const weatherCss = `ha-tab-group { --track-width: 0px; --track-color: transparent; }
ha-tab-group::part(tabs) { gap: 4px; padding: 4px; border-radius: var(--fluvy-radius-control); background: var(--fluvy-page-alt); }
ha-tab-group-tab { flex: 1 1 0; opacity: 1; border: 0; margin: 0; }
ha-tab-group-tab::part(base) { justify-content: center; height: 32px; padding: 0 12px; border-radius: 10px; color: var(--fluvy-text-secondary); font-size: 14px; font-weight: 500; }
ha-tab-group-tab[active]::part(base) { background: var(--fluvy-accent-fill); color: var(--fluvy-accent-on-fill); }
@media (max-width: 600px) { .forecast { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); } }`;

/**
 * Entity settings: the sub-line of a row that opens more settings (Voice assistants: the aliases) wraps on the
 * phone instead of ending in an ellipsis; the rows' text on the fields' column (HA's 13 side padding plus the
 * template's 4 px of whitespace put it 1 px right of the fields).
 */
export const entitySettingsEditorCss = `.menu-item { --mdc-list-side-padding: 16px; }
.menu-item[twoline] { height: auto; min-height: 72px; padding-block: 16px; box-sizing: border-box; }
.input-prefix { margin-top: 16px; }`;

/** …and inside the row, its sub-line wraps (the row above lets it grow); only that row, the log and other lists keep one line. */
export const listItemCss = `:host(.menu-item[twoline]) .mdc-deprecated-list-item__secondary-text { white-space: normal; }
:host(.menu-item[twoline]) .mdc-deprecated-list-item__primary-text::before, :host(.menu-item[twoline]) .mdc-deprecated-list-item__primary-text::after, :host(.menu-item[twoline]) .mdc-deprecated-list-item__secondary-text::before { display: none; }
:host(.menu-item[twoline]) .mdc-deprecated-list-item__primary-text { margin: 0; line-height: 20px; font-weight: 500; }
:host(.menu-item[twoline]) .mdc-deprecated-list-item__secondary-text { line-height: 16px; font-weight: 500; }`;

/** Paired footer actions (Skip · Update, Delete · Update) share one width, on the dialog's 24 column. */
export const pairedFooterCss = `.actions ha-button, .buttons ha-button { min-width: 112px; }
.actions, .buttons { padding-inline: 24px; }`;
