import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import {
  CollectionFollower,
  collectionKeyOf,
  findCollection,
  followedMoment,
  followPeriod,
  isCollectionKey,
  type EnergyCollectionLike,
  type EnergyDataLike,
} from './collection.js';

const data = (start: string, end: string): EnergyDataLike => ({
  start: new Date(start),
  end: new Date(end),
  prefs: {},
  stats: {},
});

/** A collection as Home Assistant keeps one, counting who holds it. */
function collection(state?: EnergyDataLike) {
  const subscribers = new Set<(data: EnergyDataLike) => void>();
  const c = {
    start: new Date('2026-09-17T00:00:00'),
    end: new Date('2026-09-17T23:59:59.999'),
    compare: '' as const,
    state,
    subscribed: 0,
    unsubscribed: 0,
    subscribe(subscriber: (data: EnergyDataLike) => void) {
      c.subscribed++;
      subscribers.add(subscriber);
      return () => {
        c.unsubscribed++;
        subscribers.delete(subscriber);
      };
    },
    setPeriod(start: Date, end?: Date) {
      c.start = start;
      c.end = end ?? c.end;
    },
    setCompare() {},
    refresh() {
      for (const subscriber of subscribers) if (c.state) subscriber(c.state);
    },
  } satisfies EnergyCollectionLike & Record<string, unknown>;
  return c;
}

const hassWith = (collections: Record<string, unknown>): HomeAssistant =>
  ({
    connection: { subscribeMessage: async () => () => undefined, ...collections },
  }) as unknown as HomeAssistant;

const host = () => ({
  addController: vi.fn(),
  removeController: vi.fn(),
  requestUpdate: vi.fn(),
  updateComplete: Promise.resolve(true),
});

describe('a collection key', () => {
  it('starts with energy_, as Home Assistant requires; empty is none; another word is a readable error', () => {
    expect(isCollectionKey('energy_dashboard')).toBe(true);
    expect(isCollectionKey('dashboard')).toBe(false);
    expect(collectionKeyOf({}, 'fluvy-x-card')).toBeUndefined();
    expect(collectionKeyOf({ collection_key: '' }, 'fluvy-x-card')).toBeUndefined();
    expect(collectionKeyOf({ collection_key: 'energy_pg' }, 'fluvy-x-card')).toBe('energy_pg');
    expect(() => collectionKeyOf({ collection_key: 'pg' }, 'fluvy-x-card')).toThrow(
      /fluvy-x-card: "collection_key" must start with "energy_"/,
    );
  });

  it('is found on the connection under an underscore', () => {
    const c = collection();
    expect(findCollection(hassWith({ _energy_pg: c }), 'energy_pg')).toBe(c);
    expect(findCollection(hassWith({}), 'energy_pg')).toBeUndefined();
  });
});

describe('CollectionFollower', () => {
  it('looks on every hass until the collection is there, subscribes once, and lets go on detach', () => {
    const h = host();
    const follower = new CollectionFollower(h);
    const c = collection(data('2026-09-17T00:00:00', '2026-09-17T23:59:59.999'));
    follower.attach(hassWith({}), 'energy_pg');
    follower.attach(hassWith({}), 'energy_pg');
    expect(c.subscribed).toBe(0);
    expect(follower.following).toBe(true);
    expect(follower.range()).toBeUndefined();
    follower.attach(hassWith({ _energy_pg: c }), 'energy_pg');
    follower.attach(hassWith({ _energy_pg: c }), 'energy_pg');
    expect(c.subscribed).toBe(1);
    expect(follower.range()?.start.toISOString()).toBe(
      new Date('2026-09-17T00:00:00').toISOString(),
    );
    expect(follower.data()).toBe(c.state);
    follower.detach();
    expect(c.unsubscribed).toBe(1);
    expect(follower.range()).toBeUndefined();
    // off the page, the collection is let go as well
    follower.attach(hassWith({ _energy_pg: c }), 'energy_pg');
    follower.hostDisconnected();
    expect(c.unsubscribed).toBe(2);
  });

  it('hands the picker’s range until its data arrives, then the data’s, and asks the host to draw', () => {
    const h = host();
    const follower = new CollectionFollower(h);
    const c = collection();
    follower.attach(hassWith({ _energy_pg: c }), 'energy_pg');
    expect(follower.range()?.end?.toISOString()).toBe(c.end.toISOString());
    c.state = data('2026-09-10T00:00:00', '2026-09-16T23:59:59.999');
    c.refresh();
    expect(h.requestUpdate).toHaveBeenCalled();
    expect(follower.range()?.start.toISOString()).toBe(c.state.start.toISOString());
  });

  it('another key lets the first collection go; no key at all detaches', () => {
    const follower = new CollectionFollower(host());
    const a = collection();
    const b = collection();
    follower.attach(hassWith({ _energy_a: a, _energy_b: b }), 'energy_a');
    follower.attach(hassWith({ _energy_a: a, _energy_b: b }), 'energy_b');
    expect(a.unsubscribed).toBe(1);
    expect(b.subscribed).toBe(1);
    follower.attach(hassWith({ _energy_a: a, _energy_b: b }), undefined);
    expect(b.unsubscribed).toBe(1);
    expect(follower.following).toBe(false);
  });
});

describe('what a follower draws', () => {
  it('a period card’s span is the range’s grain, else its own', () => {
    const follower = new CollectionFollower(host());
    expect(followPeriod(follower, 'week')).toBe('week');
    const c = collection(data('2026-09-01T00:00:00', '2026-09-30T23:59:59.999'));
    follower.attach(hassWith({ _energy_pg: c }), 'energy_pg');
    expect(followPeriod(follower, 'day')).toBe('month');
    c.state = data('2026-09-14T00:00:00', '2026-09-20T23:59:59.999');
    expect(followPeriod(follower, 'day')).toBe('week');
    c.state = data('2026-09-17T00:00:00', '2026-09-17T23:59:59.999');
    expect(followPeriod(follower, 'month')).toBe('day');
  });

  it('a day card reads a range at now while it holds now, else at the end of its last day', () => {
    const now = new Date('2026-09-17T21:47:12');
    const today = {
      start: new Date('2026-09-17T00:00:00'),
      end: new Date('2026-09-17T23:59:59.999'),
    };
    expect(followedMoment(today, now)).toBe(now);
    const lastWeek = {
      start: new Date('2026-09-07T00:00:00'),
      end: new Date('2026-09-13T23:59:59.999'),
    };
    expect(followedMoment(lastWeek, now)).toBe(lastWeek.end);
  });
});
