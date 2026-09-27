/**
 * Swiping between a dashboard's views on a phone: the view follows the finger, and letting go past a third of the
 * width (or with a flick) opens the next tab, the way the pages of a phone's home screen do. Nothing is drawn
 * beside the view (Home Assistant renders one view at a time), so the leaving view slides out and the arriving one
 * slides in from the other side once Home Assistant has put it on the page.
 *
 * What never becomes a swipe: a drag that begins on something that handles horizontal touches itself — a ruler, a
 * dial, a row of chips that scrolls, a slider, a map, anything marked `data-swipe="off"` — or within 24 px of the
 * screen's edges (the system's own back gesture), or in edit mode, or with a second finger down. A drag that leans
 * vertical stays a scroll. The gesture is a person's preference (Preferences → *Swipe between views*) and only
 * lives where the look does.
 *
 * `hui-root` is not modified: its connect and disconnect are wrapped so every instance gets the gesture, reading
 * only what it publishes (`lovelace.config.views`, `route`, `hass.user`) and navigating the way Home Assistant's
 * own tabs do (`location-changed`). If Home Assistant reshapes the element, nothing is wrapped and the shell's
 * report says so.
 */
import { haptic, reducedMotion } from '@fluvy/ui';
import { navigate as navigateTo } from '../actions.js';
import { NO_SWIPE, PAGE_ATTRIBUTE, PANEL_ATTRIBUTE } from '../look/attributes.js';
import { walkShadow } from './dom.js';

export interface ViewLike {
  readonly path?: string;
  readonly subview?: boolean;
  readonly visible?: boolean | ReadonlyArray<{ readonly user: string }>;
}

/** What the gesture reads from `hui-root` (all of it public state Home Assistant keeps on the element). */
export interface SwipeHost extends HTMLElement {
  lovelace?: { config?: { views?: readonly ViewLike[] }; editMode?: boolean };
  route?: { prefix: string; path: string };
  hass?: { user?: { id: string } };
}

export interface SwipeOptions {
  /** Whether the gesture is wanted here now (the preference, the look): asked at every touch. */
  readonly enabled: (host: SwipeHost) => boolean;
  /** Opens a view's URL; Home Assistant's `location-changed` by default. */
  readonly navigate?: (path: string) => void;
  readonly window?: Window & typeof globalThis;
}

/* ---------- the numbers ---------- */

/** A touch this close to a screen edge is the system's (back gestures). */
export const EDGE = 24;
/** Movement before the drag chooses an axis, and how much more horizontal than vertical it has to be. */
export const LOCK_DISTANCE = 12;
export const LOCK_RATIO = 1.4;
/** Letting go past this share of the width opens the next view; a flick faster than this does too (px per ms). */
export const COMMIT_FRACTION = 0.3;
export const COMMIT_VELOCITY = 0.45;
/** A flick still has to travel this far, so a twitch never turns a page. */
export const COMMIT_DISTANCE = 24;
/** Past the last view the finger drags against a rubber band: this much of the pull shows. */
export const RUBBER = 0.55;
/** How far the leaving view travels (a share of the width), and how long each leg takes. */
export const TRAVEL = 0.35;
export const OUT_MS = 160;
export const IN_MS = 280;
export const BACK_MS = 220;
/** How long to wait for Home Assistant to put the next view on the page before giving the old one back. */
const ARRIVAL_MS = 1500;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** What handles horizontal touches itself, whatever its `touch-action`. */
const HANDLES_TOUCH =
  'input, textarea, select, ha-slider, ha-control-slider, ha-control-circular-slider, ha-map, hui-map-card, [data-swipe="off"]';

/* ---------- pure parts (tested on their own) ---------- */

/** The views that have a tab, in order, for this person: no subviews, none hidden from them. */
export function tabbedViews(views: readonly ViewLike[], userId: string | undefined): number[] {
  const indices: number[] = [];
  views.forEach((view, index) => {
    if (view.subview) return;
    const visible =
      view.visible === undefined ||
      view.visible === true ||
      (Array.isArray(view.visible) && view.visible.some((entry) => entry.user === userId));
    if (visible) indices.push(index);
  });
  return indices;
}

/** The URL segment of a view: its path, else its index (Home Assistant's own rule). */
export const viewSegment = (views: readonly ViewLike[], index: number): string =>
  views[index]?.path ?? String(index);

