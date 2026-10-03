/*
 * Pointer geometry under CSS `zoom` (a dashboard's view read larger on a wall tablet). Two kinds of pixel meet in
 * a gesture: the VISUAL ones of `getBoundingClientRect()` and `PointerEvent.clientX / clientY`, and the LOCAL ones
 * an element lays out in — `offsetWidth`, `clientWidth`, `scrollLeft`, a ResizeObserver's sizes, every CSS length
 * it writes. Inside a zoomed subtree one local pixel is `zoom` visual pixels. A fraction of a rect is right as it
 * is; a distance that is going to meet a local length is not, until it is divided by the zoom.
 */

/** The factor between an element's visual and local pixels: 1 when nothing of it can be measured. */
export function zoomOf(el: Element): number {
  const local = (el as HTMLElement).offsetWidth;
  if (!(local > 0)) return 1;
  const visual = el.getBoundingClientRect().width;
  return visual > 0 ? visual / local : 1;
}

/** A pointer's place inside `el`, in the element's own pixels (from its top-left corner). */
export function localPoint(
  el: Element,
  event: { readonly clientX: number; readonly clientY: number },
): { readonly x: number; readonly y: number } {
  const rect = el.getBoundingClientRect();
  const zoom = zoomOf(el);
  return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
}
