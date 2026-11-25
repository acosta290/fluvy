import { describe, expect, it, vi } from 'vitest';
import { PanZoom, ZOOM_MOST } from './pan-zoom.js';

/*
 * A picture moved and enlarged inside its plate (#265): the zoom held between the whole picture and four times it,
 * the picture never carried past the plate's edges, the spot under two fingers or the pointer staying under them.
 */

const SIZE = { width: 320, height: 240 };
/** A plate 320 × 240 at the page's corner, drawn `zoomed` times its own size (a zoomed view). */
const plate = (zoomed = 1): HTMLElement =>
  ({
    offsetWidth: SIZE.width,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: SIZE.width * zoomed,
      height: SIZE.height * zoomed,
    }),
  }) as unknown as HTMLElement;

function view(zoomed = 1) {
  const changed = vi.fn();
  const pan = new PanZoom(
    () => plate(zoomed),
    () => SIZE,
    changed,
  );
  return { pan, changed, at: () => [pan.zoom, pan.x, pan.y] };
}

const touches = (...spots: ReadonlyArray<readonly [number, number]>) =>
  ({
    touches: spots.map(([clientX, clientY]) => ({ clientX, clientY })),
    cancelable: true,
    preventDefault: vi.fn(),
  }) as unknown as TouchEvent & { preventDefault: ReturnType<typeof vi.fn> };

const key = (name: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key: name, ...extra }) as KeyboardEvent;

describe('the zoom', () => {
  it('is about a spot, which stays where it is', () => {
    const { pan, at } = view();
    pan.by(2, { x: 80, y: 60 });
    expect(at()).toEqual([2, -80, -60]);
    // the picture's place under the spot is the same before and after: (80 + 80) / 2 = 80
    pan.by(2, { x: 80, y: 60 });
    expect(at()).toEqual([4, -240, -180]);
  });

  it('is about the plate’s middle where no spot is said', () => {
    const { pan, at } = view();
    pan.by(2);
    expect(at()).toEqual([2, -160, -120]);
  });

  it('is held between the whole picture and four times it', () => {
    const { pan, at, changed } = view();
    pan.by(0.5);
    expect(at()).toEqual([1, 0, 0]);
    expect(changed).not.toHaveBeenCalled();
    pan.by(100);
    expect(pan.zoom).toBe(ZOOM_MOST);
    pan.fit();
    expect(at()).toEqual([1, 0, 0]);
    expect(pan.zoomed).toBe(false);
  });
});

describe('the picture carried', () => {
  it('never leaves the plate uncovered', () => {
    const { pan, at } = view();
    pan.by(2);
    pan.pan(500, 500);
    expect(at()).toEqual([2, 0, 0]);
    pan.pan(-5000, -5000);
    expect(at()).toEqual([2, -320, -240]);
    pan.pan(100, 40);
    expect(at()).toEqual([2, -220, -200]);
  });

  it('whole, it does not move', () => {
    const { pan, at, changed } = view();
    pan.pan(40, 40);
    expect(at()).toEqual([1, 0, 0]);
    expect(changed).not.toHaveBeenCalled();
  });

  it('zoomed out about a corner, it is held inside as it shrinks', () => {
    const { pan, at } = view();
    pan.by(4, { x: 320, y: 240 });
    expect(at()).toEqual([4, -960, -720]);
    pan.by(0.5, { x: 0, y: 0 });
    expect(at()).toEqual([2, -320, -240]);
  });
});