/** The view a route opens, as Home Assistant reads it: nothing is the first, a number is an index, else a path. */
export function currentIndex(views: readonly ViewLike[], routePath: string | undefined): number {
  const segment = (routePath ?? '').replace(/^\/+/, '').split('/')[0] ?? '';
  if (segment === '') return views.length ? 0 : -1;
  const byPath = views.findIndex((view) => view.path === segment);
  if (byPath >= 0) return byPath;
  if (/^\d+$/.test(segment)) {
    const index = Number(segment);
    return index < views.length ? index : -1;
  }
  return -1;
}

/** Which way a drag leans once it has moved enough; `null` while it could still be either. */
export function lockAxis(dx: number, dy: number): 'horizontal' | 'vertical' | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= LOCK_DISTANCE && ax > ay * LOCK_RATIO) return 'horizontal';
  if (ay >= LOCK_DISTANCE && ay >= ax) return 'vertical';
  return null;
}

/** The pull past an edge, as the finger feels it: ever less of it shows, and it never crosses the width. */
export function rubberBand(offset: number, width: number): number {
  if (width <= 0) return 0;
  const pull = Math.abs(offset);
  const shown = (1 - 1 / ((pull * RUBBER) / width + 1)) * width;
  return Math.sign(offset) * shown;
}

/** Whether letting go here opens the next view. `velocity` is the last movement, px per ms, signed like `offset`. */
export function commits(offset: number, width: number, velocity: number): boolean {
  if (width <= 0 || offset === 0) return false;
  if (Math.abs(offset) >= width * COMMIT_FRACTION) return true;
  return (
    Math.abs(offset) >= COMMIT_DISTANCE &&
    Math.sign(velocity) === Math.sign(offset) &&
    Math.abs(velocity) >= COMMIT_VELOCITY
  );
}

/**
 * Whether something under the finger takes horizontal touches for itself: what says so with `touch-action`
 * (`none`, or `pan-y` without `pan-x`: our rulers and dials), what scrolls sideways (a chip row), or a control
 * from the list above. Looked for from the touched element up to `stopAt`, the view's box.
 */
export function handlesHorizontal(
  path: readonly EventTarget[],
  stopAt: Element,
  win: Window & typeof globalThis,
): boolean {
  for (const target of path) {
    if (target === stopAt) return false;
    if (!(target instanceof win.Element)) continue;
    if (target.matches(HANDLES_TOUCH)) return true;
    const style = win.getComputedStyle(target);
    const touch = style.touchAction;
    if (touch === 'none' || (touch.includes('pan-y') && !touch.includes('pan-x'))) return true;
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      target.scrollWidth > target.clientWidth + 1
    )
      return true;
  }
  return false;
}

/** Where the gesture lives: this person did not turn it off, and this dashboard wears the look. */
export function swipeWanted(doc: Document, host: Element): boolean {
  const html = doc.documentElement;
  if (html.hasAttribute(NO_SWIPE)) return false;
  if (html.hasAttribute(PAGE_ATTRIBUTE)) return true;
  const root = host.getRootNode();
  const panel = root instanceof ShadowRoot ? root.host : undefined;
  return panel?.hasAttribute(PANEL_ATTRIBUTE) ?? false;
}

/* ---------- the gesture on one host ---------- */

interface Touching {
  readonly id: number;
  readonly x0: number;
  readonly y0: number;
  axis: 'pending' | 'horizontal' | 'vertical' | 'dead';
  /** The last two positions and times, for the velocity at release. */
  samples: Array<{ x: number; t: number }>;
  /** Where the view sits now, px. */
  offset: number;
  /** The view a commit opens, and its URL; `null` at an edge (rubber band). */
  target: { index: number; path: string } | null;
  view: HTMLElement;
  width: number;
  /** +1: the arriving view comes from the right (the finger moved left); −1 the other way. */
  sign: 1 | -1;
}

/** The moving element: the view Home Assistant put in its container (never the background behind it, nor `except`). */
const viewIn = (container: Element, except?: Element): HTMLElement | undefined =>
  [...container.children].find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.localName !== 'hui-view-background' && child !== except,
  );

const place = (view: HTMLElement, x: number, opacity: number): void => {
  view.style.transform = x === 0 ? '' : `translate3d(${x}px, 0, 0)`;
  view.style.opacity = opacity === 1 ? '' : String(opacity);
};

const rest = (view: HTMLElement): void => {
  view.style.transform = '';
  view.style.opacity = '';
  view.style.willChange = '';
};

