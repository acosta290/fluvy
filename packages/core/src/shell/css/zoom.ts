/*
 * A device's size, on a dashboard's view alone (`hui-root`'s `#view > hui-view`): CSS `zoom` from the variable
 * `look/zoom.ts` keeps on `<html>` (absent at 100 %, so the rule does nothing on every other device). The header
 * above the view, the sidebar, the dialogs and the edit mode keep Home Assistant's size: an administrator edits a
 * dashboard at the size it is laid out in. Every rule hangs on the variable, so the sheet stays filled whatever
 * the theme.
 */
export const deviceZoomCss = `#view > hui-view { zoom: var(--fluvy-zoom, 1); }
.edit-mode #view > hui-view { zoom: 1; }`;
