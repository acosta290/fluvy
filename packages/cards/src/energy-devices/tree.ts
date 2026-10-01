/**
 * Where the house's energy goes, as a tree: a device may be part of another (the oven is part of the kitchen's
 * circuit, as Home Assistant's `included_in_stat` says), children under their parent. Each parent that reads more
 * than its children shows what they leave unmeasured, and the house's own meter — when there is one — what the
 * devices leave. Nothing is estimated: a rest is only said when every figure it depends on reads.
 */

export interface DeviceItem {
  readonly key: string;
  /** The sensor (or statistic) the row reads: what a child names as its `parent`. */
  readonly id: string;
  readonly parent?: string | undefined;
  /** In the card's base unit (W or Wh); `null` = unreadable. */
  readonly value: number | null;
}

export interface DeviceNode<T extends DeviceItem> {
  readonly item: T;
  readonly children: readonly DeviceNode<T>[];
  /** Its own reading less its children's: only when it has children, all of them read, and it is positive. */
  readonly rest: number | null;
}

export interface DeviceTree<T extends DeviceItem> {
  readonly roots: readonly DeviceNode<T>[];
  /** The house's meter less every top-level device, when positive and every one of them reads. */
  readonly rest: number | null;
  /** What the top-level devices account for of the house (0–1), when the house is known and every one reads. */
  readonly measured: number | null;
  /** The one scale every bar is drawn on: the house, else the largest top-level device. */
  readonly scale: number;
  /** The top-level devices' sum, when every one reads. */
  readonly sum: number | null;
}

/** Below one W (or Wh) a remainder is the rounding of the figures, not something unmeasured. */
const REST_MIN = 1;

const sumOf = (values: readonly (number | null)[]): number | null =>
  values.reduce<number | null>((acc, v) => (acc === null || v === null ? null : acc + v), 0);

/** Biggest first, the unreadable after them in their configured order (a stable sort). */
const bySize = <T extends DeviceItem>(a: DeviceNode<T>, b: DeviceNode<T>): number =>
  (b.item.value ?? -Infinity) - (a.item.value ?? -Infinity);

/**
 * The tree of `items`: a `parent` that names another item makes it a child; one that names nothing listed (or would
 * close a loop) leaves it at the top. `sort` orders every level biggest first; `limit` keeps that many top-level
 * devices (their children follow them). `total` is the house's meter in the same unit.
 */
export function deviceTree<T extends DeviceItem>(
  items: readonly T[],
  options: {
    readonly total?: number | null;
    readonly sort?: boolean;
    readonly limit?: number;
  } = {},
): DeviceTree<T> {
  const byId = new Map<string, T>();
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
  /** The parent an item hangs under: listed, not itself, and not one of its own descendants. */
  const parentOf = (item: T): T | undefined => {
    const parent = item.parent ? byId.get(item.parent) : undefined;
    if (!parent || parent === item) return undefined;
    const seen = new Set<T>([item]);
    for (let up: T | undefined = parent; up; up = up.parent ? byId.get(up.parent) : undefined) {
      if (seen.has(up)) return undefined; // a loop: the item stays at the top
      seen.add(up);
    }
    return parent;
  };
  const kids = new Map<T, T[]>();
  const top: T[] = [];
  for (const item of items) {
    const parent = parentOf(item);
    if (parent) kids.set(parent, [...(kids.get(parent) ?? []), item]);
    else top.push(item);
  }
  const sort = options.sort !== false;
  const node = (item: T): DeviceNode<T> => {
    const children = (kids.get(item) ?? []).map(node);
    if (sort) children.sort(bySize);
    const known = sumOf(children.map((c) => c.item.value));
    const rest =
      children.length && item.value !== null && known !== null && item.value - known >= REST_MIN
        ? item.value - known
        : null;
    return { item, children, rest };
  };
  const all = top.map(node);
  if (sort) all.sort(bySize);
  const limit = options.limit;
  const roots = typeof limit === 'number' && limit >= 1 ? all.slice(0, Math.round(limit)) : all;

  const total = options.total ?? null;
  const sum = sumOf(all.map((r) => r.item.value));
  const rest = total !== null && sum !== null && total - sum >= REST_MIN ? total - sum : null;
  const measured = total !== null && total > 0 && sum !== null ? Math.min(1, sum / total) : null;
  const largest = Math.max(0, ...all.map((r) => r.item.value ?? 0));
  const scale = total !== null && total > 0 ? Math.max(total, largest) : largest;
  return { roots, rest, measured, scale, sum };
}

/** A figure's share of the scale, for its bar (0–1). */
export const barOf = (value: number | null, scale: number): number =>
  value === null || !(scale > 0) ? 0 : Math.min(1, Math.max(0, value / scale));

/** A whole percent of `of` (0–100), or `null` when there is nothing to take a share of. */
export const percentOf = (value: number | null, of: number | null): number | null =>
  value === null || of === null || !(of > 0)
    ? null
    : Math.round(Math.min(1, Math.max(0, value / of)) * 100);
