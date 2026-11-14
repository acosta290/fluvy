import type { FlowLink, FlowNode, Ink, SankeyModel } from './model.js';

/**
 * The diagram's geometry, top to bottom, in true proportions: ONE px-per-kWh scale for every bar and ribbon — the
 * largest that lets every row (its bars and the 8 px between them) hold in the column. Each row's words are packed
 * by their measured width in their bars' order, 16 px apart: one tier at their bars' starts or ends, else the fewest
 * lines that keep each over its bar.
 *
 *   sources' words (tiers of 36, the nearest under) · 8 · bars 8 · ribbons 88 · bars 8 · 8 · targets' words · 12 ·
 *   the house's ribbons 88 (leaving under its words' band) · its devices' bars 8 · 8 · their words
 */

export const GAP = 8;
export const BAR = 8;
export const RIBBONS = 88;
export const TIER = 36;
/** Between two words of a tier. */
export const APART = 16;
/** Between a bar and its words. */
export const WORDS_GAP = 8;
/** Under the targets' words, before the house's ribbons leave. */
export const LEAVE_GAP = 12;
/** The stem the house's ribbons leave from: 4 tall, its bottom where they start. */
export const STEM = 4;
/**
 * Under this column (half a section) a line holds two words at most, at the column's start and at its end: bars this
 * narrow would put every word at a place of its own, five columns of words where the eye reads two.
 */
export const NARROW = 200;

export interface LaidNode extends FlowNode {
  readonly x: number;
  readonly w: number;
}

export interface LaidLabel {
  readonly key: string;
  /** Left edge (on the 4 grid) and width of the words' box. */
  readonly x: number;
  readonly w: number;
  readonly tier: number;
  /** Anchored at its bar's end: the words are right-aligned there. */
  readonly end: boolean;
  /** Top of the words' box. */
  readonly y: number;
}

export interface Ribbon {
  readonly key: string;
  readonly d: string;
  readonly ink: Ink;
}

export interface SankeyLayout {
  readonly height: number;
  readonly scale: number;
  readonly y0: number;
  readonly y1: number;
  readonly y2: number;
  readonly top: readonly LaidNode[];
  readonly mid: readonly LaidNode[];
  readonly kids: readonly LaidNode[];
  readonly labels: readonly LaidLabel[];
  readonly ribbons: readonly Ribbon[];
  /** The house's stem, when its devices are drawn. */
  readonly stem: { readonly x: number; readonly y: number; readonly w: number } | null;
}

const rowSpan = (count: number): number => GAP * Math.max(0, count - 1);
const sum = (row: readonly FlowNode[]): number => row.reduce((s, n) => s + n.value, 0);

/** The one scale: every row, bars and gaps, holds in `width`. */
export function scaleOf(model: SankeyModel, width: number): number {
  const rows = [model.sources, model.targets, model.kids].filter((r) => r.length && sum(r) > 0);
  if (!rows.length) return 0;
  return Math.max(0, Math.min(...rows.map((r) => (width - rowSpan(r.length)) / sum(r))));
}

function lay(row: readonly FlowNode[], scale: number, x0 = 0): LaidNode[] {
  let x = x0;
  return row.map((n) => {
    const laid = { ...n, x, w: n.value * scale };
    x += laid.w + GAP;
    return laid;
  });
}

const down4 = (v: number): number => Math.floor(v / 4) * 4;
const up4 = (v: number): number => Math.ceil(v / 4) * 4;

/**
 * Packs a row's words in their bars' order, each leaning to its bar, on the 4 grid. One tier holds them where each
 * stands at its bar's start or, right-aligned, at its end, 16 after the one before it. Else they take the fewest tiers
 * that keep every word over its bar: each word has its room, from its end 8 into its bar to its start 8 before the
 * bar's end (half of a bar narrower than 16), inside the column; a tier takes the longest run of words that fit their
 * rooms placed leftmost, 16 apart (so the fewest tiers in order). In its tier a word stands at its bar's start, pushed
 * right by the one before it and pulled left by what follows it, where that keeps every word in its room; else the
 * tier settles from the right, each word as near its bar's start as the next one lets it. A word pulled left of its bar
 * is right-aligned, toward it, where its box ends on the bar or it is the tier's last (which ends where the column
 * does). A box wider than the column is the column, read from its start (its name ends in an ellipsis). Half a column
 * (`NARROW`) leans its words to the column's start and end instead: two
 * a tier at most, the first at the start, the second at the end, a word alone at the end where its bar stands in the
 * right half.
 */
