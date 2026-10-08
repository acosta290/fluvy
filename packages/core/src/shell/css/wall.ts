import { WALL_ATTRIBUTE, WALL_BACKGROUND_VAR } from '../../look/attributes.js';
import { SUBVIEW_ATTRIBUTE } from '../../look/view.js';

/*
 * A wall panel (`<html fluvy-wall>`): the page does not bounce or select, the drawer is gone with its width (the
 * variable Home Assistant pads its content by — `--ha-sidebar-width` today, `--mdc-drawer-width` before — and the
 * padding itself), the
 * dashboard has no header and fills the tablet inside its safe area, and its view takes the wall's background
 * (the wall mesh, or Home Assistant's own when the house keeps the page plain). These sheets fill on the
 * attribute alone, whatever the theme: a wall is a wall in every scope.
 */

export const wallPageCss = `
html[${WALL_ATTRIBUTE}] {
  overscroll-behavior: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
`;

export const wallDrawerCss = `
:host {
  --ha-sidebar-width: 0px;
  --mdc-drawer-width: 0px;
}
.sidebar-shell,
wa-drawer::part(dialog) {
  display: none;
}
.app-content {
  padding-inline-start: 0;
}
`;

export const wallDashboardCss = `
:host {
  --header-height: 0px;
}
.header {
  display: none;
}
#view {
  min-height: 100vh;
  padding-top: env(safe-area-inset-top, 0px);
  background: var(${WALL_BACKGROUND_VAR}, var(--lovelace-background, var(--primary-background-color))) !important;
}
`;

/*
 * A wall's way back from a subview, as the house chose it (`<html fluvy-wall-header>` or `<html fluvy-wall-way-back>`): Home
 * Assistant's header in a subview alone — its back arrow and the view's title, its height given back to the view — or
 * the room the floating way back takes at the top of the view, so it never sits on the first card.
 */
export const wallSubviewHeaderCss = `
:host([${SUBVIEW_ATTRIBUTE}]) {
  --header-height: 56px;
}
:host([${SUBVIEW_ATTRIBUTE}]) .header {
  display: block;
}
:host([${SUBVIEW_ATTRIBUTE}]) #view {
  padding-top: calc(var(--header-height) + env(safe-area-inset-top, 0px));
}
`;

export const wallSubviewBackCss = `
:host([${SUBVIEW_ATTRIBUTE}]) #view {
  padding-top: calc(env(safe-area-inset-top, 0px) + 44px);
}
`;
