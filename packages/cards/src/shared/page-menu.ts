import type { HomeAssistant } from '@fluvy/core';

/**
 * Whether a page of ours (the settings panel, Activity, History) shows its menu button: where Home Assistant's own
 * does, on a phone and beside a hidden sidebar (its "Always hide the sidebar", or this device's sidebar beside the page
 * between asks, #173), where nothing else would bring the sidebar back.
 */
export const menuShown = (
  narrow: boolean,
  hass: Pick<HomeAssistant, 'dockedSidebar'> | undefined,
): boolean => narrow || hass?.dockedSidebar === 'always_hidden';
