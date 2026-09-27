// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_SWIPE, PAGE_ATTRIBUTE, PANEL_ATTRIBUTE } from '../look/attributes.js';
import {
  attachViewSwipe,
  COMMIT_DISTANCE,
  COMMIT_FRACTION,
  commits,
  currentIndex,
  EDGE,
  handlesHorizontal,
  lockAxis,
  rubberBand,
  swipeWanted,
  tabbedViews,
  viewSegment,
  type SwipeHost,
  type ViewLike,
} from '../shell/swipe.js';

const VIEWS: readonly ViewLike[] = [
  { path: 'home' },
  { path: 'lights' },
  { path: 'guests', visible: [{ user: 'guest' }] },
  { path: 'detail', subview: true },
  { path: 'energy', visible: false },
  {},
];

describe('the views a swipe moves between', () => {
  it('are the ones with a tab for this person, in order', () => {
    expect(tabbedViews(VIEWS, 'marta')).toEqual([0, 1, 5]);
    expect(tabbedViews(VIEWS, 'guest')).toEqual([0, 1, 2, 5]);
    expect(tabbedViews(VIEWS, undefined)).toEqual([0, 1, 5]);
  });

  it('are named in the URL by path, else by index', () => {
    expect(viewSegment(VIEWS, 1)).toBe('lights');
    expect(viewSegment(VIEWS, 5)).toBe('5');
  });

  it('are found from the route the way Home Assistant reads it', () => {
    expect(currentIndex(VIEWS, '')).toBe(0);
    expect(currentIndex(VIEWS, '/')).toBe(0);
    expect(currentIndex(VIEWS, '/lights')).toBe(1);
    expect(currentIndex(VIEWS, '/5')).toBe(5);
    expect(currentIndex(VIEWS, '/9')).toBe(-1);
    expect(currentIndex(VIEWS, '/nowhere')).toBe(-1);
    expect(currentIndex([], '')).toBe(-1);
  });
});

describe('the finger', () => {
  it('chooses an axis once it has moved, and only a clearly sideways drag is a swipe', () => {
    expect(lockAxis(4, 3)).toBeNull();
    expect(lockAxis(14, 4)).toBe('horizontal');
    expect(lockAxis(14, 12)).toBeNull(); // too diagonal to be sure: still pending
    expect(lockAxis(3, 14)).toBe('vertical');
    expect(lockAxis(14, 14)).toBe('vertical');
  });

  it('pulls against a rubber band past the last view: less and less shows, never the width', () => {
    const width = 400;
    let last = 0;
    for (const pull of [20, 100, 300, 1000, 5000]) {
      const shown = rubberBand(pull, width);
      expect(shown).toBeGreaterThan(last);
      expect(shown).toBeLessThan(width);
      expect(shown).toBeLessThan(pull);
      last = shown;
    }
    expect(rubberBand(-100, width)).toBe(-rubberBand(100, width));
    expect(rubberBand(100, 0)).toBe(0);
  });

  it('turns the page past a third of the width, or with a flick that travelled at all', () => {
    const width = 400;
    expect(commits(width * COMMIT_FRACTION, width, 0)).toBe(true);
    expect(commits(-width * COMMIT_FRACTION, width, 0)).toBe(true);
    expect(commits(60, width, 0.1)).toBe(false);
    expect(commits(60, width, 0.9)).toBe(true); // a flick
    expect(commits(60, width, -0.9)).toBe(false); // flicked back the other way
    expect(commits(COMMIT_DISTANCE - 1, width, 2)).toBe(false); // a twitch
    expect(commits(0, width, 2)).toBe(false);
  });
});

describe('what keeps a touch for itself', () => {
  const stop = document.createElement('div');

  // on the page: a test DOM computes no style for what is not
  const element = (tag: string, style = ''): HTMLElement => {
    const el = document.createElement(tag);
    el.setAttribute('style', style);
    document.body.append(el);
    return el;
  };

  it('a ruler or a dial (pan-y), a slider, a map, anything marked off', () => {
    expect(handlesHorizontal([element('div', 'touch-action: pan-y'), stop], stop, window)).toBe(
      true,
    );
    expect(handlesHorizontal([element('div', 'touch-action: none'), stop], stop, window)).toBe(
      true,
    );
    expect(handlesHorizontal([element('input'), stop], stop, window)).toBe(true);
    expect(handlesHorizontal([element('ha-slider'), stop], stop, window)).toBe(true);
    const off = element('div');
    off.setAttribute('data-swipe', 'off');
    expect(handlesHorizontal([off, stop], stop, window)).toBe(true);
  });

  it('not a vertical ruler (pan-x), plain content, or anything above the view', () => {
    expect(handlesHorizontal([element('div', 'touch-action: pan-x'), stop], stop, window)).toBe(
      false,
    );
    expect(handlesHorizontal([element('p'), element('article'), stop], stop, window)).toBe(false);
    // the ruler sits outside the view's box: not on the finger's path to the view
    expect(handlesHorizontal([stop, element('div', 'touch-action: pan-y')], stop, window)).toBe(
      false,
    );
  });
});

