import { DEVICE_KEY, latchZoomFromUrl, readDevice } from '../settings/device.js';

/*
 * The size this device reads its dashboards at: a variable on `<html>` that the shell's `device-zoom` sheet turns
 * into `zoom` on a dashboard's view — the cards grow, Home Assistant's header, sidebar, dialogs and edit mode do
 * not. The loader sets the same variable from the same memory before Home Assistant paints, so a page never
 * starts at one size and jumps to another; this module takes it over once the bundle runs.
 */

/** On `<html>`: the device's size as a factor (`1.25`); absent at 100 %. */
export const ZOOM_VAR = '--fluvy-zoom';

/** Puts the size on the page (the device's remembered one by default); 100 takes the variable off. */
export function applyZoom(zoom: number = readDevice().zoom, doc: Document = document): void {
  const root = doc.documentElement;
  if (zoom === 100) root.style.removeProperty(ZOOM_VAR);
  else root.style.setProperty(ZOOM_VAR, String(zoom / 100));
}

/**
 * Starts the size for the page: `?zoom=` on the address is remembered and dropped from it (every other parameter
 * and the hash stay), the remembered size is applied, and a change made in another tab of this browser follows
 * (the `storage` event; the panel applies its own save itself). Returns the function that stops following.
 */
export function startZoom(): () => void {
  const params = new URLSearchParams(location.search);
  if (params.has('zoom')) {
    latchZoomFromUrl(location.search);
    // the address is read once; the device remembers, and the address stays clean
    const url = new URL(location.href);
    url.searchParams.delete('zoom');
    history.replaceState(history.state, '', url.toString());
  }
  applyZoom();
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === DEVICE_KEY) applyZoom();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
