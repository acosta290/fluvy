// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { startLook } from '../look/start.js';

/*
 * What is built once from the house's settings (an automatic dashboard, with the house's order of its rooms: 1.21,
 * #189) waits for them: they are here at once where this browser kept a copy from an earlier visit, and with Home
 * Assistant's first answer on a first visit, where the factory's would have been read instead.
 */
const first = (settled: Promise<void>): Promise<string> =>
  Promise.race([
    settled.then(() => 'settled'),
    new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 50)),
  ]);

describe('the look says when the settings are the house’s own', () => {
  it('waits for Home Assistant on a first visit, and not where this browser kept a copy', async () => {
    localStorage.removeItem('fluvy:settings');
    const fresh = startLook()!;
    // no Home Assistant on this page yet: nothing has answered
    expect(await first(fresh.settled())).toBe('waiting');
    fresh.stop();

    localStorage.setItem(
      'fluvy:settings',
      JSON.stringify({ house: { rooms: { sort: 'name', order: [] } }, personal: {} }),
    );
    const kept = startLook()!;
    expect(await first(kept.settled())).toBe('settled');
    expect(kept.settings().rooms.sort).toBe('name');
    kept.stop();
  });
});
