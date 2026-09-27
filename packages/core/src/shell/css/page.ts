/**
 * The document itself:
 * - Inter on `body` (Home Assistant's template hard-codes Roboto there, so the sidebar, the header
 *   and the dialogs never see the theme's `--ha-font-family-body`);
 * - the older Material components (mwc list items, the time input's labels) take their family and
 *   tracking from `--mdc-typography-*`, which nothing sets, so they fall back to Roboto with Material
 *   letter-spacing, their second lines at 12.25 px (body2 is set to the rows' 13). Declared here rather
 *   than in the theme: HA 2026.10 retires these names, and the theme file only carries names HA keeps.
 *   Declared again on `body`, because a panel frame (HACS) puts the theme there, and a variable built
 *   from another resolves where it is declared;
 * - a thin page scrollbar in the theme's thumb colour (the window scrolls the dashboards; its bar sits
 *   in the page margin around the frame).
 * A document-level adopted sheet follows the template's `<style>`, so it wins.
 */
export const pageCss = `body { font-family: var(--ha-font-family-body); }
:root, body {
  --mdc-typography-font-family: var(--ha-font-family-body);
  --mdc-typography-subtitle1-letter-spacing: 0;
  --mdc-typography-subtitle2-letter-spacing: 0;
  --mdc-typography-body1-letter-spacing: 0;
  --mdc-typography-body2-letter-spacing: 0;
  --mdc-typography-body2-font-size: 13px;
  --mdc-typography-button-letter-spacing: 0;
  --mdc-typography-caption-letter-spacing: 0;
}
html {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb-color) transparent;
}`;
