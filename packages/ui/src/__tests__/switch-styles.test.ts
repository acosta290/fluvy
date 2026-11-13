// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import {
  drawRocker,
  switchStylesSheet,
  wearSwitchStyles,
  type RockerDrawing,
} from '../controls/switch-styles.js';
import { switchStylesCss } from '../styles/switch-styles.js';

/**
 * The switch styles (1.20, #177): the wall rocker a tile draws in its switch's place. The drawing is read from what
 * it writes — a switch to a reader and to the keys, in a 44 target — and its sheet from its rules.
 */
const drawing = (more: Partial<RockerDrawing> = {}): RockerDrawing => ({
  on: false,
  down: false,
  tone: 'light',
  label: 'Porch',
  disabled: false,
  onTap: () => undefined,
  ...more,
});

const drawn = (o: RockerDrawing) => {
  const host = document.createElement('div');
  document.body.append(host);
  render(drawRocker(o), host);
  return {
    hit: host.querySelector<HTMLElement>('.fv-hit')!,
    rocker: host.querySelector<HTMLElement>('.fv-rocker')!,
  };
};

afterEach(() => document.body.replaceChildren());

describe('the rocker', () => {
  it('is a switch a reader hears by its name, in the tile’s box for it', () => {
    const { hit, rocker } = drawn(drawing());
    // the tile's 44 target (fluvy/tiles.css), raised over the tile's button as a switch's is
    expect(hit.className.trim()).toBe('fv-hit fv-hit--rocker');
    expect(hit.hasAttribute('data-target')).toBe(true);
    expect(rocker.hasAttribute('data-control')).toBe(true);
    expect(rocker.getAttribute('role')).toBe('switch');
    expect(rocker.getAttribute('aria-label')).toBe('Porch');
    expect(rocker.getAttribute('aria-checked')).toBe('false');
    expect(rocker.getAttribute('aria-disabled')).toBe('false');
    expect(rocker.tabIndex).toBe(0);
    // its bar, the one part it draws besides its halves (the sheet's)
    expect(rocker.querySelectorAll('.fv-rocker__bar')).toHaveLength(1);
  });

  it('wears its tone, lights its bar while on and raises the half a finger presses next', () => {
    const off = drawn(drawing()).rocker;
    expect([...off.classList]).toEqual(['fv-rocker', 'fv-tone--light']);
    const on = drawn(drawing({ on: true, down: true, tone: 'fan' })).rocker;
    expect([...on.classList]).toEqual(['fv-rocker', 'fv-tone--fan', 'is-on', 'is-down']);
    expect(on.getAttribute('aria-checked')).toBe('true');
    // a cover stopped on its way down: open, its next tap opening it
    const part = drawn(drawing({ on: true, down: false, moving: true })).rocker;
    expect([...part.classList]).toEqual(['fv-rocker', 'fv-tone--light', 'is-on', 'is-moving']);
  });

  it('answers a finger, Space and Enter, and keeps its tap from the tile under it', () => {
    let taps = 0;
    const { hit, rocker } = drawn(drawing({ onTap: () => (taps += 1) }));
    const heard: Event[] = [];
    document.body.addEventListener('click', (event) => heard.push(event));
    hit.click();
    expect(taps).toBe(1);
    expect(heard).toEqual([]);
    for (const key of [' ', 'Enter']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      rocker.dispatchEvent(event);
      // the page does not scroll under Space
      expect(event.defaultPrevented).toBe(true);
    }
    expect(taps).toBe(3);
    rocker.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(taps).toBe(3);
  });

  it('out of reach it takes no tap and no key, and says so', () => {
    let taps = 0;
    const { hit, rocker } = drawn(drawing({ disabled: true, onTap: () => (taps += 1) }));
    expect(hit.classList.contains('is-fixed')).toBe(true);
    expect(rocker.getAttribute('aria-disabled')).toBe('true');
    expect(rocker.tabIndex).toBe(-1);
    hit.click();
    rocker.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(taps).toBe(0);
  });
});

describe('the sheet', () => {
  it('is worn once by the root that draws a rocker, after its own', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const own = new CSSStyleSheet();
    root.adoptedStyleSheets = [own];
    wearSwitchStyles(root);
    wearSwitchStyles(root);
    expect(root.adoptedStyleSheets).toEqual([own, switchStylesSheet]);
    // a root that is no shadow root has none to wear
    expect(() => wearSwitchStyles(document.createElement('div'))).not.toThrow();
  });

  it('flips in the fast step, breathes while it moves and fades out of reach', () => {
    // the halves flip in `--fv-fast` (120 ms; the interaction layer takes every transition away without motion)
    expect(switchStylesCss).toContain(
      'transition:background-color var(--fv-fast) var(--fv-ease),box-shadow var(--fv-fast) var(--fv-ease)',
    );
    expect(switchStylesCss).toContain('.fv-rocker.is-moving .fv-rocker__bar{animation:rk-breathe');
    expect(switchStylesCss).toContain(".fv-rocker[aria-disabled='true']{opacity:0.4}");
    // quiet out of reach, at full strength
    expect(switchStylesCss).toContain(
      ".fv-rocker[aria-disabled='true']:where([data-unavailable='quiet'] *){opacity:1}",
    );
    // dark is the card's own mark, as every sheet a card adopts
    expect(switchStylesCss).toContain(':host([dark]) .fv-rocker{');
    // every colour is the palette's: a shadow's black alone is written, at the palette's share
    expect(switchStylesCss.match(/#[0-9a-f]{3,8}\b|rgb\([\d ]+/gi)).toEqual(['rgb(0 0 0 ']);
    expect(switchStylesCss).toContain('rgb(0 0 0 / calc(0.18 * var(--fluvy-shade,1)))');
  });
});