describe('two fingers', () => {
  it('apart enlarge it about the spot between them, which stays between them; one finger is the page’s', () => {
    const { pan, at } = view();
    const one = touches([100, 100]);
    pan.touchStart(one);
    pan.touchMove(touches([100, 160]));
    expect(at()).toEqual([1, 0, 0]);
    // from 100 apart to 200 apart, about (160, 120)
    pan.touchStart(touches([110, 120], [210, 120]));
    const move = touches([60, 120], [260, 120]);
    pan.touchMove(move);
    expect(at()).toEqual([2, -160, -120]);
    expect(move.preventDefault).toHaveBeenCalled();
  });

  it('carry it as they travel together', () => {
    const { pan, at } = view();
    pan.by(2);
    pan.touchStart(touches([100, 100], [200, 100]));
    pan.touchMove(touches([130, 110], [230, 110]));
    expect(at()).toEqual([2, -130, -110]);
  });

  it('let go, the next finger alone moves nothing', () => {
    const { pan, at } = view();
    pan.touchStart(touches([110, 120], [210, 120]));
    pan.touchEnd(touches([110, 120]));
    pan.touchMove(touches([10, 120]));
    expect(at()).toEqual([1, 0, 0]);
  });

  it('are read in the plate’s own pixels in a view drawn larger', () => {
    const { pan, at } = view(2);
    // on screen from 200 apart to 400 apart about (320, 240): the plate's own (160, 120)
    pan.touchStart(touches([220, 240], [420, 240]));
    pan.touchMove(touches([120, 240], [520, 240]));
    expect(at()).toEqual([2, -160, -120]);
  });
});

describe('a mouse', () => {
  const wheel = (deltaY: number, extra: Partial<WheelEvent> = {}) =>
    ({
      deltaY,
      clientX: 80,
      clientY: 60,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      ...extra,
    }) as unknown as WheelEvent & { preventDefault: ReturnType<typeof vi.fn> };

  it('zooms with Ctrl and its wheel about the pointer; a plain wheel is the page’s', () => {
    const { pan, at } = view();
    const plain = wheel(-100);
    pan.wheel(plain);
    expect(at()).toEqual([1, 0, 0]);
    expect(plain.preventDefault).not.toHaveBeenCalled();
    const held = wheel(-100 * Math.LN2, { ctrlKey: true });
    pan.wheel(held);
    expect(held.preventDefault).toHaveBeenCalled();
    expect(pan.zoom).toBeCloseTo(2);
    expect(pan.x).toBeCloseTo(-80);
    expect(pan.y).toBeCloseTo(-60);
  });

  it('a double click comes closer about the pointer, and from the closest back to the whole picture', () => {
    const { pan, at } = view();
    const click = { clientX: 80, clientY: 60 } as MouseEvent;
    pan.doubleClick(click);
    expect(at()).toEqual([2, -80, -60]);
    pan.doubleClick(click);
    expect(pan.zoom).toBe(4);
    pan.doubleClick(click);
    expect(at()).toEqual([1, 0, 0]);
  });

  const pointer = (clientX: number, clientY: number, extra: Partial<PointerEvent> = {}) =>
    ({ clientX, clientY, pointerType: 'mouse', button: 0, ...extra }) as PointerEvent;

  it('drags the enlarged picture, and says so its click picks nothing', () => {
    const { pan, at } = view();
    expect(pan.grab(pointer(100, 100))).toBe(false);
    pan.by(2);
    expect(pan.grab(pointer(100, 100, { pointerType: 'touch' }))).toBe(false);
    expect(pan.grab(pointer(100, 100))).toBe(true);
    pan.drag(pointer(102, 101));
    expect(pan.dragged).toBe(false);
    pan.drag(pointer(130, 110));
    expect(pan.dragged).toBe(true);
    expect(at()).toEqual([2, -130, -110]);
    pan.release();
    pan.drag(pointer(200, 200));
    expect(at()).toEqual([2, -130, -110]);
  });
});

describe('the keyboard', () => {
  it('zooms with + and −, fits with 0, carries with the arrows while enlarged', () => {
    const { pan, at } = view();
    expect(pan.key(key('ArrowLeft'))).toBe(false);
    expect(pan.key(key('+'))).toBe(true);
    expect(pan.zoom).toBe(1.5);
    expect(pan.key(key('ArrowRight'))).toBe(true);
    expect(pan.x).toBe(-80 - 48);
    expect(pan.key(key('-'))).toBe(true);
    expect(pan.zoom).toBe(1);
    pan.by(3);
    expect(pan.key(key('0'))).toBe(true);
    expect(at()).toEqual([1, 0, 0]);
  });

  it('leaves the page’s keys and chords alone', () => {
    const { pan } = view();
    expect(pan.key(key('a'))).toBe(false);
    expect(pan.key(key('+', { ctrlKey: true }))).toBe(false);
    expect(pan.zoom).toBe(1);
  });
});