export function packLabels(
  row: readonly LaidNode[],
  measure: (key: string) => number,
  width: number,
): Omit<LaidLabel, 'y'>[] {
  const lw = row.map((n) => Math.min(width, Math.ceil(measure(n.key))));
  const narrow = width < NARROW;
  let after = 0;
  const tier: Omit<LaidLabel, 'y'>[] = [];
  for (const [i, n] of row.entries()) {
    const w = lw[i] as number;
    const right = n.x + n.w;
    const start = down4(n.x);
    const end = down4(right - w);
    const place = narrow
      ? null
      : start >= after && start + w <= width
        ? { x: start, w, end: false }
        : end >= after
          ? { x: end, w: Math.round(right) - end, end: true }
          : null;
    if (!place) break;
    tier.push({ key: n.key, ...place, tier: 0 });
    after = place.x + place.w + APART;
  }
  if (tier.length === row.length) return tier;

  /** A word at `x` on tier `t`; one right-aligned that is its tier's last ends where the column does. */
  const label = (i: number, x: number, t: number, end: boolean, last: boolean) => {
    const w = lw[i] as number;
    return { key: (row[i] as LaidNode).key, x, w: end && last ? width - x : w, tier: t, end };
  };
  const out: Omit<LaidLabel, 'y'>[] = [];
  if (narrow) {
    for (let i = 0, t = 0; i < row.length; t++) {
      const n = row[i] as LaidNode;
      const w = lw[i] as number;
      const atEnd = (k: number): Omit<LaidLabel, 'y'> => {
        const x = Math.max(0, down4(width - (lw[k] as number)));
        return label(k, x, t, x > 0, true);
      };
      if (i + 1 < row.length && up4(w) + APART + (lw[i + 1] as number) <= width) {
        out.push(label(i, 0, t, false, false), atEnd(i + 1));
        i += 2;
      } else {
        out.push(n.x + n.w / 2 > width / 2 ? atEnd(i) : label(i, 0, t, false, true));
        i += 1;
      }
    }
    return out;
  }
  // each word's room on the grid: 8 of its bar under its box at least, inside the column
  const hi = row.map((n, i) =>
    Math.max(0, down4(Math.min(n.x + n.w - Math.min(8, n.w / 2), width - (lw[i] as number)))),
  );
  const lo = row.map((n, i) =>
    Math.min(up4(Math.max(0, n.x + Math.min(8, n.w / 2) - (lw[i] as number))), hi[i] as number),
  );
  for (let i = 0, t = 0; i < row.length; t++) {
    // the longest run that fits its rooms, each word placed leftmost
    const left = [lo[i] as number];
    let j = i + 1;
    for (; j < row.length; j++) {
      const x = Math.max(
        lo[j] as number,
        (left.at(-1) as number) + up4(lw[j - 1] as number) + APART,
      );
      if (x > (hi[j] as number)) break;
      left.push(x);
    }
    // each at its bar's start, pushed right by the one before it and pulled left by what follows it on its tier
    // (what a word and those after it take: each box on the grid and 16 after the one before) ...
    const placed: number[] = [];
    let rest = lw[j - 1] as number;
    for (let k = i; k < j - 1; k++) rest += up4(lw[k] as number) + APART;
    for (let k = i, cursor = 0; k < j; k++) {
      const x = Math.max(cursor, Math.min(down4((row[k] as LaidNode).x), down4(width - rest)));
      placed.push(x);
      cursor = x + up4(lw[k] as number) + APART;
      rest -= up4(lw[k] as number) + APART;
    }
    // ... a tier that fits its rooms so stands so; else its words settle from the right, each as near its bar's start
    // as the next one lets it, never left of where the run fits
    const fits = placed.every((x, k) => x >= (lo[i + k] as number) && x <= (hi[i + k] as number));
    let next = Infinity;
    for (let k = j - 1; k >= i; k--) {
      const n = row[k] as LaidNode;
      const w = lw[k] as number;
      const lean = down4(n.x);
      const x = Math.max(
        left[k - i] as number,
        Math.min(fits ? (placed[k - i] as number) : lean, hi[k] as number, next - APART - up4(w)),
      );
      const last = k === j - 1;
      out[k] = label(k, x, t, w < width && x < lean && (last || x + w <= n.x + n.w), last);
      next = x;
    }
    i = j;
  }
  return out;
}

const tiersOf = (labels: readonly Omit<LaidLabel, 'y'>[]): number =>
  labels.length ? 1 + Math.max(...labels.map((l) => l.tier)) : 0;

const f = (n: number): string => n.toFixed(1);

/** A ribbon from a band of `w0` at (x0, y0) down to a band of `w1` at (x1, y1): two cubics and their ends. */
export function ribbonPath(
  x0: number,
  w0: number,
  y0: number,
  x1: number,
  w1: number,
  y1: number,
): string {
  const my = (y0 + y1) / 2;
  return `M${f(x0)},${y0} C${f(x0)},${my} ${f(x1)},${my} ${f(x1)},${y1} L${f(x1 + w1)},${y1} C${f(x1 + w1)},${my} ${f(x0 + w0)},${my} ${f(x0 + w0)},${y0} Z`;
}

