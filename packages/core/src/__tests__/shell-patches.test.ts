// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFrames } from '../shell/frames.js';
import { browserEnv, createShell, type ShellEnv, type ShellHandle } from '../shell/index.js';
import { patchMarqueeOverflow } from '../shell/marquee.js';
import { GLYPH_ATTRIBUTE, patchNavigationGlyphs } from '../shell/navigation.js';
import {
  always,
  asidesOf,
  CHECKED,
  guard,
  inUse,
  setWorn,
  stepAside,
  versionNote,
  wrap,
} from '../shell/patches.js';

/** The page at an address (happy-dom's own way to move the window without a navigation). */
const visit = (url: string): void =>
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);

/** Home Assistant applies the Fluvy theme (its sentinel inline on `<html>`), or another one. */
const wear = (on: boolean): void => {
  if (on) document.documentElement.style.setProperty('--fluvy-theme', '1');
  else document.documentElement.style.removeProperty('--fluvy-theme');
};

/** A registry that answers `tag` with `klass` (defined under a name of its own: one page has one `ha-*` of each). */
const registryOf = (tag: string, klass: CustomElementConstructor): CustomElementRegistry =>
  ({
    whenDefined: () => Promise.resolve(klass),
    get: (name: string) => (name === tag ? klass : undefined),
  }) as unknown as CustomElementRegistry;

let defined = 0;
/** Defines `klass` under a fresh name and makes one, on the page. */
function make<T extends HTMLElement>(klass: new () => T): T {
  defined += 1;
  customElements.define(`test-element-${defined}`, klass);
  return document.body.appendChild(new klass());
}

afterEach(() => {
  wear(false);
  document.documentElement.removeAttribute('fluvy-look');
  document.documentElement.removeAttribute('fluvy-wall');
  document.body.replaceChildren();
  setWorn(() => false);
  visit('http://localhost:3000/');
  vi.restoreAllMocks();
});

describe('whether Fluvy is in use on a page', () => {
  it('is no on a page that wears another theme, outside the look and the walls', () => {
    expect(inUse(document)).toBe(false);
  });

  it('is yes while the page wears the theme, the look covers it, or the device is a wall', () => {
    wear(true);
    expect(inUse(document)).toBe(true);
    wear(false);
    document.documentElement.setAttribute('fluvy-look', '');
    expect(inUse(document)).toBe(true);
    document.documentElement.removeAttribute('fluvy-look');
    document.documentElement.setAttribute('fluvy-wall', '');
    expect(inUse(document)).toBe(true);
  });

  it('is yes on a dashboard that wears the look, by the address on screen, and no on any other', () => {
    setWorn((urlPath) => urlPath === 'fluvy-home');
    visit('http://localhost:3000/fluvy-home/0');
    expect(inUse(document)).toBe(true);
    visit('http://localhost:3000/lovelace/0');
    expect(inUse(document)).toBe(false);
  });
});

