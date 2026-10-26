// @vitest-environment happy-dom
import { resolveEntity, type HassEntity, type HomeAssistant } from '@fluvy/core';
import { render, type ReactiveController, type ReactiveControllerHost } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraFeed, GIVE_UP, STALL_MS, type FeedWant } from './feed.js';

/*
 * One camera's picture in a card: stills only while they are worth fetching, one request at a time, a stalled one
 * given up on, a camera that keeps failing said so, and the stream's session ended with its camera.
 */

const STAMP = '2026-10-22T09:00:00+00:00';
const camera = (entity_id: string, state = 'idle', picture: string | null = `/api/${entity_id}`) =>
  ({
    entity_id,
    state,
    attributes: { friendly_name: entity_id, ...(picture ? { entity_picture: picture } : {}) },
    last_changed: STAMP,
    last_updated: STAMP,
    context: { id: '', parent_id: null, user_id: null },
  }) as HassEntity;

/** The house, counting every still asked of it. */
function house(asked: string[], ...states: HassEntity[]): HomeAssistant {
  return {
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    hassUrl: (path: string) => {
      asked.push(path);
      return path;
    },
  } as unknown as HomeAssistant;
}

/**
 * A card as the feed sees it: an element in the page that takes controllers, draws the feed's picture when it updates
 * and holds what the feed is asked for (`want`); the viewport is the test's to drive.
 */
