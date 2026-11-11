// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluvyDial } from '../controls/dial.js';
import {
  HOLD_TO_SLIDE,
  setHoldToSlide,
  trackDrag,
  type DragAxis,
  type DragCallbacks,
} from '../controls/pointer.js';
import { fetchSliderStyles, FluvyRuler } from '../controls/ruler.js';
import { FluvyTimeRail } from '../controls/time-rail.js';
import { setMotionPreference } from '../motion.js';

if (!customElements.get('fluvy-ruler')) customElements.define('fluvy-ruler', FluvyRuler);
if (!customElements.get('fluvy-dial')) customElements.define('fluvy-dial', FluvyDial);

/**
 * Hold to slide (#166): with the person's setting on, a finger's press on a slider stands still for 200 ms before the
 * slider is its — the cue shows meanwhile, a finger that strays first is the page's scroll, one lifted before taps
 * and moves no value; armed, the slider buzzes, takes its drag look and claims the finger whichever way it goes. A
 * mouse, the keys and a control that is not a slider never wait.
 */
const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    ...init,
  });

/** What a control says, by event name, in order. */
function heard(el: Element, ...types: string[]): string[] {
  const said: string[] = [];
  for (const type of types) el.addEventListener(type, () => said.push(type));
  return said;
}

beforeEach(() => {
  vi.useFakeTimers();
  setMotionPreference('reduced'); // springs land at once: the knob is read where it ends
  setHoldToSlide(true);
});
afterEach(() => {
  setHoldToSlide(false);
  setMotionPreference('system');
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the tracker, holding to slide', () => {
  function tracked(more: Partial<DragCallbacks> & { axis?: () => DragAxis } = {}, slider = true) {
    const el = document.createElement('div');
    document.body.append(el);
    const log: string[] = [];
    trackDrag(el, {
      start: () => true,
      ...(slider ? { wait: (ms: number) => void log.push(`wait ${ms}`) } : {}),
      arm: (s) => void log.push(`arm ${s.x},${s.y}`),
      move: (s) => void log.push(`move ${s.dx},${s.dy}`),
      end: (_s, moved) => void log.push(moved ? 'end moved' : 'end'),
      cancel: () => void log.push('cancel'),
      ...more,
    });
    return { el, log };
  }

  it('waits 200 ms standing still, buzzes as it arms, and counts the drag from where the finger is then', () => {
    const { el, log } = tracked();
    const buzzes = heard(el, 'haptic');
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 104, clientY: 103 })); // a thumb's tremble, under 10 px
    vi.advanceTimersByTime(HOLD_TO_SLIDE - 1);
    expect(log).toEqual(['wait 200']);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(['wait 200', 'arm 104,103']);
    expect(buzzes).toEqual(['haptic']);
    el.dispatchEvent(pointer('pointermove', { clientX: 124, clientY: 103 }));
    el.dispatchEvent(pointer('pointerup', { clientX: 124, clientY: 103 }));
    expect(log.slice(2)).toEqual(['move 20,0', 'end moved']);
  });

  it('lets a finger that strays more than 10 px before it is armed go: the page’s scroll, never a move', () => {
    const { el, log } = tracked({ axis: () => 'x' });
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 111, clientY: 100 })); // along the axis, still too soon
    vi.advanceTimersByTime(500);
    el.dispatchEvent(pointer('pointerup', { clientX: 140, clientY: 100 }));
    expect(log).toEqual(['wait 200', 'cancel']);
  });

  it('ends a press lifted before it is armed as a tap, never arming it', () => {
    const { el, log } = tracked();
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    vi.advanceTimersByTime(120);
    el.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 100 }));
    vi.advanceTimersByTime(500);
    expect(log).toEqual(['wait 200', 'end']);
  });

  it('claims an armed finger across the axis too: the person chose to slide', () => {
    const { el, log } = tracked({ axis: () => 'x' });
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    el.dispatchEvent(pointer('pointermove', { clientX: 102, clientY: 70 }));
    expect(log).toEqual(['wait 200', 'arm 100,100', 'move 2,-30']);
  });

  it('keeps the page still under an armed finger, and leaves it the page’s while the finger waits', () => {
    const { el } = tracked();
    const touch = (): TouchEvent => {
      const event = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event;
    };
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    expect(touch().defaultPrevented).toBe(false);
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    expect(touch().defaultPrevented).toBe(true);
    el.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 100 }));
    expect(touch().defaultPrevented).toBe(false);
  });

  it('never makes a mouse wait, nor a control that is not a slider, nor anyone without the setting', () => {
    const mouse = tracked();
    mouse.el.dispatchEvent(
      pointer('pointerdown', { clientX: 10, clientY: 10, pointerType: 'mouse' }),
    );
    expect(mouse.log).toEqual(['arm 10,10']);
    const lock = tracked({}, false);
    lock.el.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
    expect(lock.log).toEqual(['arm 10,10']);
    setHoldToSlide(false);
    const off = tracked();
    off.el.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
    expect(off.log).toEqual(['arm 10,10']);
  });

  it('lets the knobs that keep the page’s scroll off pan it while the setting is on', () => {
    expect(document.documentElement.style.getPropertyValue('--fv-pan')).toBe('pan-y');
    setHoldToSlide(false);
    expect(document.documentElement.style.getPropertyValue('--fv-pan')).toBe('');
  });
});

