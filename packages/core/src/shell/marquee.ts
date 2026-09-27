/**
 * `ha-marquee-text` (the playing title in more-info) scrolls a text that does not fit, and does nothing
 * with one that does — but says neither. Its one set-up method is wrapped so the element carries
 * `overflowing` while its text is wider than its box: the shell fades the edges of a scrolling title only,
 * never the first letter of one that sits still. If HA renames the method, nothing is wrapped and the
 * shell's report says so.
 */
interface MarqueePrototype {
  _setupAnimation?: () => void;
  __fluvyOverflow?: true;
}

export async function patchMarqueeOverflow(registry: CustomElementRegistry): Promise<boolean> {
  await registry.whenDefined('ha-marquee-text');
  const proto = registry.get('ha-marquee-text')?.prototype as MarqueePrototype | undefined;
  const original = proto?._setupAnimation;
  if (!proto || typeof original !== 'function') return false;
  if (proto.__fluvyOverflow) return true;
  proto._setupAnimation = function (this: HTMLElement & { _maxOffset?: number }): void {
    original.call(this);
    this.toggleAttribute('overflowing', (this._maxOffset ?? 0) > 0);
  };
  proto.__fluvyOverflow = true;
  return true;
}