describe('where the swipe lives', () => {
  const panel = document.createElement('div');
  const root = panel.attachShadow({ mode: 'open' });
  const host = document.createElement('div');
  root.append(host);

  beforeEach(() => {
    document.documentElement.removeAttribute(NO_SWIPE);
    document.documentElement.removeAttribute(PAGE_ATTRIBUTE);
    panel.removeAttribute(PANEL_ATTRIBUTE);
  });

  it('is where the look is: the whole app, or a dashboard that wears it', () => {
    expect(swipeWanted(document, host)).toBe(false);
    document.documentElement.setAttribute(PAGE_ATTRIBUTE, '');
    expect(swipeWanted(document, host)).toBe(true);
    document.documentElement.removeAttribute(PAGE_ATTRIBUTE);
    panel.setAttribute(PANEL_ATTRIBUTE, '');
    expect(swipeWanted(document, host)).toBe(true);
  });

  it('is nowhere for a person who turned it off', () => {
    document.documentElement.setAttribute(PAGE_ATTRIBUTE, '');
    document.documentElement.setAttribute(NO_SWIPE, '');
    expect(swipeWanted(document, host)).toBe(false);
  });
});

/* ---------- the gesture on a host ---------- */

interface Point {
  x: number;
  y: number;
  t?: number;
}

/** A touch event the way a phone sends it, from `target` (through the shadow root to the host). */
function touch(target: Element, type: string, { x, y, t = 0 }: Point, id = 1, fingers = 1): Event {
  const event = new Event(type, { bubbles: true, composed: true, cancelable: true });
  const point = { identifier: id, clientX: x, clientY: y };
  const others = Array.from({ length: fingers - 1 }, (_, i) => ({
    ...point,
    identifier: id + i + 1,
  }));
  const list = type === 'touchend' || type === 'touchcancel' ? [] : [point, ...others];
  Object.defineProperties(event, {
    touches: { value: list },
    changedTouches: { value: [point] },
    timeStamp: { value: t },
  });
  target.dispatchEvent(event);
  return event;
}

function makeHost(): { host: SwipeHost; box: HTMLElement; view: () => HTMLElement } {
  const host = document.createElement('div') as SwipeHost;
  const shadow = host.attachShadow({ mode: 'open' });
  const box = document.createElement('div');
  box.id = 'view';
  const background = document.createElement('hui-view-background');
  const view = document.createElement('div');
  view.className = 'view';
  box.append(background, view);
  shadow.append(box);
  document.body.append(host);
  host.lovelace = { config: { views: VIEWS }, editMode: false };
  host.route = { prefix: '/dash', path: '/home' };
  host.hass = { user: { id: 'marta' } };
  return { host, box, view: () => box.querySelector('.view') as HTMLElement };
}

/** A whole drag: down, a few moves, up. The last move sets the speed. */
function drag(
  target: Element,
  from: Point,
  to: Point,
  { steps = 4, ms = 200, release = true } = {},
): void {
  touch(target, 'touchstart', { ...from, t: 0 });
  for (let i = 1; i <= steps; i += 1) {
    const f = i / steps;
    touch(target, 'touchmove', {
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
      t: ms * f,
    });
  }
  if (release) touch(target, 'touchend', { ...to, t: ms });
}

