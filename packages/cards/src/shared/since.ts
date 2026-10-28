import type { EntityView, HomeAssistant } from '@fluvy/core';

/**
 * The real last change (#67): a row may say where its last change is read from (`since`) — an entity whose state is a
 * timestamp (ISO, or an epoch in seconds or milliseconds; a helper that keeps the change a restart or a reload loses),
 * or `attribute:<name>` of the row's own entity — and a card may name it for every row at once (`since_pattern`:
 * `sensor.{id}_real_last_changed`, `{id}` the row's object id, `{entity}` its whole id). What does not read — empty,
 * unknown, unavailable, not a moment — falls back to Home Assistant's own `last_changed`.
 */
export interface Since {
  readonly entity?: string;
  readonly since?: string;
}

const ATTRIBUTE = 'attribute:';

/** A row's `since`: its own, else the card's pattern filled in for it; none where neither says. */
export const sinceOf = (item: Since, pattern?: string): string | undefined =>
  item.since ||
  (pattern && item.entity
    ? pattern
        .replace('{id}', item.entity.slice(item.entity.indexOf('.') + 1))
        .replace('{entity}', item.entity)
    : undefined);

/** The moment a timestamp says, read as ISO or as an epoch (seconds under 1e11, milliseconds over); null for none. */
const moment = (raw: unknown): Date | null => {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? /^\d+(\.\d+)?$/.test(raw)
          ? Number(raw)
          : Date.parse(raw)
        : Number.NaN;
  return Number.isFinite(n) ? new Date(n < 1e11 ? n * 1000 : n) : null;
};

/**
 * When the entity last changed: as its `since` says where that reads, else as Home Assistant has it; null for an
 * entity the house has not got.
 */
export function changedAt(
  hass: HomeAssistant | undefined,
  view: EntityView,
  since?: string,
): Date | null {
  if (!view.stateObj) return null;
  const raw = !since
    ? undefined
    : since.startsWith(ATTRIBUTE)
      ? view.attr<unknown>(since.slice(ATTRIBUTE.length))
      : hass?.states[since]?.state;
  return moment(raw) ?? new Date(view.stateObj.last_changed);
}

/** The entities the rows' `since` read, for a card's `watched()`: a change there draws the card again. */
export const sinceIds = (items: readonly Since[], pattern?: string): string[] =>
  items.flatMap((item) => {
    const since = sinceOf(item, pattern);
    return since && !since.startsWith(ATTRIBUTE) ? [since] : [];
  });