/** Runs `frames` on `view` and settles it at rest afterwards (at once under reduced motion). */
function play(
  view: HTMLElement,
  frames: Keyframe[],
  ms: number,
  easing: string,
  then?: () => void,
): void {
  if (reducedMotion() || typeof view.animate !== 'function') {
    rest(view);
    then?.();
    return;
  }
  const animation = view.animate(frames, { duration: ms, easing, fill: 'forwards' });
  const done = (): void => {
    rest(view);
    animation.cancel();
    then?.();
  };
  animation.onfinish = done;
  animation.oncancel = () => rest(view);
}

/** The pull behind the finger: a full width fades the view to a little more than half. */
const fade = (x: number, width: number): number =>
  reducedMotion() ? 1 : 1 - 0.45 * Math.min(1, Math.abs(x) / width);

/**
 * Gives one host the gesture; the returned function takes it away. `options.enabled` is asked at every touch, so
 * the preference and the look apply at once.
 */
export function attachViewSwipe(host: SwipeHost, options: SwipeOptions): () => void {
  const win = options.window ?? window;
  const go = options.navigate ?? navigateTo;
  let touching: Touching | null = null;
  let arriving: (() => void) | null = null;

  const container = (): Element | null => host.shadowRoot?.querySelector('#view') ?? null;

  const begin = (event: TouchEvent): void => {
    if (touching) {
      // a second finger ends the gesture where it is
      if (event.touches.length > 1) settle(touching, false);
      return;
    }
    if (event.touches.length !== 1 || !options.enabled(host) || host.lovelace?.editMode) return;
    const touch = event.touches[0]!;
    const width = win.innerWidth;
    if (touch.clientX < EDGE || touch.clientX > width - EDGE) return;
    const box = container();
    if (!box) return;
    const path = event.composedPath();
    if (!path.includes(box) || handlesHorizontal(path, box, win)) return;
    const view = viewIn(box);
    if (!view || arriving) return;
    touching = {
      id: touch.identifier,
      x0: touch.clientX,
      y0: touch.clientY,
      axis: 'pending',
      samples: [{ x: touch.clientX, t: event.timeStamp }],
      offset: 0,
      target: null,
      view,
      width: box.clientWidth || width,
      sign: 1,
    };
  };

  const move = (event: TouchEvent): void => {
    const state = touching;
    if (!state || state.axis === 'dead' || state.axis === 'vertical') return;
    const touch = [...event.changedTouches].find((t) => t.identifier === state.id);
    if (!touch) return;
    const dx = touch.clientX - state.x0;
    const dy = touch.clientY - state.y0;
    if (state.axis === 'pending') {
      const axis = lockAxis(dx, dy);
      if (!axis) return;
      state.axis = axis;
      if (axis === 'vertical') return;
      aim(state, dx);
      state.view.style.willChange = 'transform';
    }
    if (event.cancelable) event.preventDefault();
    state.samples.push({ x: touch.clientX, t: event.timeStamp });
    if (state.samples.length > 3) state.samples.shift();
    // the finger may turn round: the target follows its side
    if (Math.sign(dx) !== -state.sign && dx !== 0) aim(state, dx);
    state.offset = state.target ? dx : rubberBand(dx, state.width);
    place(state.view, state.offset, fade(state.offset, state.width));
  };

  /** Which view the drag heads for, from the finger's direction and the writing direction. */
  const aim = (state: Touching, dx: number): void => {
    const rtl = win.getComputedStyle(host).direction === 'rtl';
    const forward = dx < 0 !== rtl; // finger left in LTR (right in RTL): the next tab
    state.sign = dx < 0 ? 1 : -1;
    const views = host.lovelace?.config?.views ?? [];
    const order = tabbedViews(views, host.hass?.user?.id);
    const at = order.indexOf(currentIndex(views, host.route?.path));
    const next = at < 0 ? -1 : (order[at + (forward ? 1 : -1)] ?? -1);
    state.target =
      next >= 0
        ? { index: next, path: `${host.route?.prefix ?? ''}/${viewSegment(views, next)}` }
        : null;
  };

  const end = (event: TouchEvent): void => {
    const state = touching;
    if (!state) return;
    if (![...event.changedTouches].some((t) => t.identifier === state.id)) return;
    if (state.axis !== 'horizontal') {
      touching = null;
      return;
    }
    const [a, b] = [state.samples[0]!, state.samples[state.samples.length - 1]!];
    const velocity = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    settle(state, state.target !== null && commits(state.offset, state.width, velocity));
  };

  /** Lets go: the view springs back, or leaves for the next one. */
  const settle = (state: Touching, commit: boolean): void => {
    touching = null;
    const { view, width, sign } = state;
    const from = { transform: view.style.transform || 'none', opacity: view.style.opacity || '1' };
    if (!commit || !state.target) {
      play(view, [from, { transform: 'none', opacity: '1' }], BACK_MS, EASE_OUT);
      return;
    }
    const path = state.target.path;
    haptic(host, 'light');
    play(
      view,
      [from, { transform: `translate3d(${-sign * width * TRAVEL}px, 0, 0)`, opacity: '0' }],
      OUT_MS,
      EASE_IN,
      () => {
        // the leaving view is drawn in its leaving place until the next one is on the page
        if (!reducedMotion()) place(view, -sign * width * TRAVEL, 0);
        arrive(view, sign, width);
        go(path);
      },
    );
  };

  /** Waits for Home Assistant to put the next view in the container, then slides it in from the finger's side. */
  const arrive = (leaving: HTMLElement, sign: 1 | -1, width: number): void => {
    const box = container();
    if (!box || reducedMotion()) {
      rest(leaving);
      return;
    }
    const watch = { observer: null as MutationObserver | null, timer: 0 };
    const stop = (): void => {
      watch.observer?.disconnect();
      win.clearTimeout(watch.timer);
      arriving = null;
      rest(leaving);
    };
    const observer = new win.MutationObserver(() => {
      const next = viewIn(box, leaving);
      if (!next) return;
      stop();
      place(next, sign * width * TRAVEL, 0);
      next.style.willChange = 'transform';
      play(
        next,
        [
          { transform: `translate3d(${sign * width * TRAVEL}px, 0, 0)`, opacity: '0' },
          { transform: 'none', opacity: '1' },
        ],
        IN_MS,
        EASE_OUT,
      );
    });
    watch.observer = observer;
    observer.observe(box, { childList: true });
    // nothing arrived (the same view, or a route that went elsewhere): the old one comes back
    watch.timer = win.setTimeout(() => {
      stop();
      const back = viewIn(box);
      if (back) play(back, [{ opacity: '0' }, { opacity: '1' }], BACK_MS, EASE_OUT);
    }, ARRIVAL_MS);
    arriving = stop;
  };

  const cancel = (event: TouchEvent): void => {
    const state = touching;
    if (!state || ![...event.changedTouches].some((t) => t.identifier === state.id)) return;
    if (state.axis === 'horizontal') settle(state, false);
    else touching = null;
  };

  host.addEventListener('touchstart', begin, { passive: true });
  host.addEventListener('touchmove', move, { passive: false });
  host.addEventListener('touchend', end, { passive: true });
  host.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    host.removeEventListener('touchstart', begin);
    host.removeEventListener('touchmove', move);
    host.removeEventListener('touchend', end);
    host.removeEventListener('touchcancel', cancel);
    if (touching) {
      rest(touching.view);
      touching = null;
    }
    arriving?.();
  };
}

