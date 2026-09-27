/*
 * List rows across Settings and the dialogs.
 */

/**
 * Rows whose sub-line is a sentence (settings navigation, backups, the restart sheet): it wraps instead of being
 * cut, as our rows' two lines — the title on 20, the sub-line 13 on 16 (HA's 21 / 18 made 63 and 81 px rows and
 * put every switch on a half pixel): a row of two lines is 60, as a card's.
 */
export const rowSupportingCss =
  '.supporting { white-space: normal; font-size: 13px; line-height: 16px; } .headline { line-height: 20px; }';

/** Picker and quick-bar rows: the domain label sits on the row's centre when there is no second line. */
export const comboItemCss = `:host(:not(:has([slot="supporting-text"]))) ::slotted(.domain) { align-self: center; }
[slot="overline"] { font-size: 11px; line-height: 16px; font-weight: 500; }`;

/** Section bands in the picker dialogs: 32 tall, 13/600, one line. */
export const sectionTitleCss =
  ':host { min-height: 32px; padding: 8px 12px; font-size: 13px; line-height: 16px; font-weight: 600; }';
