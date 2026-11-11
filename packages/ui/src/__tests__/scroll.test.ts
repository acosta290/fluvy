// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluvyDial } from '../controls/dial.js';
import {
  releaseStepRepeat,
  startStepRepeat,
  stopStepRepeat,
  trackDrag,
  type DragAxis,
  type StepButton,
} from '../controls/pointer.js';
import { FluvyRuler } from '../controls/ruler.js';
import { setMotionPreference } from '../motion.js';

if (!customElements.get('fluvy-ruler')) customElements.define('fluvy-ruler', FluvyRuler);
if (!customElements.get('fluvy-dial')) customElements.define('fluvy-dial', FluvyDial);

/**
 * A scroll that sets off on a control (#166): the browser takes the gesture for the page (`pointercancel`) and the
 * control chooses nothing — it sends nothing, taps nothing and shows what it showed; a finger or a pen that sets off
 * across a control's axis is the page's from the start, and the control does not move. A mouse drags as it always did.
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

/** A finger (or `pointerType`) from (`x`, `y`) by (`dx`, `dy`) in four moves; the gesture is left open. */
function travel(el: Element, x: number, y: number, dx: number, dy: number, pointerType = 'touch') {
  el.dispatchEvent(pointer('pointerdown', { clientX: x, clientY: y, pointerType }));
  for (let i = 1; i <= 4; i++)
    el.dispatchEvent(
      pointer('pointermove', {
        clientX: x + (dx * i) / 4,
        clientY: y + (dy * i) / 4,
        pointerType,
      }),
    );
}

/** What a control says, by event name, in order. */
function heard(el: Element, ...types: string[]): string[] {
  const said: string[] = [];
  for (const type of types) el.addEventListener(type, () => said.push(type));
  return said;
}

beforeEach(() => setMotionPreference('reduced')); // springs land at once: the knob is read where it ends
afterEach(() => {
  setMotionPreference('system');
  stopStepRepeat();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the drag tracker', () => {
  function tracked(axis?: DragAxis) {
    const el = document.createElement('div');
    document.body.append(el);
    const log: string[] = [];
    trackDrag(el, {
      ...(axis ? { axis: () => axis } : {}),
      start: () => true,
      move: () => void log.push('move'),
      end: (_s, moved) => void log.push(moved ? 'end moved' : 'end'),
      cancel: () => void log.push('cancel'),
    });
    return { el, log };
  }

  it('cancels a gesture the browser takes, never releasing it', () => {
    const { el, log } = tracked();
    travel(el, 100, 100, 0, -12);
    el.dispatchEvent(pointer('pointercancel', { clientX: 100, clientY: 88 }));
    expect(log).toEqual(['move', 'move', 'move', 'cancel']);
  });

  it('lets a finger that sets off across the axis go at once: the page’s scroll, never a move', () => {
    const { el, log } = tracked('x');
    travel(el, 100, 100, 3, -12);
    el.dispatchEvent(pointer('pointercancel', { clientX: 103, clientY: 88 }));
    el.dispatchEvent(pointer('pointerup', { clientX: 103, clientY: 88 }));
    expect(log).toEqual(['cancel']);
  });

  it('claims a finger along the axis, more along than across, and releases it on its pointerup', () => {
    const { el, log } = tracked('x');
    travel(el, 100, 100, 16, -10);
    el.dispatchEvent(pointer('pointerup', { clientX: 116, clientY: 90 }));
    expect(log).toEqual(['move', 'move', 'move', 'move', 'end moved']);
  });

  it('reads the axis up and down for a vertical control, and lets a pen go as a finger', () => {
    const { el, log } = tracked('y');
    travel(el, 100, 100, 12, 2, 'pen');
    expect(log).toEqual(['cancel']);
    log.length = 0;
    travel(el, 100, 100, 2, -12, 'pen');
    el.dispatchEvent(pointer('pointerup', { clientX: 102, clientY: 88, pointerType: 'pen' }));
    expect(log).toEqual(['move', 'move', 'move', 'end moved']);
  });

  it('keeps a mouse’s drag in any direction, as it always was', () => {
    const { el, log } = tracked('x');
    travel(el, 100, 100, 0, -12, 'mouse');
    el.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 88, pointerType: 'mouse' }));
    expect(log).toEqual(['move', 'move', 'move', 'end moved']);
  });

  it('cancels when the capture goes without a release, and not after one', () => {
    const { el, log } = tracked('x');
    travel(el, 100, 100, 12, 0);
    el.dispatchEvent(pointer('lostpointercapture'));
    expect(log.at(-1)).toBe('cancel');
    log.length = 0;
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 100 }));
    el.dispatchEvent(pointer('lostpointercapture'));
    expect(log).toEqual(['end']);
  });
});