function card(want: Partial<FeedWant> & { entity?: string }, target?: () => Element | null) {
  const controllers: ReactiveController[] = [];
  const draw = (): void => {
    render(feed.render('cover', 16 / 9, 'x'), el);
  };
  const el = Object.assign(document.createElement('div'), {
    addController: (c: ReactiveController) => controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => undefined,
  }) as unknown as ReactiveControllerHost & HTMLElement;
  // an update completes with the picture drawn
  Object.defineProperty(el, 'updateComplete', {
    get: async () => {
      await Promise.resolve();
      draw();
      return true;
    },
  });
  document.body.append(el);
  const asks = { ...want };
  const feed = new CameraFeed(
    el,
    () => ({
      hass: asks.hass,
      view: asks.entity ? resolveEntity(asks.hass, asks.entity) : null,
      live: asks.live ?? false,
      refresh: asks.refresh ?? 10,
      native: asks.native ?? false,
      width: 320,
    }),
    target,
  );
  return {
    el,
    feed,
    asks,
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
    /** The card updates: the feed looks again, and its picture is drawn. */
    update: () => {
      controllers.forEach((c) => c.hostUpdate?.());
      draw();
      controllers.forEach((c) => c.hostUpdated?.());
    },
    /** The image asked for last answers: with a frame (of its size), or with an error. */
    answer: async (ok: boolean, size?: { width: number; height: number }) => {
      draw();
      const image = [...el.querySelectorAll('img')].find(
        (i) => i.src && !i.classList.contains('is-on'),
      );
      if (image && size)
        Object.defineProperties(image, {
          naturalWidth: { value: size.width },
          naturalHeight: { value: size.height },
        });
      image?.dispatchEvent(new Event(ok ? 'load' : 'error'));
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('a camera feed', () => {
  it('fetches stills only while on screen, in front, with a picture to fetch and no stream in their place', async () => {
    const asked: string[] = [];
    const c = card({ entity: 'camera.porch', hass: house(asked, camera('camera.porch')) });
    c.connect();
    c.update();
    // until the viewport's first word the picture is off screen: nothing is asked
    expect(asked).toHaveLength(0);
    c.feed.holder.report(true);
    expect(asked).toHaveLength(1);
    await c.answer(true);
    // a hidden tab: none
    const tab = (state: DocumentVisibilityState): void => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    tab('hidden');
    vi.advanceTimersByTime(30_000);
    expect(asked).toHaveLength(1);
    // in front again: one at once
    tab('visible');
    expect(asked).toHaveLength(2);
    await c.answer(true);
    // a camera out of reach, or one with no picture: none
    for (const state of [
      camera('camera.porch', 'unavailable'),
      camera('camera.porch', 'idle', null),
    ]) {
      c.asks.hass = house(asked, state);
      c.update();
      vi.advanceTimersByTime(30_000);
      expect(asked).toHaveLength(2);
    }
    // the stream playing in their place: none
    c.asks.hass = house(asked, camera('camera.porch'));
    c.asks.live = true;
    c.feed.holder.state = 'ready';
    c.update();
    expect(c.feed.streaming).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(asked).toHaveLength(2);
  });

  it('asks one still at a time, and gives up waiting on one after a while', async () => {
    const asked: string[] = [];
    const c = card({
      entity: 'camera.porch',
      refresh: 1,
      hass: house(asked, camera('camera.porch')),
    });
    c.connect();
    c.feed.holder.report(true);
    expect(asked).toHaveLength(1);
    // the camera is slow: the next ones wait for it
    vi.advanceTimersByTime(5_000);
    expect(asked).toHaveLength(1);
    // it answered: the next second asks again
    await c.answer(true);
    expect(c.feed.stamp).toBeGreaterThan(0);
    vi.advanceTimersByTime(1_000);
    expect(asked).toHaveLength(2);
    // it never answers: after the stall the next request goes all the same
    vi.advanceTimersByTime(STALL_MS - 1_000);
    expect(asked).toHaveLength(2);
    vi.advanceTimersByTime(1_000);
    expect(asked).toHaveLength(3);
  });

  it('keeps the last frame through a failure or two, and says it failed at the third', async () => {
    const asked: string[] = [];
    const c = card({
      entity: 'camera.porch',
      refresh: 1,
      hass: house(asked, camera('camera.porch')),
    });
    c.connect();
    c.feed.holder.report(true);
    await c.answer(true);
    for (let i = 1; i <= GIVE_UP; i++) {
      vi.advanceTimersByTime(1_000);
      await c.answer(false);
      expect({ stale: c.feed.stale, failed: c.feed.failed }).toEqual({
        stale: true,
        failed: i === GIVE_UP,
      });
    }
    // a frame again: fresh
    vi.advanceTimersByTime(1_000);
    await c.answer(true);
    expect({ stale: c.feed.stale, failed: c.feed.failed }).toEqual({ stale: false, failed: false });
    // no frame ever: failed at the first
    const other = card({ entity: 'camera.yard', hass: house(asked, camera('camera.yard')) });
    other.connect();
    other.feed.holder.report(true);
    await other.answer(false);
    expect(other.feed.failed).toBe(true);
  });

  it('stops off screen and when the card goes, the shown frame then stale', async () => {
    const asked: string[] = [];
    const c = card({
      entity: 'camera.porch',
      refresh: 1,
      hass: house(asked, camera('camera.porch')),
    });
    c.connect();
    c.feed.holder.report(true);
    await c.answer(true);
    c.feed.holder.report(false);
    expect(c.feed.stale).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(asked).toHaveLength(1);
    c.feed.holder.report(true);
    expect(asked).toHaveLength(2);
    c.disconnect();
    vi.advanceTimersByTime(10_000);
    expect(asked).toHaveLength(2);
  });

  it('marks the frame stale without a draw once the card has left the page, with one while it is on it', async () => {
    const asked: string[] = [];
    const c = card({
      entity: 'camera.porch',
      refresh: 1,
      hass: house(asked, camera('camera.porch')),
    });
    let draws = 0;
    c.el.requestUpdate = () => {
      draws += 1;
    };
    c.connect();
    c.feed.holder.report(true);
    await c.answer(true);
    const before = draws;
    // off screen on the page: the stale mark is drawn
    c.feed.holder.report(false);
    expect(c.feed.stale).toBe(true);
    expect(draws).toBe(before + 1);
    // back, a fresh frame, then the card leaves the page: the mark is set for its return, nothing is drawn
    c.feed.holder.report(true);
    await c.answer(true);
    expect(c.feed.stale).toBe(false);
    const shown = draws;
    c.el.remove();
    c.disconnect();
    expect(c.feed.stale).toBe(true);
    expect(draws).toBe(shown);
  });

  it('ends the stream’s session when the camera changes, or the card goes back to stills', () => {
    const c = card({
      entity: 'camera.porch',
      live: true,
      hass: house([], camera('camera.porch'), camera('camera.yard')),
    });
    c.connect();
    c.feed.holder.report(true);
    c.feed.holder.state = 'ready';
    c.update();
    const stream = c.el.querySelector('ha-camera-stream');
    expect(stream).not.toBeNull();
    // another update with the same camera: the same element, its session kept
    c.update();
    expect(c.el.querySelector('ha-camera-stream')).toBe(stream);
    // another camera: a new element (a new session), the old one gone for good
    c.asks.entity = 'camera.yard';
    c.update();
    expect(c.feed.holder.element).not.toBe(stream);
    expect(stream?.isConnected).toBe(false);
    // stills: the stream goes
    c.asks.live = false;
    c.update();
    expect(c.feed.holder.element).toBeUndefined();
    expect(c.el.querySelector('ha-camera-stream')).toBeNull();
  });

  it('counts the place on screen of its plate, not of the card, where it has one', () => {
    const watched: Element[] = [];
    class FakeObserver {
      observe(element: Element): void {
        watched.push(element);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      FakeObserver;
    let plate: Element | null = null;
    const c = card(
      { entity: 'camera.porch', hass: house([], camera('camera.porch')) },
      () => plate,
    );
    c.connect();
    expect(watched).toEqual([]);
    plate = c.el.appendChild(document.createElement('div'));
    c.update();
    expect(watched).toEqual([plate]);
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  it('lays a camera out in its own shape, remembered, and checks it against its first frame', async () => {
    const hass = house([], camera('camera.attic'));
    const first = card({ entity: 'camera.attic', native: true, hass }, () => first.el);
    first.connect();
    expect(first.feed.native).toBe(0); // not known yet: 16:9 until a frame says
    first.feed.holder.report(true);
    await first.answer(true, { width: 640, height: 480 });
    expect(first.feed.native).toBeCloseTo(4 / 3);
    // the next card for this camera is laid out in it before its first frame
    const next = card({ entity: 'camera.attic', native: true, hass }, () => next.el);
    next.connect();
    expect(next.feed.native).toBeCloseTo(4 / 3);
    // the camera turned upright: its first frame says so, and it is taken and remembered anew
    next.feed.holder.report(true);
    await next.answer(true, { width: 480, height: 640 });
    expect(next.feed.native).toBeCloseTo(3 / 4);
    expect(JSON.parse(localStorage.getItem('fluvy-camera-shape') ?? '{}')).toMatchObject({
      'camera.attic': 0.75,
    });
    // another shape asked for: none of its own
    next.asks.native = false;
    next.update();
    expect(next.feed.native).toBe(0);
  });
});