describe('a wrap of one of Home Assistant’s methods', () => {
  class Element1 extends HTMLElement {
    calls = 0;
    draw(times: number): number {
      this.calls += 1;
      return times * 2;
    }
  }

  it('is not made where the method is not (Home Assistant reshaped the element)', () => {
    expect(wrap(undefined, 'draw', 'test:none', () => 1)).toBe(false);
    expect(wrap(Element1.prototype, 'paint', 'test:none', () => 1)).toBe(false);
  });

  it('runs Home Assistant’s method alone where Fluvy is not in use, then ours after it, with its result', () => {
    const element = make(class extends Element1 {});
    const proto = Object.getPrototypeOf(element) as Element1;
    const ours = vi.fn((_: Element, result: number, [times]: [number]) => result + times);
    expect(wrap(proto, 'draw', 'test:after', ours)).toBe(true);
    expect(element.draw(3)).toBe(6);
    expect(element.calls).toBe(1);
    expect(ours).not.toHaveBeenCalled();
    wear(true);
    expect(element.draw(3)).toBe(9);
    expect(element.calls).toBe(2);
    expect(ours).toHaveBeenCalledWith(element, 6, [3]);
    // a part that returns nothing keeps Home Assistant's result
    ours.mockImplementation(() => undefined as unknown as number);
    expect(element.draw(3)).toBe(6);
  });

  it('wraps once: a second start finds its own wrap', () => {
    const element = make(class extends Element1 {});
    const proto = Object.getPrototypeOf(element) as Element1;
    const ours = vi.fn();
    wrap(proto, 'draw', 'test:once', ours);
    const wrapped = proto.draw;
    expect(wrap(proto, 'draw', 'test:once', ours)).toBe(true);
    expect(proto.draw).toBe(wrapped);
    wear(true);
    element.draw(1);
    expect(element.calls).toBe(1);
    expect(ours).toHaveBeenCalledTimes(1);
  });

  it('follows our marks on any page when asked to (`always`)', () => {
    const element = make(class extends Element1 {});
    const ours = vi.fn();
    wrap(Object.getPrototypeOf(element) as Element1, 'draw', 'test:always', ours, always);
    element.draw(1);
    expect(ours).toHaveBeenCalledTimes(1);
  });

  it('steps aside for the session when ours throws: Home Assistant’s ran, once said and reported', () => {
    const element = make(class extends Element1 {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ours = vi.fn(() => {
      throw new TypeError('reshaped');
    });
    wrap(Object.getPrototypeOf(element) as Element1, 'draw', 'test:throws', ours);
    wear(true);
    expect(element.draw(2)).toBe(4);
    expect(element.draw(5)).toBe(10);
    expect(element.calls).toBe(2);
    expect(ours).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /^\[fluvy\] test:throws stepped aside: TypeError: reshaped · Home Assistant /,
    );
    expect(asidesOf(document)['test:throws']).toBe('stepped aside: TypeError: reshaped');
  });

  it('guards a part of ours that is not a wrap the same way', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(guard('test:guard', () => 7)).toBe(7);
    expect(
      guard('test:guard', () => {
        throw new Error('gone');
      }),
    ).toBeUndefined();
    expect(guard('test:guard', () => 7)).toBeUndefined();
  });

  it('steps aside on its own document alone: a patch that fails in a panel frame stays on the page, and back', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const frame = document.implementation.createHTMLDocument('HACS');
    const fails = (): number => {
      throw new Error('reshaped');
    };
    expect(guard('test:frame', fails, frame)).toBeUndefined();
    expect(guard('test:frame', () => 7, frame)).toBeUndefined();
    expect(guard('test:frame', () => 7)).toBe(7);
    expect(asidesOf(frame)['test:frame']).toBe('stepped aside: Error: reshaped');
    expect(asidesOf(document)['test:frame']).toBeUndefined();
    // a wrap reads its element's document
    class Element1 extends HTMLElement {
      draw(): number {
        return 1;
      }
    }
    const element = make(Element1);
    wrap(Object.getPrototypeOf(element) as Element1, 'draw', 'test:page', fails, always);
    expect(element.draw()).toBe(1);
    expect(asidesOf(document)['test:page']).toBe('stepped aside: Error: reshaped');
    expect(guard('test:page', () => 7, frame)).toBe(7);
  });
});

describe('the shell’s report', () => {
  it('lists every patch that stepped aside, with what it threw, and the page’s Home Assistant version', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // a page where none of Home Assistant's elements is ever defined (the other tests define their own)
    const never = {
      get: () => undefined,
      whenDefined: () => new Promise(() => undefined),
    } as unknown as CustomElementRegistry;
    const shell = createShell({ ...browserEnv()!, customElements: never }, { frames: true });
    guard('test:report', () => {
      throw new Error('gone');
    });
    const report = shell.report();
    expect(report.patches['test:report']).toBe('stepped aside: Error: gone');
    // the shell's own wraps: their elements are not defined on this page
    expect(report.patches['chartFont']).toBeNull();
    expect(report.version).toBe(`Home Assistant ? (checked: ${CHECKED})`);
    shell.stop();
  });
});

describe('Home Assistant’s version', () => {
  it('stands beside the releases this build was checked against, from the floor HACS installs on', () => {
    expect(versionNote()).toBe(`Home Assistant ? (checked: ${CHECKED})`);
    const app = Object.assign(document.createElement('home-assistant'), {
      hass: { config: { version: '2026.11.0b2' } },
    });
    document.body.append(app);
    expect(versionNote()).toBe(`Home Assistant 2026.11.0b2 (checked: ${CHECKED})`);
    // (tests run from the package's folder)
    const hacs = JSON.parse(readFileSync(resolve(process.cwd(), '../../hacs.json'), 'utf8')) as {
      homeassistant: string;
    };
    const [floor, latest] = CHECKED.split('–');
    expect(hacs.homeassistant.startsWith(`${floor}.`)).toBe(true);
    expect(latest).toMatch(/^\d{4}\.\d{1,2}$/);
  });
});

describe('the marquee’s overflow', () => {
  class Marquee extends HTMLElement {
    _maxOffset: unknown = 0;
    set = 0;
    _setupAnimation(): void {
      this.set += 1;
    }
  }

  it('is marked only where Fluvy is in use, after Home Assistant’s set-up, and only from a number', async () => {
    const marquee = make(Marquee);
    const registry = registryOf('ha-marquee-text', marquee.constructor as typeof Marquee);
    expect(await patchMarqueeOverflow(registry)).toBe(true);
    marquee._maxOffset = 40;
    marquee._setupAnimation();
    expect(marquee.set).toBe(1);
    expect(marquee.hasAttribute('overflowing')).toBe(false);
    wear(true);
    marquee._setupAnimation();
    expect(marquee.hasAttribute('overflowing')).toBe(true);
    marquee._maxOffset = '40';
    marquee._setupAnimation();
    expect(marquee.hasAttribute('overflowing')).toBe(false);
    expect(marquee.set).toBe(3);
  });
});

