import type { Card, DashboardEdit } from '../../strategy/types.js';

/*
 * A dashboard's `edit` as Customise changes it (#170): every change is laid over the edit that is there, entry by
 * entry and key by key, so nothing a person did earlier — or wrote by hand, or made for a room the house no longer
 * has — is lost; an entry left with nothing goes, and so does a table, until `edit` itself is gone and the dashboard
 * is the house's alone again. Pure: the panel keeps the result as the dashboard's pending edit.
 */

type Table = 'views' | 'cards' | 'entities';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const empty = (value: unknown): boolean =>
  value === undefined ||
  (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

/**
 * An edit with one entry's keys changed: a key given nothing (`undefined`, an empty list, an empty table) is taken
 * away, an entry left without keys goes, and a table left without entries too.
 */
export function patched(
  edit: DashboardEdit,
  table: Table,
  id: string,
  patch: Readonly<Record<string, unknown>>,
): DashboardEdit {
  const entry: Record<string, unknown> = { ...edit[table]?.[id], ...patch };
  for (const [key, value] of Object.entries(entry)) if (empty(value)) delete entry[key];
  const entries: Record<string, unknown> = { ...edit[table] };
  if (Object.keys(entry).length) entries[id] = entry;
  else delete entries[id];
  const next: Record<string, unknown> = { ...edit, [table]: entries };
  if (!Object.keys(entries).length) delete next[table];
  return next as DashboardEdit;
}

/** An edit as a dashboard's configuration keeps it: none at all once nothing is left of it. */
export const written = (edit: DashboardEdit): DashboardEdit | undefined =>
  Object.keys(edit).length ? edit : undefined;

/** The ids of an edit's entries that belong to a view (`home/…`), or to one part (`home/lights`, `home/lights:…`). */
const under = (id: string, prefix: string): boolean =>
  id === prefix || id.startsWith(`${prefix}/`) || id.startsWith(`${prefix}:`);

/** An edit without what a person changed on one part: its own entry, its list's, and its cards' own options. */
export function withoutPart(edit: DashboardEdit, id: string): DashboardEdit {
  let next = edit;
  for (const table of ['cards', 'entities'] as const)
    for (const key of Object.keys(edit[table] ?? {}))
      if (under(key, id)) next = patched(next, table, key, clearing(next[table]?.[key]));
  return next;
}

/** An edit without what a person changed on one view: its parts', and its own entry (its cards of their own too). */
export function withoutView(edit: DashboardEdit, view: string): DashboardEdit {
  let next = withoutPart(edit, view);
  next = patched(next, 'views', view, clearing(next.views?.[view]));
  return next;
}

/** A patch that takes every key of an entry away. */
const clearing = (entry: object | undefined): Record<string, undefined> =>
  Object.fromEntries(Object.keys(entry ?? {}).map((key) => [key, undefined]));

/**
 * An edit without one of a view's own cards (`own:<index>`): the cards after it are named one lower, so what a person
 * changed on each (its place) goes down with it.
 */
export function withoutOwn(edit: DashboardEdit, view: string, index: number): DashboardEdit {
  const cards = [...(edit.views?.[view]?.add ?? [])];
  cards.splice(index, 1);
  let next = patched(edit, 'views', view, { add: cards });
  const id = (at: number): string => `${view}/own:${at}`;
  for (let at = index; at <= cards.length; at++)
    next = patched(next, 'cards', id(at), {
      ...clearing(next.cards?.[id(at)]),
      ...next.cards?.[id(at + 1)],
    });
  return next;
}

/**
 * The fewest places that put `ids` (the house's order) in the order a person asked for: what already reads in the
 * house's order among them is left alone (the longest such run), and each of the others is pinned where it stands —
 * from the first in the list's first half, from the last (negative) in its second, so one put at an end stays there
 * when the house grows.
 */
export function pinsFor(
  ids: readonly string[],
  asked: readonly string[],
): ReadonlyMap<string, number> {
  const at = new Map(ids.map((id, index) => [id, index]));
  const ranks = asked.map((id) => at.get(id) ?? -1);
  // the longest run that rises: `best[i]` its length ending at i, `from[i]` the one before it
  const best = ranks.map(() => 1);
  const from = ranks.map(() => -1);
  let last = -1;
  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < i; j++)
      if (
        (ranks[j] as number) < (ranks[i] as number) &&
        (best[j] as number) + 1 > (best[i] as number)
      ) {
        best[i] = (best[j] as number) + 1;
        from[i] = j;
      }
    if (last < 0 || (best[i] as number) > (best[last] as number)) last = i;
  }
  const kept = new Set<number>();
  for (let i = last; i >= 0; i = from[i] as number) kept.add(i);
  const pins = new Map<string, number>();
  asked.forEach((id, index) => {
    if (!kept.has(index)) pins.set(id, index < asked.length / 2 ? index : index - asked.length);
  });
  return pins;
}

/**
 * `ids` with one put on a place among those a person sees (`seen`, in their order; `to`: its place among them):
 * where a row dropped there, a step, or a press of Top or Bottom leaves it. Gone up, it stands right before the one
 * it now leads; gone down, right after the one it now follows — past the hidden and the empty ones between, and no
 * others; on the first place or the last it leads or closes them all, so an end stays an end when the house grows.
 */
export function moved(
  ids: readonly string[],
  seen: readonly string[],
  id: string,
  to: number,
): string[] {
  const from = seen.indexOf(id);
  const others = seen.filter((other) => other !== id);
  const place = Math.max(0, Math.min(others.length, to));
  if (from < 0 || place === from) return [...ids];
  const next = ids.filter((other) => other !== id);
  const at =
    place === 0
      ? 0
      : place === others.length
        ? next.length
        : place < from
          ? next.indexOf(others[place] as string)
          : next.indexOf(others[place - 1] as string) + 1;
  next.splice(at, 0, id);
  return next;
}

/**
 * A list's `order` for the order a person asked for: the entities they put first, up to where the rest follows by
 * itself in the list's own order (`all`: the house's, then what they added).
 */
export function leading(all: readonly string[], asked: readonly string[]): string[] {
  for (let cut = 0; cut < asked.length; cut++) {
    const first = new Set(asked.slice(0, cut));
    if (
      same(
        asked.slice(cut),
        all.filter((id) => !first.has(id)),
      )
    )
      return asked.slice(0, cut);
  }
  return [...asked];
}

/**
 * What a person changed in a card's form, as its `options`: each key whose value is no longer the generated one, and a
 * `null` for one they took away; never its type, nor a key Customise edits itself (`omit`: the part's list).
 */
export function optionsOf(
  generated: Card,
  edited: Readonly<Record<string, unknown>>,
  omit: ReadonlySet<string> = new Set(),
): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(generated), ...Object.keys(edited)])) {
    if (key === 'type' || omit.has(key)) continue;
    if (!(key in edited) || edited[key] === undefined) options[key] = null;
    else if (!same(edited[key], generated[key])) options[key] = edited[key];
  }
  return Object.keys(options).length ? options : undefined;
}
