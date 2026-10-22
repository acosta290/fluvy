import { wrap } from './patches.js';

/**
 * `ha-marquee-text` (the playing title in more-info) scrolls a text that does not fit, and does nothing
 * with one that does — but says neither. Its one set-up method is wrapped so the element carries
 * `overflowing` while its text is wider than its box (while Fluvy is in use on the page): the shell fades
 * the edges of a scrolling title only, never the first letter of one that sits still. If HA renames the
 * method, nothing is wrapped and the shell's report says so.
 */
export async function patchMarqueeOverflow(registry: CustomElementRegistry): Promise<boolean> {
  await registry.whenDefined('ha-marquee-text');
  return wrap(
    registry.get('ha-marquee-text')?.prototype,
    '_setupAnimation',
    'marqueeOverflow',
    (marquee: Element & { _maxOffset?: unknown }) => {
      marquee.toggleAttribute(
        'overflowing',
        typeof marquee._maxOffset === 'number' && marquee._maxOffset > 0,
      );
    },
  );
}