/**
 * Where each link leaves its source and meets its target: a source's links in the order of their targets, a
 * target's in the order of their sources (so no two cross unless the rows' order forces it). A node whose links
 * add up to more than its bar (meters that disagree by a rounding) squeezes them into it.
 */
function attach(
  links: readonly FlowLink[],
  top: readonly LaidNode[],
  mid: readonly LaidNode[],
  scale: number,
): { link: FlowLink; x0: number; w0: number; x1: number; w1: number }[] {
  const at = (row: readonly LaidNode[], key: string): number => row.findIndex((n) => n.key === key);
  const squeeze = (node: LaidNode, own: readonly FlowLink[]): number => {
    const total = own.reduce((s, l) => s + l.value * scale, 0);
    return total > node.w && total > 0 ? node.w / total : 1;
  };
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  const drawn = links.filter((l) => at(top, l.from) >= 0 && at(mid, l.to) >= 0);
  const leaving = [...drawn].sort(
    (p, q) => at(top, p.from) - at(top, q.from) || at(mid, p.to) - at(mid, q.to),
  );
  const offsets = new Map<FlowLink, { x0: number; w0: number }>();
  for (const l of leaving) {
    const node = top[at(top, l.from)] as LaidNode;
    const k = squeeze(
      node,
      drawn.filter((o) => o.from === l.from),
    );
    const w0 = l.value * scale * k;
    const x0 = node.x + (out.get(l.from) ?? 0);
    out.set(l.from, (out.get(l.from) ?? 0) + w0);
    offsets.set(l, { x0, w0 });
  }
  const arriving = [...drawn].sort(
    (p, q) => at(mid, p.to) - at(mid, q.to) || at(top, p.from) - at(top, q.from),
  );
  return arriving.map((l) => {
    const node = mid[at(mid, l.to)] as LaidNode;
    const k = squeeze(
      node,
      drawn.filter((o) => o.to === l.to),
    );
    const w1 = l.value * scale * k;
    const x1 = node.x + (into.get(l.to) ?? 0);
    into.set(l.to, (into.get(l.to) ?? 0) + w1);
    const from = offsets.get(l) as { x0: number; w0: number };
    return { link: l, ...from, x1, w1 };
  });
}

export function layoutSankey(
  model: SankeyModel,
  width: number,
  measure: (key: string) => number,
): SankeyLayout {
  const scale = scaleOf(model, width);
  const top = lay(model.sources, scale);
  const mid = lay(model.targets, scale);
  const house = mid.find((n) => n.key === 'house');
  const kidsWidth = sum(model.kids) * scale + rowSpan(model.kids.length);
  const kids =
    house && model.kids.length
      ? lay(model.kids, scale, Math.min(Math.max(0, house.x), Math.max(0, width - kidsWidth)))
      : [];

  const topWords = packLabels(top, measure, width);
  const midWords = packLabels(mid, measure, width);
  const kidWords = packLabels(kids, measure, width);
  const y0 = tiersOf(topWords) * TIER + WORDS_GAP;
  const y1 = y0 + BAR + RIBBONS;
  const midY = y1 + BAR + WORDS_GAP;
  const leave = midY + tiersOf(midWords) * TIER + LEAVE_GAP;
  const y2 = leave + RIBBONS;
  const kidY = y2 + BAR + WORDS_GAP;
  const height = kids.length ? kidY + tiersOf(kidWords) * TIER : midY + tiersOf(midWords) * TIER;

  const labels: LaidLabel[] = [
    ...topWords.map((l) => ({ ...l, y: y0 - WORDS_GAP - (l.tier + 1) * TIER })),
    ...midWords.map((l) => ({ ...l, y: midY + l.tier * TIER })),
    ...kidWords.map((l) => ({ ...l, y: kidY + l.tier * TIER })),
  ];

  const ribbons: Ribbon[] = attach(model.links, top, mid, scale).map((r) => ({
    key: `${r.link.from}-${r.link.to}`,
    d: ribbonPath(r.x0, r.w0, y0 + BAR, r.x1, r.w1, y1),
    ink: r.link.ink,
  }));
  let stem: SankeyLayout['stem'] = null;
  if (house && kids.length) {
    stem = { x: house.x, y: leave - STEM, w: house.w };
    // the devices leave the house's stem side by side; more than the house (meters that disagree) is squeezed in
    const k =
      kidsWidth - rowSpan(kids.length) > house.w ? house.w / (kidsWidth - rowSpan(kids.length)) : 1;
    let hx = house.x;
    for (const kid of kids) {
      ribbons.push({
        key: `house-${kid.key}`,
        d: ribbonPath(hx, kid.w * k, leave, kid.x, kid.w, y2),
        ink: 'home',
      });
      hx += kid.w * k;
    }
  }
  return { height, scale, y0, y1, y2, top, mid, kids, labels, ribbons, stem };
}