describe('the ruler, holding to slide', () => {
  async function ruler(more: Partial<FluvyRuler> = {}) {
    const el = document.createElement('fluvy-ruler') as FluvyRuler;
    Object.assign(el, { value: 40, length: 320, label: 'Brightness', ...more });
    document.body.append(el);
    await el.updateComplete;
    const band = el.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    const said = heard(el, 'fluvy-change', 'fluvy-tap', 'fluvy-hold', 'fluvy-window');
    const shown = async (): Promise<string | null> => {
      await el.updateComplete;
      return band.getAttribute('aria-valuenow');
    };
    const root = el.shadowRoot!;
    return { el, band, said, shown, root };
  }

  it('closes a ring round the knob while the finger waits, then takes its drag look', async () => {
    const { el, band, root } = await ruler();
    band.dispatchEvent(pointer('pointerdown', { clientX: 128, clientY: 22 }));
    await el.updateComplete;
    const ring = root.querySelector<SVGElement>('.fv-knob .fv-hold');
    expect(ring?.getAttribute('style')).toBe('--fv-wait:200ms');
    expect(ring?.querySelector('circle')?.getAttribute('r')).toBe('23'); // 5 outside a 36 knob's edge
    expect(band.classList.contains('is-dragging')).toBe(false);
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    await el.updateComplete;
    expect(root.querySelector('.fv-hold')).toBeNull();
    expect(band.classList.contains('is-dragging')).toBe(true);
  });

  it('never jumps to a tap, before it is armed or after', async () => {
    const { band, said, shown } = await ruler();
    band.dispatchEvent(pointer('pointerdown', { clientX: 250, clientY: 22 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 22 }));
    band.dispatchEvent(pointer('pointerdown', { clientX: 250, clientY: 22 }));
    vi.advanceTimersByTime(300);
    band.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 22 }));
    expect(said).toEqual([]);
    expect(await shown()).toBe('40');
  });

  it('slides once armed and sends once on the release', async () => {
    const { band, said, shown } = await ruler();
    band.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 22 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    for (const x of [116, 132, 148, 164])
      band.dispatchEvent(pointer('pointermove', { clientX: x, clientY: 22 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 164, clientY: 22 }));
    expect(said).toEqual(['fluvy-change']);
    expect(await shown()).toBe('60');
  });

  it('raises the fine scale 450 ms after it is armed: 650 ms of one still press', async () => {
    const { band, said } = await ruler();
    band.dispatchEvent(pointer('pointerdown', { clientX: 128, clientY: 22 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE + 449);
    expect(said).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(said).toEqual(['fluvy-window']);
  });

  it('wakes an off light’s knob for the ring, and leaves it asleep when the finger strays', async () => {
    const { el, band, said, root } = await ruler({ value: 0, inactive: true, wake: true });
    band.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 22 }));
    await el.updateComplete;
    expect(root.querySelector('.fv-knob .fv-hold')).not.toBeNull();
    band.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 6 }));
    await el.updateComplete;
    expect(root.querySelector('.fv-knob')).toBeNull();
    expect(said).toEqual([]);
  });

  it('keeps a tile’s fill the tile’s: a quick tap taps, a still press of 500 ms holds, its edge inked meanwhile', async () => {
    await fetchSliderStyles();
    const { el, band, said, root } = await ruler({ look: 'fill', band: 168, length: 160 });
    band.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap']);
    band.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 80 }));
    await el.updateComplete;
    expect(root.querySelector('.sb-fill__edge.is-waiting')).not.toBeNull();
    vi.advanceTimersByTime(500);
    band.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap', 'fluvy-hold']);
  });

  it('grows a bar’s handle to 28 while the finger waits, and gives a liquid the bar’s handle till it lifts', async () => {
    await fetchSliderStyles();
    const bar = await ruler({ look: 'bar', value: 65 });
    bar.band.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 22 }));
    await bar.el.updateComplete;
    expect(bar.root.querySelector<HTMLElement>('.sb-bar__handle')!.style.height).toBe('28px');
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    await bar.el.updateComplete;
    expect(bar.root.querySelector<HTMLElement>('.sb-bar__handle')!.style.height).toBe('20px');
    bar.band.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 22 }));

    const liquid = await ruler({ look: 'liquid', value: 65 });
    expect(liquid.root.querySelector('.sb-liq .sb-bar__handle')).toBeNull();
    liquid.band.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 22 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    liquid.band.dispatchEvent(pointer('pointermove', { clientX: 120, clientY: 22 }));
    await liquid.el.updateComplete;
    expect(liquid.root.querySelector('.sb-liq .sb-bar__handle')).not.toBeNull();
    liquid.band.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 22 }));
    await liquid.el.updateComplete;
    expect(liquid.root.querySelector('.sb-liq .sb-bar__handle')).toBeNull();
  });

  it('answers a mouse at once, as it always did: a click goes there', async () => {
    const { band, said, shown } = await ruler();
    band.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 44 }) as DOMRect;
    band.dispatchEvent(pointer('pointerdown', { clientX: 160, clientY: 22, pointerType: 'mouse' }));
    band.dispatchEvent(pointer('pointerup', { clientX: 160, clientY: 22, pointerType: 'mouse' }));
    expect(said).toEqual(['fluvy-change']);
    expect(await shown()).toBe('50');
  });
});

