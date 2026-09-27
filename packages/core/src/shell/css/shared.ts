import { ICON_PATHS } from '../../icons/generated.js';

/*
 * Pieces the shell's sheets share. Every sheet is filled only while a fluvy theme is the page's theme,
 * so the brand tokens (`--fluvy-*`) always exist when these rules apply: no fallbacks are needed.
 */

/** A glyph of the icon set as a CSS mask: `-webkit-mask: ${mask('check')} center / 20px 20px no-repeat`. */
export const mask = (glyph: string): string =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${ICON_PATHS[glyph] ?? ''}'/></svg>")`;

/** The cards' field: a 12-radius box on the page fill, closed by a hairline. */
export const FIELD =
  'border-radius: var(--fluvy-radius-control); background-color: var(--fluvy-page); box-shadow: inset 0 0 0 1px var(--fluvy-border); transition: box-shadow 180ms ease-in-out;';
export const FIELD_HOVER = 'box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);';
export const FIELD_FOCUS = 'box-shadow: inset 0 0 0 2px var(--fluvy-accent);';

/** What lifts off the page: menus and popovers (the dial disc's shadow), per mode from the theme. */
export const LIFT = 'var(--fluvy-shadow-lift)';

/**
 * The language's empty state on a block that holds one line of text (HA's "No data", "No activity found",
 * "You have no to-do items"): a 44 ring on the card fill with `glyph`, over the line (14/500 secondary),
 * centred in a 120 panel of radius 16. The panel is the page fill (inside a card); where it sits on the page
 * itself, `--fluvy-empty-surface` gives it the page-alt fill, and `--fluvy-empty-margin` insets it from the
 * surface's edges (both set by the page that hosts the block). The ring and the glyph are the block's two
 * pseudo-elements, both placed before the text by `order`; the glyph pulls itself back into the ring.
 */
export const emptyState = (
  selector: string,
  glyph: string,
): string => `:is(${selector}) { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 120px; margin: var(--fluvy-empty-margin, 0); padding: 16px; box-sizing: border-box; border-radius: var(--fluvy-radius-lg); background: var(--fluvy-empty-surface, var(--fluvy-page)); color: var(--secondary-text-color); font: 500 14px/20px var(--ha-font-family-body); letter-spacing: 0; text-align: center; white-space: normal; }
:is(${selector})::before { content: ''; order: -2; flex: none; width: 44px; height: 44px; border-radius: 50%; background: var(--fluvy-card); box-shadow: inset 0 0 0 1px var(--fluvy-border-strong); }
:is(${selector})::after { content: ''; order: -1; flex: none; width: 20px; height: 20px; margin: -40px 0 12px; background-color: currentColor; -webkit-mask: ${mask(glyph)} center / 20px 20px no-repeat; mask: ${mask(glyph)} center / 20px 20px no-repeat; }`;

/** A title line that holds 48 icon buttons (the Activity card, the log cards): the title sits where every card head's title sits (12 above, a 34 line, 16 below) and the buttons hang over it instead of setting the row's height. */
export const headRow = (
  row: string,
  buttons: string,
): string => `${row} { display: flex; align-items: center; justify-content: space-between; margin: 0; padding: 12px 16px 16px; line-height: 34px; }
${buttons} { margin-block: -7px; }`;

/**
 * A short choice HA draws as a row of radios (Automatic · Static · Disabled) as option tiles that fill the row:
 * 44 tall on the page fill, the label centred, the chosen one on the accent fill, the focus ring inside.
 */
export const optionTiles = (
  group: string,
): string => `${group}::part(form-control-input) { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
${group} ha-radio-option { margin: 0; min-height: 44px; justify-content: center; border-radius: var(--fluvy-radius-control); background: var(--fluvy-page); color: var(--secondary-text-color); font-weight: 500; cursor: pointer; }
${group} ha-radio-option::part(control) { display: none; }
${group} ha-radio-option::part(label) { width: 100%; justify-content: center; }
${group} ha-radio-option[aria-checked="true"] { background: var(--fluvy-accent-fill); color: var(--fluvy-accent-on-fill); }
${group} ha-radio-option:focus-visible { outline: 2px solid var(--fluvy-accent); outline-offset: -2px; }`;