describe('the ruler under a scroll', () => {
  async function ruler(more: Partial<FluvyRuler> = {}) {
    const el = document.createElement('fluvy-ruler') as FluvyRuler;
    Object.assign(el, { value: 40, length: 320, label: 'Brightness', ...more });
    document.body.append(el);
    await el.updateComplete;
    const band = el.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    const said = heard(
      el,
      'fluvy-input',
      'fluvy-change',
      'fluvy-cancel',
      'fluvy-tap',
      'fluvy-hold',
    );
    const shown = async () => {
      await el.updateComplete;
      return band.getAttribute('aria-valuenow');
    };
    return { el, band, said, shown };
  }

  it('a press, 12 px up and the browser’s cancel: nothing sent, nothing moved', async () => {
    const { band, said, shown } = await ruler();
    travel(band, 100, 22, 0, -12);
    band.dispatchEvent(pointer('pointercancel', { clientX: 100, clientY: 10 }));
    expect(said).toEqual([]);
    expect(await shown()).toBe('40');
  });

  it('a diagonal swipe, more up than across, moves nothing', async () => {
    const { band, said, shown } = await ruler();
    travel(band, 100, 22, 30, -60);
    band.dispatchEvent(pointer('pointercancel', { clientX: 130, clientY: -38 }));
    expect(said).toEqual([]);
    expect(await shown()).toBe('40');
  });

  it('a drag the browser takes after it was claimed sends nothing, and the knob goes back', async () => {
    const { band, said, shown } = await ruler();
    travel(band, 100, 22, 48, 0);
    expect(await shown()).toBe('55');
    band.dispatchEvent(pointer('pointercancel', { clientX: 148, clientY: 22 }));
    expect(said.filter((type) => type !== 'fluvy-input')).toEqual(['fluvy-cancel']);
    expect(await shown()).toBe('40');
  });

  it('a lost capture mid-drag is a cancel, not a release', async () => {
    const { band, said, shown } = await ruler();
    travel(band, 100, 22, 48, 0);
    band.dispatchEvent(pointer('lostpointercapture'));
    expect(said).not.toContain('fluvy-change');
    expect(await shown()).toBe('40');
  });

  it('does not wake an off light: a swipe up on a sleeping ruler sends nothing', async () => {
    const { band, said } = await ruler({ value: 0, inactive: true, wake: true });
    travel(band, 100, 22, 4, -40);
    band.dispatchEvent(pointer('pointercancel', { clientX: 104, clientY: -18 }));
    expect(said).toEqual([]);
  });

  it('still slides along its axis and sends once on the release, and a tap still goes there', async () => {
    const { band, said, shown } = await ruler();
    travel(band, 100, 22, 64, 6);
    band.dispatchEvent(pointer('pointerup', { clientX: 164, clientY: 28 }));
    expect(said.filter((type) => type !== 'fluvy-input')).toEqual(['fluvy-change']);
    expect(await shown()).toBe('60');
  });

  it('stands vertical: a finger across it lets go, one along it slides', async () => {
    const { band, said, shown } = await ruler({ vertical: true, length: 160 });
    travel(band, 22, 100, 40, 4);
    band.dispatchEvent(pointer('pointercancel', { clientX: 62, clientY: 104 }));
    expect(said).toEqual([]);
    travel(band, 22, 100, 2, -32);
    band.dispatchEvent(pointer('pointerup', { clientX: 24, clientY: 68 }));
    expect(said.at(-1)).toBe('fluvy-change');
    expect(await shown()).toBe('60');
  });

  it('keeps a mouse’s drag that wanders off the axis (the precision gain), as it always was', async () => {
    const { band, said } = await ruler();
    travel(band, 100, 22, 0, -12, 'mouse');
    band.dispatchEvent(pointer('pointermove', { clientX: 132, clientY: 10, pointerType: 'mouse' }));
    band.dispatchEvent(pointer('pointerup', { clientX: 132, clientY: 10, pointerType: 'mouse' }));
    expect(said.at(-1)).toBe('fluvy-change');
  });

  it('drops the fine scale a hold raised when the page takes the finger, and sends nothing', async () => {
    vi.useFakeTimers();
    const { el, band, said } = await ruler();
    const windows: boolean[] = [];
    el.addEventListener('fluvy-window', (e) => windows.push((e as CustomEvent).detail.fine));
    band.dispatchEvent(pointer('pointerdown', { clientX: 128, clientY: 22 }));
    vi.advanceTimersByTime(500);
    band.dispatchEvent(pointer('pointermove', { clientX: 129, clientY: 10 }));
    band.dispatchEvent(pointer('pointercancel', { clientX: 129, clientY: 10 }));
    expect(windows).toEqual([true, false]);
    expect(said).toEqual([]);
  });
});

