// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from 'vitest';
import { WALL_ATTRIBUTE } from '../look/attributes.js';
import { BACKGROUND_ATTRIBUTE } from '../look/background.js';
import { startLook } from '../look/start.js';
import { onDarkPage, derivePalette, seedOf } from '@fluvy/tokens/runtime';

/*
 * The page's background as the look puts it on (1.19, #155): the house's, on every dashboard that wears the look, each
 * time its root updates; never on one that does not; a wall's own choice wins on a wall — plain stays plain, the
 * dashboard's comes through when the wall lets it — and the colours follow the mode the wall forces.
 */

/** The house as this browser last saw it: a sage page, a wall that keeps its own. */
const house = (wall: 'plain' | 'dashboard') =>
  JSON.stringify({
    house: { background: { type: 'color', colors: ['#dbe5d8'] }, wall: { background: wall } },
    personal: {},
  });

/** `hui-root` as far as the look's patch needs it: its own update, its dashboard and its view. */
class Root extends HTMLElement {
  hass = { panelUrl: 'fluvy-home' };
  lovelace = { config: { views: [{}] }, rawConfig: {} };
  _curView = 0;
  updated(): void {
    // Home Assistant's own update
  }
}
customElements.define('hui-root', Root);

const mounted = (panelUrl: string): Root => {
  const element = document.createElement('hui-root') as Root;
  element.hass = { panelUrl };
  document.body.append(element);
  element.updated();
  return element;
};

describe('the page’s background on the dashboards', () => {
  localStorage.setItem('fluvy:settings', house('plain'));
  const look = startLook()!;
  afterAll(() => look.stop());

  it('is the house’s on a dashboard that wears the look, and none on another', async () => {
    // the patch is put on once Home Assistant's element is defined
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fluvy = mounted('fluvy-home');
    const other = mounted('lovelace');
    await expect.poll(() => fluvy.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('color');
    expect(fluvy.style.getPropertyValue('--fluvy-bg-1')).toBe('#dbe5d8');
    expect(other.hasAttribute(BACKGROUND_ATTRIBUTE)).toBe(false);
  });

  it('follows the mode it is drawn in: a pale colour taken to the dark page in dark mode', async () => {
    const fluvy = document.querySelector('hui-root') as Root;
    look.setWall({ on: false, dark: true });
    const page = derivePalette(seedOf('linen')).dark.surface.page;
    await expect
      .poll(() => fluvy.style.getPropertyValue('--fluvy-bg-1'))
      .toBe(onDarkPage('#dbe5d8', page));
    look.setWall({ on: false, dark: undefined });
    await expect.poll(() => fluvy.style.getPropertyValue('--fluvy-bg-1')).toBe('#dbe5d8');
  });

  it('gives way to a wall that keeps its own background', async () => {
    const fluvy = document.querySelector('hui-root') as Root;
    document.documentElement.setAttribute(WALL_ATTRIBUTE, '');
    look.setWall({ on: true, dark: undefined });
    await expect.poll(() => fluvy.hasAttribute(BACKGROUND_ATTRIBUTE)).toBe(false);
    document.documentElement.removeAttribute(WALL_ATTRIBUTE);
    look.setWall({ on: false, dark: undefined });
    await expect.poll(() => fluvy.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('color');
  });
});
