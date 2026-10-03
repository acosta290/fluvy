import { reducedMotion } from '../motion.js';
import { zoomOf } from './zoom.js';

/**
 * A row that scrolls sideways (a tab strip). A finger and a trackpad already scroll it natively; this
 * gives the mouse the same reach:
 *
 * - the wheel turns the row while it has room to move that way; at either end the page scrolls on,
 *   so the row never traps the wheel;
 * - press and drag pulls the row. The pointer is only captured once it has travelled past the intent
 *   threshold, so a plain click still lands on the item under it, and the click that ends a drag never
 *   reaches an item.
 *
 * `onUse` runs whenever the person moves the row (a caller that keeps an item in view stops doing so).
 * Returns the function that removes every listener.
 */
export function sideScroll(target: HTMLElement, onUse?: () => void): () => void {
  const INTENT = 4;
  const room = (): number => target.scrollWidth - target.clientWidth;

  const wheel = (event: WheelEvent): void => {
    // a sideways gesture (trackpad, tilt wheel) is the browser's own; zoom stays zoom
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || room() <= 1) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? target.clientWidth : 1;
    const delta = event.deltaY * unit;
    const next = Math.min(Math.max(target.scrollLeft + delta, 0), room());
    if (Math.abs(next - target.scrollLeft) < 1) return; // at the end: the page scrolls on
    event.preventDefault();
    onUse?.();
    // a notched wheel moves in steps of ~100 px: glide them; a trackpad's small deltas follow the finger
    target.scrollBy({
      left: delta,
      behavior: Math.abs(delta) >= 40 && !reducedMotion() ? 'smooth' : 'auto',
    });
  };

  let pointer = -1;
  let originX = 0;
  let originScroll = 0;
  let zoom = 1;
  let dragging = false;
  let swallowClick = false;

  const down = (event: PointerEvent): void => {
    swallowClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || room() <= 1) return;
    pointer = event.pointerId;
    originX = event.clientX;
    originScroll = target.scrollLeft;
    zoom = zoomOf(target); // the row scrolls in its own pixels; the pointer travels in the viewport's
    dragging = false;
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    const dx = (event.clientX - originX) / zoom;
    if (!dragging) {
      if (Math.abs(dx) < INTENT) return;
      dragging = true;
      try {
        target.setPointerCapture(pointer);
      } catch {
        /* the pointer is already gone */
      }
      target.classList.add('is-dragging');
      onUse?.();
    }
    target.scrollLeft = originScroll - dx;
  };
  const up = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    if (!dragging) return;
    dragging = false;
    // the click that follows this pointerup (same task) is the drag's own; a later one (keyboard) is not
    swallowClick = true;
    setTimeout(() => {
      swallowClick = false;
    }, 0);
    target.classList.remove('is-dragging');
    try {
      target.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };
  const click = (event: MouseEvent): void => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  target.addEventListener('wheel', wheel, { passive: false });
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
  target.addEventListener('lostpointercapture', up);
  target.addEventListener('click', click, true);
  return () => {
    target.removeEventListener('wheel', wheel);
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    target.removeEventListener('lostpointercapture', up);
    target.removeEventListener('click', click, true);
    target.classList.remove('is-dragging');
  };
}