describe('a tile’s fill under a scroll', () => {
  async function fill() {
    const el = document.createElement('fluvy-ruler') as FluvyRuler;
    Object.assign(el, { value: 40, length: 160, band: 168, look: 'fill', label: 'Desk' });
    document.body.append(el);
    await el.updateComplete;
    const band = el.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    return { band, said: heard(el, 'fluvy-change', 'fluvy-tap', 'fluvy-hold', 'fluvy-cancel') };
  }

  it('neither taps nor sets the tile when the page takes a swipe up', async () => {
    vi.useFakeTimers();
    const { band, said } = await fill();
    travel(band, 60, 80, 2, -12);
    band.dispatchEvent(pointer('pointercancel', { clientX: 62, clientY: 68 }));
    vi.advanceTimersByTime(800);
    expect(said).toEqual([]);
  });

  it('taps nothing when the browser cancels a still press', async () => {
    const { band, said } = await fill();
    band.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 80 }));
    band.dispatchEvent(pointer('pointercancel', { clientX: 60, clientY: 80 }));
    expect(said).toEqual([]);
  });

  it('still taps on a still press’s release', async () => {
    const { band, said } = await fill();
    band.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap']);
  });
});

describe('the dial under a cancel', () => {
  it('sends nothing for a turn taken away, and puts its knob back', async () => {
    const dial = document.createElement('fluvy-dial') as FluvyDial;
    Object.assign(dial, { value: 21, min: 5, max: 35, step: 0.5, label: 'Living room' });
    document.body.append(dial);
    await dial.updateComplete;
    const said = heard(dial, 'fluvy-input', 'fluvy-change');
    // a 200 box: the top of the ring is the middle of the sweep, its right three quarters of the way
    dial.shadowRoot!.querySelector<HTMLElement>('.fv-dial')!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    const knob = dial.shadowRoot!.querySelector<HTMLElement>('[data-knob="0"]')!;
    knob.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 0, pointerType: 'mouse' }));
    for (const [clientX, clientY] of [
      [150, 10],
      [190, 50],
      [200, 100],
    ] as const)
      knob.dispatchEvent(pointer('pointermove', { clientX, clientY, pointerType: 'mouse' }));
    expect(said).toContain('fluvy-input');
    knob.dispatchEvent(pointer('pointercancel', { pointerType: 'mouse' }));
    await dial.updateComplete;
    expect(said).not.toContain('fluvy-change');
    expect(knob.getAttribute('aria-valuenow')).toBe('21');
  });
});

describe('a stepper half under a scroll', () => {
  function half() {
    const button = document.createElement('button') as StepButton;
    const steps: number[] = [];
    button.fvStep = (direction) => void steps.push(direction);
    button.addEventListener('pointerdown', (e) => startStepRepeat(e, 1));
    button.addEventListener('pointerup', releaseStepRepeat);
    button.addEventListener('pointercancel', stopStepRepeat);
    document.body.append(button);
    return { button, steps };
  }

  it('steps nothing for a finger the page takes for a scroll', () => {
    vi.useFakeTimers();
    const { button, steps } = half();
    button.dispatchEvent(pointer('pointerdown'));
    button.dispatchEvent(pointer('pointercancel'));
    vi.advanceTimersByTime(1000);
    expect(steps).toEqual([]);
  });

  it('steps once on a finger’s tap, at its release', () => {
    vi.useFakeTimers();
    const { button, steps } = half();
    button.dispatchEvent(pointer('pointerdown'));
    expect(steps).toEqual([]);
    button.dispatchEvent(pointer('pointerup'));
    vi.advanceTimersByTime(1000);
    expect(steps).toEqual([1]);
  });

  it('repeats a held finger from its first step on, and steps no more at its release', () => {
    vi.useFakeTimers();
    const { button, steps } = half();
    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(420);
    expect(steps).toEqual([1]);
    vi.advanceTimersByTime(220);
    expect(steps).toEqual([1, 1, 1]);
    button.dispatchEvent(pointer('pointerup'));
    vi.advanceTimersByTime(1000);
    expect(steps).toEqual([1, 1, 1]);
  });

  it('steps a mouse at its press, as it always did', () => {
    vi.useFakeTimers();
    const { button, steps } = half();
    button.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse' }));
    expect(steps).toEqual([1]);
    button.dispatchEvent(pointer('pointerup', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(1000);
    expect(steps).toEqual([1]);
  });
});