describe('the settings lists’ glyphs', () => {
  /** `ha-config-navigation-list`, as far as its items go (a class of its own for each test: each is wrapped once). */
  const listClass = () =>
    class List extends HTMLElement {
      updates = 0;
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML =
          '<ha-list-item-button><div class="icon-background"></div></ha-list-item-button>';
        Object.assign(this.shadowRoot!.querySelector('ha-list-item-button')!, {
          href: '/config/areas',
        });
      }
      updated(): void {
        this.updates += 1;
      }
    };
  const circle = (list: HTMLElement): Element =>
    list.shadowRoot!.querySelector('.icon-background')!;

  it('are told only where Fluvy is in use, after Home Assistant’s update', async () => {
    const List = listClass();
    const list = make(List);
    const glyphOf = vi.fn(() => 'sofa');
    expect(
      await patchNavigationGlyphs(registryOf('ha-config-navigation-list', List), document, glyphOf),
    ).toBe(true);
    // the lists already on the page are left as they are too
    expect(circle(list).hasAttribute(GLYPH_ATTRIBUTE)).toBe(false);
    list.updated();
    expect(list.updates).toBe(1);
    expect(glyphOf).not.toHaveBeenCalled();
    expect(circle(list).hasAttribute(GLYPH_ATTRIBUTE)).toBe(false);
    wear(true);
    list.updated();
    expect(circle(list).getAttribute(GLYPH_ATTRIBUTE)).toBe('sofa');
  });

  it('step aside when ours throws, and the list goes on updating as Home Assistant’s', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const List = listClass();
    const list = make(List);
    const glyphOf = vi.fn((): string => {
      throw new Error('reshaped');
    });
    await patchNavigationGlyphs(registryOf('ha-config-navigation-list', List), document, glyphOf);
    wear(true);
    list.updated();
    list.updated();
    expect(list.updates).toBe(2);
    expect(glyphOf).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(asidesOf(document)['navigationGlyphs']).toBe('stepped aside: Error: reshaped');
  });
});

describe('the panel frames (HACS)', () => {
  /** The fonts the frame's window was asked for. */
  const faces: string[] = [];
  /** The frame's document, loading until a test says it loaded. */
  const frameDocument = {
    readyState: 'loading',
    defaultView: {
      FontFace: class {
        constructor(family: string) {
          faces.push(family);
        }
        load = (): Promise<never> => new Promise(() => undefined);
      },
      customElements,
      CSSStyleSheet,
      MutationObserver,
    },
  };
  /** `ha-panel-custom`: its `_createPanel` writes the frame into itself (a same-origin frame, its window stood in for). */
  class Panel extends HTMLElement {
    created = 0;
    _createPanel(): void {
      this.created += 1;
      const frame = document.createElement('iframe');
      Object.defineProperties(frame, {
        contentWindow: { value: frameDocument.defaultView },
        contentDocument: { value: frameDocument },
      });
      this.append(frame);
    }
  }
  const env = (registry: CustomElementRegistry): ShellEnv =>
    ({
      document,
      customElements: registry,
      createSheet: () => new CSSStyleSheet(),
      MutationObserver,
    }) as ShellEnv;
  const shell = (): ShellHandle => ({ stop: () => undefined, report: () => ({}) as never });

  it('get no shell and no Inter where Fluvy is not in use, and theirs once the page wears it', async () => {
    customElements.define('ha-panel-custom', Panel);
    const panel = document.body.appendChild(new Panel());
    const shellFor = vi.fn(shell);
    const frames = new PanelFrames(env(customElements), shellFor);
    expect(await frames.watch()).toBe(true);
    panel._createPanel();
    expect(panel.created).toBe(1);
    frameDocument.readyState = 'complete';
    panel.querySelector('iframe')!.dispatchEvent(new Event('load'));
    expect(shellFor).not.toHaveBeenCalled();
    expect(faces).toEqual([]);
    // the page wears Fluvy now: the shell finds the frame on it
    wear(true);
    frames.scan();
    expect(shellFor).toHaveBeenCalledTimes(1);
    expect(faces).toContain('Inter');
    expect(frames.current()).toHaveLength(1);
  });
});

describe('a wrap Home Assistant made impossible', () => {
  it('steps aside, wraps nothing and leaves the method as it was', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const own = function (): string {
      return 'home assistant';
    };
    const proto = {};
    Object.defineProperty(proto, 'render', { value: own, writable: false });
    expect(wrap(proto, 'render', 'frozen-render', () => 'ours')).toBe(false);
    expect((proto as { render: () => string }).render).toBe(own);
    expect(asidesOf(document)['frozen-render']).toMatch(/^stepped aside: TypeError/);
    stepAside('frozen-render', new Error('again'));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
