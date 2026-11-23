import { resolveEntity, type HomeAssistant } from '@fluvy/core';
export { dayRange, sameRange, shiftRange, type ActivityRange } from '../shared/range.js';
import { DAY, type ActivityRange } from '../shared/range.js';
import {
  ACTIVITY_CATEGORIES,
  categoryOf,
  density,
  isQuiet,
  toRows,
  toSections,
  withPrevious,
  type ActivityCategory,
  type ActivityEvent,
  type ActivityFilter,
  type ActivitySection,
  type ActivityWho,
} from '@fluvy/core/activity';

/** What each entry is, worked out once per entry (a day holds thousands, and every keystroke filters them). */
interface Meta {
  readonly category: ActivityCategory;
  readonly quiet: boolean;
  readonly text: string;
  /** Who did it, while the house shows who (`activityWho`). */
  readonly who: ActivityWho | undefined;
}

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export class ActivityIndex {
  private readonly meta = new WeakMap<ActivityEvent, Meta>();

  /**
   * `who` names who did each entry while the house shows who (none: nobody is named, nor found); the search finds
   * them by their name, and the one reading by `you` too.
   */
  constructor(
    private readonly hass: () => HomeAssistant,
    private readonly who?: (event: ActivityEvent) => ActivityWho | undefined,
    private readonly you = '',
  ) {}

  of(event: ActivityEvent): Meta {
    let meta = this.meta.get(event);
    if (!meta) {
      const hass = this.hass();
      const view = event.entity_id ? resolveEntity(hass, event.entity_id) : undefined;
      const who = this.who?.(event);
      meta = {
        category: categoryOf(event, hass),
        quiet: isQuiet(event, hass),
        text: fold(
          [
            event.name,
            view?.name,
            view?.areaName,
            event.entity_id,
            event.message,
            who?.name,
            who?.you ? this.you : '',
          ]
            .filter(Boolean)
            .join(' '),
        ),
        who,
      };
      this.meta.set(event, meta);
    }
    return meta;
  }
}

const HOUR = 3_600_000;

/** The histogram's stretch: a quarter hour over a day, an hour up to three days, three hours beyond. */
export const bucketOf = (range: ActivityRange): number => {
  const span = range.end - range.start;
  return span > 3 * DAY ? 3 * HOUR : span > 36 * HOUR ? HOUR : HOUR / 4;
};

export interface ActivityModel {
  /** Every entry of the period (the day's summary). */
  readonly total: number;
  /** How many entries each filter would show (of what the search and the person chosen find, while narrowed). */
  readonly counts: Readonly<Record<ActivityFilter, number>>;
  /** The filters worth offering: the two views, then the categories that have anything (before the search). */
  readonly filters: readonly ActivityFilter[];
  /** What the list shows, newest first. */
  readonly shown: readonly ActivityEvent[];
  readonly sections: readonly ActivitySection[];
  /** Entries per stretch of the range, oldest first (the rail's histogram): a quarter hour, an hour or three over longer periods. */
  readonly density: readonly number[];
  readonly automations: number;
  readonly restarts: number;
  /** Who did anything in the period, the busiest first (the "By person" filter's list). */
  readonly people: readonly ActivityWho[];
}

export function buildModel(
  events: readonly ActivityEvent[],
  index: ActivityIndex,
  filter: ActivityFilter,
  search: string,
  range: ActivityRange,
  /** Only what this user did ('' everyone): narrows as the search does. */
  person = '',
): ActivityModel {
  const query = fold(search.trim());
  const finds = (meta: Meta): boolean =>
    (!query || meta.text.includes(query)) && (!person || meta.who?.userId === person);
  const empty = (): Record<ActivityFilter, number> => {
    const zero = { highlights: 0, all: 0 } as Record<ActivityFilter, number>;
    for (const category of ACTIVITY_CATEGORIES) zero[category] = 0;
    return zero;
  };
  // the day's counts pick the filters; what the search and the person chosen find are what they show meanwhile
  const narrowed = query !== '' || person !== '';
  const day = empty();
  const found = narrowed ? empty() : day;
  let automations = 0;
  let restarts = 0;
  /** Who did anything, and how often. */
  const busy = new Map<string, { who: ActivityWho; n: number }>();
  for (const event of events) {
    const meta = index.of(event);
    if (meta.who) {
      const seen = busy.get(meta.who.userId);
      busy.set(meta.who.userId, { who: meta.who, n: (seen?.n ?? 0) + 1 });
    }
    for (const counts of narrowed && finds(meta) ? [day, found] : [day]) {
      counts.all += 1;
      counts[meta.category] += 1;
      if (!meta.quiet) counts.highlights += 1;
    }
    if (meta.category === 'automations' && event.state === undefined) automations += 1;
    if ((event.domain ?? '') === 'homeassistant' && /start/i.test(event.message ?? ''))
      restarts += 1;
  }
  const shown = events.filter((event) => {
    const meta = index.of(event);
    const kept =
      filter === 'all' ? true : filter === 'highlights' ? !meta.quiet : meta.category === filter;
    return kept && finds(meta);
  });
  // the previous state of a change comes from the whole range, not only from what the filter keeps
  const previous = new Map(withPrevious(events).map((item) => [item.event, item]));
  const items = shown.map((event) => previous.get(event)!);
  return {
    total: events.length,
    counts: found,
    filters: ['highlights', 'all', ...ACTIVITY_CATEGORIES.filter((category) => day[category] > 0)],
    shown,
    sections: toSections(toRows(items)),
    density: density(shown, range.start, range.end, bucketOf(range)),
    automations,
    restarts,
    people: [...busy.values()].sort((a, b) => b.n - a.n).map(({ who }) => who),
  };
}
