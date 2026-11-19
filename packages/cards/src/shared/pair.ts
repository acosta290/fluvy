/**
 * A sheet's pair of buttons (Cancel · Save) sharing one width: the schedule sheet's and the heating sheet's. The
 * arithmetic is pure (`pairWidth`); `fitPair` measures the row as it is laid out and asks it.
 */

/** The sheet's 16 between the two buttons of its pair. */
const GAP = 16;
/** The design's width for a button of the pair, where the sheet holds two of them (392 wide: 360 of content). */
export const PAIR = 172;

const up4 = (n: number): number => Math.ceil(n / 4) * 4;

/**
 * One width for both buttons of a pair, on the 4 px grid: the design's 172 where two of them and the 16 between fit
 * the row; else the row's equal share while the longer label (`natural`, its words and sides) holds it; else the
 * label's own width, and the two stand one above the other (`stacked`).
 */
export function pairWidth(
  natural: number,
  room: number,
  base = PAIR,
): { readonly pair: number; readonly stacked: boolean } {
  const share = Math.floor((room - GAP) / 2 / 4) * 4;
  const pair = up4(Math.max(natural, Math.min(base, share)));
  return { pair, stacked: 2 * pair + GAP > room };
}

/**
 * The pair's row (`.dv-actions`) fitted: its buttons' labels measured laid out at their natural width, the row as it is
 * now, the width they share written to `--ss-pair` and the row marked stacked where two would not hold it.
 */
export function fitPair(row: HTMLElement | null): void {
  if (!row) return;
  let natural = 0;
  for (const button of row.querySelectorAll<HTMLElement>('.fv-btn')) {
    const previous = button.style.width;
    button.style.width = 'max-content';
    natural = Math.max(natural, button.offsetWidth + 16);
    button.style.width = previous;
  }
  const { pair, stacked } = pairWidth(natural, row.clientWidth);
  row.style.setProperty('--ss-pair', `${pair}px`);
  row.classList.toggle('dv-actions--stacked', stacked);
}
