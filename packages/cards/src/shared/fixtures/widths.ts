/*
 * Laid-out widths in a test's page, where happy-dom lays nothing out (every `offsetWidth` is 0, so every line fits): a
 * tile's state line as Inter at 13 px about sets it, 7 a Latin character and 13 a CJK one — "Living room · −1.0 °C"
 * measures 147, wider than a 172 tile's 140 and well inside a 360 one's 328. `TextRuler` reads its probe's
 * `offsetWidth`; every other element keeps happy-dom's.
 */

const STATE = 'fv-tile__state';
const CJK = 0x2e80;

/** Lays out a tile's state line by the model above until the returned function puts happy-dom's back. */
export function stateLineWidths(): () => void {
  const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement): number {
      if (!this.classList.contains(STATE)) return (own?.get?.call(this) as number | undefined) ?? 0;
      return [...(this.textContent ?? '')].reduce(
        (width, char) => width + ((char.codePointAt(0) ?? 0) >= CJK ? 13 : 7),
        0,
      );
    },
  });
  return () => {
    if (own) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', own);
  };
}
