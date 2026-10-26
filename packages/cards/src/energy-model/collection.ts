import type { HomeAssistant } from '@fluvy/core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { EnergyInfo } from './costs.js';
import { fullDays, type Period, type Range, type StatRow } from './period.js';
import type { EnergyPrefs } from './prefs.js';

/**
 * An Energy date picker's collection — Home Assistant's `energy-date-selection` card's, or Fluvy's Energy period
 * card's — lives on the connection as `_<key>`, and a card given the key follows it: its range, and the figures Home
 * Assistant fetched for that range (one set of statistics for the whole view), so a Fluvy card and Home Assistant's
 * beside it say the same numbers and move together. The picker's card may land after ours: a follower looks for the
 * collection on every `hass` until it is there, then subscribes once and lets go when it leaves the page.
 */

export const COLLECTION_PREFIX = 'energy_';

/** Home Assistant's rule: a collection key starts with `energy_` (its own dashboard's is `energy_dashboard`). */
export const isCollectionKey = (key: unknown): key is string =>
  typeof key === 'string' && key.startsWith(COLLECTION_PREFIX);

/** A card's `collection_key`: the key, or none (absent or empty); any other word is a readable error, as HA's cards throw. */
export function collectionKeyOf(
  config: { readonly collection_key?: unknown },
  tag: string,
): string | undefined {
  const key = config.collection_key;
  if (key === undefined || key === null || key === '') return undefined;
  if (!isCollectionKey(key))
    throw new Error(
      `${tag}: "collection_key" must start with "${COLLECTION_PREFIX}" (it is "${String(key)}")`,
    );
  return key;
}

/** A statistics row as the collection carries it: a meter's change, a power sensor's mean, over `start` → `end`. */
export interface CollectionRow extends StatRow {
  readonly end?: number;
  readonly mean?: number | null;
}

export type Statistics = Readonly<Record<string, readonly CollectionRow[]>>;

/** What the collection hands its subscribers: Home Assistant's `EnergyData`, the part the cards read. */
export interface EnergyDataLike {
  readonly start: Date;
  readonly end?: Date;
  readonly startCompare?: Date;
  readonly endCompare?: Date;
  readonly prefs: EnergyPrefs;
  readonly info?: EnergyInfo;
  /** Every statistic the Energy dashboard references, over the range: energy as `change` in kWh, power as `mean` in kW. */
  readonly stats: Statistics;
  readonly statsCompare?: Statistics;
  readonly co2SignalEntity?: string;
  readonly fossilEnergyConsumption?: Readonly<Record<string, number>> | null;
}

/** What a picker compares the range with: nothing, the period before it, the same one a year ago. */
export type CompareMode = '' | 'previous' | 'yoy';

/** The collection as Home Assistant's `getEnergyDataCollection` makes it, the part a follower (or a picker) uses. */
export interface EnergyCollectionLike {
  start: Date;
  end?: Date | undefined;
  compare?: CompareMode | undefined;
  readonly state?: EnergyDataLike | undefined;
  subscribe(subscriber: (data: EnergyDataLike) => void): () => void;
  setPeriod(start: Date, end?: Date): void;
  setCompare(compare: CompareMode): void;
  refresh(): unknown;
}

export const findCollection = (
  hass: HomeAssistant,
  key: string,
): EnergyCollectionLike | undefined =>
  (hass.connection as unknown as Record<string, EnergyCollectionLike | undefined>)[`_${key}`];

export interface FollowedRange extends Range {
  readonly compare?: CompareMode | undefined;
  readonly startCompare?: Date | undefined;
  readonly endCompare?: Date | undefined;
}

/**
 * A card's hold on a collection. `attach(hass, key)` from the host's `willUpdate` with every `hass`: nothing until the
 * collection exists, one subscription once it does, let go on `detach()` (and when the host leaves the page: the
 * collection's `_active` count drops, so Home Assistant stops refreshing for nobody).
 */
export class CollectionFollower implements ReactiveController {
  private key: string | undefined;
  private collection: EnergyCollectionLike | undefined;
  private unsubscribe: (() => void) | undefined;
  private latest: EnergyDataLike | undefined;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  attach(hass: HomeAssistant | undefined, key: string | undefined): void {
    if (key !== this.key) {
      this.detach();
      this.key = key;
    }
    if (!key || this.collection || !hass) return;
    const collection = findCollection(hass, key);
    if (!collection) return;
    this.collection = collection;
    this.unsubscribe = collection.subscribe((data) => {
      this.latest = data;
      this.host.requestUpdate();
    });
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.collection = undefined;
    this.latest = undefined;
  }

  /** Put back on the page, the host attaches again on its next update. */
  hostConnected(): void {
    if (this.key) this.host.requestUpdate();
  }

  hostDisconnected(): void {
    this.detach();
  }

  /** A key is set: the card hides its own chips and waits for the picker, drawing today meanwhile. */
  get following(): boolean {
    return this.key !== undefined;
  }

  /** The range once the collection is found: the data's (what the figures are of), else what the picker holds now. */
  range(): FollowedRange | undefined {
    const c = this.collection;
    if (!c) return undefined;
    const data = this.data();
    return data
      ? {
          start: data.start,
          end: data.end,
          compare: c.compare,
          startCompare: data.startCompare,
          endCompare: data.endCompare,
        }
      : { start: c.start, end: c.end, compare: c.compare };
  }

  data(): EnergyDataLike | undefined {
    return this.latest ?? this.collection?.state;
  }
}

/** A period card's span: the followed range's grain (its own chips are gone), else its own period. */
export function followPeriod(follower: CollectionFollower, own: Period): Period {
  const range = follower.range();
  if (!range) return own;
  const days = fullDays(range.start, range.end ?? new Date());
  return days < 1 ? 'day' : days < 7 ? 'week' : 'month';
}

/** The moment a day card reads a followed range at: now while the range holds it, else the end of its last day. */
export const followedMoment = (range: Range, now: Date): Date =>
  range.end && range.end.getTime() < now.getTime() ? range.end : now;
