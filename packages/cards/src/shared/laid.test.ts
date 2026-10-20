// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaidWidth } from './laid.js';

type Callback = () => void;
const observers: { callback: Callback; observed: Element[]; disconnected: number }[] = [];
const original = globalThis.ResizeObserver;

class FakeResizeObserver {
  readonly record = {
    callback: (() => {}) as Callback,
    observed: [] as Element[],
    disconnected: 0,
  };
  constructor(callback: Callback) {
    this.record.callback = callback;
    observers.push(this.record);
  }
  observe(element: Element): void {
    this.record.observed.push(element);
  }
  disconnect(): void {
    this.record.observed = [];
    this.record.disconnected++;
  }
  unobserve(): void {}
}

const host = () => {
  const controllers: LaidWidth[] = [];
  return {
    controllers,
    requestUpdate: vi.fn(),
    addController: (c: LaidWidth) => controllers.push(c),
    removeController: () => {},
    updateComplete: Promise.resolve(true),
  };
};

describe('LaidWidth', () => {
  beforeEach(() => {
    observers.length = 0;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    globalThis.ResizeObserver = original;
  });

  it('draws the host again when the width it drew for is not the one it was laid out at', () => {
    const sheet = document.createElement('div');
    let width = 360; // the design's, before any layout
    const h = host();
    const laid = new LaidWidth(
      h,
      () => sheet,
      () => width,
    );
    laid.hostUpdate(); // the render reads 360
    laid.hostUpdated(); // the sheet exists: watched
    expect(observers[0]?.observed).toEqual([sheet]);
    width = 234; // laid out in a 266 column
    observers[0]!.callback();
    expect(h.requestUpdate).toHaveBeenCalledTimes(1);
    laid.hostUpdate(); // that render reads 234
    observers[0]!.callback(); // the sheet grew taller: its width is the one drawn for
    expect(h.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('asks nothing before the host has drawn, and watches a sheet drawn later', () => {
    const h = host();
    let sheet: HTMLElement | null = null;
    const laid = new LaidWidth(
      h,
      () => sheet,
      () => 360,
    );
    laid.hostUpdated(); // nothing to watch yet
    expect(observers).toHaveLength(0);
    sheet = document.createElement('div');
    laid.hostUpdate();
    laid.hostUpdated();
    expect(observers[0]?.observed).toEqual([sheet]);
    observers[0]!.callback(); // the same width
    expect(h.requestUpdate).not.toHaveBeenCalled();
  });

  it('watches the element a render replaced, and lets go when the host leaves', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    let sheet = first;
    const h = host();
    const laid = new LaidWidth(
      h,
      () => sheet,
      () => 328,
    );
    laid.hostUpdate();
    laid.hostUpdated();
    sheet = second;
    laid.hostUpdated();
    expect(observers[0]?.disconnected).toBe(1);
    expect(observers[0]?.observed).toEqual([second]);
    laid.hostDisconnected();
    expect(observers[0]?.observed).toEqual([]);
    expect(observers).toHaveLength(1); // one observer for the life of the host
  });

  it('is content without ResizeObserver (a test runtime)', () => {
    // @ts-expect-error — the runtime may lack it
    delete globalThis.ResizeObserver;
    const h = host();
    const laid = new LaidWidth(
      h,
      () => document.createElement('div'),
      () => 360,
    );
    laid.hostUpdate();
    expect(() => laid.hostUpdated()).not.toThrow();
    expect(h.requestUpdate).not.toHaveBeenCalled();
  });
});
