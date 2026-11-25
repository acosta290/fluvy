import { clamp, localPoint, zoomOf } from '@fluvy/ui';

/*
 * A picture moved and enlarged inside its plate (#265; the house's first): a zoom of 1 (the whole picture) to 4 and
 * where the enlarged picture's top left corner stands in the plate, in the plate's own pixels. Two fingers pinch and
 * carry it, one finger is the page's scroll; a mouse zooms with Ctrl and its wheel (a trackpad's pinch is that too)
 * or a double click, and drags the enlarged picture; the keys + − 0 and the arrows do the same. It holds numbers and
 * says when they change: whoever draws the plate writes them as one transform.
 */

export const ZOOM_MOST = 4;
/** What one press of + or − multiplies the zoom by, and a double click. */
const KEY_STEP = 1.5;
const CLICK_STEP = 2;
/** How far an arrow carries the picture. */
const KEY_PAN = 48;

interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Two fingers as they landed: how far apart, where between them, and the picture as it stood then. */
interface Pinch {
  readonly apart: number;
  readonly mid: Spot;
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

const between = (a: Touch, b: Touch): { clientX: number; clientY: number } => ({
  clientX: (a.clientX + b.clientX) / 2,
  clientY: (a.clientY + b.clientY) / 2,
});

export class PanZoom {
  zoom = 1;
  x = 0;
  y = 0;

  private pinch: Pinch | undefined;
  /** A mouse dragging the enlarged picture: where it last was; and whether it travelled, so its click picks nothing. */
  private grip: Spot | undefined;
  dragged = false;

  constructor(
    /** The plate, once it is drawn, and its size in its own pixels. */
    private readonly plate: () => HTMLElement | null,
    private readonly size: () => { readonly width: number; readonly height: number },
    private readonly changed: () => void,
  ) {}

  get zoomed(): boolean {
    return this.zoom > 1;
  }

  /** The whole picture again. */
  fit(): void {
    this.place(1, 0, 0);
  }

  /** The zoom multiplied by `factor` about a spot of the plate (its middle where none is said), which stays put. */
  by(factor: number, at?: Spot): void {
    const { width, height } = this.size();
    const spot = at ?? { x: width / 2, y: height / 2 };
    const zoom = clamp(this.zoom * factor, 1, ZOOM_MOST);
    const scale = zoom / this.zoom;
    this.place(zoom, spot.x - (spot.x - this.x) * scale, spot.y - (spot.y - this.y) * scale);
  }

  /** The picture carried, never past the plate's edges. */
  pan(dx: number, dy: number): void {
    this.place(this.zoom, this.x + dx, this.y + dy);
  }

  /** The picture held inside its plate (its size may have changed under it). */
  settle(): void {
    this.place(this.zoom, this.x, this.y, false);
  }

  private place(zoom: number, x: number, y: number, say = true): void {
    const { width, height } = this.size();
    const next = {
      zoom,
      x: clamp(x, width * (1 - zoom), 0),
      y: clamp(y, height * (1 - zoom), 0),
    };
    if (next.zoom === this.zoom && next.x === this.x && next.y === this.y) return;
    Object.assign(this, next);
    if (say) this.changed();
  }

  private spot(event: { readonly clientX: number; readonly clientY: number }): Spot {
    const plate = this.plate();
    return plate ? localPoint(plate, event) : { x: 0, y: 0 };
  }

  /* ---------- two fingers ---------- */

  readonly touchStart = (event: TouchEvent): void => {
    const [a, b] = event.touches;
    this.pinch =
      a && b && event.touches.length === 2
        ? {
            apart: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            mid: this.spot(between(a, b)),
            zoom: this.zoom,
            x: this.x,
            y: this.y,
          }
        : undefined;
  };

  /**
   * Two fingers moving: the picture's, never the page's (the one listener here that is not passive: a browser asks it
   * before it scrolls, and one finger is let through). The zoom follows how far apart they are, and the spot that was
   * between them stays between them.
   */
  readonly touchMove = (event: TouchEvent): void => {
    const [a, b] = event.touches;
    const from = this.pinch;
    if (!from || !a || !b) return;
    if (event.cancelable) event.preventDefault();
    const apart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const zoom = clamp(from.zoom * (from.apart > 0 ? apart / from.apart : 1), 1, ZOOM_MOST);
    const mid = this.spot(between(a, b));
    const scale = zoom / from.zoom;
    this.place(zoom, mid.x - (from.mid.x - from.x) * scale, mid.y - (from.mid.y - from.y) * scale);
  };

  readonly touchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) this.pinch = undefined;
  };

  /* ---------- a mouse ---------- */

  /** Ctrl and the wheel (a trackpad's pinch arrives so): the zoom about the pointer; a plain wheel is the page's. */
  readonly wheel = (event: WheelEvent): void => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.by(Math.exp(-event.deltaY / 100), this.spot(event));
  };

  /** A double click: closer about the pointer, and from the closest back to the whole picture. */
  readonly doubleClick = (event: MouseEvent): void => {
    if (this.zoom >= ZOOM_MOST) this.fit();
    else this.by(CLICK_STEP, this.spot(event));
  };

  /** A mouse takes the enlarged picture to drag it; false where there is nothing to drag. */
  grab(event: PointerEvent): boolean {
    this.dragged = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !this.zoomed) return false;
    this.grip = { x: event.clientX, y: event.clientY };
    return true;
  }

  drag(event: PointerEvent): void {
    const from = this.grip;
    const plate = this.plate();
    if (!from || !plate) return;
    const scale = zoomOf(plate);
    const [dx, dy] = [(event.clientX - from.x) / scale, (event.clientY - from.y) / scale];
    if (!this.dragged && Math.hypot(dx, dy) < 4) return;
    this.dragged = true;
    this.grip = { x: event.clientX, y: event.clientY };
    this.pan(dx, dy);
  }

  release(): void {
    this.grip = undefined;
  }

  /* ---------- the keyboard ---------- */

  /** + and − zoom about the middle, 0 fits, the arrows carry the enlarged picture; true where the key was its own. */
  key(event: KeyboardEvent): boolean {
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    const pans: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const pan = Object.hasOwn(pans, event.key) ? pans[event.key] : undefined;
    if (event.key === '+' || event.key === '=') this.by(KEY_STEP);
    else if (event.key === '-') this.by(1 / KEY_STEP);
    else if (event.key === '0') this.fit();
    else if (pan && this.zoomed) this.pan(...pan);
    else return false;
    return true;
  }
}
