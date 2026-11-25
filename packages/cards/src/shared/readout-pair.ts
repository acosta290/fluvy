import { css } from 'lit';
import type { TextRuler } from './fit.js';

/*
 * A readout each in equal columns (1.6: the Sensor card's several sensors; #264: the Chart card's series): how the row
 * fits, measured in the classes that draw it, and its sheet: one for both cards.
 */

/** A readout of the row as it is measured: its name, its value and its unit. */
export interface PairText {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

/** How a row of readouts fits: their size, whether their circles show, and the gap between columns (0: a line each). */
export interface PairFit {
  readonly size: 'm' | 's' | 'xs';
  readonly circles: boolean;
  readonly gap: 32 | 16 | 0;
}

/**
 * How the row of readouts fits in `width`, `columns` to a line (all of them by default), in the order things give
 * way: the circles while every name reads whole and every value keeps the small size beside one (where the card draws
 * circles); then the circles go (a key beside each name says which curve is whose); then the gap closes to 16; then
 * one readout a line. A name never ends in an ellipsis before the row has stacked, and a value never shrinks past the
 * extra-small size.
 */
export function pairFit(
  ruler: TextRuler,
  width: number,
  texts: readonly PairText[],
  {
    circles = true,
    columns = texts.length,
  }: { readonly circles?: boolean; readonly columns?: number } = {},
): PairFit {
  const across = (gap: number): number => (width - gap * (columns - 1)) / columns;
  const fits = (size: PairFit['size'], room: number): boolean =>
    texts.every(
      ({ value, unit }) =>
        ruler.width(`fv-readout fv-readout--${size} > fv-readout__value`, value, 'fv-unit', unit) <=
        room,
    );
  // a name with its key (12 + 8) when the circles have gone
  const named = (room: number, key: boolean): boolean =>
    texts.every(
      ({ label }) => ruler.width('fv-readout > fv-readout__label', label) + (key ? 20 : 0) <= room,
    );
  const wide = across(32);
  if (circles && named(wide - 56, false))
    for (const size of ['m', 's'] as const)
      if (fits(size, wide - 56)) return { size, circles: true, gap: 32 };
  if (named(wide, true))
    for (const size of ['m', 's', 'xs'] as const)
      if (fits(size, wide)) return { size, circles: false, gap: 32 };
  const tight = across(16);
  if (named(tight, true))
    for (const size of ['s', 'xs'] as const)
      if (fits(size, tight)) return { size, circles: false, gap: 16 };
  // a line each: the value at the end, beside its name
  return { size: fits('s', width / 2) ? 's' : 'xs', circles: false, gap: 0 };
}

/** The row's sheet: its columns and hairlines, a readout's key and name, and a line each where columns would cut. */
export const pairStyles = css`
  /* a readout each in equal columns, 32 apart with a 36 hairline in the middle of the gap */
  .am-pair {
    display: grid;
    grid-template-columns: repeat(var(--am-pair, 2), minmax(0, 1fr));
    column-gap: var(--am-gap, 32px);
    margin-top: 16px;
  }
  /* each readout centred in its column, its circle and its words as one (the language's readout rows) */
  .am-pair__item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-width: 0;
    min-height: 44px;
  }
  .am-pair__item + .am-pair__item::before {
    content: '';
    position: absolute;
    top: 50%;
    height: 36px;
    translate: 0 -50%;
    inset-inline-start: calc(var(--am-gap, 32px) / -2);
    width: 1px;
    background: var(--fluvy-border);
  }
  /* without its circle a readout keeps the key of its curve beside its name: a 12 × 2 line in the curve's ink, its
     own part, so a name that ends in an ellipsis never takes its key with it */
  .am-key {
    flex: none;
    width: 12px;
    height: 2px;
    margin-inline-start: 8px;
    border-radius: 1px;
    background: var(--tone-ink, var(--fluvy-accent));
  }
  /* where columns would cut a name, a line a readout: its name and key at the start, its value at the end on the
     name's baseline, the hairline across between them */
  .am-pair--column {
    row-gap: 12px;
  }
  .am-pair--column .am-pair__item {
    min-height: 32px;
  }
  .am-pair--column .fv-readout {
    display: flex;
    flex: 1;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }
  .am-pair--column .fv-readout__value {
    flex: none;
    margin-top: 0;
  }
  .am-pair--column .am-pair__item + .am-pair__item::before {
    top: -6px;
    translate: none;
    inset-inline: 0;
    width: auto;
    height: 1px;
  }
  .am-pair .fv-readout {
    min-width: 0;
  }
  .am-pair .fv-readout__label {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .am-name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  } /* a name may ellipsize; its key and its value never */
  .am-pair .fv-readout__value {
    white-space: nowrap;
  }
`;
