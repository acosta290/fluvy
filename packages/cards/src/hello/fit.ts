/**
 * Measuring laid-out text for the post-render fits (the greeting's tiers, the readouts' sizes).
 *
 * `scrollWidth` is a whole number, and a line that is 0.4 px too wide already gets its ellipsis, so
 * these read client rects instead: sub-pixel, and safe while a card is still scaling in, because
 * both sides of every comparison carry the same transform.
 */

/** Width the element's own content wants on one line, whatever its box was squeezed to. */
export function contentWidth(el: Element): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
}

/** True when the content is wider than the box — the moment an ellipsis would appear. */
export const overflows = (el: Element): boolean =>
  contentWidth(el) > el.getBoundingClientRect().width + 0.01;
