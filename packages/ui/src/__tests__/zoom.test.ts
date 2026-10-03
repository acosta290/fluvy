// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { trackDrag, type DragSample } from '../controls/pointer.js';
import { localPoint, zoomOf } from '../controls/zoom.js';

/**
 * An element inside a view zoomed by `zoom`: it lays out `width` of its own pixels and the browser paints them
 * `zoom` times larger from (`left`, `top`) in the viewport — what `offsetWidth` and `getBoundingClientRect()` say
 * under CSS `zoom`.
 */
function zoomed(zoom: number, { width = 100, left = 40, top = 20 } = {}): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  el.getBoundingClientRect = () =>
    ({ left, top, width: width * zoom, height: 44 * zoom }) as DOMRect;
  document.body.append(el);
  return el;
}

const pointer = (type: string, clientX: number, clientY = 42): PointerEvent =>
  new PointerEvent(type, { clientX, clientY, pointerId: 1, pointerType: 'touch', bubbles: true });

describe('pointer geometry under zoom', () => {
  afterEach(() => document.body.replaceChildren());

  it('reads the zoom as the painted width over the laid-out one, 1 when nothing can be measured', () => {
    expect(zoomOf(zoomed(1))).toBe(1);
    expect(zoomOf(zoomed(1.25))).toBe(1.25);
    expect(zoomOf(zoomed(1.5))).toBe(1.5);
    expect(zoomOf(zoomed(1.25, { width: 0 }))).toBe(1); // not laid out
    const hidden = zoomed(1.25);
    hidden.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    expect(zoomOf(hidden)).toBe(1); // display: none
  });

  it('puts the pointer in the element’s own pixels', () => {
    const el = zoomed(1.25, { width: 200, left: 100, top: 50 });
    expect(localPoint(el, { clientX: 100, clientY: 50 })).toEqual({ x: 0, y: 0 });
    expect(localPoint(el, { clientX: 350, clientY: 100 })).toEqual({ x: 200, y: 40 });
    // the far edge of the element is its own width, whatever the zoom
    expect(localPoint(zoomed(1.5, { width: 200, left: 0 }), { clientX: 300, clientY: 0 }).x).toBe(
      200,
    );
    expect(localPoint(zoomed(1, { width: 200, left: 0 }), { clientX: 300, clientY: 0 }).x).toBe(
      300,
    );
  });

  it('hands a drag its travel in the control’s pixels and its place in the viewport’s', () => {
    const el = zoomed(1.25, { width: 320, left: 100 });
    const samples: DragSample[] = [];
    const ends: [DragSample, boolean][] = [];
    const stop = trackDrag(el, {
      start: () => true,
      move: (s) => void samples.push(s),
      end: (s, moved) => void ends.push([s, moved]),
    });
    el.dispatchEvent(pointer('pointerdown', 200));
    el.dispatchEvent(pointer('pointermove', 203)); // under the 4 px intent: not yet a drag
    expect(samples).toHaveLength(0);
    el.dispatchEvent(pointer('pointermove', 300, 67));
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ x: 300, y: 67, dx: 80, dy: 20 }); // 100 and 25 viewport px
    el.dispatchEvent(pointer('pointerup', 350));
    expect(ends).toHaveLength(1);
    expect(ends[0]?.[0]).toMatchObject({ x: 350, dx: 120 });
    expect(ends[0]?.[1]).toBe(true);
    stop();
  });

  it('changes nothing at zoom 1', () => {
    const el = zoomed(1, { left: 0 });
    const samples: DragSample[] = [];
    const stop = trackDrag(el, {
      start: () => true,
      move: (s) => void samples.push(s),
      end: () => undefined,
    });
    el.dispatchEvent(pointer('pointerdown', 10, 10));
    el.dispatchEvent(pointer('pointermove', 50, 30));
    expect(samples[0]).toMatchObject({ x: 50, y: 30, dx: 40, dy: 20 });
    stop();
  });
});
