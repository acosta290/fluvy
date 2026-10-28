import { firstFit, type TextRuler } from './fit.js';

/** Words along an axis or a ruler, each at its fraction. */
export type Labels = ReadonlyArray<readonly [number, string]>;

/**
 * Whether an axis's labels stand apart: each placed by its fraction of `width` — the first flush left, the last
 * flush right, the rest centred on their point — with 12 px or more between neighbours. Two labels always hold;
 * a card that cannot hold three (a narrow column, a long "Maintenant") keeps the two ends.
 */
export function axisHolds(
  ruler: TextRuler,
  width: number,
  items: ReadonlyArray<readonly [number, string]>,
): boolean {
  if (items.length <= 2) return true;
  const spans = items.map(([fraction, text], index) => {
    const w = ruler.width('fv-axis', text);
    const left =
      index === 0 ? 0 : index === items.length - 1 ? width - w : fraction * width - w / 2;
    return [left, left + w] as const;
  });
  return spans.every(([, end], i) => i === spans.length - 1 || spans[i + 1]![0] - end >= 12);
}

/**
 * A ruler's words that stand 12 apart in its column, measured: all of them, else the ends and the middle, else the
 * ends ("Apagado" would run into "Baja" at 211).
 */
export function heldLabels(ruler: TextRuler, width: number, labels: Labels): Labels {
  const first = labels[0]!;
  const last = labels[labels.length - 1]!;
  const middle = labels.length % 2 ? [labels[(labels.length - 1) / 2]!] : [];
  return (
    firstFit([labels, [first, ...middle, last], [first, last]], (set) =>
      axisHolds(ruler, width, set),
    ) ?? labels
  );
}
