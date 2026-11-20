/*
 * Laid-out widths in a test's page, where happy-dom lays nothing out (every `offsetWidth` is 0, so every line fits): a
 * tile's state line as Inter at 13 px about sets it, 7 a Latin character and 13 a CJK one — "Living room · −1.0 °C"
 * measures 147, wider than a 172 tile's 140 and well inside a 360 one's 328. `TextRuler` reads its probe's
 * `offsetWidth`; every other element keeps happy-dom's.
 */

const STATE = 'fv-tile__state';
const CJK = 0x2e80;

/** Lays out the elements of `classes` by the model above until the returned function puts happy-dom's back. */
function laidOut(classes: readonly string[]): () => void {
  const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement): number {
      if (!classes.some((name) => this.classList.contains(name)))
        return (own?.get?.call(this) as number | undefined) ?? 0;
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

/** Lays out a tile's state line by the model above until the returned function puts happy-dom's back. */
export const stateLineWidths = (): (() => void) => laidOut([STATE]);

/**
 * A tile's state line and its readouts — each one's label and its figure with its unit, as a large tile's foot and a
 * compact one's columns at its end draw them (#197) — by the same model.
 */
export const readoutWidths = (): (() => void) =>
  laidOut([STATE, 'fv-readout__label', 'fv-readout__value']);

/** The states the rounds say (`lt-said`, in a pill or a key) by the same model. */
export const saidWidths = (): (() => void) => laidOut(['lt-said']);