/* ---------- on Home Assistant's hui-root ---------- */

interface RootPrototype {
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
  __fluvySwipe?: true;
}

const attached = new WeakMap<Element, () => void>();

/**
 * Wraps `hui-root`'s connect and disconnect so every dashboard root carries the gesture while it is on the page;
 * the roots on the page now get it at once. False when Home Assistant reshaped the element (nothing is wrapped).
 */
export async function patchViewSwipe(
  registry: CustomElementRegistry,
  doc: Document,
  options: SwipeOptions,
): Promise<boolean> {
  const tag = 'hui-root';
  await registry.whenDefined(tag);
  const proto = registry.get(tag)?.prototype as RootPrototype | undefined;
  const connect = proto?.connectedCallback;
  const disconnect = proto?.disconnectedCallback;
  if (!proto || typeof connect !== 'function' || typeof disconnect !== 'function') return false;
  const attach = (host: Element): void => {
    if (!attached.has(host)) attached.set(host, attachViewSwipe(host as SwipeHost, options));
  };
  const detach = (host: Element): void => {
    attached.get(host)?.();
    attached.delete(host);
  };
  if (!proto.__fluvySwipe) {
    proto.connectedCallback = function (this: HTMLElement): void {
      connect.call(this);
      attach(this);
    };
    proto.disconnectedCallback = function (this: HTMLElement): void {
      detach(this);
      disconnect.call(this);
    };
    proto.__fluvySwipe = true;
  }
  walkShadow(doc, (element) => {
    if (element.localName === tag) attach(element);
  });
  return true;
}
