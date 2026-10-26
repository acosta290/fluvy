/**
 * The history bars' own scale rule: the typical bar its unit is chosen by. The nice numbers of its y axis, how wide a
 * bar is in its slot and how many date labels a row holds are the chart engine's (`chart/engine/scale.ts`,
 * `chart/engine/bars.ts`), shared with every chart.
 */

/**
 * The size of a typical bar, by which the figures choose their unit: the middle of the bars that have something in
 * them, by size (a bar below zero too), so a spike among them reads in the unit of the rest. Zero where none has.
 */
export function typical(values: ReadonlyArray<number | null>): number {
  const sizes = values.flatMap((v) => (v ? [Math.abs(v)] : [])).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? 0;
}
