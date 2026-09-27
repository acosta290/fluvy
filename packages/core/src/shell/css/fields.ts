import { FIELD, FIELD_FOCUS, FIELD_HOVER } from './shared.js';

/*
 * Fields, the way the cards draw theirs: a 12-radius box on the page fill with a hairline, the strong
 * hairline on hover, a 2 px accent line on focus — no Material underline, no square bottom corners.
 */

/**
 * `ha-input` (Web Awesome input in HA's "material" appearance). A required field without a hint kept an
 * empty 20 px row under its box for a validation message, so a form stepped 8 / 28 between boxes: the row
 * now takes the height of what it shows (a message still appears when there is one), on the field text's 16 column
 * (HA starts it at 12). A raised label is 11/500 on 16 from 10 down and the value 16 under it, as the selects draw
 * theirs, so a stack of fields and selects keeps one label line and one value line.
 */
export const inputCss = `.input::part(hint) { min-height: 0; margin-inline-start: 16px; }
:host([appearance="material"]) wa-input.label-raised::part(label), :host([appearance="material"]:focus-within) wa-input::part(label) { padding-top: 10px; line-height: 16px; font-weight: 500; }
:host([appearance="material"]) wa-input:not(.no-label)::part(input) { padding-top: 16px; }
:host([appearance="material"]) wa-input::part(base) { ${FIELD} }
:host([appearance="material"]) wa-input::part(base):hover { ${FIELD_HOVER} }
:host([appearance="material"]:focus-within) wa-input::part(base) { ${FIELD_FOCUS} }
:host([appearance="material"]) ::part(base)::after { display: none; }
:host([appearance="material"]:focus-within) wa-input::part(label) { color: var(--fluvy-accent); }`;

/**
 * Search boxes (`ha-input` in its outlined appearance and its subclass `ha-input-search`: tables, pickers,
 * the quick bar): a card-white field closed by the hairline, 12 radius, the 2 px accent ring on focus.
 * White, not the page fill, because they sit on the page and on toolbars as often as on cards.
 */
export const outlinedFieldCss = `:host([appearance="outlined"]) wa-input::part(base) { border: 0; border-radius: var(--fluvy-radius-control); background-color: var(--card-background-color); box-shadow: inset 0 0 0 1px var(--fluvy-border); transition: box-shadow 180ms ease-in-out; }
:host([appearance="outlined"]) wa-input::part(base):hover { ${FIELD_HOVER} }
:host([appearance="outlined"]:focus-within) wa-input::part(base) { border: 0; ${FIELD_FOCUS} }`;

export const textareaCss = `.input::part(hint) { margin-inline-start: 16px; } a { color: var(--fluvy-accent); }
:host wa-textarea::part(base), :host ::part(base) { ${FIELD} }
:host(:focus-within) ::part(base) { ${FIELD_FOCUS} }
:host ::part(base)::after { display: none; }`;

/** `ha-picker-field`: the face of every picker and of `ha-select`. */
export const pickerFieldCss = `ha-combo-box-item { ${FIELD} border-end-end-radius: var(--fluvy-radius-control); border-end-start-radius: var(--fluvy-radius-control); }
ha-combo-box-item:hover { ${FIELD_HOVER} }
ha-combo-box-item:after { display: none; }
:host(:focus-within) ha-combo-box-item, :host([opened]) ha-combo-box-item, :host(.opened) ha-combo-box-item { ${FIELD_FOCUS} }`;

/** The older composite fields (a chip row or a picker drawn in a Material box with an `:after` underline): the same box. */
export const boxedField = (
  selector: string,
): string => `${selector} { ${FIELD} border-bottom: 0; border-end-end-radius: var(--fluvy-radius-control); border-end-start-radius: var(--fluvy-radius-control); }
${selector}:after { display: none; }
${selector}:focus-within { ${FIELD_FOCUS} }`;

/** The time input is a row of small fields (hours, minutes, seconds): each is a box; the separators and the clear button sit on the card between them, none overlapping (HA's negative margins joined one Material strip). */
export const timeInputCss = `.time-separator, ha-icon-button { background-color: transparent; border-bottom: 0; }
.time-separator, ha-icon-button { margin-inline: 0; }
.time-separator { width: 12px; }
ha-icon-button { margin-inline-start: 4px; }
ha-select { margin-inline-start: 12px; }
ha-input:first-child::part(wa-base) { padding-inline-start: 4px; }
label { display: block; padding-inline-start: 0; font-size: 13px; line-height: 16px; font-weight: 500; letter-spacing: 0; color: var(--secondary-text-color); margin-bottom: 4px; }`;

/** The code editor (YAML, templates): a field with a hairline gutter; focus is the accent ring, not a line. */
export const codeEditorCss = `:host { --code-editor-background-color: var(--fluvy-page); --code-editor-gutter-color: var(--fluvy-page); }
.cm-editor { border-radius: var(--fluvy-radius-control); border: 1px solid var(--fluvy-border); overflow: hidden; transition: border-color 180ms ease-in-out, box-shadow 180ms ease-in-out; }
.cm-editor.cm-focused { border-color: var(--fluvy-accent); box-shadow: 0 0 0 1px var(--fluvy-accent); }
.cm-editor .cm-gutters, .cm-editor.cm-focused .cm-gutters { border-right: 1px solid var(--fluvy-border); padding-right: 1px; }
:host(.hasToolbar) .cm-editor .cm-content, :host(.hasToolbar) .cm-editor.cm-focused .cm-content { border-top: 1px solid var(--fluvy-border); padding-top: 16px; }
.code-editor-toolbar { border-top-left-radius: var(--fluvy-radius-control); border-top-right-radius: var(--fluvy-radius-control); }
.cm-scroller { font-family: var(--ha-font-family-code); line-height: 20px; }
.cm-textfield, .cm-completionDetail, .cm-button { font-family: var(--ha-font-family-body); letter-spacing: 0; text-transform: none; }
.cm-tooltip { border-radius: var(--fluvy-radius-control); box-shadow: var(--fluvy-shadow-lift); }
.cm-button { border-radius: var(--fluvy-radius-control); }`;

/**
 * A creation form (a helper's, a label's, an area's…): one 16 rhythm between its fields. HA spaced only the
 * optional ones (a required field leaned on a hint row we give no height), so Name touched the field under it.
 */
export const formStack = (
  form: string,
): string => `${form} { display: flex; flex-direction: column; gap: 16px; }
${form} > :is(ha-input, ha-textarea, ha-icon-picker, ha-color-picker, ha-picture-upload, ha-expansion-panel, ha-radio-group, ha-duration-input, ha-formfield, ha-checkbox, ha-selector, ha-labels-picker, ha-floor-picker, ha-entities-picker, .row, .mode) { margin-block: 0; --ha-input-padding-bottom: 0px; }`;