describe('the gesture on a host', () => {
  // happy-dom has no layout: the width the gesture works with is the window's (1024)
  const width = window.innerWidth;
  const far = width * COMMIT_FRACTION + 20;

  // a test DOM starts animations it never finishes: without `animate`, the engine settles the view at once
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: undefined,
      configurable: true,
    });
  });

  it('opens the next view on a drag to the left, and the previous on one to the right', async () => {
    const { host, view } = makeHost();
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).toHaveBeenCalledWith('/dash/lights');
    // Home Assistant answers: the route moves and a new view element replaces the old
    host.route = { prefix: '/dash', path: '/lights' };
    const old = view();
    old.remove();
    const next = document.createElement('div');
    next.className = 'view';
    host.shadowRoot!.querySelector('#view')!.append(next);
    await Promise.resolve();
    expect(next.style.transform).toBe(''); // settled (no animations in a test DOM: at rest at once)
    drag(next, { x: 300, y: 300 }, { x: 300 + far, y: 300 });
    expect(navigate).toHaveBeenLastCalledWith('/dash/home');
    off();
  });

  it('skips the views without a tab: a hidden one, a subview', () => {
    const { host, view } = makeHost();
    host.route = { prefix: '/dash', path: '/lights' };
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).toHaveBeenCalledWith('/dash/5');
    off();
  });

  it('follows the finger and springs back from a short drag', () => {
    const { host, view } = makeHost();
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 440, y: 300 }, { release: false });
    expect(view().style.transform).toBe('translate3d(-60px, 0, 0)');
    expect(Number(view().style.opacity)).toBeLessThan(1);
    touch(view(), 'touchend', { x: 440, y: 300, t: 200 });
    expect(view().style.transform).toBe('');
    expect(view().style.opacity).toBe('');
    expect(navigate).not.toHaveBeenCalled();
    off();
  });

  it('turns the page on a flick, however short', () => {
    const { host, view } = makeHost();
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 440, y: 300 }, { ms: 40 });
    expect(navigate).toHaveBeenCalledWith('/dash/lights');
    off();
  });

  it('pulls against a rubber band past the last view and stays', () => {
    const { host, view } = makeHost();
    host.route = { prefix: '/dash', path: '/5' };
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 800, y: 300 }, { x: 800 - far, y: 300 }, { release: false });
    const shown = Math.abs(Number(/-?[\d.]+/.exec(view().style.transform)?.[0]));
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(far);
    touch(view(), 'touchend', { x: 800 - far, y: 300, t: 200 });
    expect(navigate).not.toHaveBeenCalled();
    expect(view().style.transform).toBe('');
    off();
  });

  it('reads right to left the other way round', () => {
    const { host, view } = makeHost();
    host.style.direction = 'rtl';
    host.route = { prefix: '/dash', path: '/lights' };
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).toHaveBeenCalledWith('/dash/home');
    off();
  });

  it('leaves a scroll, a touch at the screen edge, a second finger and edit mode alone', () => {
    const { host, view } = makeHost();
    const navigate = vi.fn();
    const off = attachViewSwipe(host, { enabled: () => true, navigate });
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 + far * 2 }); // leans vertical
    expect(view().style.transform).toBe('');
    drag(view(), { x: EDGE - 4, y: 300 }, { x: EDGE - 4 + far, y: 300 }); // the system's back gesture
    touch(view(), 'touchstart', { x: 500, y: 300 });
    touch(view(), 'touchstart', { x: 520, y: 300 }, 2, 2); // a second finger, two on the screen
    touch(view(), 'touchmove', { x: 500 - far, y: 300 });
    touch(view(), 'touchend', { x: 500 - far, y: 300 });
    host.lovelace = { config: { views: VIEWS }, editMode: true };
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).not.toHaveBeenCalled();
    off();
  });

  it('leaves a drag that starts on a ruler to the ruler, and asks whether it is wanted at every touch', () => {
    const { host, view } = makeHost();
    const ruler = document.createElement('div');
    ruler.style.touchAction = 'pan-y';
    view().append(ruler);
    const navigate = vi.fn();
    let wanted = true;
    const off = attachViewSwipe(host, { enabled: () => wanted, navigate });
    drag(ruler, { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).not.toHaveBeenCalled();
    wanted = false;
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).not.toHaveBeenCalled();
    wanted = true;
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).toHaveBeenCalledTimes(1);
    off();
    drag(view(), { x: 500, y: 300 }, { x: 500 - far, y: 300 });
    expect(navigate).toHaveBeenCalledTimes(1); // detached: nothing listens
  });

  it('stops the page scrolling once the drag is a swipe, and not before', () => {
    const { host, view } = makeHost();
    const off = attachViewSwipe(host, { enabled: () => true, navigate: vi.fn() });
    touch(view(), 'touchstart', { x: 500, y: 300 });
    const early = touch(view(), 'touchmove', { x: 496, y: 300 });
    expect(early.defaultPrevented).toBe(false);
    const locked = touch(view(), 'touchmove', { x: 470, y: 302 });
    expect(locked.defaultPrevented).toBe(true);
    touch(view(), 'touchend', { x: 470, y: 302 });
    off();
  });
});
