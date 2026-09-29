/** On `<html>` (and a panel frame's): the look covers the whole app, and the shell styles Home Assistant's own pages. */
export const PAGE_ATTRIBUTE = 'fluvy-look';

/** On a dashboard's `ha-panel-lovelace`: this dashboard wears the look (the `dashboards` scope). */
export const PANEL_ATTRIBUTE = 'fluvy-look';

/** On `<html>`: the house keeps Home Assistant's own Activity page (fluvy's settings). */
export const ORIGINAL_ACTIVITY = 'fluvy-original-activity';
/** Set while the house keeps Home Assistant's own History page. */
export const ORIGINAL_HISTORY = 'fluvy-original-history';

/** On `<html>`: this person wants the Activity page's timeline on a card (fluvy's preferences). */
export const ACTIVITY_CARD = 'fluvy-activity-card';

/** On `<html>`: this device is a wall panel and the page is one of the house's walls (the shell hides the chrome). */
export const WALL_ATTRIBUTE = 'fluvy-wall';
/** On `<html>`: the wall's background for the dashboard's view (the wall mesh), read by the shell's wall sheet. */
export const WALL_BACKGROUND_VAR = '--fluvy-wall-bg';