describe('the dial, holding to slide', () => {
  async function dial() {
    const el = document.createElement('fluvy-dial') as FluvyDial;
    Object.assign(el, { value: 21, min: 5, max: 35, step: 0.5, label: 'Living room' });
    document.body.append(el);
    await el.updateComplete;
    // a 200 box: the top of the ring is the middle of the sweep, its right three quarters of the way
    el.shadowRoot!.querySelector<HTMLElement>('.fv-dial')!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    const knob = el.shadowRoot!.querySelector<HTMLElement>('[data-knob="0"]')!;
    return { el, knob, said: heard(el, 'fluvy-input', 'fluvy-change') };
  }

  it('rings the knob a finger stands on, and turns nothing for one that sets off at once', async () => {
    const { el, knob, said } = await dial();
    knob.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 0 }));
    await el.updateComplete;
    expect(knob.querySelector('.fv-hold')).not.toBeNull();
    expect(knob.classList.contains('is-dragging')).toBe(false);
    for (const [clientX, clientY] of [
      [150, 10],
      [190, 50],
    ] as const)
      knob.dispatchEvent(pointer('pointermove', { clientX, clientY }));
    await el.updateComplete;
    expect(said).toEqual([]);
    expect(knob.querySelector('.fv-hold')).toBeNull();
    expect(knob.getAttribute('aria-valuenow')).toBe('21');
  });

  it('turns once armed, from where the finger stood, and sends once', async () => {
    const { el, knob, said } = await dial();
    knob.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 0 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    await el.updateComplete;
    expect(knob.classList.contains('is-dragging')).toBe(true);
    for (const [clientX, clientY] of [
      [150, 10],
      [190, 50],
      [200, 100],
    ] as const)
      knob.dispatchEvent(pointer('pointermove', { clientX, clientY }));
    knob.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 100 }));
    await el.updateComplete;
    expect(said.filter((type) => type === 'fluvy-change')).toHaveLength(1);
    expect(Number(knob.getAttribute('aria-valuenow'))).toBeGreaterThan(21);
  });
});

describe('the time rail, holding to slide', () => {
  it('rings its knob while the finger waits, picks nothing for one lifted before, and scrubs once armed', async () => {
    const HOUR = 3_600_000;
    const rail = new FluvyTimeRail();
    Object.assign(rail, { start: 0, end: 24 * HOUR, value: 12 * HOUR });
    document.body.append(rail);
    (rail as unknown as { height: number }).height = 600; // noon's knob at 300
    await rail.updateComplete;
    const said = heard(rail, 'fluvy-scrub', 'fluvy-cancel');
    rail.dispatchEvent(pointer('pointerdown', { clientY: 300 }));
    await rail.updateComplete;
    expect(rail.shadowRoot!.querySelector('.fv-knob .fv-hold')).not.toBeNull();
    expect(rail.scrubbing).toBe(false);
    rail.dispatchEvent(pointer('pointerup', { clientY: 300 }));
    expect(said).toEqual([]);
    rail.dispatchEvent(pointer('pointerdown', { clientY: 300 }));
    vi.advanceTimersByTime(HOLD_TO_SLIDE);
    expect(rail.scrubbing).toBe(true);
    rail.dispatchEvent(pointer('pointermove', { clientY: 400 }));
    rail.dispatchEvent(pointer('pointerup', { clientY: 400 }));
    expect(said.length).toBeGreaterThan(1);
    expect(said.every((type) => type === 'fluvy-scrub')).toBe(true);
  });
});
