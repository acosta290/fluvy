// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { dialogsOf } from '../shell/dialogs.js';

/*
 * What Home Assistant's open dialogs paint (#242): a report a person runs on a device we cannot hold
 * (`__fluvy.shell.report().dialogs`), read only.
 */

/** Home Assistant's `tag` (`ha-dialog`, `ha-bottom-sheet`) in `holder`'s shadow root, its Web Awesome surface open in a box. */
function surface(
  holder: HTMLElement,
  tag: string,
  inner: string,
  part: string,
  box: { x: number; y: number; width: number; height: number },
): HTMLElement {
  const element = document.createElement(tag);
  (holder.shadowRoot ?? holder.attachShadow({ mode: 'open' })).append(element);
  const wa = document.createElement(inner);
  element.attachShadow({ mode: 'open' }).append(wa);
  const painted = document.createElement('div');
  painted.setAttribute('part', `${part} other`);
  painted.style.setProperty('--wa-color-surface-raised', '#28241d');
  painted.style.setProperty('--ha-dialog-surface-background', '#28241d');
  painted.style.backgroundColor = 'rgb(40, 36, 29)';
  painted.getBoundingClientRect = () => ({ ...box, top: box.y, left: box.x }) as DOMRect;
  wa.attachShadow({ mode: 'open' }).append(painted);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('fluvy-wall');
  document.documentElement.style.removeProperty('--fluvy-zoom');
});

describe('the dialogs’ report (#242)', () => {
  it('says what each open dialog and sheet paints, where, and in what mode', () => {
    // a dialog of its own, then the details dialog on a phone (an adaptive dialog in its bottom-sheet mode)
    const other = document.createElement('dialog-box');
    const adaptive = document.createElement('ha-adaptive-dialog');
    document.body.append(other, adaptive);
    surface(other, 'ha-dialog', 'wa-dialog', 'dialog', { x: 110, y: 60, width: 580, height: 0.5 });
    surface(adaptive, 'ha-bottom-sheet', 'wa-drawer', 'body', {
      x: 0,
      y: 412.4,
      width: 800,
      height: 788,
    });
    document.documentElement.setAttribute('fluvy-wall', '');
    document.documentElement.style.setProperty('--fluvy-zoom', '1.1');

    const report = dialogsOf(document);

    expect(report.open).toEqual([
      {
        mode: 'dialog',
        in: 'dialog-box',
        raised: '#28241d',
        surface: '#28241d',
        background: 'rgb(40, 36, 29)',
        image: expect.any(String),
        rect: '110,60 580×1',
      },
      {
        mode: 'bottom-sheet',
        in: 'ha-adaptive-dialog',
        raised: '#28241d',
        surface: '#28241d',
        background: 'rgb(40, 36, 29)',
        image: expect.any(String),
        rect: '0,412 800×788',
      },
    ]);
    expect(report).toMatchObject({ width: window.innerWidth, wall: true, zoom: '1.1' });
    expect(report.ratio).toBe(window.devicePixelRatio);
  });

  it('leaves out a shut one, and says the page as it is where nothing is open', () => {
    const holder = document.createElement('div');
    document.body.append(holder);
    surface(holder, 'ha-dialog', 'wa-dialog', 'dialog', { x: 0, y: 0, width: 0, height: 0 });

    expect(dialogsOf(document)).toMatchObject({ open: [], wall: false, zoom: '1' });
  });
});
